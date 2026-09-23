// SmartShule — Teacher Dashboard Helpers (Étape 1 RDC)
// ============================================================
// Helpers pour le tableau de bord enseignant avec :
//   - Filtres multiclasses/multisections
//   - Alertes de statut financier (élèves en litige)
//   - Vue agrégée des cours, notes, présences par classe/section
//
// EXTENDS les queries existantes — ne les remplace pas.

import { db } from '@/lib/db'

// ============================================================
// Types
// ============================================================

export interface TeacherDashboardData {
  teacher: {
    id: string
    name: string
    globalRole?: string
    isMultiDirectorate: boolean
  }
  assignments: Array<{
    classroomId: string
    classroomName: string
    directorateName: string
    sectionName?: string
    optionName?: string
    subjectName: string
    courseId: string
  }>
  financialAlerts: Array<{
    studentId: string
    studentName: string
    classroomName: string
    status: string
    reason?: string
  }>
  todaySchedule: Array<{
    courseId: string
    classroomName: string
    startTime: string
    endTime: string
    room?: string
    subjectName: string
  }>
}

// ============================================================
// Helpers
// ============================================================

/**
 * Récupère les données du tableau de bord enseignant.
 * Inclut les filtres multiclasses (un prof peut enseigner dans plusieurs directions/sections).
 */
export async function getTeacherDashboard(
  employeeId: string,
  schoolId: string,
  filters?: {
    classroomId?: string
    directorateId?: string
    sectionId?: string
    optionId?: string
  }
): Promise<TeacherDashboardData | null> {
  // 1. Récupérer l'enseignant
  const employee = await db.employee.findFirst({
    where: { id: employeeId, schoolId },
  })
  if (!employee) return null

  // 2. Récupérer les affectations avec filtres
  const assignments = await db.teacherAssignment.findMany({
    where: {
      employeeId,
      classroom: filters?.classroomId
        ? { id: filters.classroomId }
        : filters?.directorateId
        ? { directorateId: filters.directorateId }
        : filters?.sectionId
        ? { sectionId: filters.sectionId }
        : filters?.optionId
        ? { optionId: filters.optionId }
        : undefined,
    },
    include: {
      subject: true,
      classroom: {
        include: {
          directorate: true,
          section: true,
          option: true,
        },
      },
    },
  })

  // 3. Récupérer les élèves en litige financier pour les classes du prof
  const classroomIds = assignments.map((a) => a.classroomId)
  const financialAlerts = await getFinancialAlertsForClassrooms(schoolId, classroomIds)

  // 4. Récupérer l'emploi du temps du jour
  const today = new Date().getDay() // 0=Dimanche, 6=Samedi
  const todaySchedule = await db.timetable.findMany({
    where: {
      schoolId,
      dayOfWeek: today,
      classroomId: { in: classroomIds },
    },
    include: {
      course: { include: { subject: true } },
      classroom: true,
    },
    orderBy: { startTime: 'asc' },
  })

  return {
    teacher: {
      id: employee.id,
      name: `${employee.firstName} ${employee.lastName}`,
      globalRole: employee.globalRole || undefined,
      isMultiDirectorate: employee.isMultiDirectorate,
    },
    assignments: assignments.map((a) => ({
      classroomId: a.classroomId,
      classroomName: a.classroom.name,
      directorateName: a.classroom.directorate.name,
      sectionName: a.classroom.section?.name,
      optionName: a.classroom.option?.name,
      subjectName: a.subject.name,
      courseId: a.subjectId, // Approximation — courseId serait sur l'affectation
    })),
    financialAlerts,
    todaySchedule: todaySchedule.map((s) => ({
      courseId: s.courseId,
      classroomName: s.classroom.name,
      startTime: s.startTime,
      endTime: s.endTime,
      room: s.room || undefined,
      subjectName: s.course.subject.name,
    })),
  }
}

/**
 * Récupère les alertes financières pour un ensemble de classes.
 * Utilisé pour afficher l'alerte discrète sur le registre de présence.
 */
export async function getFinancialAlertsForClassrooms(
  schoolId: string,
  classroomIds: string[]
): Promise<TeacherDashboardData['financialAlerts']> {
  if (classroomIds.length === 0) return []

  const studentsInLitigation = await db.studentFinancialStatus.findMany({
    where: {
      schoolId,
      status: { in: ['LITIGATION', 'BLOCKED'] },
      student: {
        enrollments: {
          some: {
            classroomId: { in: classroomIds },
            status: 'ACTIVE',
          },
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

  return studentsInLitigation.map((s) => {
    const enr = s.student.enrollments[0]
    return {
      studentId: s.studentId,
      studentName: `${s.student.firstName} ${s.student.lastName}`,
      classroomName: enr?.classroom.name || '—',
      status: s.status,
      reason: s.reason || undefined,
    }
  })
}

/**
 * Vérifie si un élève est en litige financier.
 * Utilisé par le registre de présence pour afficher l'alerte discrète.
 */
export async function checkStudentFinancialStatus(
  studentId: string
): Promise<{ isLitigation: boolean; status: string; reason?: string }> {
  const status = await db.studentFinancialStatus.findFirst({
    where: { studentId },
  })
  if (!status) {
    return { isLitigation: false, status: 'REGULAR' }
  }
  return {
    isLitigation: status.status !== 'REGULAR',
    status: status.status,
    reason: status.reason || undefined,
  }
}
