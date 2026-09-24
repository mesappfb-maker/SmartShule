// SmartShule — API Admissions V2 (multi-enfants + anti-doublon + archivage)
// ============================================================
// GET : liste des demandes avec filtres + recherche + stats
// POST : création + actions (submit, accept, refuse, incomplete, transmit, archive)
//       + anti-doublon automatique (nom + prénom + date naissance + sexe)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Normaliser un nom pour la comparaison anti-doublon
function normalizeName(name: string): string {
  return name.toLowerCase().trim()
    .replace(/[éèêë]/g, 'e').replace(/[àâä]/g, 'a').replace(/[îï]/g, 'i')
    .replace(/[ôö]/g, 'o').replace(/[ûüù]/g, 'u').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '')
}

// Détecter les doublons potentiels
async function detectDuplicates(schoolId: string, firstName: string, lastName: string, birthDate: Date | null, gender: string | null) {
  if (!birthDate) return { isDuplicate: false, matches: [] }

  const normalizedFirst = normalizeName(firstName)
  const normalizedLast = normalizeName(lastName)

  // Chercher parmi les élèves existants
  const students = await db.student.findMany({
    where: {
      schoolId,
      birthDate: birthDate,
    },
    select: { id: true, firstName: true, lastName: true, matricule: true, gender: true },
  })

  const matches = students.filter((s) =>
    normalizeName(s.firstName) === normalizedFirst &&
    normalizeName(s.lastName) === normalizedLast &&
    (!gender || !s.gender || s.gender === gender)
  )

  return {
    isDuplicate: matches.length > 0,
    matches: matches.map((m) => ({ id: m.id, name: `${m.firstName} ${m.lastName}`, matricule: m.matricule })),
  }
}

// ============================================================
// GET : liste des admissions avec filtres
// ============================================================
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (user.role !== 'SECRETARY' && user.role !== 'DIRECTION' && user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
    }

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const url = new URL(req.url)
    const search = url.searchParams.get('search') || ''
    const status = url.searchParams.get('status') || ''
    const applicationType = url.searchParams.get('applicationType') || ''

    // Construction du where
    const where: any = { schoolId }
    if (status && status !== 'ALL') where.status = status
    if (applicationType && applicationType !== 'ALL') where.applicationType = applicationType

    // Recherche globale
    if (search) {
      where.OR = [
        { referenceNumber: { contains: search, mode: 'insensitive' } },
        { parentFirstName: { contains: search, mode: 'insensitive' } },
        { parentLastName: { contains: search, mode: 'insensitive' } },
        { parentEmail: { contains: search, mode: 'insensitive' } },
        { parentPhone: { contains: search, mode: 'insensitive' } },
        { children: { some: { childFirstName: { contains: search, mode: 'insensitive' } } } },
        { children: { some: { childLastName: { contains: search, mode: 'insensitive' } } } },
      ]
    }

    const [applications, total] = await Promise.all([
      db.admissionApplication.findMany({
        where,
        include: {
          children: {
            include: { _count: { select: { documents: true } } },
          },
          _count: { select: { documents: true, children: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      db.admissionApplication.count({ where }),
    ])

    // Stats par statut
    const stats = {
      total,
      submitted: await db.admissionApplication.count({ where: { schoolId, status: 'SUBMITTED' } }),
      incomplete: await db.admissionApplication.count({ where: { schoolId, status: 'INCOMPLETE' } }),
      accepted: await db.admissionApplication.count({ where: { schoolId, status: 'ACCEPTED' } }),
      refused: await db.admissionApplication.count({ where: { schoolId, status: 'REFUSED' } }),
      transmitted: await db.admissionApplication.count({ where: { schoolId, status: 'TRANSMITTED' } }),
      archived: await db.admissionApplication.count({ where: { schoolId, status: 'ARCHIVED' } }),
      duplicateSuspected: await db.admissionApplication.count({ where: { schoolId, status: 'DUPLICATE_SUSPECTED' } }),
    }

    return NextResponse.json({
      ok: true,
      applications: applications.map((a) => ({
        id: a.id,
        referenceNumber: a.referenceNumber,
        applicationType: a.applicationType,
        status: a.status,
        parentName: `${a.parentFirstName} ${a.parentLastName}`,
        parentEmail: a.parentEmail,
        parentPhone: a.parentPhone,
        parentRelationship: a.parentRelationship,
        emailVerified: a.emailVerified,
        phoneVerified: a.phoneVerified,
        childrenCount: a._count.children,
        children: a.children.map((c) => ({
          id: c.id,
          name: `${c.childFirstName} ${c.childLastName}`,
          firstName: c.childFirstName,
          lastName: c.childLastName,
          birthDate: c.childBirthDate?.toISOString() || null,
          gender: c.childGender,
          desiredLevel: c.desiredLevel,
          status: c.status,
          duplicateStatus: c.duplicateStatus,
          matricule: c.matricule,
          studentId: c.studentId,
          documentsCount: c._count.documents,
        })),
        submittedAt: a.submittedAt?.toISOString() || null,
        reviewedAt: a.reviewedAt?.toISOString() || null,
        reviewedByName: a.reviewedByName,
        decisionReason: a.decisionReason,
        createdAt: a.createdAt.toISOString(),
      })),
      stats,
    })
  } catch (err) {
    console.error('[api/admissions] GET Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

// ============================================================
// POST : création + actions
// ============================================================
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })

    const body = await req.json()
    const { action } = body
    const h = await headers()
    const ip = getClientIP(h)

    // ============================================================
    // CRÉER UNE DEMANDE (parent)
    // ============================================================
    if (action === 'create') {
      const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
      if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

      const { parentFirstName, parentLastName, parentPhone, parentRelationship, children } = body
      if (!parentFirstName || !parentLastName || !parentPhone || !children || !Array.isArray(children) || children.length === 0) {
        return NextResponse.json({ ok: false, error: 'Informations parent et au moins un enfant obligatoires.' }, { status: 400 })
      }

      // Générer référence
      const year = new Date().getFullYear()
      const count = await db.admissionApplication.count({ where: { schoolId } })
      const referenceNumber = `ADM-${year}-${String(count + 1).padStart(6, '0')}`

      // Vérifier email unique
      const existingUser = await db.user.findUnique({ where: { email: user.email } })
      if (!existingUser) return NextResponse.json({ ok: false, error: 'Utilisateur introuvable.' }, { status: 404 })

      // Transaction : créer la demande + les sous-dossiers enfants + anti-doublon
      const result = await db.$transaction(async (tx) => {
        // 1. Créer la demande globale
        const application = await tx.admissionApplication.create({
          data: {
            schoolId,
            userId: user.id,
            referenceNumber,
            applicationType: 'NEW_ADMISSION',
            status: 'SUBMITTED',
            parentFirstName, parentLastName,
            parentEmail: user.email,
            parentPhone, parentRelationship: parentRelationship || 'PERE',
            submittedAt: new Date(),
          },
        })

        // 2. Pour chaque enfant, créer un sous-dossier + vérifier doublon
        let hasDuplicate = false
        for (const child of children) {
          const dupCheck = await detectDuplicates(
            schoolId,
            child.childFirstName, child.childLastName,
            child.childBirthDate ? new Date(child.childBirthDate) : null,
            child.childGender
          )

          const childApp = await tx.childApplication.create({
            data: {
              applicationId: application.id,
              childFirstName: child.childFirstName,
              childLastName: child.childLastName,
              childBirthDate: child.childBirthDate ? new Date(child.childBirthDate) : null,
              childGender: child.childGender || null,
              childBirthPlace: child.childBirthPlace || null,
              previousSchool: child.previousSchool || null,
              desiredLevel: child.desiredLevel || null,
              desiredClassroomId: child.desiredClassroomId || null,
              status: dupCheck.isDuplicate ? 'DUPLICATE' : 'PENDING',
              duplicateStatus: dupCheck.isDuplicate ? 'SUSPECTED' : null,
              duplicateStudentId: dupCheck.matches[0]?.id || null,
            },
          })

          if (dupCheck.isDuplicate) {
            hasDuplicate = true
            await tx.admissionHistory.create({
              data: {
                applicationId: application.id,
                childApplicationId: childApp.id,
                action: 'DUPLICATE_DETECTED',
                notes: `Doublon suspecté avec ${dupCheck.matches[0].name} (${dupCheck.matches[0].matricule})`,
                newStatus: 'DUPLICATE',
              },
            })
          }
        }

        // 3. Mettre à jour le statut global si doublon
        if (hasDuplicate) {
          await tx.admissionApplication.update({
            where: { id: application.id },
            data: { status: 'DUPLICATE_SUSPECTED' },
          })
        }

        // 4. Historique
        await tx.admissionHistory.create({
          data: {
            applicationId: application.id,
            action: 'SUBMITTED',
            performedById: user.id,
            performedByName: user.displayName,
            notes: `Demande soumise avec ${children.length} enfant(s)`,
            newStatus: hasDuplicate ? 'DUPLICATE_SUSPECTED' : 'SUBMITTED',
          },
        })

        // 5. Notifier le secrétariat
        const secretaries = await tx.user.findMany({
          where: { role: 'SECRETARY', active: true },
          select: { id: true },
        })
        if (secretaries.length > 0) {
          await tx.notification.createMany({
            data: secretaries.map((s) => ({
              userId: s.id,
              type: 'ADMISSION_SUBMITTED',
              title: '📋 Nouvelle demande d\'admission',
              message: `${referenceNumber} : ${parentFirstName} ${parentLastName} (${children.length} enfant(s))${hasDuplicate ? ' ⚠️ Doublon suspecté' : ''}`,
              read: false,
            })),
          })
        }

        return { applicationId: application.id, referenceNumber, hasDuplicate }
      })

      await logAudit({
        userId: user.id, userName: user.displayName, userRole: user.role,
        schoolId: await getSchoolIdForUser(user.id, user.email || undefined) || '',
        action: 'CREATE', entityType: 'OTHER', entityId: result.applicationId,
        description: `Demande d'admission créée : ${result.referenceNumber} (${children.length} enfant(s))${result.hasDuplicate ? ' — DOUBLON SUSPECTÉ' : ''}`,
        ipAddress: ip,
      })

      return NextResponse.json({
        ok: true,
        referenceNumber: result.referenceNumber,
        hasDuplicate: result.hasDuplicate,
        message: result.hasDuplicate
          ? `Demande soumise (${result.referenceNumber}). ⚠️ Un doublon potentiel a été détecté. Le secrétariat vérifiera.`
          : `Demande soumise avec succès. Référence : ${result.referenceNumber}`,
      })
    }

    // ============================================================
    // ACTIONS SECRÉTARIAT (accept, refuse, incomplete, transmit, archive)
    // ============================================================
    if (['accept', 'accept-child', 'refuse', 'incomplete', 'transmit', 'archive'].includes(action)) {
      if (user.role !== 'SECRETARY' && user.role !== 'DIRECTION' && user.role !== 'ADMIN') {
        return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
      }

      const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
      if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

      const { applicationId, childId, reason, classroomId, academicYearId } = body

      // === ACCEPTER (tout le dossier) ===
      if (action === 'accept') {
        const app = await db.admissionApplication.findUnique({
          where: { id: applicationId },
          include: { children: true },
        })
        if (!app) return NextResponse.json({ ok: false, error: 'Demande introuvable.' }, { status: 404 })

        const result = await db.$transaction(async (tx) => {
          let createdStudents: Array<{ name: string; matricule: string }> = []

          for (const child of app.children) {
            // Skip les enfants déjà acceptés ou en doublon confirmé
            if (child.status === 'ACCEPTED') continue
            if (child.duplicateStatus === 'CONFIRMED') continue

            // Vérifier doublon une dernière fois
            const dupCheck = child.duplicateStatus === 'SUSPECTED' && child.duplicateStudentId
            if (dupCheck) {
              // Si doublon suspecté, ne pas créer un nouvel élève — utiliser l'existant
              await tx.childApplication.update({
                where: { id: child.id },
                data: {
                  status: 'ACCEPTED',
                  studentId: child.duplicateStudentId,
                  matricule: (await tx.student.findUnique({ where: { id: child.duplicateStudentId }, select: { matricule: true } }))?.matricule || null,
                  reviewedAt: new Date(),
                  decisionReason: 'Accepte - rattache a eleve existant',
                },
              })
              createdStudents.push({ name: `${child.childFirstName} ${child.childLastName}`, matricule: 'existant' })
              continue
            }

            // Créer l'élève
            const matricule = `${new Date().getFullYear().toString().slice(-2)}${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`
            const student = await tx.student.create({
              data: {
                schoolId,
                matricule,
                firstName: child.childFirstName,
                lastName: child.childLastName,
                birthDate: child.childBirthDate,
                gender: child.childGender,
                status: 'ACTIVE',
              },
            })

            // Inscrire dans la classe si fournie
            if (classroomId) {
              const yearId = academicYearId || (await tx.academicYear.findFirst({ where: { schoolId, active: true } }))?.id
              if (yearId) {
                await tx.enrollment.create({
                  data: { studentId: student.id, classroomId, academicYearId: yearId, status: 'ACTIVE' },
                })
              }
            }

            // Lier le parent
            const guardian = await tx.guardian.findFirst({ where: { userId: app.userId } })
            if (guardian) {
              await tx.guardianStudentLink.create({
                data: {
                  guardianId: guardian.id,
                  studentId: student.id,
                  relationship: app.parentRelationship,
                  isPrimary: true,
                },
              })
            }

            // Mettre à jour le sous-dossier enfant
            await tx.childApplication.update({
              where: { id: child.id },
              data: {
                status: 'ACCEPTED',
                studentId: student.id,
                matricule,
                reviewedAt: new Date(),
                decisionReason: 'Admission acceptée',
              },
            })

            createdStudents.push({ name: `${child.childFirstName} ${child.childLastName}`, matricule })
          }

          // Activer le parent
          await tx.user.update({
            where: { id: app.userId },
            data: { accountStatus: 'PARENT_VERIFIE' },
          })

          // Mettre à jour la demande
          await tx.admissionApplication.update({
            where: { id: applicationId },
            data: {
              status: 'ACCEPTED',
              reviewedById: user.id,
              reviewedByName: user.displayName,
              reviewedAt: new Date(),
              decisionReason: reason || 'Admission acceptée',
            },
          })

          // Historique
          await tx.admissionHistory.create({
            data: {
              applicationId,
              action: 'ACCEPTED',
              performedById: user.id,
              performedByName: user.displayName,
              notes: `${createdStudents.length} élève(s) créé(s) / rattaché(s). Parent activé : PARENT_VERIFIE.`,
              previousStatus: app.status,
              newStatus: 'ACCEPTED',
            },
          })

          // Notifier le parent
          await tx.notification.create({
            data: {
              userId: app.userId,
              type: 'ADMISSION_ACCEPTED',
              title: '✅ Admission acceptée !',
              message: `L'admission a été acceptée. ${createdStudents.length} élève(s) inscrit(s). Votre portail parent est maintenant activé.`,
              read: false,
            },
          })

          return { createdStudents }
        })

        await logAudit({
          userId: user.id, userName: user.displayName, userRole: user.role, schoolId,
          action: 'APPROVE', entityType: 'OTHER', entityId: applicationId,
          description: `Admission acceptée : ${result.createdStudents.length} élève(s), parent activé`,
          ipAddress: ip,
        })

        return NextResponse.json({
          ok: true,
          message: `Admission acceptée. ${result.createdStudents.length} élève(s) créé(s). Parent activé.`,
          students: result.createdStudents,
        })
      }

      // === REFUSER ===
      if (action === 'refuse') {
        const app = await db.admissionApplication.findUnique({ where: { id: applicationId } })
        if (!app) return NextResponse.json({ ok: false, error: 'Demande introuvable.' }, { status: 404 })

        await db.admissionApplication.update({
          where: { id: applicationId },
          data: { status: 'REFUSED', reviewedById: user.id, reviewedByName: user.displayName, reviewedAt: new Date(), decisionReason: reason || 'Refusé' },
        })
        await db.admissionHistory.create({
          data: { applicationId, action: 'REFUSED', performedById: user.id, performedByName: user.displayName, notes: reason || 'Refusé', previousStatus: app.status, newStatus: 'REFUSED' },
        })
        await db.notification.create({
          data: { userId: app.userId, type: 'ADMISSION_REFUSED', title: '❌ Demande refusée', message: `Votre demande d'admission a été refusée. Motif : ${reason || 'Non précisé'}.`, read: false },
        })

        return NextResponse.json({ ok: true, message: 'Demande refusée. Parent notifié.' })
      }

      // === INCOMPLET ===
      if (action === 'incomplete') {
        const app = await db.admissionApplication.findUnique({ where: { id: applicationId } })
        if (!app) return NextResponse.json({ ok: false, error: 'Demande introuvable.' }, { status: 404 })

        await db.admissionApplication.update({
          where: { id: applicationId },
          data: { status: 'INCOMPLETE', decisionReason: reason || 'Documents manquants' },
        })
        await db.admissionHistory.create({
          data: { applicationId, action: 'MARKED_INCOMPLETE', performedById: user.id, performedByName: user.displayName, notes: reason || 'Dossier incomplet', previousStatus: app.status, newStatus: 'INCOMPLETE' },
        })
        await db.notification.create({
          data: { userId: app.userId, type: 'ADMISSION_INCOMPLETE', title: '⚠️ Dossier incomplet', message: `Votre dossier est incomplet. ${reason || 'Contactez le secrétariat.'}`, read: false },
        })

        return NextResponse.json({ ok: true, message: 'Dossier marqué incomplet. Parent notifié.' })
      }

      // === TRANSMETTRE AU DIRECTEUR ===
      if (action === 'transmit') {
        const app = await db.admissionApplication.findUnique({ where: { id: applicationId } })
        if (!app) return NextResponse.json({ ok: false, error: 'Demande introuvable.' }, { status: 404 })

        await db.admissionApplication.update({
          where: { id: applicationId },
          data: { status: 'TRANSMITTED' },
        })
        await db.admissionHistory.create({
          data: { applicationId, action: 'TRANSMITTED', performedById: user.id, performedByName: user.displayName, notes: 'Transmis au directeur', previousStatus: app.status, newStatus: 'TRANSMITTED' },
        })

        const directors = await db.user.findMany({ where: { role: 'DIRECTION', active: true }, select: { id: true } })
        if (directors.length > 0) {
          await db.notification.createMany({
            data: directors.map((d) => ({
              userId: d.id, type: 'ADMISSION_TO_VALIDATE', title: '🎯 Admission à valider',
              message: `Dossier ${app.referenceNumber} à valider`, read: false,
            })),
          })
        }

        return NextResponse.json({ ok: true, message: 'Dossier transmis au directeur.' })
      }

      // === ARCHIVER ===
      if (action === 'archive') {
        const app = await db.admissionApplication.findUnique({ where: { id: applicationId } })
        if (!app) return NextResponse.json({ ok: false, error: 'Demande introuvable.' }, { status: 404 })

        await db.admissionApplication.update({
          where: { id: applicationId },
          data: { status: 'ARCHIVED' },
        })
        await db.admissionHistory.create({
          data: { applicationId, action: 'ARCHIVED', performedById: user.id, performedByName: user.displayName, notes: 'Archivé', previousStatus: app.status, newStatus: 'ARCHIVED' },
        })

        return NextResponse.json({ ok: true, message: 'Dossier archivé.' })
      }

      // === ACCEPTER UN SEUL ENFANT (sous-dossier) ===
      if (action === 'accept-child') {
        if (!childId) return NextResponse.json({ ok: false, error: 'childId obligatoire.' }, { status: 400 })

        const child = await db.childApplication.findUnique({
          where: { id: childId },
          include: { application: true },
        })
        if (!child) return NextResponse.json({ ok: false, error: 'Sous-dossier introuvable.' }, { status: 404 })

        const result = await db.$transaction(async (tx) => {
          const matricule = `${new Date().getFullYear().toString().slice(-2)}${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`
          const student = await tx.student.create({
            data: {
              schoolId,
              matricule,
              firstName: child.childFirstName,
              lastName: child.childLastName,
              birthDate: child.childBirthDate,
              gender: child.childGender,
              status: 'ACTIVE',
            },
          })

          if (classroomId) {
            const yearId = academicYearId || (await tx.academicYear.findFirst({ where: { schoolId, active: true } }))?.id
            if (yearId) {
              await tx.enrollment.create({ data: { studentId: student.id, classroomId, academicYearId: yearId, status: 'ACTIVE' } })
            }
          }

          const guardian = await tx.guardian.findFirst({ where: { userId: child.application.userId } })
          if (guardian) {
            await tx.guardianStudentLink.create({
              data: { guardianId: guardian.id, studentId: student.id, relationship: child.application.parentRelationship, isPrimary: true },
            })
          }

          await tx.childApplication.update({
            where: { id: childId },
            data: { status: 'ACCEPTED', studentId: student.id, matricule, reviewedAt: new Date(), decisionReason: 'Accepté individuellement' },
          })

          await tx.user.update({ where: { id: child.application.userId }, data: { accountStatus: 'PARENT_VERIFIE' } })

          await tx.admissionHistory.create({
            data: { applicationId: child.applicationId, childApplicationId: childId, action: 'ACCEPTED', performedById: user.id, performedByName: user.displayName, notes: `Enfant accepté : ${child.childFirstName} ${child.childLastName} → ${matricule}`, newStatus: 'ACCEPTED' },
          })

          await tx.notification.create({
            data: { userId: child.application.userId, type: 'ADMISSION_ACCEPTED', title: '✅ Enfant accepté', message: `${child.childFirstName} ${child.childLastName} a été accepté. Matricule : ${matricule}. Portail parent activé.`, read: false },
          })

          return { matricule }
        })

        return NextResponse.json({ ok: true, message: `Enfant accepté. Matricule : ${result.matricule}. Parent activé.`, matricule: result.matricule })
      }
    }

    return NextResponse.json({ ok: false, error: `Action "${action}" inconnue.` }, { status: 400 })
  } catch (err) {
    console.error('[api/admissions] POST Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
