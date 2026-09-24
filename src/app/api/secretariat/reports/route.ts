// API : Rapports & Traitement de masse — Secrétariat
// ============================================================
// GET : rapports filtrables (effectifs, admissions, absences, etc.)
// POST : actions de masse sécurisées

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
    const report = url.searchParams.get('report') || 'effectifs' // effectifs | admissions-stats | absence-stats | mass-operations
    const academicYearId = url.searchParams.get('academicYearId')

    if (report === 'effectifs') {
      // Effectifs par direction, classe, sexe, statut
      const [totalStudents, activeStudents, archivedStudents, transferredStudents, byGender, byDirectorate] = await Promise.all([
        db.student.count({ where: { schoolId } }),
        db.student.count({ where: { schoolId, status: 'ACTIVE' } }),
        db.student.count({ where: { schoolId, status: 'ARCHIVED' } }),
        db.student.count({ where: { schoolId, status: 'TRANSFERRED' } }),
        db.student.groupBy({ by: ['gender'], where: { schoolId, status: 'ACTIVE' }, _count: true }),
        db.directorate.findMany({
          where: { schoolId },
          include: {
            classrooms: {
              include: {
                _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } },
              },
            },
          },
        }),
      ])

      return NextResponse.json({
        ok: true,
        report: 'effectifs',
        total: totalStudents,
        active: activeStudents,
        archived: archivedStudents,
        transferred: transferredStudents,
        byGender: byGender.map((g) => ({ gender: g.gender || 'N/A', count: g._count })),
        byDirectorate: byDirectorate.map((d) => ({
          id: d.id,
          name: d.name,
          code: d.code,
          totalEnrolled: d.classrooms.reduce((sum, c) => sum + c._count.enrollments, 0),
          classrooms: d.classrooms.map((c) => ({
            id: c.id,
            name: c.name,
            capacity: c.capacity,
            enrolled: c._count.enrollments,
          })),
        })),
      })
    }

    if (report === 'admission-stats') {
      const [byStatus, totalThisMonth, totalThisYear] = await Promise.all([
        db.admissionApplication.groupBy({
          by: ['status'],
          where: { schoolId },
          _count: true,
        }),
        db.admissionApplication.count({
          where: {
            schoolId,
            createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
          },
        }),
        db.admissionApplication.count({
          where: {
            schoolId,
            createdAt: { gte: new Date(new Date().getFullYear(), 0, 1) },
          },
        }),
      ])

      return NextResponse.json({
        ok: true,
        report: 'admission-stats',
        byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
        totalThisMonth,
        totalThisYear,
      })
    }

    if (report === 'absence-stats') {
      const today = new Date()
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      today.setHours(0, 0, 0, 0)

      const [absencesToday, latesToday, absencesThisMonth, unjustifiedTotal, byStatus] = await Promise.all([
        db.attendance.count({ where: { schoolId, status: 'ABSENT', date: { gte: today } } }),
        db.attendance.count({ where: { schoolId, status: 'LATE', date: { gte: today } } }),
        db.attendance.count({ where: { schoolId, status: 'ABSENT', date: { gte: monthStart } } }),
        db.attendance.count({ where: { schoolId, status: 'ABSENT', justified: false } }),
        db.attendance.groupBy({
          by: ['status'],
          where: { schoolId, date: { gte: monthStart } },
          _count: true,
        }),
      ])

      return NextResponse.json({
        ok: true,
        report: 'absence-stats',
        absencesToday,
        latesToday,
        absencesThisMonth,
        unjustifiedTotal,
        byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
      })
    }

    if (report === 'mass-operations') {
      const operations = await db.massOperation.findMany({
        where: { schoolId },
        orderBy: [{ createdAt: 'desc' }],
        take: 50,
      })

      return NextResponse.json({
        ok: true,
        report: 'mass-operations',
        operations: operations.map((o) => ({
          id: o.id,
          operationType: o.operationType,
          affectedCount: o.affectedCount,
          successCount: o.successCount,
          failCount: o.failCount,
          confirmedByName: o.confirmedByName,
          createdAt: o.createdAt.toISOString(),
          completedAt: o.completedAt?.toISOString() || null,
          cancelled: o.cancelled,
        })),
      })
    }

    return NextResponse.json({ ok: false, error: `Rapport "${report}" inconnu.` }, { status: 400 })
  } catch (err) {
    console.error('[api/secretariat/reports] Error:', err)
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

    // Relance groupée de parents
    if (action === 'mass-notify') {
      const { studentIds, message, channel } = body
      if (!studentIds?.length || !message) {
        return NextResponse.json({ ok: false, error: 'studentIds et message requis.' }, { status: 400 })
      }

      let successCount = 0
      let failCount = 0
      const errors: string[] = []

      for (const sid of studentIds) {
        try {
          const student = await db.student.findUnique({
            where: { id: sid },
            include: { guardianLinks: { take: 1, include: { guardian: true } } },
          })
          if (!student || !student.guardianLinks[0]?.guardian) {
            failCount++
            errors.push(`Élève ${sid}: aucun parent trouvé`)
            continue
          }

          const guardian = student.guardianLinks[0].guardian
          await db.communication.create({
            data: {
              schoolId,
              senderId: user.id,
              senderName: user.displayName,
              senderRole: 'SECRETARY',
              recipientName: `${guardian.firstName} ${guardian.lastName}`,
              recipientPhone: guardian.phone,
              recipientEmail: guardian.email,
              channel: channel || 'APP',
              subject: 'Communication de l\'établissement',
              body: message,
              category: 'GENERAL',
              studentId: sid,
              status: 'NEW',
              deliveredAt: new Date(),
              deliveryStatus: 'SENT',
            },
          })
          successCount++
        } catch (e) {
          failCount++
          errors.push(`Élève ${sid}: ${(e as Error).message}`)
        }
      }

      // Journal
      await db.massOperation.create({
        data: {
          schoolId,
          operationType: 'NOTIFY_PARENTS',
          parameters: JSON.stringify({ count: studentIds.length, channel }),
          affectedCount: studentIds.length,
          successCount,
          failCount,
          errors: errors.length ? JSON.stringify(errors) : null,
          confirmedById: user.id,
          confirmedByName: user.displayName,
          confirmedAt: new Date(),
          createdById: user.id,
          createdByName: user.displayName,
          completedAt: new Date(),
        },
      })

      return NextResponse.json({
        ok: true,
        successCount,
        failCount,
        message: `${successCount} parent(s) notifié(s), ${failCount} échec(s)`,
      })
    }

    // Export de liste
    if (action === 'export') {
      const { exportType, filters } = body
      if (!exportType) return NextResponse.json({ ok: false, error: 'exportType requis.' }, { status: 400 })

      // Journal
      const op = await db.massOperation.create({
        data: {
          schoolId,
          operationType: 'EXPORT',
          parameters: JSON.stringify({ exportType, filters }),
          affectedCount: 0,
          successCount: 1,
          failCount: 0,
          confirmedById: user.id,
          confirmedByName: user.displayName,
          confirmedAt: new Date(),
          createdById: user.id,
          createdByName: user.displayName,
          completedAt: new Date(),
        },
      })

      return NextResponse.json({ ok: true, operationId: op.id, message: 'Export lancé' })
    }

    return NextResponse.json({ ok: false, error: `Action "${action}" inconnue.` }, { status: 400 })
  } catch (err) {
    console.error('[api/secretariat/reports POST] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
