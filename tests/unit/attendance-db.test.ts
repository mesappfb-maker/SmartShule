// SmartShule — Tests d'intégration DB : Appel & Notes (Cycle 03)
//
// Vérifie :
//   - La déduplication via la clé logique (schoolId + attendanceSessionId + studentId) ;
//   - Le verrouillage de session (status OPEN → LOCKED) ;
//   - La création d'une note en brouillon + transition jusqu'à PUBLISHED ;
//   - Le refus de modification d'une note PUBLISHED ;
//   - La notification parent créée en DB lors d'une absence.

import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { db } from '../../src/lib/db'
import {
  findOrCreateAttendanceSession,
  upsertAttendance,
  lockAttendanceSession,
  notifyParentsOfAbsence,
  createGradeDraft,
  updateGradeDraft,
  transitionGradeStatus,
  requestGradeCorrection,
  AttendanceError,
  GradeError,
  type AttendanceStatus,
} from '../../src/lib/attendance'

const TEST_SUFFIX = Date.now().toString()
let schoolId: string
let directorateId: string
let classroomId: string
let courseId: string
let subjectId: string
let studentId: string
let guardianUserId: string
let teacherUserId: string

describe('Appel & Notes — intégration DB', () => {
  beforeAll(async () => {
    // Créer l'écosystème de test
    const school = await db.school.create({
      data: {
        name: `Test School Attendance ${TEST_SUFFIX}`,
        primaryColor: '#2563EB',
        secondaryColor: '#0F766E',
        tertiaryColor: '#F59E0B',
        currency: 'EUR',
        locale: 'fr-FR',
      },
    })
    schoolId = school.id

    const directorate = await db.directorate.create({
      data: { schoolId, name: 'Secondaire', code: 'SEC' },
    })
    directorateId = directorate.id

    const academicYear = await db.academicYear.create({
      data: {
        schoolId, label: '2025-2026',
        startDate: new Date('2025-09-01'),
        endDate: new Date('2026-07-15'),
        active: true,
      },
    })

    const classroom = await db.classroom.create({
      data: {
        directorateId,
        academicYearId: academicYear.id,
        name: `6ème Test ${TEST_SUFFIX}`,
        capacity: 30,
      },
    })
    classroomId = classroom.id

    const subject = await db.subject.create({
      data: { schoolId, name: 'Maths Test', code: 'MATHS-T' },
    })
    subjectId = subject.id

    const course = await db.course.create({
      data: {
        schoolId, classroomId, subjectId,
        title: 'Cours test',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    })
    courseId = course.id

    // Élève
    const student = await db.student.create({
      data: {
        schoolId,
        matricule: `ST-${TEST_SUFFIX}`,
        firstName: 'Test',
        lastName: 'Student',
        status: 'ACTIVE',
      },
    })
    studentId = student.id

    await db.enrollment.create({
      data: {
        studentId, classroomId,
        academicYearId: academicYear.id,
        status: 'ACTIVE',
      },
    })

    // Parent
    const guardianUser = await db.user.create({
      data: {
        email: `parent-test-${TEST_SUFFIX}@smartshule.test`,
        passwordHash: 'pbkdf2$100000$sha512$salt$hash',
        role: 'PARENT',
        displayName: 'Test Parent',
        active: true,
      },
    })
    guardianUserId = guardianUser.id

    const guardian = await db.guardian.create({
      data: {
        schoolId,
        userId: guardianUser.id,
        firstName: 'Test',
        lastName: 'Parent',
      },
    })

    await db.guardianStudentLink.create({
      data: {
        guardianId: guardian.id,
        studentId,
        relationship: 'PERE',
        isPrimary: true,
      },
    })

    // Enseignant
    const teacherUser = await db.user.create({
      data: {
        email: `teacher-test-${TEST_SUFFIX}@smartshule.test`,
        passwordHash: 'pbkdf2$100000$sha512$salt$hash',
        role: 'DIRECTION', // pour pouvoir publier les notes
        displayName: 'Test Teacher',
        active: true,
      },
    })
    teacherUserId = teacherUser.id
  })

  afterAll(async () => {
    // Nettoyer
    await db.gradeCorrection.deleteMany({ where: { grade: { schoolId } } })
    await db.notification.deleteMany({ where: { userId: { in: [guardianUserId, teacherUserId] } } })
    await db.grade.deleteMany({ where: { schoolId } })
    await db.attendance.deleteMany({ where: { schoolId } })
    await db.attendanceSession.deleteMany({ where: { schoolId } })
    await db.course.deleteMany({ where: { schoolId } })
    await db.enrollment.deleteMany({ where: { student: { schoolId } } })
    await db.guardianStudentLink.deleteMany({ where: { student: { schoolId } } })
    await db.student.deleteMany({ where: { schoolId } })
    await db.guardian.deleteMany({ where: { schoolId } })
    await db.subject.deleteMany({ where: { schoolId } })
    await db.classroom.deleteMany({ where: { directorate: { schoolId } } })
    await db.directorate.deleteMany({ where: { schoolId } })
    await db.academicYear.deleteMany({ where: { schoolId } })
    await db.school.deleteMany({ where: { id: schoolId } })
    await db.user.deleteMany({ where: { id: { in: [guardianUserId, teacherUserId] } } })
  })

  // ============================================================
  // Appel — Déduplication
  // ============================================================

  describe('findOrCreateAttendanceSession', () => {
    test('crée une session puis la réutilise', async () => {
      const date = new Date('2025-09-17')
      const s1 = await findOrCreateAttendanceSession({
        schoolId, courseId, classroomId, teacherId: teacherUserId, date,
      })
      expect(s1.status).toBe('OPEN')

      const s2 = await findOrCreateAttendanceSession({
        schoolId, courseId, classroomId, teacherId: teacherUserId, date,
      })
      expect(s2.id).toBe(s1.id)
    })
  })

  describe('upsertAttendance — déduplication', () => {
    test('crée une présence puis la met à jour (pas de doublon)', async () => {
      const date = new Date('2025-09-18')
      const session = await findOrCreateAttendanceSession({
        schoolId, courseId, classroomId, teacherId: teacherUserId, date,
      })

      // Première insertion : PRESENT
      const r1 = await upsertAttendance({
        schoolId,
        attendanceSessionId: session.id,
        studentId, courseId, date,
        status: 'PRESENT' as AttendanceStatus,
      })
      expect(r1.created).toBe(true)

      // Deuxième insertion : LATE — doit mettre à jour, pas créer
      const r2 = await upsertAttendance({
        schoolId,
        attendanceSessionId: session.id,
        studentId, courseId, date,
        status: 'LATE' as AttendanceStatus,
      })
      expect(r2.created).toBe(false)
      expect(r2.id).toBe(r1.id)

      // Compter les présences pour cet élève dans cette session
      const count = await db.attendance.count({
        where: { attendanceSessionId: session.id, studentId },
      })
      expect(count).toBe(1)
    })

    test('rejette un élève non inscrit', async () => {
      const date = new Date('2025-09-19')
      const session = await findOrCreateAttendanceSession({
        schoolId, courseId, classroomId, teacherId: teacherUserId, date,
      })
      // Créer un autre élève non inscrit
      const otherStudent = await db.student.create({
        data: {
          schoolId,
          matricule: `ST2-${TEST_SUFFIX}`,
          firstName: 'Other',
          lastName: 'Student',
          status: 'ACTIVE',
        },
      })

      await expect(upsertAttendance({
        schoolId,
        attendanceSessionId: session.id,
        studentId: otherStudent.id,
        courseId, date,
        status: 'PRESENT' as AttendanceStatus,
      })).rejects.toThrow(AttendanceError)

      // Nettoyer
      await db.student.delete({ where: { id: otherStudent.id } })
    })
  })

  // ============================================================
  // Verrouillage
  // ============================================================

  describe('lockAttendanceSession', () => {
    test('verrouille une session ouverte', async () => {
      const date = new Date('2025-09-20')
      const session = await findOrCreateAttendanceSession({
        schoolId, courseId, classroomId, teacherId: teacherUserId, date,
      })
      await lockAttendanceSession(session.id, teacherUserId)

      const updated = await db.attendanceSession.findUnique({ where: { id: session.id } })
      expect(updated?.status).toBe('LOCKED')
      expect(updated?.lockedAt).toBeTruthy()
      expect(updated?.lockedById).toBe(teacherUserId)
    })

    test('rejette le verrouillage d\'une session déjà verrouillée', async () => {
      const date = new Date('2025-09-21')
      const session = await findOrCreateAttendanceSession({
        schoolId, courseId, classroomId, teacherId: teacherUserId, date,
      })
      await lockAttendanceSession(session.id, teacherUserId)

      await expect(lockAttendanceSession(session.id, teacherUserId))
        .rejects.toThrow(AttendanceError)
    })

    test('rejette l\'enregistrement d\'appel sur session verrouillée', async () => {
      const date = new Date('2025-09-22')
      const session = await findOrCreateAttendanceSession({
        schoolId, courseId, classroomId, teacherId: teacherUserId, date,
      })
      await lockAttendanceSession(session.id, teacherUserId)

      await expect(upsertAttendance({
        schoolId,
        attendanceSessionId: session.id,
        studentId, courseId, date,
        status: 'PRESENT' as AttendanceStatus,
      })).rejects.toThrow(AttendanceError)
    })
  })

  // ============================================================
  // Notification parent
  // ============================================================

  describe('notifyParentsOfAbsence', () => {
    test('crée une notification pour le parent rattaché', async () => {
      const beforeCount = await db.notification.count({
        where: { userId: guardianUserId },
      })

      const count = await notifyParentsOfAbsence({
        schoolId,
        studentId,
        studentName: 'Test Student',
        sessionDate: new Date('2025-09-23'),
        courseTitle: 'Cours test',
      })

      expect(count).toBe(1)
      const afterCount = await db.notification.count({
        where: { userId: guardianUserId },
      })
      expect(afterCount).toBe(beforeCount + 1)

      const notif = await db.notification.findFirst({
        where: { userId: guardianUserId, type: 'ABSENCE_ALERT' },
        orderBy: { createdAt: 'desc' },
      })
      expect(notif).toBeTruthy()
      expect(notif?.title).toContain('Test Student')
      expect(notif?.read).toBe(false)
    })
  })

  // ============================================================
  // Workflow notes
  // ============================================================

  describe('Workflow notes (DRAFT → PUBLISHED)', () => {
    let gradeId: string

    test('crée une note en brouillon', async () => {
      const result = await createGradeDraft({
        schoolId, studentId, subjectId, classroomId,
        teacherId: teacherUserId,
        title: 'Devoir test',
        score: 15, maxScore: 20, weight: 1,
        teacherComment: 'Bon travail',
      })
      gradeId = result.id
      expect(gradeId).toBeTruthy()

      const grade = await db.grade.findUnique({ where: { id: gradeId } })
      expect(grade?.status).toBe('DRAFT')
      expect(grade?.score).toBe(15)
      expect(grade?.scoreCents).toBe(1500)
    })

    test('met à jour le score d\'un brouillon', async () => {
      await updateGradeDraft(gradeId, { score: 17, teacherComment: 'Très bien' })
      const grade = await db.grade.findUnique({ where: { id: gradeId } })
      expect(grade?.score).toBe(17)
      expect(grade?.teacherComment).toBe('Très bien')
    })

    test('DRAFT → SUBMITTED', async () => {
      const r = await transitionGradeStatus(gradeId, 'SUBMITTED', teacherUserId)
      expect(r.previousStatus).toBe('DRAFT')
      expect(r.newStatus).toBe('SUBMITTED')
    })

    test('SUBMITTED → CONTROLLED', async () => {
      const r = await transitionGradeStatus(gradeId, 'CONTROLLED', teacherUserId)
      expect(r.newStatus).toBe('CONTROLLED')
    })

    test('CONTROLLED → PUBLISHED', async () => {
      const r = await transitionGradeStatus(gradeId, 'PUBLISHED', teacherUserId)
      expect(r.newStatus).toBe('PUBLISHED')
    })

    test('PUBLISHED est terminal (refus de modification)', async () => {
      await expect(transitionGradeStatus(gradeId, 'DRAFT', teacherUserId))
        .rejects.toThrow(GradeError)
      await expect(updateGradeDraft(gradeId, { score: 18 }))
        .rejects.toThrow(GradeError)
    })

    test('refuse la transition DRAFT → PUBLISHED (saut d\'étape)', async () => {
      // Créer une nouvelle note en brouillon
      const draft2 = await createGradeDraft({
        schoolId, studentId, subjectId, classroomId,
        teacherId: teacherUserId,
        title: 'Devoir test 2',
        score: 12, maxScore: 20,
      })
      await expect(transitionGradeStatus(draft2.id, 'PUBLISHED', teacherUserId))
        .rejects.toThrow(GradeError)
    })

    test('permet la demande de correction sur note publiée', async () => {
      const correction = await requestGradeCorrection({
        gradeId,
        correctedScore: 18,
        reason: 'Erreur de saisie initiale',
        requestedById: teacherUserId,
      })
      expect(correction.id).toBeTruthy()

      const c = await db.gradeCorrection.findUnique({ where: { id: correction.id } })
      expect(c?.previousScore).toBe(17)
      expect(c?.correctedScore).toBe(18)
      expect(c?.status).toBe('PENDING')
      expect(c?.reason).toContain('Erreur de saisie')
    })

    test('rejette la demande de correction sur note non publiée', async () => {
      const draft = await createGradeDraft({
        schoolId, studentId, subjectId, classroomId,
        teacherId: teacherUserId,
        title: 'Devoir non publié',
        score: 10, maxScore: 20,
      })
      await expect(requestGradeCorrection({
        gradeId: draft.id,
        correctedScore: 15,
        reason: 'Test correction',
        requestedById: teacherUserId,
      })).rejects.toThrow(GradeError)
    })
  })
})
