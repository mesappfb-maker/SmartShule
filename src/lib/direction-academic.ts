// SmartShule — Chaîne académique Direction (Étape 2 RDC)
// ============================================================
// Gestion complète par la Direction :
//   - Création de matières
//   - Affectation des professeurs aux classes/matières (multi-classes)
//   - Création d'horaires de cours (emploi du temps professeurs)
//   - Pointage des présences professeurs
//   - Vue agrégée de toute la chaîne académique
//
// EXTENDS les modules existants — ne les remplace pas.

import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'

// ============================================================
// Types
// ============================================================

export interface AcademicChainData {
  subjects: Array<{
    id: string
    name: string
    code: string
    assignmentsCount: number
  }>
  teachers: Array<{
    id: string
    name: string
    function: string
    globalRole?: string
    isMultiDirectorate: boolean
    assignmentsCount: number
    schedulesCount: number
  }>
  assignments: Array<{
    id: string
    teacherName: string
    subjectName: string
    classroomName: string
    directorateName: string
  }>
  todaySchedules: Array<{
    id: string
    teacherName: string
    classroomName: string
    subjectName: string
    dayOfWeek: number
    startTime: string
    endTime: string
    room?: string
  }>
  teacherAttendanceToday: Array<{
    id: string
    teacherName: string
    status: string
    arrivalTime?: string
    departureTime?: string
  }>
}

// ============================================================
// Gestion des matières
// ============================================================

export async function createSubject(input: {
  schoolId: string
  name: string
  code: string
}, tx?: Prisma.TransactionClient) {
  const client = tx || db
  if (!input.name || input.name.length < 2) {
    throw new Error('Le nom de la matière doit faire au moins 2 caractères.')
  }
  if (!input.code || input.code.length < 2) {
    throw new Error('Le code de la matière doit faire au moins 2 caractères.')
  }

  // Vérifier l'unicité du code
  const existing = await client.subject.findFirst({
    where: { schoolId: input.schoolId, code: input.code },
  })
  if (existing) {
    throw new Error(`Une matière avec le code "${input.code}" existe déjà.`)
  }

  return client.subject.create({ data: input })
}

// ============================================================
// Affectation des professeurs (multi-classes)
// ============================================================

export async function assignTeacherToClass(input: {
  employeeId: string
  subjectId: string
  classroomId?: string
  // Permet l'affectation multi-classes en une seule fois
  classroomIds?: string[]
}, tx?: Prisma.TransactionClient) {
  const client = tx || db

  const employee = await client.employee.findUnique({ where: { id: input.employeeId } })
  if (!employee) throw new Error('Enseignant introuvable.')

  const subject = await client.subject.findUnique({ where: { id: input.subjectId } })
  if (!subject) throw new Error('Matière introuvable.')

  // Si classroomIds fourni, créer plusieurs affectations
  const classIds = input.classroomIds || (input.classroomId ? [input.classroomId] : [])
  if (classIds.length === 0) {
    throw new Error('Au moins une classe doit être spécifiée.')
  }

  const created = []
  for (const classroomId of classIds) {
    // Vérifier l'unicité (prof + matière + classe)
    const existing = await client.teacherAssignment.findFirst({
      where: { employeeId: input.employeeId, subjectId: input.subjectId, classroomId },
    })
    if (existing) {
      // Skip si déjà assigné
      continue
    }

    const assignment = await client.teacherAssignment.create({
      data: {
        employeeId: input.employeeId,
        subjectId: input.subjectId,
        classroomId,
      },
    })
    created.push(assignment)
  }

  // Marquer l'employé comme multi-directions si plus d'une classe
  if (classIds.length > 1) {
    await client.employee.update({
      where: { id: input.employeeId },
      data: { isMultiDirectorate: true },
    })
  }

  return created
}

// ============================================================
// Horaires de cours (emploi du temps professeurs)
// ============================================================

export async function createEmployeeSchedule(input: {
  schoolId: string
  employeeId: string
  classroomId?: string
  courseId?: string
  subjectId?: string
  dayOfWeek: number // 0-6
  startTime: string // "08:00"
  endTime: string   // "10:00"
  room?: string
  academicYearLabel?: string
}, tx?: Prisma.TransactionClient) {
  const client = tx || db

  if (input.dayOfWeek < 0 || input.dayOfWeek > 6) {
    throw new Error('Le jour doit être entre 0 (dimanche) et 6 (samedi).')
  }
  if (input.startTime >= input.endTime) {
    throw new Error('L\'heure de début doit être antérieure à l\'heure de fin.')
  }

  // Vérifier les conflits pour le même professeur
  const teacherConflict = await client.employeeSchedule.findFirst({
    where: {
      schoolId: input.schoolId,
      employeeId: input.employeeId,
      dayOfWeek: input.dayOfWeek,
      status: 'ACTIVE',
      AND: [
        { startTime: { lt: input.endTime } },
        { endTime: { gt: input.startTime } },
      ],
    },
  })
  if (teacherConflict) {
    throw new Error('Conflit d\'horaire : ce professeur a déjà un cours sur ce créneau.')
  }

  // Vérifier les conflits pour la même salle (si spécifiée)
  if (input.classroomId) {
    const roomConflict = await client.employeeSchedule.findFirst({
      where: {
        schoolId: input.schoolId,
        classroomId: input.classroomId,
        dayOfWeek: input.dayOfWeek,
        status: 'ACTIVE',
        AND: [
          { startTime: { lt: input.endTime } },
          { endTime: { gt: input.startTime } },
        ],
      },
    })
    if (roomConflict) {
      throw new Error('Conflit de salle : cette classe a déjà un cours sur ce créneau.')
    }
  }

  return client.employeeSchedule.create({ data: input })
}

// ============================================================
// Présence des professeurs (pointage)
// ============================================================

export async function recordTeacherAttendance(input: {
  schoolId: string
  employeeId: string
  date: Date
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED' | 'MISSION'
  arrivalTime?: string
  departureTime?: string
  notes?: string
  recordedById?: string
}, tx?: Prisma.TransactionClient) {
  const client = tx || db

  // Upsert : un prof ne peut avoir qu'un seul pointage par jour
  return client.employeeAttendance.upsert({
    where: {
      schoolId_employeeId_date: {
        schoolId: input.schoolId,
        employeeId: input.employeeId,
        date: input.date,
      },
    },
    create: input,
    update: {
      status: input.status,
      arrivalTime: input.arrivalTime,
      departureTime: input.departureTime,
      notes: input.notes,
      recordedById: input.recordedById,
    },
  })
}

// ============================================================
// Vue agrégée de la chaîne académique
// ============================================================

export async function getAcademicChainData(
  schoolId: string
): Promise<AcademicChainData> {
  const [subjects, employees, assignments, todaySchedules, todayAttendance] = await Promise.all([
    db.subject.findMany({
      where: { schoolId },
      include: {
        teacherAssignments: true,
      },
    }),
    db.employee.findMany({
      where: { schoolId, status: 'ACTIVE' },
      include: {
        teacherAssignments: true,
        schedules: { where: { status: 'ACTIVE' } },
      },
    }),
    db.teacherAssignment.findMany({
      where: { employee: { schoolId } },
      include: {
        employee: true,
        subject: true,
        classroom: { include: { directorate: true } },
      },
    }),
    db.employeeSchedule.findMany({
      where: {
        schoolId,
        dayOfWeek: new Date().getDay(),
        status: 'ACTIVE',
      },
      include: {
        employee: true,
        classroom: true,
        subject: true,
      },
      orderBy: { startTime: 'asc' },
    }),
    db.employeeAttendance.findMany({
      where: {
        schoolId,
        date: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lte: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      },
      include: {
        employee: true,
      },
    }),
  ])

  return {
    subjects: subjects.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      assignmentsCount: s.teacherAssignments.length,
    })),
    teachers: employees.map((e) => ({
      id: e.id,
      name: `${e.firstName} ${e.lastName}`,
      function: e.function,
      globalRole: e.globalRole || undefined,
      isMultiDirectorate: e.isMultiDirectorate,
      assignmentsCount: e.teacherAssignments.length,
      schedulesCount: e.schedules.length,
    })),
    assignments: assignments.map((a) => ({
      id: a.id,
      teacherName: `${a.employee.firstName} ${a.employee.lastName}`,
      subjectName: a.subject.name,
      classroomName: a.classroom?.name || '—',
      directorateName: a.classroom?.directorate.name || '—',
    })),
    todaySchedules: todaySchedules.map((s) => ({
      id: s.id,
      teacherName: `${s.employee.firstName} ${s.employee.lastName}`,
      classroomName: s.classroom?.name || '—',
      subjectName: s.subject?.name || '—',
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      room: s.room || undefined,
    })),
    teacherAttendanceToday: todayAttendance.map((a) => ({
      id: a.id,
      teacherName: `${a.employee.firstName} ${a.employee.lastName}`,
      status: a.status,
      arrivalTime: a.arrivalTime || undefined,
      departureTime: a.departureTime || undefined,
    })),
  }
}
