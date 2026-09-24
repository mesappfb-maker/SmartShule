// API : Centre Absences & Retards — Secrétariat
// ============================================================
// GET : absences du jour, retards, sans justificatif, répétées, justificatifs en attente
// POST : valider/rejeter justificatif, relancer parent, générer convocation

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { hasRole } from '@/lib/rbac'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (!hasRole(user, ['SECRETARY', 'DIRECTION', 'ADMIN', 'DIRECTOR', 'SCHOOL_ADMIN', 'SYSTEM_ADMIN', 'ADMISSIONS_OFFICER'])) {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
    }

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const url = new URL(req.url)
    const view = url.searchParams.get('view') || 'today' // today | unjustified | repeated | justifications | all
    const classroomId = url.searchParams.get('classroomId')
    const studentId = url.searchParams.get('studentId')
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = parseInt(url.searchParams.get('limit') || '50', 10)

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (view === 'justifications') {
      // Justificatifs en attente de validation
      const justifications = await db.absenceJustification.findMany({
        where: { schoolId, status: 'SUBMITTED' },
        include: {
          student: { select: { id: true, firstName: true, lastName: true, matricule: true } },
        },
        orderBy: [{ justificationDate: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      })

      const total = await db.absenceJustification.count({ where: { schoolId, status: 'SUBMITTED' } })

      return NextResponse.json({
        ok: true,
        view,
        justifications: justifications.map((j) => ({
          id: j.id,
          studentId: j.studentId,
          studentName: `${j.student.firstName} ${j.student.lastName}`,
          matricule: j.student.matricule,
          justificationType: j.justificationType,
          justificationDate: j.justificationDate.toISOString(),
          endDate: j.endDate?.toISOString() || null,
          description: j.description,
          documentUrl: j.documentUrl,
          status: j.status,
          submittedByName: j.submittedByName,
          createdAt: j.createdAt.toISOString(),
        })),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      })
    }

    // Construction du where pour les absences
    const where: any = { schoolId }
    if (classroomId) {
      where.student = { enrollments: { some: { classroomId, status: 'ACTIVE' } } }
    }
    if (studentId) where.studentId = studentId

    if (view === 'today') {
      where.date = { gte: today, lt: tomorrow }
      where.status = { in: ['ABSENT', 'LATE'] }
    } else if (view === 'unjustified') {
      where.status = 'ABSENT'
      where.justified = false
    } else if (view === 'repeated') {
      // Élèves avec 3+ absences non justifiées ce mois
      const monthStart = new Date(today)
      monthStart.setDate(1)
      where.status = 'ABSENT'
      where.justified = false
      where.date = { gte: monthStart }
    }

    const [attendances, totalCount] = await Promise.all([
      db.attendance.findMany({
        where,
        include: {
          student: {
            select: {
              id: true, firstName: true, lastName: true, matricule: true, gender: true,
              guardianLinks: { take: 1, select: { guardian: { select: { firstName: true, lastName: true, phone: true, email: true } } } },
            },
          },
        },
        orderBy: [{ date: 'desc' }, { student: { lastName: 'asc' } }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.attendance.count({ where }),
    ])

    // Stats résumé
    const [absencesToday, latesToday, unjustified, justificationsPending] = await Promise.all([
      db.attendance.count({ where: { schoolId, status: 'ABSENT', date: { gte: today, lt: tomorrow } } }),
      db.attendance.count({ where: { schoolId, status: 'LATE', date: { gte: today, lt: tomorrow } } }),
      db.attendance.count({ where: { schoolId, status: 'ABSENT', justified: false } }),
      db.absenceJustification.count({ where: { schoolId, status: 'SUBMITTED' } }),
    ])

    return NextResponse.json({
      ok: true,
      view,
      attendances: attendances.map((a) => ({
        id: a.id,
        studentId: a.studentId,
        studentName: `${a.student.firstName} ${a.student.lastName}`,
        matricule: a.student.matricule,
        gender: a.student.gender,
        status: a.status,
        date: a.date.toISOString(),
        justified: a.justified,
        justification: a.justification,
        guardian: a.student.guardianLinks[0]?.guardian
          ? {
            name: `${a.student.guardianLinks[0].guardian.firstName} ${a.student.guardianLinks[0].guardian.lastName}`,
            phone: a.student.guardianLinks[0].guardian.phone,
            email: a.student.guardianLinks[0].guardian.email,
          }
          : null,
      })),
      stats: { absencesToday, latesToday, unjustified, justificationsPending },
      pagination: { page, limit, total: totalCount, pages: Math.ceil(totalCount / limit) },
    })
  } catch (err) {
    console.error('[api/secretariat/absences] Error:', err)
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
    const { action } = body

    // Valider un justificatif
    if (action === 'validate-justification') {
      const { justificationId, rejectionReason } = body
      if (!justificationId) return NextResponse.json({ ok: false, error: 'justificationId requis.' }, { status: 400 })

      const justification = await db.absenceJustification.findUnique({ where: { id: justificationId } })
      if (!justification || justification.schoolId !== schoolId) {
        return NextResponse.json({ ok: false, error: 'Justificatif introuvable.' }, { status: 404 })
      }

      const isValidated = !rejectionReason
      await db.absenceJustification.update({
        where: { id: justificationId },
        data: {
          status: isValidated ? 'VALIDATED' : 'REJECTED',
          validatedById: user.id,
          validatedByName: user.displayName,
          validatedAt: new Date(),
          rejectionReason: rejectionReason || null,
        },
      })

      // Si validé, marquer l'absence correspondante comme justifiée
      if (isValidated && justification.attendanceId) {
        await db.attendance.update({
          where: { id: justification.attendanceId },
          data: { justified: true, justification: `Justificatif validé le ${new Date().toLocaleDateString('fr-FR')}` },
        })
      }

      // Créer une tâche de suivi
      if (isValidated) {
        await db.adminTask.create({
          data: {
            schoolId,
            studentId: justification.studentId,
            title: `Justificatif d'absence validé`,
            description: `Type: ${justification.justificationType}, Date: ${justification.justificationDate.toLocaleDateString('fr-FR')}`,
            category: 'ABSENCE',
            priority: 'LOW',
            status: 'DONE',
            createdById: user.id,
            createdByName: user.displayName,
            completedAt: new Date(),
          },
        })
      }

      return NextResponse.json({
        ok: true,
        message: isValidated ? 'Justificatif validé' : 'Justificatif rejeté',
        status: isValidated ? 'VALIDATED' : 'REJECTED',
      })
    }

    // Relancer un parent pour absence
    if (action === 'notify-parent') {
      const { studentId, attendanceIds, message } = body
      if (!studentId) return NextResponse.json({ ok: false, error: 'studentId requis.' }, { status: 400 })

      const student = await db.student.findUnique({
        where: { id: studentId },
        include: { guardianLinks: { take: 1, include: { guardian: true } } },
      })
      if (!student) return NextResponse.json({ ok: false, error: 'Élève introuvable.' }, { status: 404 })

      const guardian = student.guardianLinks[0]?.guardian
      if (guardian) {
        await db.communication.create({
          data: {
            schoolId,
            senderId: user.id,
            senderName: user.displayName,
            senderRole: 'SECRETARY',
            recipientName: `${guardian.firstName} ${guardian.lastName}`,
            recipientPhone: guardian.phone,
            recipientEmail: guardian.email,
            channel: 'APP',
            subject: 'Absence non justifiée',
            body: message || `Votre enfant ${student.firstName} ${student.lastName} (${student.matricule}) a des absences non justifiées. Merci de fournir un justificatif.`,
            category: 'ABSENCE',
            studentId,
            status: 'NEW',
          },
        })
      }

      return NextResponse.json({ ok: true, message: 'Parent notifié' })
    }

    return NextResponse.json({ ok: false, error: `Action "${action}" inconnue.` }, { status: 400 })
  } catch (err) {
    console.error('[api/secretariat/absences POST] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
