// SmartShule — Tests : Chaîne académique Direction (Étape 2 RDC)
// Vérifie : matières, affectations multi-classes, horaires, présences profs

import { test, expect, describe, beforeAll } from 'bun:test'
import { db } from '../../src/lib/db'
import {
  createSubject,
  assignTeacherToClass,
  createEmployeeSchedule,
  recordTeacherAttendance,
  getAcademicChainData,
} from '../../src/lib/direction-academic'

let schoolId: string

describe('Chaîne académique Direction (Étape 2 RDC)', () => {
  beforeAll(async () => {
    const school = await db.school.findFirst()
    if (!school) throw new Error('Aucune école dans la DB.')
    schoolId = school.id
  })

  // ============================================================
  // Matières
  // ============================================================
  describe('Création de matières', () => {
    test('crée une matière avec nom et code', async () => {
      const uniqueCode = `HG${Date.now().toString().slice(-4)}`
      const subject = await createSubject({
        schoolId,
        name: 'Histoire-Géographie',
        code: uniqueCode,
      })

      expect(subject.id).toBeTruthy()
      expect(subject.name).toBe('Histoire-Géographie')
      expect(subject.code).toBe(uniqueCode)

      // Nettoyer
      await db.subject.delete({ where: { id: subject.id } })
    })

    test('rejette un nom trop court', async () => {
      await expect(createSubject({
        schoolId,
        name: 'A',
        code: 'TEST',
      })).rejects.toThrow()
    })

    test('rejette un code en double', async () => {
      const subject = await createSubject({
        schoolId,
        name: 'Test Matière',
        code: 'TST',
      })

      await expect(createSubject({
        schoolId,
        name: 'Autre Matière',
        code: 'TST',
      })).rejects.toThrow(/existe déjà/)

      // Nettoyer
      await db.subject.delete({ where: { id: subject.id } })
    })
  })

  // ============================================================
  // Affectations multi-classes
  // ============================================================
  describe('Affectation des professeurs', () => {
    test('affecte un prof à une seule classe', async () => {
      const teacher = await db.employee.findFirst({ where: { schoolId } })
      if (!teacher) return
      const subject = await db.subject.findFirst({ where: { schoolId } })
      if (!subject) return
      const classroom = await db.classroom.findFirst()
      if (!classroom) return

      const assignments = await assignTeacherToClass({
        employeeId: teacher.id,
        subjectId: subject.id,
        classroomId: classroom.id,
      })

      expect(assignments).toHaveLength(1)

      // Nettoyer
      await db.teacherAssignment.deleteMany({
        where: { employeeId: teacher.id, subjectId: subject.id, classroomId: classroom.id },
      })
    })

    test('affecte un prof à plusieurs classes (multi-classes)', async () => {
      const teacher = await db.employee.findFirst({ where: { schoolId } })
      if (!teacher) return
      const subject = await db.subject.findFirst({ where: { schoolId } })
      if (!subject) return
      const classrooms = await db.classroom.findMany({ take: 2 })
      if (classrooms.length < 2) return

      const assignments = await assignTeacherToClass({
        employeeId: teacher.id,
        subjectId: subject.id,
        classroomIds: classrooms.map((c) => c.id),
      })

      expect(assignments.length).toBeGreaterThanOrEqual(1)

      // Vérifier que l'employé est marqué multi-directions
      const updated = await db.employee.findUnique({ where: { id: teacher.id } })
      expect(updated?.isMultiDirectorate).toBe(true)

      // Nettoyer
      await db.teacherAssignment.deleteMany({
        where: { employeeId: teacher.id, subjectId: subject.id },
      })
      // Réinitialiser le flag
      await db.employee.update({
        where: { id: teacher.id },
        data: { isMultiDirectorate: false },
      })
    })

    test('ne crée pas de doublon (idempotent)', async () => {
      const teacher = await db.employee.findFirst({ where: { schoolId } })
      if (!teacher) return
      const subject = await db.subject.findFirst({ where: { schoolId } })
      if (!subject) return
      const classroom = await db.classroom.findFirst()
      if (!classroom) return

      // Première affectation
      await assignTeacherToClass({
        employeeId: teacher.id,
        subjectId: subject.id,
        classroomId: classroom.id,
      })

      // Deuxième tentative (même affectation)
      const result = await assignTeacherToClass({
        employeeId: teacher.id,
        subjectId: subject.id,
        classroomId: classroom.id,
      })

      // Ne doit pas créer de doublon
      expect(result).toHaveLength(0)

      // Nettoyer
      await db.teacherAssignment.deleteMany({
        where: { employeeId: teacher.id, subjectId: subject.id, classroomId: classroom.id },
      })
    })
  })

  // ============================================================
  // Horaires de cours
  // ============================================================
  describe('Horaires de cours (emploi du temps)', () => {
    test('crée un horaire pour un professeur', async () => {
      const teacher = await db.employee.findFirst({ where: { schoolId } })
      if (!teacher) return

      const schedule = await createEmployeeSchedule({
        schoolId,
        employeeId: teacher.id,
        dayOfWeek: 4, // Jeudi
        startTime: '16:00',
        endTime: '18:00',
        room: 'Salle 200',
      })

      expect(schedule.id).toBeTruthy()
      expect(schedule.dayOfWeek).toBe(4)

      // Nettoyer
      await db.employeeSchedule.delete({ where: { id: schedule.id } })
    })

    test('rejette un conflit d\'horaire pour le même professeur', async () => {
      const teacher = await db.employee.findFirst({ where: { schoolId } })
      if (!teacher) return

      // Premier horaire
      await createEmployeeSchedule({
        schoolId,
        employeeId: teacher.id,
        dayOfWeek: 5, // Vendredi
        startTime: '14:00',
        endTime: '16:00',
      }).catch(() => {}) // Ignorer si existe déjà

      // Conflit : chevauche 14h-16h
      await expect(createEmployeeSchedule({
        schoolId,
        employeeId: teacher.id,
        dayOfWeek: 5,
        startTime: '15:00',
        endTime: '17:00',
      })).rejects.toThrow(/Conflit d'horaire/)
    })

    test('rejette un conflit de salle', async () => {
      const teacher = await db.employee.findFirst({ where: { schoolId } })
      if (!teacher) return
      const classroom = await db.classroom.findFirst()
      if (!classroom) return

      // Premier horaire avec salle
      await createEmployeeSchedule({
        schoolId,
        employeeId: teacher.id,
        classroomId: classroom.id,
        dayOfWeek: 6, // Samedi
        startTime: '08:00',
        endTime: '10:00',
      }).catch(() => {})

      // Conflit : même salle, même créneau, prof différent
      const otherTeacher = await db.employee.findFirst({
        where: { schoolId, id: { not: teacher.id } },
      })
      if (!otherTeacher) return

      await expect(createEmployeeSchedule({
        schoolId,
        employeeId: otherTeacher.id,
        classroomId: classroom.id,
        dayOfWeek: 6,
        startTime: '09:00',
        endTime: '11:00',
      })).rejects.toThrow(/Conflit de salle/)
    })
  })

  // ============================================================
  // Présences professeurs
  // ============================================================
  describe('Présences des professeurs', () => {
    test('enregistre le pointage d\'un professeur', async () => {
      const teacher = await db.employee.findFirst({ where: { schoolId } })
      if (!teacher) return

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const attendance = await recordTeacherAttendance({
        schoolId,
        employeeId: teacher.id,
        date: today,
        status: 'PRESENT',
        arrivalTime: '07:45',
        departureTime: '16:30',
      })

      expect(attendance.id).toBeTruthy()
      expect(attendance.status).toBe('PRESENT')
      expect(attendance.arrivalTime).toBe('07:45')

      // Nettoyer
      await db.employeeAttendance.delete({ where: { id: attendance.id } })
    })

    test('met à jour le pointage (upsert)', async () => {
      const teacher = await db.employee.findFirst({ where: { schoolId } })
      if (!teacher) return

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // Premier pointage
      await recordTeacherAttendance({
        schoolId,
        employeeId: teacher.id,
        date: today,
        status: 'LATE',
        arrivalTime: '08:15',
      })

      // Mise à jour
      const updated = await recordTeacherAttendance({
        schoolId,
        employeeId: teacher.id,
        date: today,
        status: 'PRESENT',
        arrivalTime: '07:55',
      })

      expect(updated.status).toBe('PRESENT')
      expect(updated.arrivalTime).toBe('07:55')

      // Nettoyer
      await db.employeeAttendance.delete({ where: { id: updated.id } })
    })
  })

  // ============================================================
  // Vue agrégée
  // ============================================================
  describe('Vue agrégée de la chaîne académique', () => {
    test('récupère toutes les données académiques', async () => {
      const data = await getAcademicChainData(schoolId)

      expect(data).toHaveProperty('subjects')
      expect(data).toHaveProperty('teachers')
      expect(data).toHaveProperty('assignments')
      expect(data).toHaveProperty('todaySchedules')
      expect(data).toHaveProperty('teacherAttendanceToday')

      expect(Array.isArray(data.subjects)).toBe(true)
      expect(data.subjects.length).toBeGreaterThan(0)
      expect(Array.isArray(data.teachers)).toBe(true)
      expect(data.teachers.length).toBeGreaterThan(0)
    })
  })
})
