// SmartShule — Queries : Portail Prof enrichi (Étape 4 RDC)
// IQA, Émargements temps réel, Cahier de textes, Incidents
// + Vue Audit pour la Direction

import { db } from '@/lib/db'
import { computeIqaForStudent, computeIqaForSubject, getClassroomIqaSnapshots } from '@/lib/iqa'

// ============================================================
// Helper : retrouver l'employé lié à un utilisateur
// ============================================================

async function findEmployeeByUserId(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) return null
  const employee = await db.employee.findFirst({
    where: { email: user.email },
    include: { school: true },
  })
  if (!employee) return null
  return { user, employee, schoolId: employee.schoolId }
}

// ============================================================
// 1. Données enrichies pour le portail prof
// ============================================================

export async function getTeacherPortalDataV2(userId: string) {
  const ctx = await findEmployeeByUserId(userId)
  if (!ctx) return null
  const { employee, schoolId } = ctx

  // Cours du jour dans l'agenda
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const todayAgendas = await db.teacherAgenda.findMany({
    where: {
      schoolId,
      teacherId: employee.id,
      startDateTime: { gte: todayStart, lte: todayEnd },
    },
    include: {
      classroom: true,
      subject: true,
      emargements: true,
      lessonLogs: true,
    },
    orderBy: { startDateTime: 'asc' },
  })

  // Tous les agendas à venir (7 prochains jours)
  const upcomingStart = new Date()
  const upcomingEnd = new Date()
  upcomingEnd.setDate(upcomingEnd.getDate() + 7)
  const upcomingAgendas = await db.teacherAgenda.findMany({
    where: {
      schoolId,
      teacherId: employee.id,
      startDateTime: { gte: upcomingStart, lte: upcomingEnd },
    },
    include: {
      classroom: true,
      subject: true,
    },
    orderBy: { startDateTime: 'asc' },
    take: 20,
  })

  // Tous les agendas récents (30 derniers jours)
  const recentStart = new Date()
  recentStart.setDate(recentStart.getDate() - 30)
  const recentAgendas = await db.teacherAgenda.findMany({
    where: {
      schoolId,
      teacherId: employee.id,
      startDateTime: { gte: recentStart },
    },
    include: {
      classroom: true,
      subject: true,
      emargements: { include: { studentAttendances: true } },
      lessonLogs: true,
    },
    orderBy: { startDateTime: 'desc' },
    take: 50,
  })

  // Incidents signalés par ce prof
  const myIncidents = await db.classIncident.findMany({
    where: { teacherId: employee.id },
    include: {
      classroom: true,
      student: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  // Classes assignées (via TeacherAssignment)
  const assignments = await db.teacherAssignment.findMany({
    where: { employeeId: employee.id },
    include: {
      subject: true,
      classroom: { include: { directorate: true, section: true, option: true } },
    },
  })

  // Pour chaque classe, calculer les élèves avec IQA snapshot
  const now = new Date()
  const periodLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const classroomIqaData = await Promise.all(
    assignments
      .filter((a) => a.classroomId)
      .map(async (a) => {
        const iqaList = await getClassroomIqaSnapshots(a.classroomId!, periodLabel)
        return {
          classroomId: a.classroomId,
          classroomName: a.classroom?.name || '—',
          subjectName: a.subject.name,
          directorateName: a.classroom?.directorate.name || '—',
          optionName: a.classroom?.option?.name,
          students: iqaList,
        }
      })
  )

  return {
    teacher: {
      id: employee.id,
      name: `${employee.firstName} ${employee.lastName}`,
      function: employee.function,
    },
    todayAgendas: todayAgendas.map((a) => ({
      id: a.id,
      classroomId: a.classroomId,
      classroomName: a.classroom.name,
      subjectId: a.subjectId,
      subjectName: a.subject?.name || '—',
      startDateTime: a.startDateTime,
      endDateTime: a.endDateTime,
      room: a.room,
      status: a.status,
      hasEmargement: a.emargements.length > 0,
      emargementId: a.emargements[0]?.id || null,
      hasLessonLog: a.lessonLogs.length > 0,
    })),
    upcomingAgendas: upcomingAgendas.map((a) => ({
      id: a.id,
      classroomName: a.classroom.name,
      subjectName: a.subject?.name || '—',
      startDateTime: a.startDateTime,
      endDateTime: a.endDateTime,
      room: a.room,
      status: a.status,
    })),
    recentAgendas: recentAgendas.map((a) => ({
      id: a.id,
      classroomName: a.classroom.name,
      subjectName: a.subject?.name || '—',
      startDateTime: a.startDateTime,
      endDateTime: a.endDateTime,
      status: a.status,
      hasEmargement: a.emargements.length > 0,
      hasLessonLog: a.lessonLogs.length > 0,
      studentsCount: a.emargements[0]?.studentAttendances.length || 0,
    })),
    myIncidents: myIncidents.map((i) => ({
      id: i.id,
      classroomName: i.classroom.name,
      studentName: i.student
        ? `${i.student.firstName} ${i.student.lastName}`
        : null,
      severity: i.severity,
      category: i.category,
      description: i.description,
      status: i.status,
      createdAt: i.createdAt,
      syncStatus: i.syncStatus,
    })),
    classroomIqaData,
    periodLabel,
  }
}

// ============================================================
// 2. Détails d'un émargement avec liste des élèves + IQA
// ============================================================

export async function getEmargementDetails(emargementId: string) {
  const emargement = await db.teacherEmargement.findUnique({
    where: { id: emargementId },
    include: {
      agenda: {
        include: { classroom: true, subject: true },
      },
      studentAttendances: {
        include: {
          student: { select: { id: true, firstName: true, lastName: true, matricule: true } },
        },
      },
    },
  })
  if (!emargement) return null

  // Pour chaque élève, on calcule son IQA Global pour le mois en cours
  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  const periodLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Récupérer les élèves actifs de la classe
  const enrolledStudents = await db.enrollment.findMany({
    where: {
      classroomId: emargement.classroomId,
      status: 'ACTIVE',
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          matricule: true,
          financialStatus: true,
        },
      },
    },
  })

  // Map statut par élève (déjà enregistré ou non)
  const callMap = new Map(emargement.studentAttendances.map((c) => [c.studentId, c]))

  // IQA snapshots persistés
  const iqaSnapshots = await db.iqaSnapshot.findMany({
    where: {
      studentId: { in: enrolledStudents.map((e) => e.studentId) },
      subjectId: null,
      period: periodLabel,
    },
  })
  const iqaMap = new Map(iqaSnapshots.map((s) => [s.studentId, s]))

  return {
    emargement: {
      id: emargement.id,
      agendaId: emargement.agendaId,
      signatureAt: emargement.signatureAt,
      status: emargement.status,
      classroomName: emargement.agenda.classroom.name,
      classroomId: emargement.classroomId,
      subjectId: emargement.subjectId,
      subjectName: emargement.agenda.subject?.name || '—',
      startDateTime: emargement.agenda.startDateTime,
      endDateTime: emargement.agenda.endDateTime,
    },
    students: enrolledStudents.map((e) => {
      const call = callMap.get(e.studentId)
      const iqa = iqaMap.get(e.studentId)
      return {
        studentId: e.student.id,
        name: `${e.student.firstName} ${e.student.lastName}`,
        matricule: e.student.matricule,
        financialStatus: e.student.financialStatus?.[0]?.status || 'REGULAR',
        // Appel déjà enregistré ?
        called: !!call,
        callStatus: call?.status || null,
        lateMinutes: call?.lateMinutes || 0,
        justified: call?.justified || false,
        justification: call?.justification || null,
        // IQA
        iqa: iqa?.iqaValue ?? 100,
        iqaLevel: iqa?.level || 'EXCELLENT',
        totalSessions: iqa?.totalSessions || 0,
        absencesUnexcused: iqa?.absencesUnexcused || 0,
        absencesExcused: iqa?.absencesExcused || 0,
        lateCount: iqa?.lateCount || 0,
      }
    }),
    periodLabel,
  }
}

// ============================================================
// 3. Vue Audit Direction — Cahier de textes filtrable
// ============================================================

export async function getDirectionLessonLogs(
  schoolId: string,
  filters?: { teacherId?: string; subjectId?: string; startDate?: Date; endDate?: Date }
) {
  const where: any = { schoolId }
  if (filters?.teacherId) where.teacherId = filters.teacherId
  if (filters?.subjectId) where.subjectId = filters.subjectId
  if (filters?.startDate || filters?.endDate) {
    where.sessionDate = {}
    if (filters?.startDate) where.sessionDate.gte = filters.startDate
    if (filters?.endDate) where.sessionDate.lte = filters.endDate
  }

  const logs = await db.lessonLog.findMany({
    where,
    include: {
      teacher: { select: { firstName: true, lastName: true } },
      classroom: true,
      subject: true,
    },
    orderBy: { sessionDate: 'desc' },
    take: 200,
  })

  return logs.map((l) => ({
    id: l.id,
    teacherName: `${l.teacher.firstName} ${l.teacher.lastName}`,
    classroomName: l.classroom.name,
    subjectName: l.subject?.name || '—',
    sessionDate: l.sessionDate,
    lessonTitle: l.lessonTitle,
    summary: l.summary,
    homeworkPublished: l.homeworkPublished,
    resourcesUrl: l.resourcesUrl,
    status: l.status,
    auditedAt: l.auditedAt,
    auditComment: l.auditComment,
  }))
}

// ============================================================
// 4. Vue Temps Réel Direction — Profs actuellement en cours
// ============================================================

export async function getDirectionLiveClasses(schoolId: string) {
  const now = new Date()
  // Trouver tous les agendas dont start <= now <= end et status IN_PROGRESS
  const liveAgendas = await db.teacherAgenda.findMany({
    where: {
      schoolId,
      status: 'IN_PROGRESS',
      startDateTime: { lte: now },
      endDateTime: { gte: now },
    },
    include: {
      teacher: { select: { firstName: true, lastName: true } },
      classroom: true,
      subject: true,
      emargements: { include: { studentAttendances: true } },
    },
    orderBy: { startDateTime: 'asc' },
  })

  return liveAgendas.map((a) => ({
    agendaId: a.id,
    teacherId: a.teacherId,
    teacherName: `${a.teacher.firstName} ${a.teacher.lastName}`,
    classroomName: a.classroom.name,
    subjectName: a.subject?.name || '—',
    startDateTime: a.startDateTime,
    endDateTime: a.endDateTime,
    room: a.room,
    emargementSigned: a.emargements.length > 0,
    signatureAt: a.emargements[0]?.signatureAt || null,
    studentsCalled: a.emargements[0]?.studentAttendances.length || 0,
    directorNotifiedAt: a.emargements[0]?.directorNotifiedAt || null,
  }))
}

// ============================================================
// 5. Vue Audit Direction — Incidents non résolus
// ============================================================

export async function getDirectionOpenIncidents(schoolId: string) {
  const incidents = await db.classIncident.findMany({
    where: {
      schoolId,
      status: { in: ['OPEN', 'IN_PROGRESS'] },
    },
    include: {
      teacher: { select: { firstName: true, lastName: true } },
      classroom: true,
      student: { select: { firstName: true, lastName: true, matricule: true } },
    },
    orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    take: 100,
  })

  return incidents.map((i) => ({
    id: i.id,
    teacherName: `${i.teacher.firstName} ${i.teacher.lastName}`,
    classroomName: i.classroom.name,
    studentName: i.student
      ? `${i.student.firstName} ${i.student.lastName} (${i.student.matricule})`
      : null,
    severity: i.severity,
    category: i.category,
    description: i.description,
    status: i.status,
    createdAt: i.createdAt,
    syncStatus: i.syncStatus,
    resolution: i.resolution,
  }))
}

// ============================================================
// 6. Vue Audit Direction — Émargements du jour
// ============================================================

export async function getDirectionTodayEmargements(schoolId: string) {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const emargements = await db.teacherEmargement.findMany({
    where: {
      schoolId,
      signatureAt: { gte: todayStart, lte: todayEnd },
    },
    include: {
      teacher: { select: { firstName: true, lastName: true } },
      classroom: true,
      subject: true,
      agenda: true,
      studentAttendances: true,
      lessonLog: true,
    },
    orderBy: { signatureAt: 'desc' },
  })

  return emargements.map((e) => ({
    id: e.id,
    teacherName: `${e.teacher.firstName} ${e.teacher.lastName}`,
    classroomName: e.classroom.name,
    subjectName: e.subject?.name || '—',
    signatureAt: e.signatureAt,
    startDateTime: e.agenda.startDateTime,
    endDateTime: e.agenda.endDateTime,
    room: e.agenda.room,
    studentsCalledCount: e.studentAttendances.length,
    hasLessonLog: !!e.lessonLog,
    lessonLogStatus: e.lessonLog?.status || null,
  }))
}

// ============================================================
// 7. Vue Temps Réel Direction — Stats temps réel
// ============================================================

export async function getDirectionRealtimeStats(schoolId: string) {
  const now = new Date()

  // Cours en cours
  const liveCount = await db.teacherAgenda.count({
    where: {
      schoolId,
      status: 'IN_PROGRESS',
      startDateTime: { lte: now },
      endDateTime: { gte: now },
    },
  })

  // Cours terminés aujourd'hui
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const doneToday = await db.teacherAgenda.count({
    where: {
      schoolId,
      status: 'DONE',
      endDateTime: { gte: todayStart, lte: todayEnd },
    },
  })

  // Émargements aujourd'hui
  const emargementsToday = await db.teacherEmargement.count({
    where: {
      schoolId,
      signatureAt: { gte: todayStart, lte: todayEnd },
    },
  })

  // Incidents critiques ouverts
  const criticalOpenIncidents = await db.classIncident.count({
    where: {
      schoolId,
      severity: { in: ['HIGH', 'CRITICAL'] },
      status: { in: ['OPEN', 'IN_PROGRESS'] },
    },
  })

  // Cahier de textes publiés aujourd'hui
  const publishedToday = await db.lessonLog.count({
    where: {
      schoolId,
      status: { in: ['PUBLISHED', 'AUDITED'] },
      updatedAt: { gte: todayStart, lte: todayEnd },
    },
  })

  return {
    liveCount,
    doneToday,
    emargementsToday,
    criticalOpenIncidents,
    publishedToday,
    timestamp: now,
  }
}
