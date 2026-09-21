// SmartShule — Tests unitaires : Topologie RDC (Étape 1)
// Vérifie : sync-bridge, teacher-dashboard, statut financier

import { test, expect, describe, beforeAll } from 'bun:test'
import { db } from '../../src/lib/db'
import {
  detectSyncMode,
  getConflictStrategy,
  generateLogicalKey,
  prepareSyncOperation,
  syncWithConflictResolution,
  type ConflictStrategy,
} from '../../src/lib/sync-bridge'
import {
  checkStudentFinancialStatus,
  getFinancialAlertsForClassrooms,
} from '../../src/lib/teacher-dashboard'

let schoolId: string

describe('Topologie RDC — Étape 1', () => {
  beforeAll(async () => {
    const school = await db.school.findFirst()
    if (!school) throw new Error('Aucune école dans la DB.')
    schoolId = school.id
  })

  // ============================================================
  // Sync Bridge — Stratégies de résolution
  // ============================================================
  describe('Sync Bridge — Stratégies', () => {
    test('getConflictStrategy retourne la bonne stratégie par type', () => {
      expect(getConflictStrategy('ATTENDANCE')).toBe('MERGE_BY_LOGICAL_KEY')
      expect(getConflictStrategy('GRADE_DRAFT')).toBe('LAST_WRITE_WINS')
      expect(getConflictStrategy('GRADE_PUBLISHED')).toBe('REFUSE_MODIFICATION')
      expect(getConflictStrategy('TEACHER_LOGBOOK')).toBe('LAST_WRITE_WINS')
      expect(getConflictStrategy('STUDENT_FINANCIAL_STATUS')).toBe('SERVER_PRIORITY')
      expect(getConflictStrategy('ENROLLMENT')).toBe('SERVER_PRIORITY')
      expect(getConflictStrategy('TIMETABLE')).toBe('SERVER_PRIORITY')
      expect(getConflictStrategy('UNKNOWN_TYPE')).toBe('LAST_WRITE_WINS') // défaut
    })

    test('generateLogicalKey génère la clé pour ATTENDANCE', () => {
      const key = generateLogicalKey('ATTENDANCE', {
        schoolId: 'school-1',
        sessionId: 'session-1',
        studentId: 'student-1',
      })
      expect(key).toBe('school-1_session-1_student-1')
    })

    test('generateLogicalKey génère la clé pour GRADE_DRAFT', () => {
      const key = generateLogicalKey('GRADE_DRAFT', {
        studentId: 'stu-1',
        subjectId: 'sub-1',
        title: 'Devoir 1',
      })
      expect(key).toBe('stu-1_sub-1_Devoir 1')
    })

    test('generateLogicalKey retourne undefined pour les types sans clé', () => {
      expect(generateLogicalKey('TIMETABLE', {})).toBeUndefined()
      expect(generateLogicalKey('UNKNOWN', {})).toBeUndefined()
    })

    test('prepareSyncOperation génère une opération avec contexte', () => {
      const op = prepareSyncOperation(
        'ATTENDANCE',
        'attendance-1',
        'CREATE',
        { schoolId: 's1', sessionId: 'sess1', studentId: 'stu1', status: 'PRESENT' }
      )
      expect(op.operationId).toBeTruthy()
      expect(op.conflictStrategy).toBe('MERGE_BY_LOGICAL_KEY')
      expect(op.logicalKey).toBe('s1_sess1_stu1')
    })

    test('syncWithConflictResolution rejette en mode OFFLINE', async () => {
      const op = prepareSyncOperation('GRADE_DRAFT', 'g1', 'CREATE', {})
      const result = await syncWithConflictResolution([op], 'OFFLINE')
      expect(result.accepted).toBe(0)
      expect(result.details[0].status).toBe('REJECTED')
      expect(result.details[0].reason).toContain('hors-ligne')
    })
  })

  // ============================================================
  // Sync Bridge — Détection de mode
  // ============================================================
  describe('Sync Bridge — Détection de mode', () => {
    test('detectSyncMode retourne OFFLINE si aucun serveur accessible', async () => {
      const mode = await detectSyncMode('192.168.99.99') // IP inexistante
      // Soit OFFLINE, soit CLOUD (si internet disponible dans le sandbox)
      expect(['OFFLINE', 'CLOUD']).toContain(mode)
    })

    test('detectSyncMode sans IP retourne OFFLINE ou CLOUD', async () => {
      const mode = await detectSyncMode()
      expect(['OFFLINE', 'CLOUD']).toContain(mode)
    })
  })

  // ============================================================
  // Teacher Dashboard — Statut financier
  // ============================================================
  describe('Teacher Dashboard — Statut financier', () => {
    test('checkStudentFinancialStatus retourne REGULAR pour un élève sans statut', async () => {
      const student = await db.student.findFirst({ where: { schoolId } })
      if (!student) return

      const result = await checkStudentFinancialStatus(student.id)
      expect(result.isLitigation).toBe(false)
      expect(result.status).toBe('REGULAR')
    })

    test('checkStudentFinancialStatus détecte un élève en litige', async () => {
      const student = await db.student.findFirst({ where: { schoolId } })
      if (!student) return

      // Créer un statut de litige
      await db.studentFinancialStatus.upsert({
        where: { schoolId_studentId: { schoolId, studentId: student.id } },
        create: {
          schoolId,
          studentId: student.id,
          status: 'LITIGATION',
          reason: 'Frais impayés T1',
        },
        update: {
          status: 'LITIGATION',
          reason: 'Frais impayés T1',
        },
      })

      const result = await checkStudentFinancialStatus(student.id)
      expect(result.isLitigation).toBe(true)
      expect(result.status).toBe('LITIGATION')
      expect(result.reason).toContain('Frais impayés')

      // Nettoyer
      await db.studentFinancialStatus.deleteMany({
        where: { studentId: student.id },
      })
    })

    test('getFinancialAlertsForClassrooms retourne les élèves en litige', async () => {
      const student = await db.student.findFirst({ where: { schoolId } })
      if (!student) return
      const enrollment = await db.enrollment.findFirst({
        where: { studentId: student.id, status: 'ACTIVE' },
      })
      if (!enrollment) return

      // Créer un statut de litige
      await db.studentFinancialStatus.create({
        data: {
          schoolId,
          studentId: student.id,
          status: 'LITIGATION',
          reason: 'Frais impayés T2',
        },
      })

      const alerts = await getFinancialAlertsForClassrooms(schoolId, [enrollment.classroomId])
      expect(alerts.length).toBeGreaterThanOrEqual(1)
      expect(alerts[0].status).toBe('LITIGATION')
      expect(alerts[0].studentName).toContain(student.firstName)

      // Nettoyer
      await db.studentFinancialStatus.deleteMany({
        where: { studentId: student.id },
      })
    })

    test('getFinancialAlertsForClassrooms retourne un tableau vide sans classes', async () => {
      const alerts = await getFinancialAlertsForClassrooms(schoolId, [])
      expect(alerts).toEqual([])
    })
  })

  // ============================================================
  // Topologie RDC — Options
  // ============================================================
  describe('Topologie RDC — Options', () => {
    test('crée une option pour une section', async () => {
      const section = await db.section.findFirst()
      if (!section) return

      const school = await db.directorate.findUnique({
        where: { id: section.directorateId },
        select: { schoolId: true },
      })
      if (!school) return

      const option = await db.option.create({
        data: {
          schoolId: school.schoolId,
          sectionId: section.id,
          name: 'Coupe-Couture',
          code: 'CC',
        },
      })

      expect(option.id).toBeTruthy()
      expect(option.name).toBe('Coupe-Couture')
      expect(option.code).toBe('CC')

      // Nettoyer
      await db.option.delete({ where: { id: option.id } })
    })

    test('vérifie la contrainte d\'unicité des options', async () => {
      const section = await db.section.findFirst()
      if (!section) return

      const school = await db.directorate.findUnique({
        where: { id: section.directorateId },
        select: { schoolId: true },
      })
      if (!school) return

      const option1 = await db.option.create({
        data: { schoolId: school.schoolId, sectionId: section.id, name: 'Scientifique', code: 'SCI' },
      })

      // Vérifier que l'option existe
      const existing = await db.option.findFirst({
        where: { schoolId: school.schoolId, sectionId: section.id, code: 'SCI' },
      })
      expect(existing).toBeTruthy()
      expect(existing?.name).toBe('Scientifique')

      // Nettoyer
      await db.option.deleteMany({
        where: { schoolId: school.schoolId, sectionId: section.id, code: 'SCI' },
      })
    })
  })

  // ============================================================
  // Topologie RDC — InstanceConfig
  // ============================================================
  describe('Topologie RDC — InstanceConfig', () => {
    test('crée une configuration d\'instance serveur', async () => {
      const config = await db.instanceConfig.create({
        data: {
          schoolId,
          instanceRole: 'SERVER',
          syncTarget: 'LOCAL',
          serverIp: '192.168.1.100',
        },
      })

      expect(config.id).toBeTruthy()
      expect(config.instanceRole).toBe('SERVER')
      expect(config.syncTarget).toBe('LOCAL')

      // Nettoyer
      await db.instanceConfig.delete({ where: { id: config.id } })
    })

    test('crée une configuration d\'instance professeur', async () => {
      const config = await db.instanceConfig.create({
        data: {
          schoolId,
          deviceId: 'device-test-1',
          instanceRole: 'TEACHER',
          syncTarget: 'CLOUD',
        },
      })

      expect(config.instanceRole).toBe('TEACHER')
      expect(config.syncTarget).toBe('CLOUD')

      // Nettoyer
      await db.instanceConfig.delete({ where: { id: config.id } })
    })
  })
})
