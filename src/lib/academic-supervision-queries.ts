// SmartShule — Queries : Supervision académique Direction (RDC)
// Vue détaillée : classes → élèves (notes, présences) + profs → matières → horaires

import { db } from '@/lib/db'

export async function getAcademicSupervisionData(schoolId: string) {
  const [classrooms, teachers, subjects] = await Promise.all([
    // 1. Classes avec élèves, notes et présences
    db.classroom.findMany({
      where: {
        directorate: { schoolId },
      },
      include: {
        directorate: true,
        section: true,
        option: true,
        enrollments: {
          where: { status: 'ACTIVE' },
          include: {
            student: {
              include: {
                grades: {
                  where: { status: 'PUBLISHED' },
                  include: { subject: true },
                  orderBy: { publishedAt: 'desc' },
                  take: 5,
                },
                attendances: {
                  orderBy: { date: 'desc' },
                  take: 5,
                },
                financialStatus: true,
              },
            },
          },
          orderBy: { student: { firstName: 'asc' } },
        },
        courses: {
          where: { status: 'PUBLISHED' },
          include: { subject: true, teacher: true },
        },
        teacherAssignments: {
          include: {
            employee: true,
            subject: true,
          },
        },
        grades: {
          where: { status: 'PUBLISHED' },
          include: { student: true, subject: true },
          orderBy: { publishedAt: 'desc' },
          take: 20,
        },
        attendanceSessions: {
          orderBy: { date: 'desc' },
          take: 5,
        },
      },
      orderBy: { name: 'asc' },
    }),

    // 2. Professeurs avec matières, affectations et horaires
    db.employee.findMany({
      where: {
        schoolId,
        status: 'ACTIVE',
        function: { in: ['ENSEIGNANT', 'DIRECTION'] },
      },
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
          },
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        },
        attendances: {
          orderBy: { date: 'desc' },
          take: 5,
        },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    }),

    // 3. Matières avec statistiques
    db.subject.findMany({
      where: { schoolId },
      include: {
        teacherAssignments: {
          include: {
            employee: true,
            classroom: true,
          },
        },
        grades: {
          where: { status: 'PUBLISHED' },
          select: { score: true, maxScore: true },
        },
      },
      orderBy: { name: 'asc' },
    }),
  ])

  // Calculer les statistiques par classe
  const classroomStats = classrooms.map((c) => {
    const students = c.enrollments.map((e) => e.student)
    const totalStudents = students.length
    const publishedGrades = c.grades
    const avgScore = publishedGrades.length > 0
      ? publishedGrades.reduce((sum, g) => sum + (g.score / g.maxScore) * 20, 0) / publishedGrades.length
      : 0

    const recentAttendances = students.flatMap((s) => s.attendances)
    const presentCount = recentAttendances.filter((a) => a.status === 'PRESENT').length
    const absentCount = recentAttendances.filter((a) => a.status === 'ABSENT').length
    const attendanceRate = recentAttendances.length > 0
      ? (presentCount / recentAttendances.length) * 100
      : 100

    const litigationCount = students.filter(
      (s) => s.financialStatus && s.financialStatus.status !== 'REGULAR'
    ).length

    return {
      classroom: {
        id: c.id,
        name: c.name,
        capacity: c.capacity,
        directorateName: c.directorate.name,
        sectionName: c.section?.name,
        optionName: c.option?.name,
      },
      totalStudents,
      avgScore: Math.round(avgScore * 100) / 100,
      attendanceRate: Math.round(attendanceRate * 10) / 10,
      absentCount,
      litigationCount,
      publishedGradesCount: publishedGrades.length,
      teachers: c.teacherAssignments.map((ta) => ({
        id: ta.employee.id,
        name: `${ta.employee.firstName} ${ta.employee.lastName}`,
        subjectName: ta.subject.name,
      })),
      students: students.map((s) => ({
        id: s.id,
        name: `${s.firstName} ${s.lastName}`,
        matricule: s.matricule,
        grades: s.grades.map((g) => ({
          subject: g.subject.name,
          score: g.score,
          maxScore: g.maxScore,
          title: g.title,
        })),
        recentAttendances: s.attendances.map((a) => ({
          date: a.date,
          status: a.status,
          justified: a.justified,
        })),
        financialStatus: s.financialStatus?.status || 'REGULAR',
      })),
    }
  })

  // Calculer les statistiques par prof
  const teacherStats = teachers.map((t) => ({
    teacher: {
      id: t.id,
      name: `${t.firstName} ${t.lastName}`,
      function: t.function,
      globalRole: t.globalRole,
      isMultiDirectorate: t.isMultiDirectorate,
    },
    assignments: t.teacherAssignments.map((a) => ({
      subjectName: a.subject.name,
      classroomName: a.classroom?.name || '—',
      directorateName: a.classroom?.directorate.name || '—',
    })),
    schedule: t.schedules.map((s) => ({
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      room: s.room,
      classroomName: s.classroom?.name || '—',
      subjectName: s.subject?.name || '—',
    })),
    recentAttendance: t.attendances.map((a) => ({
      date: a.date,
      status: a.status,
      arrivalTime: a.arrivalTime,
      departureTime: a.departureTime,
    })),
  }))

  // Stats par matière
  const subjectStats = subjects.map((s) => {
    const grades = s.grades
    const avg = grades.length > 0
      ? grades.reduce((sum, g) => sum + (g.score / g.maxScore) * 20, 0) / grades.length
      : 0
    return {
      id: s.id,
      name: s.name,
      code: s.code,
      teacherCount: new Set(s.teacherAssignments.map((ta) => ta.employeeId)).size,
      classroomCount: new Set(s.teacherAssignments.map((ta) => ta.classroomId)).size,
      gradesCount: grades.length,
      avgScore: Math.round(avg * 100) / 100,
    }
  })

  return {
    classrooms: classroomStats,
    teachers: teacherStats,
    subjects: subjectStats,
    summary: {
      totalClassrooms: classrooms.length,
      totalStudents: classroomStats.reduce((sum, c) => sum + c.totalStudents, 0),
      totalTeachers: teachers.length,
      totalSubjects: subjects.length,
      avgGlobalScore: classroomStats.length > 0
        ? Math.round((classroomStats.reduce((sum, c) => sum + c.avgScore, 0) / classroomStats.length) * 100) / 100
        : 0,
      avgGlobalAttendance: classroomStats.length > 0
        ? Math.round((classroomStats.reduce((sum, c) => sum + c.attendanceRate, 0) / classroomStats.length) * 10) / 10
        : 0,
    },
  }
}
