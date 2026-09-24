// API : Admissions Secrétariat (file d'attente + validation)
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { hasRole } from '@/lib/rbac'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (!hasRole(user, ['SECRETARY', 'DIRECTION', 'ADMIN', 'DIRECTOR', 'SCHOOL_ADMIN', 'SYSTEM_ADMIN', 'ADMISSIONS_OFFICER'])) {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
    }

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const preRegs = await db.preRegistration.findMany({
      where: { schoolId, status: { in: ['SOUMIS', 'INCOMPLET', 'EN_ETUDE', 'TRANSFERE_DIRECTION'] } },
      orderBy: { submittedAt: 'asc' },
    })

    return NextResponse.json({
      ok: true,
      admissions: preRegs.map((p) => ({
        id: p.id,
        referenceNumber: p.referenceNumber,
        parentName: `${p.parentFirstName} ${p.parentLastName}`,
        parentPhone: p.parentPhone,
        parentEmail: p.parentEmail,
        parentRelationship: p.parentRelationship,
        childName: `${p.childFirstName} ${p.childLastName}`,
        childBirthDate: p.childBirthDate?.toISOString() || null,
        childGender: p.childGender,
        desiredLevel: p.desiredLevel,
        status: p.status,
        submittedAt: p.submittedAt?.toISOString() || null,
      })),
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (!hasRole(user, ['SECRETARY', 'DIRECTION', 'ADMIN', 'DIRECTOR', 'SCHOOL_ADMIN', 'SYSTEM_ADMIN', 'ADMISSIONS_OFFICER'])) {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
    }

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const body = await req.json()
    const { action, preRegistrationId, reason, classroomId, academicYearId } = body
    const h = await headers()
    const ip = getClientIP(h)

    if (action === 'accept') {
      // Accepter : créer l'élève + lier le parent + activer PARENT_VERIFIE
      const preReg = await db.preRegistration.findUnique({
        where: { id: preRegistrationId },
        include: { user: true },
      })
      if (!preReg) return NextResponse.json({ ok: false, error: 'Dossier introuvable.' }, { status: 404 })

      const result = await db.$transaction(async (tx) => {
        // 1. Créer l'élève
        const matricule = `${new Date().getFullYear().toString().slice(-2)}${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`
        const student = await tx.student.create({
          data: {
            schoolId,
            matricule,
            firstName: preReg.childFirstName,
            lastName: preReg.childLastName,
            birthDate: preReg.childBirthDate,
            gender: preReg.childGender,
            status: 'ACTIVE',
          },
        })

        // 2. Inscrire dans la classe si fournie
        if (classroomId) {
          const yearId = academicYearId || (await tx.academicYear.findFirst({ where: { schoolId, active: true } }))?.id
          if (yearId) {
            await tx.enrollment.create({
              data: { studentId: student.id, classroomId, academicYearId: yearId, status: 'ACTIVE' },
            })
          }
        }

        // 3. Lier le parent à l'élève
        const guardian = await tx.guardian.findFirst({ where: { userId: preReg.userId } })
        if (guardian) {
          await tx.guardianStudentLink.create({
            data: {
              guardianId: guardian.id,
              studentId: student.id,
              relationship: preReg.parentRelationship,
              isPrimary: true,
            },
          })
        }

        // 4. Activer PARENT_VERIFIE
        await tx.user.update({
          where: { id: preReg.userId },
          data: { accountStatus: 'PARENT_VERIFIE' },
        })

        // 5. Mettre à jour le dossier
        await tx.preRegistration.update({
          where: { id: preRegistrationId },
          data: {
            status: 'ACCEPTE',
            reviewedById: user.id,
            reviewedByName: user.displayName,
            reviewedAt: new Date(),
            decisionReason: reason || 'Admission acceptée',
            studentId: student.id,
          },
        })

        // 6. Historique
        await tx.preRegistrationHistory.create({
          data: {
            preRegistrationId,
            action: 'ACCEPTED',
            performedById: user.id,
            performedByName: user.displayName,
            notes: `Élève créé : ${student.matricule}. Parent activé : PARENT_VERIFIE.`,
            previousStatus: preReg.status,
            newStatus: 'ACCEPTE',
          },
        })

        // 7. Notifier le parent
        await tx.notification.create({
          data: {
            userId: preReg.userId,
            type: 'ADMISSION_ACCEPTED',
            title: '✅ Admission acceptée !',
            message: `L'admission de ${preReg.childFirstName} ${preReg.childLastName} est acceptée. Matricule : ${student.matricule}. Votre portail parent est maintenant activé.`,
            read: false,
          },
        })

        return { studentId: student.id, matricule: student.matricule }
      })

      await logAudit({
        userId: user.id, userName: user.displayName, userRole: user.role, schoolId,
        action: 'APPROVE', entityType: 'OTHER', entityId: preRegistrationId,
        description: `Préinscription acceptée → élève ${result.matricule} créé, parent activé`,
        ipAddress: ip,
      })

      return NextResponse.json({
        ok: true,
        message: `Admission acceptée. Élève créé avec le matricule ${result.matricule}. Parent activé.`,
        matricule: result.matricule,
      })
    }

    if (action === 'refuse') {
      const preReg = await db.preRegistration.findUnique({ where: { id: preRegistrationId } })
      if (!preReg) return NextResponse.json({ ok: false, error: 'Dossier introuvable.' }, { status: 404 })

      await db.preRegistration.update({
        where: { id: preRegistrationId },
        data: {
          status: 'REFUSE',
          reviewedById: user.id,
          reviewedByName: user.displayName,
          reviewedAt: new Date(),
          decisionReason: reason || 'Demande refusée',
        },
      })

      await db.preRegistrationHistory.create({
        data: {
          preRegistrationId,
          action: 'REFUSED',
          performedById: user.id,
          performedByName: user.displayName,
          notes: reason || 'Refusé',
          previousStatus: preReg.status,
          newStatus: 'REFUSE',
        },
      })

      await db.notification.create({
        data: {
          userId: preReg.userId,
          type: 'ADMISSION_REFUSED',
          title: '❌ Demande refusée',
          message: `La demande d'admission de ${preReg.childFirstName} ${preReg.childLastName} a été refusée. Motif : ${reason || 'Non précisé'}. Contactez le secrétariat pour plus d'informations.`,
          read: false,
        },
      })

      return NextResponse.json({ ok: true, message: 'Demande refusée. Parent notifié.' })
    }

    if (action === 'incomplete') {
      const preReg = await db.preRegistration.findUnique({ where: { id: preRegistrationId } })
      if (!preReg) return NextResponse.json({ ok: false, error: 'Dossier introuvable.' }, { status: 404 })

      await db.preRegistration.update({
        where: { id: preRegistrationId },
        data: { status: 'INCOMPLET', decisionReason: reason || 'Documents manquants' },
      })

      await db.preRegistrationHistory.create({
        data: {
          preRegistrationId,
          action: 'MARKED_INCOMPLETE',
          performedById: user.id,
          performedByName: user.displayName,
          notes: reason || 'Dossier incomplet',
          previousStatus: preReg.status,
          newStatus: 'INCOMPLET',
        },
      })

      await db.notification.create({
        data: {
          userId: preReg.userId,
          type: 'ADMISSION_INCOMPLETE',
          title: '⚠️ Dossier incomplet',
          message: `Le dossier de ${preReg.childFirstName} ${preReg.childLastName} est incomplet. ${reason || 'Veuillez contacter le secrétariat.'}`,
          read: false,
        },
      })

      return NextResponse.json({ ok: true, message: 'Dossier marqué incomplet. Parent notifié.' })
    }

    if (action === 'transmit') {
      const preReg = await db.preRegistration.findUnique({ where: { id: preRegistrationId } })
      if (!preReg) return NextResponse.json({ ok: false, error: 'Dossier introuvable.' }, { status: 404 })

      await db.preRegistration.update({
        where: { id: preRegistrationId },
        data: { status: 'TRANSFERE_DIRECTION' },
      })

      await db.preRegistrationHistory.create({
        data: {
          preRegistrationId,
          action: 'TRANSMITTED',
          performedById: user.id,
          performedByName: user.displayName,
          notes: 'Transmis au directeur pour validation',
          previousStatus: preReg.status,
          newStatus: 'TRANSFERE_DIRECTION',
        },
      })

      // Notifier le directeur
      const directors = await db.user.findMany({ where: { role: 'DIRECTION', active: true }, select: { id: true } })
      if (directors.length > 0) {
        await db.notification.createMany({
          data: directors.map((d) => ({
            userId: d.id,
            type: 'ADMISSION_TO_VALIDATE',
            title: '🎯 Admission à valider',
            message: `Dossier ${preReg.referenceNumber} : ${preReg.childFirstName} ${preReg.childLastName}`,
            read: false,
          })),
        })
      }

      return NextResponse.json({ ok: true, message: 'Dossier transmis au directeur.' })
    }

    return NextResponse.json({ ok: false, error: `Action "${action}" inconnue.` }, { status: 400 })
  } catch (err) {
    console.error('[api/secretariat/admissions] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
