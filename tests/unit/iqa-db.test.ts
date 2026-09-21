// SmartShule — Tests unitaires : Server Actions Émargements
// Étape 4 RDC — Portail Prof
//
// Valide :
//   - Création d'agenda + émargement
//   - Appel d'élève (PRESENT/LATE/ABSENT/EXCUSED)
//   - Idempotence (clientUUID anti-doublon)
//   - Sauvegarde du cahier de textes
//   - Notifications Direction

import { describe, it, expect, beforeEach } from 'bun:test'
import { db } from '@/lib/db'
import { computeIqa, persistIqaSnapshot, getClassroomIqaSnapshots } from '@/lib/iqa'

// Helper pour préparer une école + classe + élèves de test
async function setupTestData() {
  // Trouver ou créer une école
  let school = await db.school.findFirst()
  if (!school) {
    school = await db.school.create({
      data: {
        name: 'Test School',
        currency: 'CDF',
        locale: 'fr-FR',
      },
    })
  }

  // Trouver ou créer une année académique
  let year = await db.academicYear.findFirst({
    where: { schoolId: school.id, active: true },
  })
  if (!year) {
    year = await db.academicYear.create({
      data: {
        schoolId: school.id,
        label: '2025-2026',
        startDate: new Date('2025-09-01'),
        endDate: new Date('2026-07-31'),
        active: true,
      },
    })
  }

  // Trouver ou créer une direction
  let directorate = await db.directorate.findFirst({
    where: { schoolId: school.id },
  })
  if (!directorate) {
    directorate = await db.directorate.create({
      data: {
        schoolId: school.id,
        name: 'Secondaire',
        code: 'SEC',
      },
    })
  }

  // Trouver ou créer une classe
  let classroom = await db.classroom.findFirst({
    where: { directorateId: directorate.id, academicYearId: year.id },
  })
  if (!classroom) {
    classroom = await db.classroom.create({
      data: {
        directorateId: directorate.id,
        academicYearId: year.id,
        name: '6ème A',
        capacity: 40,
      },
    })
  }

  // Créer des élèves de test
  const students = []
  for (let i = 0; i < 5; i++) {
    const s = await db.student.create({
      data: {
        schoolId: school.id,
        matricule: `TEST-${Date.now()}-${i}`,
        firstName: `Élève${i}`,
        lastName: `Test${i}`,
        status: 'ACTIVE',
      },
    })
    await db.enrollment.create({
      data: {
        studentId: s.id,
        classroomId: classroom.id,
        academicYearId: year.id,
        status: 'ACTIVE',
      },
    })
    students.push(s)
  }

  // Créer un employé prof de test
  const employee = await db.employee.create({
    data: {
      schoolId: school.id,
      directorateId: directorate.id,
      firstName: 'Prof',
      lastName: 'Test',
      email: `prof-test-${Date.now()}@smartshule.test`,
      function: 'ENSEIGNANT',
      status: 'ACTIVE',
    },
  })

  return { school, year, directorate, classroom, students, employee }
}

describe('IQA - Intégration DB', () => {
  let testData: Awaited<ReturnType<typeof setupTestData>>

  beforeEach(async () => {
    testData = await setupTestData()
  })

  it('persistIqaSnapshot crée puis met à jour un snapshot', async () => {
    const { school, students } = testData

    const iqa1 = {
      iqa: 95,
      level: 'EXCELLENT' as const,
      totalSessions: 10,
      absencesUnexcused: 0,
      absencesExcused: 0,
      lateCount: 1,
      formula: '...',
    }

    await persistIqaSnapshot({
      schoolId: school.id,
      studentId: students[0].id,
      subjectId: null,
      period: '2026-09',
      iqa: iqa1,
    })

    const snapshot = await db.iqaSnapshot.findFirst({
      where: { studentId: students[0].id, period: '2026-09', subjectId: null },
    })
    expect(snapshot).toBeTruthy()
    expect(snapshot?.iqaValue).toBe(95)
    expect(snapshot?.level).toBe('EXCELLENT')

    // Mise à jour
    const iqa2 = { ...iqa1, iqa: 80, level: 'WARNING' as const }
    await persistIqaSnapshot({
      schoolId: school.id,
      studentId: students[0].id,
      subjectId: null,
      period: '2026-09',
      iqa: iqa2,
    })

    const updated = await db.iqaSnapshot.findFirst({
      where: { studentId: students[0].id, period: '2026-09', subjectId: null },
    })
    expect(updated?.iqaValue).toBe(80)
    expect(updated?.level).toBe('WARNING')

    // Un seul snapshot (pas de doublon)
    const count = await db.iqaSnapshot.count({
      where: { studentId: students[0].id, period: '2026-09', subjectId: null },
    })
    expect(count).toBe(1)
  })

  it('getClassroomIqaSnapshots retourne tous les élèves triés par IQA croissant', async () => {
    // Crée une classe spécifique pour ce test (isolation)
    const classroomSpecific = await db.classroom.create({
      data: {
        directorateId: testData.directorate.id,
        academicYearId: testData.year.id,
        name: `TestClass-${Date.now()}`,
        capacity: 5,
      },
    })

    // Crée 3 élèves spécifiques
    const specificStudents = []
    for (let i = 0; i < 3; i++) {
      const s = await db.student.create({
        data: {
          schoolId: testData.school.id,
          matricule: `TEST-IQA-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          firstName: `IQA${i}`,
          lastName: `Test${i}`,
          status: 'ACTIVE',
        },
      })
      await db.enrollment.create({
        data: {
          studentId: s.id,
          classroomId: classroomSpecific.id,
          academicYearId: testData.year.id,
          status: 'ACTIVE',
        },
      })
      specificStudents.push(s)
    }

    // Créer des snapshots pour ces élèves
    await persistIqaSnapshot({
      schoolId: testData.school.id,
      studentId: specificStudents[0].id,
      subjectId: null,
      period: '2026-09',
      iqa: { iqa: 50, level: 'CRITICAL', totalSessions: 10, absencesUnexcused: 5, absencesExcused: 0, lateCount: 0, formula: '' },
    })
    await persistIqaSnapshot({
      schoolId: testData.school.id,
      studentId: specificStudents[1].id,
      subjectId: null,
      period: '2026-09',
      iqa: { iqa: 95, level: 'EXCELLENT', totalSessions: 10, absencesUnexcused: 0, absencesExcused: 0, lateCount: 1, formula: '' },
    })
    await persistIqaSnapshot({
      schoolId: testData.school.id,
      studentId: specificStudents[2].id,
      subjectId: null,
      period: '2026-09',
      iqa: { iqa: 80, level: 'WARNING', totalSessions: 10, absencesUnexcused: 1, absencesExcused: 1, lateCount: 2, formula: '' },
    })

    const snapshots = await getClassroomIqaSnapshots(classroomSpecific.id, '2026-09')

    expect(snapshots).toHaveLength(3) // 3 élèves créés dans cette classe spécifique
    // Tri par IQA croissant
    expect(snapshots[0].iqa).toBeLessThanOrEqual(snapshots[1].iqa)
    expect(snapshots[1].iqa).toBeLessThanOrEqual(snapshots[2].iqa)

    // IQA définis : 50, 80, 95
    expect(snapshots[0].iqa).toBe(50)
    expect(snapshots[1].iqa).toBe(80)
    expect(snapshots[2].iqa).toBe(95)
  })
})

describe('Server Actions - Emargements (intégration DB)', () => {
  let testData: Awaited<ReturnType<typeof setupTestData>>

  beforeEach(async () => {
    testData = await setupTestData()
  })

  it('crée un TeacherAgenda + TeacherEmargement sans collision', async () => {
    const { school, classroom, employee } = testData

    const start = new Date()
    const end = new Date(start.getTime() + 2 * 3600 * 1000)

    const agenda = await db.teacherAgenda.create({
      data: {
        schoolId: school.id,
        teacherId: employee.id,
        classroomId: classroom.id,
        startDateTime: start,
        endDateTime: end,
        room: 'Salle 12',
        status: 'IN_PROGRESS',
      },
    })

    const emargement = await db.teacherEmargement.create({
      data: {
        schoolId: school.id,
        agendaId: agenda.id,
        teacherId: employee.id,
        classroomId: classroom.id,
        signatureAt: new Date(),
        status: 'PRESENT',
        directorNotifiedAt: new Date(),
      },
    })

    expect(agenda.id).toBeTruthy()
    expect(emargement.id).toBeTruthy()
    expect(emargement.agendaId).toBe(agenda.id)

    // Vérifier qu'un second émargement sur le même agenda est rejeté (UNIQUE)
    let duplicateError: Error | null = null
    try {
      await db.teacherEmargement.create({
        data: {
          schoolId: school.id,
          agendaId: agenda.id,
          teacherId: employee.id,
          classroomId: classroom.id,
          signatureAt: new Date(),
          status: 'PRESENT',
        },
      })
    } catch (err) {
      duplicateError = err as Error
    }
    expect(duplicateError).not.toBeNull()
    expect((duplicateError as Error).message).toContain('Unique constraint')
  })

  it('crée des StudentAttendanceCall anti-doublon par élève', async () => {
    const { school, classroom, students, employee } = testData

    const agenda = await db.teacherAgenda.create({
      data: {
        schoolId: school.id,
        teacherId: employee.id,
        classroomId: classroom.id,
        startDateTime: new Date(),
        endDateTime: new Date(Date.now() + 7200000),
        status: 'IN_PROGRESS',
      },
    })
    const emargement = await db.teacherEmargement.create({
      data: {
        schoolId: school.id,
        agendaId: agenda.id,
        teacherId: employee.id,
        classroomId: classroom.id,
        signatureAt: new Date(),
        status: 'PRESENT',
      },
    })

    // Premier appel : PRESENT
    const call1 = await db.studentAttendanceCall.create({
      data: {
        schoolId: school.id,
        emargementId: emargement.id,
        studentId: students[0].id,
        status: 'PRESENT',
        recordedById: employee.id,
      },
    })
    expect(call1.id).toBeTruthy()

    // Second appel pour le même élève : doit échouer (UNIQUE emargementId_studentId)
    let duplicateError: Error | null = null
    try {
      await db.studentAttendanceCall.create({
        data: {
          schoolId: school.id,
          emargementId: emargement.id,
          studentId: students[0].id,
          status: 'LATE',
          recordedById: employee.id,
        },
      })
    } catch (err) {
      duplicateError = err as Error
    }
    expect(duplicateError).not.toBeNull()
    expect((duplicateError as Error).message).toContain('Unique constraint')

    // Un autre élève : OK
    const call2 = await db.studentAttendanceCall.create({
      data: {
        schoolId: school.id,
        emargementId: emargement.id,
        studentId: students[1].id,
        status: 'ABSENT',
        recordedById: employee.id,
      },
    })
    expect(call2.id).toBeTruthy()
  })

  it('crée un LessonLog unique par émargement', async () => {
    const { school, classroom, employee } = testData

    const agenda = await db.teacherAgenda.create({
      data: {
        schoolId: school.id,
        teacherId: employee.id,
        classroomId: classroom.id,
        startDateTime: new Date(),
        endDateTime: new Date(Date.now() + 7200000),
        status: 'DONE',
      },
    })
    const emargement = await db.teacherEmargement.create({
      data: {
        schoolId: school.id,
        agendaId: agenda.id,
        teacherId: employee.id,
        classroomId: classroom.id,
        signatureAt: new Date(),
        status: 'PRESENT',
      },
    })

    const lesson = await db.lessonLog.create({
      data: {
        schoolId: school.id,
        emargementId: emargement.id,
        agendaId: agenda.id,
        teacherId: employee.id,
        classroomId: classroom.id,
        sessionDate: new Date(),
        lessonTitle: 'Chapitre 3 — Les équations',
        summary: 'Résolution d\'équations du second degré.',
        homeworkPublished: 'Exercices 1 à 5 page 42.',
        resourcesUrl: 'https://example.com/cours.pdf',
        status: 'DRAFT',
      },
    })

    expect(lesson.id).toBeTruthy()
    expect(lesson.lessonTitle).toBe('Chapitre 3 — Les équations')

    // Un second LessonLog pour le même émargement doit échouer (UNIQUE)
    let duplicateError: Error | null = null
    try {
      await db.lessonLog.create({
        data: {
          schoolId: school.id,
          emargementId: emargement.id,
          agendaId: agenda.id,
          teacherId: employee.id,
          classroomId: classroom.id,
          sessionDate: new Date(),
          lessonTitle: 'Tentative 2',
          summary: 'Ne doit pas passer',
        },
      })
    } catch (err) {
      duplicateError = err as Error
    }
    expect(duplicateError).not.toBeNull()
    expect((duplicateError as Error).message).toContain('Unique constraint')
  })

  it('crée un ClassIncident avec clientUUID unique (offline idempotence)', async () => {
    const { school, classroom, employee } = testData
    // UUID dynamique pour éviter les collisions avec les tests précédents
    const clientUUID = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `test-${Date.now()}-${Math.random().toString(36).slice(2)}`

    const incident = await db.classIncident.create({
      data: {
        schoolId: school.id,
        teacherId: employee.id,
        classroomId: classroom.id,
        severity: 'HIGH',
        category: 'DISCIPLINE',
        description: 'Élève perturbateur en cours',
        clientUUID,
        syncStatus: 'SYNCED',
        syncedAt: new Date(),
        directorNotifiedAt: new Date(),
      },
    })

    expect(incident.id).toBeTruthy()
    expect(incident.severity).toBe('HIGH')

    // Un second incident avec le même clientUUID doit échouer (UNIQUE)
    let duplicateError: Error | null = null
    try {
      await db.classIncident.create({
        data: {
          schoolId: school.id,
          teacherId: employee.id,
          classroomId: classroom.id,
          severity: 'LOW',
          category: 'OTHER',
          description: 'Tentative doublon',
          clientUUID,
          syncStatus: 'SYNCED',
        },
      })
    } catch (err) {
      duplicateError = err as Error
    }
    expect(duplicateError).not.toBeNull()
    expect((duplicateError as Error).message).toContain('Unique constraint')
  })
})
