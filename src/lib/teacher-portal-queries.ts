// SmartShule — Queries : Portail Prof (Étape RDC)
// Données agrégées pour le tableau de bord enseignant

import { db } from '@/lib/db'

export async function getTeacherPortalData(userId: string) {
  const employee = await db.employee.findFirst({
    where: { email: { not: undefined }, schoolId: { not: undefined } },
    include: {
      teacherAssignments: {
        include: {
          subject: true,
          classroom: { include: { directorate: true, section: true, option: true } },
        },
      },
      schedules: {
        where: { status: 'ACTIVE' },
        include: {
          classroom: true,
          subject: true,
          course: { include: { subject: true } },
        },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      },
      attendances: {
        orderBy: { date: 'desc' },
        take: 10,
      },
    },
  })

  // Trouver via l'utilisateur lié
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) return null

  const schoolId = user.role === 'TEACHER'
    ? (await db.employee.findFirst({
        where: { email: user.email },
        select: { schoolId: true },
      }))?.schoolId
    : null

  if (!schoolId) return null

  const teacher = await db.employee.findFirst({
    where: { schoolId, email: user.email },
    include: {
      teacherAssignments: {
        include: {
          subject: true,
          classroom: { include: { directorate: true, section: true, option: true } },
        },
      },
      schedules: {
        where: { status: 'ACTIVE' },
        include: {
          classroom: true,
          subject: true,
          course: { include: { subject: true } },
        },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      },
    },
  })

  if (!teacher) return null

  const classroomIds = teacher.teacherAssignments
    .map((a) => a.classroomId)
    .filter(Boolean) as string[]

  // Élèves avec alertes financières
  const financialAlerts = classroomIds.length > 0
    ? await db.studentFinancialStatus.findMany({
        where: {
          schoolId,
          status: { in: ['LITIGATION', 'BLOCKED'] },
          student: {
            enrollments: {
              some: { classroomId: { in: classroomIds }, status: 'ACTIVE' },
            },
          },
        },
        include: {
          student: {
            include: {
              enrollments: {
                where: { status: 'ACTIVE' },
                include: { classroom: true },
              },
            },
          },
        },
      })
    : []

  // Élèves par classe pour l'appel
  const studentsByClassroom = classroomIds.length > 0
    ? await db.student.findMany({
        where: {
          schoolId,
          status: 'ACTIVE',
          enrollments: { some: { classroomId: { in: classroomIds }, status: 'ACTIVE' } },
        },
        include: {
          enrollments: {
            where: { status: 'ACTIVE' },
            include: { classroom: true },
          },
          financialStatus: true,
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        take: 200,
      })
    : []

  // Cahier de textes récent
  const recentLogbook = classroomIds.length > 0
    ? await db.teacherLogbook.findMany({
        where: { schoolId, teacherId: teacher.id },
        include: { classroom: true },
        orderBy: { sessionDate: 'desc' },
        take: 10,
      })
    : []

  // Notes en brouillon
  const draftGrades = await db.grade.findMany({
    where: {
      schoolId,
      status: 'DRAFT',
      teacherId: teacher.id,
    },
    include: { student: true, subject: true },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  })

  // Annonces
  const announcements = await db.announcement.findMany({
    where: {
      schoolId,
      status: 'PUBLISHED',
      OR: [
        { targetType: 'ALL' },
        { targetType: 'CLASSROOM', classroomId: { in: classroomIds } },
      ],
    },
    orderBy: { publishedAt: 'desc' },
    take: 5,
  })

  // Notifications
  const notifications = await db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  // Emploi du temps d'aujourd'hui
  const today = new Date().getDay()
  const todaySchedule = teacher.schedules.filter((s) => s.dayOfWeek === today)

  return {
    teacher: {
      id: teacher.id,
      name: `${teacher.firstName} ${teacher.lastName}`,
      function: teacher.function,
      globalRole: teacher.globalRole || undefined,
      isMultiDirectorate: teacher.isMultiDirectorate,
    },
    assignments: teacher.teacherAssignments.map((a) => ({
      id: a.id,
      subjectId: a.subjectId,
      subjectName: a.subject.name,
      classroomId: a.classroomId,
      classroomName: a.classroom?.name || '—',
      directorateName: a.classroom?.directorate.name || '—',
      sectionName: a.classroom?.section?.name,
      optionName: a.classroom?.option?.name,
    })),
    schedule: teacher.schedules.map((s) => ({
      id: s.id,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      room: s.room,
      classroomName: s.classroom?.name || '—',
      subjectName: s.subject?.name || s.course?.subject?.name || '—',
    })),
    todaySchedule: todaySchedule.map((s) => ({
      id: s.id,
      startTime: s.startTime,
      endTime: s.endTime,
      room: s.room,
      classroomName: s.classroom?.name || '—',
      subjectName: s.subject?.name || s.course?.subject?.name || '—',
    })),
    financialAlerts: financialAlerts.map((f) => ({
      studentId: f.studentId,
      studentName: `${f.student.firstName} ${f.student.lastName}`,
      classroomName: f.student.enrollments[0]?.classroom.name || '—',
      status: f.status,
      reason: f.reason || undefined,
    })),
    studentsForAttendance: studentsByClassroom.map((s) => ({
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
      matricule: s.matricule,
      classroomName: s.enrollments[0]?.classroom.name || '—',
      financialStatus: s.financialStatus?.status || 'REGULAR',
    })),
    recentLogbook: recentLogbook.map((l) => ({
      id: l.id,
      date: l.sessionDate,
      classroomName: l.classroom.name,
      content: l.content,
      homework: l.homework,
    })),
    draftGrades: draftGrades.map((g) => ({
      id: g.id,
      title: g.title,
      score: g.score,
      maxScore: g.maxScore,
      status: g.status,
      studentName: `${g.student.firstName} ${g.student.lastName}`,
      subjectName: g.subject.name,
    })),
    announcements: announcements.map((a) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      priority: a.priority,
      publishedAt: a.publishedAt,
    })),
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
  }
}
