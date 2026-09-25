// API : Dashboard Secrétariat (stats + indicateurs cliquables)
// ============================================================
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { hasRole } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (!hasRole(user, ['SECRETARY', 'DIRECTION', 'ADMIN', 'DIRECTOR', 'SCHOOL_ADMIN', 'SYSTEM_ADMIN', 'ADMISSIONS_OFFICER'])) {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
    }

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [
      admissionsPending, admissionsIncomplete, admissionsTransmitted, admissionsDuplicate,
      studentsWithoutClass, studentsWithoutGuardian,
      absencesToday, latesToday,
      parentsToContact, documentsToProduce,
      transfersToProcess, appointmentsToday,
      messagesUnread, tasksOverdue, tasksPending,
      totalStudents, totalActive,
    ] = await Promise.all([
      db.admissionApplication.count({ where: { schoolId, status: 'SUBMITTED' } }),
      db.admissionApplication.count({ where: { schoolId, status: 'INCOMPLETE' } }),
      db.admissionApplication.count({ where: { schoolId, status: 'TRANSMITTED' } }),
      db.admissionApplication.count({ where: { schoolId, status: 'DUPLICATE_SUSPECTED' } }),
      db.student.count({ where: { schoolId, status: 'ACTIVE', enrollments: { none: { status: 'ACTIVE' } } } }),
      db.student.count({ where: { schoolId, status: 'ACTIVE', guardianLinks: { none: {} } } }),
      db.attendance.count({ where: { schoolId, status: 'ABSENT', date: { gte: today, lt: tomorrow } } }),
      db.attendance.count({ where: { schoolId, status: 'LATE', date: { gte: today, lt: tomorrow } } }),
      db.parentRequest.count({ where: { schoolId, status: { in: ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING'] } } }),
      // documentsToProduce : certificats en attente de validation + demandes de documents
      db.certificate.count({ where: { schoolId, requiresValidation: true, validatedAt: null, archived: false } }),
      // transfersToProcess : transferts en attente
      db.transfer.count({ where: { schoolId, status: 'PENDING' } }),
      db.reception.count({ where: { schoolId, scheduledDate: { gte: today, lt: tomorrow }, status: 'SCHEDULED' } }),
      db.notification.count({ where: { read: false } }),
      db.adminTask.count({ where: { schoolId, status: { in: ['PENDING', 'IN_PROGRESS'] }, dueDate: { lt: new Date() } } }),
      db.adminTask.count({ where: { schoolId, status: { in: ['PENDING', 'IN_PROGRESS', 'WAITING_PARENT', 'WAITING_DIRECTION', 'WAITING_SERVICE'] } } }),
      db.student.count({ where: { schoolId } }),
      db.student.count({ where: { schoolId, status: 'ACTIVE' } }),
    ])

    // Tâches par catégorie
    const tasksByCategory = await db.adminTask.groupBy({
      by: ['status'],
      where: { schoolId, status: { not: 'DONE' } },
      _count: true,
    })

    return NextResponse.json({
      ok: true,
      stats: {
        admissionsPending, admissionsIncomplete, admissionsTransmitted, admissionsDuplicate,
        studentsWithoutClass, studentsWithoutGuardian,
        absencesToday, latesToday,
        parentsToContact, documentsToProduce,
        transfersToProcess, appointmentsToday,
        messagesUnread, tasksOverdue, tasksPending,
        totalStudents, totalActive,
      },
      tasksByCategory: tasksByCategory.map((t) => ({ status: t.status, count: t._count })),
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
