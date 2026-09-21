'use server'

// SmartShule — Server Actions Chaîne Académique (Étape 2 RDC)
// Création de matières, affectation professeurs, horaires, présences profs

import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import {
  createSubject,
  assignTeacherToClass,
  createEmployeeSchedule,
  recordTeacherAttendance,
} from '@/lib/direction-academic'

// ============================================================
// Helper
// ============================================================

async function getDirectionSchoolId(userId: string): Promise<string | null> {
  const audit = await db.auditLog.findFirst({
    where: { userId, schoolId: { not: null } },
    select: { schoolId: true },
  })
  if (audit?.schoolId) return audit.schoolId
  const school = await db.school.findFirst()
  return school?.id || null
}

// ============================================================
// 1. createSubjectAction
// ============================================================

export async function createSubjectAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ ok: true; subjectId: string } | { ok: false; error: string }> {
  const user = await getUserFromSession()
  if (!user || (user.role !== 'DIRECTION' && user.role !== 'ADMIN')) {
    return { ok: false, error: 'Action réservée à la direction.' }
  }

  const name = String(formData.get('name') || '').trim()
  const code = String(formData.get('code') || '').trim().toUpperCase()

  if (!name || !code) {
    return { ok: false, error: 'Nom et code obligatoires.' }
  }

  const schoolId = await getDirectionSchoolId(user.id)
  if (!schoolId) return { ok: false, error: 'École introuvable.' }

  try {
    const result = await db.$transaction(async (tx) => {
      return createSubject({ schoolId, name, code }, tx)
    })

    const h = await headers()
    await logAudit({
      userId: user.id, userName: user.displayName, userRole: user.role,
      schoolId, action: 'CREATE_SUBJECT', entityType: 'SUBJECT',
      entityId: result.id,
      description: `Création de la matière « ${name} » (${code})`,
      ipAddress: getClientIP(h),
    })

    revalidatePath('/')
    return { ok: true, subjectId: result.id }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur lors de la création de la matière.' }
  }
}

// ============================================================
// 2. assignTeacherAction (multi-classes)
// ============================================================

export async function assignTeacherAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const user = await getUserFromSession()
  if (!user || (user.role !== 'DIRECTION' && user.role !== 'ADMIN')) {
    return { ok: false, error: 'Action réservée à la direction.' }
  }

  const employeeId = String(formData.get('employeeId') || '')
  const subjectId = String(formData.get('subjectId') || '')
  const classroomIdsJson = String(formData.get('classroomIds') || '[]')

  if (!employeeId || !subjectId) {
    return { ok: false, error: 'Enseignant et matière obligatoires.' }
  }

  let classroomIds: string[]
  try {
    classroomIds = JSON.parse(classroomIdsJson)
  } catch {
    return { ok: false, error: 'Classes invalides.' }
  }

  if (!Array.isArray(classroomIds) || classroomIds.length === 0) {
    return { ok: false, error: 'Au moins une classe doit être sélectionnée.' }
  }

  try {
    const result = await db.$transaction(async (tx) => {
      return assignTeacherToClass({ employeeId, subjectId, classroomIds }, tx)
    })

    const h = await headers()
    const schoolId = await getDirectionSchoolId(user.id)
    await logAudit({
      userId: user.id, userName: user.displayName, userRole: user.role,
      schoolId: schoolId || undefined,
      action: 'ASSIGN_TEACHER', entityType: 'TEACHER_ASSIGNMENT',
      description: `Affectation de ${result.length} classe(s) à un enseignant`,
      ipAddress: getClientIP(h),
    })

    revalidatePath('/')
    return { ok: true, count: result.length }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur lors de l\'affectation.' }
  }
}

// ============================================================
// 3. createScheduleAction (horaire de cours)
// ============================================================

export async function createScheduleAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ ok: true; scheduleId: string } | { ok: false; error: string }> {
  const user = await getUserFromSession()
  if (!user || (user.role !== 'DIRECTION' && user.role !== 'ADMIN')) {
    return { ok: false, error: 'Action réservée à la direction.' }
  }

  const employeeId = String(formData.get('employeeId') || '')
  const classroomId = String(formData.get('classroomId') || '') || undefined
  const subjectId = String(formData.get('subjectId') || '') || undefined
  const courseId = String(formData.get('courseId') || '') || undefined
  const dayOfWeek = parseInt(String(formData.get('dayOfWeek') || '0'), 10)
  const startTime = String(formData.get('startTime') || '')
  const endTime = String(formData.get('endTime') || '')
  const room = String(formData.get('room') || '') || undefined

  if (!employeeId || !startTime || !endTime) {
    return { ok: false, error: 'Enseignant, heure de début et fin obligatoires.' }
  }

  const schoolId = await getDirectionSchoolId(user.id)
  if (!schoolId) return { ok: false, error: 'École introuvable.' }

  try {
    const result = await db.$transaction(async (tx) => {
      return createEmployeeSchedule({
        schoolId, employeeId, classroomId, courseId, subjectId,
        dayOfWeek, startTime, endTime, room,
      }, tx)
    })

    const h = await headers()
    await logAudit({
      userId: user.id, userName: user.displayName, userRole: user.role,
      schoolId, action: 'CREATE_SCHEDULE', entityType: 'EMPLOYEE_SCHEDULE',
      entityId: result.id,
      description: `Création d'un horaire de cours (jour ${dayOfWeek}, ${startTime}-${endTime})`,
      ipAddress: getClientIP(h),
    })

    revalidatePath('/')
    return { ok: true, scheduleId: result.id }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur lors de la création de l\'horaire.' }
  }
}

// ============================================================
// 4. recordTeacherAttendanceAction
// ============================================================

export async function recordTeacherAttendanceAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ ok: true; attendanceId: string } | { ok: false; error: string }> {
  const user = await getUserFromSession()
  if (!user || (user.role !== 'DIRECTION' && user.role !== 'ADMIN')) {
    return { ok: false, error: 'Action réservée à la direction.' }
  }

  const employeeId = String(formData.get('employeeId') || '')
  const dateStr = String(formData.get('date') || '')
  const status = String(formData.get('status') || 'PRESENT')
  const arrivalTime = String(formData.get('arrivalTime') || '') || undefined
  const departureTime = String(formData.get('departureTime') || '') || undefined
  const notes = String(formData.get('notes') || '') || undefined

  if (!employeeId || !dateStr) {
    return { ok: false, error: 'Enseignant et date obligatoires.' }
  }

  const schoolId = await getDirectionSchoolId(user.id)
  if (!schoolId) return { ok: false, error: 'École introuvable.' }

  try {
    const date = new Date(dateStr)
    const result = await db.$transaction(async (tx) => {
      return recordTeacherAttendance({
        schoolId, employeeId, date, status,
        arrivalTime, departureTime, notes,
        recordedById: user.id,
      }, tx)
    })

    const h = await headers()
    await logAudit({
      userId: user.id, userName: user.displayName, userRole: user.role,
      schoolId, action: 'RECORD_TEACHER_ATTENDANCE', entityType: 'EMPLOYEE_ATTENDANCE',
      entityId: result.id,
      description: `Pointage professeur : ${status}`,
      ipAddress: getClientIP(h),
    })

    revalidatePath('/')
    return { ok: true, attendanceId: result.id }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur lors du pointage.' }
  }
}
