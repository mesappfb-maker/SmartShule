// SmartShule — Tests unitaires : Modules d'Industrialisation (Phase 2)
// Vérifie : Discipline, Messagerie, Emplois du temps, Échéanciers, Rendez-vous, Recrutement

import { test, expect, describe, beforeAll } from 'bun:test'
import {
  createDisciplineIncident,
  resolveDisciplineIncident,
  createMessageThread,
  replyToThread,
  createTimetableSlot,
  generatePaymentSchedule,
  createLogbookEntry,
  createMeetingSlots,
  bookMeetingSlot,
  createJobOffer,
  applyToJob,
} from '../../src/lib/industrialisation'
import { db } from '../../src/lib/db'

const TEST_SUFFIX = Date.now().toString()
let schoolId: string

describe('Industrialisation — Modules Phase 2', () => {
  beforeAll(async () => {
    const school = await db.school.findFirst()
    if (!school) throw new Error('Aucune école dans la DB. Lancez scripts/seed.ts.')
    schoolId = school.id
  })

  // ============================================================
  // Discipline
  // ============================================================
  describe('Discipline', () => {
    test('crée un incident disciplinaire', async () => {
      const student = await db.student.findFirst({ where: { schoolId } })
      if (!student) return

      const incident = await createDisciplineIncident({
        schoolId,
        studentId: student.id,
        date: new Date(),
        type: 'RETARD',
        severity: 'LOW',
        description: 'Retard de 15 minutes en cours de maths',
      })

      expect(incident.id).toBeTruthy()
      expect(incident.status).toBe('OPEN')
      expect(incident.type).toBe('RETARD')
    })

    test('rejette une description trop courte', async () => {
      const student = await db.student.findFirst({ where: { schoolId } })
      if (!student) return

      await expect(createDisciplineIncident({
        schoolId,
        studentId: student.id,
        date: new Date(),
        type: 'OBSERVATION',
        description: 'AB',
      })).rejects.toThrow()
    })

    test('résout un incident', async () => {
      const student = await db.student.findFirst({ where: { schoolId } })
      if (!student) return

      const incident = await createDisciplineIncident({
        schoolId,
        studentId: student.id,
        date: new Date(),
        type: 'SANCTION',
        description: 'Comportement perturbateur',
        sanction: 'Heure de retenue',
      })

      const resolved = await resolveDisciplineIncident(incident.id)
      expect(resolved.status).toBe('RESOLVED')
    })
  })

  // ============================================================
  // Messagerie
  // ============================================================
  describe('Messagerie sécurisée', () => {
    test('crée un fil de discussion avec message initial', async () => {
      const direction = await db.user.findFirst({ where: { role: 'DIRECTION' } })
      if (!direction) return
      const parent = await db.user.findFirst({ where: { role: 'PARENT' } })
      if (!parent) return

      const thread = await createMessageThread({
        schoolId,
        subject: 'Absence répétée de Sarah',
        tags: ['ABSENCE', 'URGENT'],
        createdById: direction.id,
        recipientIds: [parent.id],
        initialContent: 'Bonjour, Sarah a été absente 3 fois cette semaine.',
        authorName: direction.displayName,
      })

      expect(thread.id).toBeTruthy()
      expect(thread.subject).toBe('Absence répétée de Sarah')
      expect(thread.participants).toHaveLength(2) // Sender + 1 recipient
      expect(thread.messages).toHaveLength(1)
      expect(thread.messages[0].content).toContain('Sarah')
    })

    test('rejette un sujet trop court', async () => {
      const direction = await db.user.findFirst({ where: { role: 'DIRECTION' } })
      if (!direction) return
      const parent = await db.user.findFirst({ where: { role: 'PARENT' } })
      if (!parent) return

      await expect(createMessageThread({
        schoolId,
        subject: 'AB',
        createdById: direction.id,
        recipientIds: [parent.id],
        initialContent: 'Test',
        authorName: direction.displayName,
      })).rejects.toThrow()
    })

    test('permet de répondre à un fil', async () => {
      const direction = await db.user.findFirst({ where: { role: 'DIRECTION' } })
      if (!direction) return
      const parent = await db.user.findFirst({ where: { role: 'PARENT' } })
      if (!parent) return

      const thread = await createMessageThread({
        schoolId,
        subject: 'Réunion parent-prof',
        createdById: direction.id,
        recipientIds: [parent.id],
        initialContent: 'Proposition de rendez-vous',
        authorName: direction.displayName,
      })

      const reply = await replyToThread({
        threadId: thread.id,
        authorId: parent.id,
        authorName: parent.displayName,
        content: 'D\'accord pour mardi 14h.',
      })

      expect(reply.id).toBeTruthy()
      expect(reply.content).toContain('mardi')
    })

    test('rejette une réponse vide', async () => {
      const direction = await db.user.findFirst({ where: { role: 'DIRECTION' } })
      if (!direction) return
      const parent = await db.user.findFirst({ where: { role: 'PARENT' } })
      if (!parent) return

      const thread = await createMessageThread({
        schoolId,
        subject: 'Test réponse vide',
        createdById: direction.id,
        recipientIds: [parent.id],
        initialContent: 'Test',
        authorName: direction.displayName,
      })

      await expect(replyToThread({
        threadId: thread.id,
        authorId: parent.id,
        authorName: parent.displayName,
        content: '',
      })).rejects.toThrow()
    })
  })

  // ============================================================
  // Emplois du temps
  // ============================================================
  describe('Emplois du temps', () => {
    test('crée un créneau de cours', async () => {
      const classroom = await db.classroom.findFirst()
      if (!classroom) return
      const course = await db.course.findFirst({ where: { classroomId: classroom.id } })
      if (!course) return

      // Utiliser un jour et horaire très spécifiques pour éviter les conflits
      const uniqueDay = 6 // Samedi
      const uniqueTime = '07:00'

      // Nettoyer les anciennes données de test
      await db.timetable.deleteMany({
        where: { schoolId, classroomId: classroom.id, dayOfWeek: uniqueDay, startTime: uniqueTime },
      }).catch(() => {})

      const slot = await createTimetableSlot({
        schoolId,
        classroomId: classroom.id,
        courseId: course.id,
        dayOfWeek: uniqueDay,
        startTime: uniqueTime,
        endTime: '09:00',
        room: 'Salle 101',
      })

      expect(slot.id).toBeTruthy()
      expect(slot.dayOfWeek).toBe(uniqueDay)
    })

    test('rejette un conflit d\'emploi du temps', async () => {
      const classroom = await db.classroom.findFirst()
      if (!classroom) return
      const course = await db.course.findFirst({ where: { classroomId: classroom.id } })
      if (!course) return

      // Utiliser un autre jour unique pour ce test
      const testDay = 5 // Vendredi
      const testStart = '14:00'
      const testEnd = '16:00'

      // Premier créneau
      await createTimetableSlot({
        schoolId,
        classroomId: classroom.id,
        courseId: course.id,
        dayOfWeek: testDay,
        startTime: testStart,
        endTime: testEnd,
      }).catch(() => {}) // Ignorer si existe déjà

      // Créneau en conflit (chevauche 14h-16h)
      await expect(createTimetableSlot({
        schoolId,
        classroomId: classroom.id,
        courseId: course.id,
        dayOfWeek: testDay,
        startTime: '15:00',
        endTime: '17:00',
      })).rejects.toThrow(/Conflit/)
    })

    test('rejette une heure de fin antérieure au début', async () => {
      const classroom = await db.classroom.findFirst()
      if (!classroom) return
      const course = await db.course.findFirst({ where: { classroomId: classroom.id } })
      if (!course) return

      await expect(createTimetableSlot({
        schoolId,
        classroomId: classroom.id,
        courseId: course.id,
        dayOfWeek: 3,
        startTime: '10:00',
        endTime: '08:00',
      })).rejects.toThrow()
    })
  })

  // ============================================================
  // Échéanciers de paiement
  // ============================================================
  describe('Échéanciers de paiement', () => {
    test('génère un échéancier de 3 mensualités', async () => {
      const invoice = await db.invoice.findFirst({ where: { schoolId } })
      if (!invoice) return

      const result = await generatePaymentSchedule({
        schoolId,
        invoiceId: invoice.id,
        totalAmountCents: 300000, // 3000.00
        installments: 3,
        startDate: new Date('2025-09-01'),
        intervalDays: 30,
      })

      expect(result).toHaveLength(3)
      expect(result[0].status).toBe('PENDING')
      // 300000 / 3 = 100000 centimes par échéance
      expect(result[0].amountCents).toBe(100000)
      expect(result[1].amountCents).toBe(100000)
    })

    test('rejette un nombre d\'échéances invalide', async () => {
      const invoice = await db.invoice.findFirst({ where: { schoolId } })
      if (!invoice) return

      await expect(generatePaymentSchedule({
        schoolId,
        invoiceId: invoice.id,
        totalAmountCents: 100000,
        installments: 15, // > 12
        startDate: new Date(),
        intervalDays: 30,
      })).rejects.toThrow()
    })
  })

  // ============================================================
  // Cahier de textes
  // ============================================================
  describe('Cahier de textes', () => {
    test('crée une entrée dans le cahier de textes', async () => {
      const teacher = await db.employee.findFirst({ where: { schoolId } })
      if (!teacher) return
      const classroom = await db.classroom.findFirst()
      if (!classroom) return

      const entry = await createLogbookEntry({
        schoolId,
        teacherId: teacher.id,
        classroomId: classroom.id,
        sessionDate: new Date(),
        content: 'Chapitre 3 : Les fractions. Exercices 1 à 5 page 42.',
        homework: 'Faire l\'exercice 6 page 43.',
      })

      expect(entry.id).toBeTruthy()
      expect(entry.content).toContain('fractions')
    })

    test('rejette un contenu trop court', async () => {
      const teacher = await db.employee.findFirst({ where: { schoolId } })
      if (!teacher) return
      const classroom = await db.classroom.findFirst()
      if (!classroom) return

      await expect(createLogbookEntry({
        schoolId,
        teacherId: teacher.id,
        classroomId: classroom.id,
        sessionDate: new Date(),
        content: 'AB',
      })).rejects.toThrow()
    })
  })

  // ============================================================
  // Rendez-vous Parents-Profs
  // ============================================================
  describe('Rendez-vous Parents-Profs', () => {
    test('génère des créneaux de rendez-vous', async () => {
      const teacher = await db.employee.findFirst({ where: { schoolId } })
      if (!teacher) return

      await createMeetingSlots({
        schoolId,
        teacherId: teacher.id,
        startDate: new Date('2025-09-25T14:00:00'),
        endDate: new Date('2025-09-25T15:00:00'),
        slotDurationMinutes: 15, // 4 créneaux de 15 min
      })

      const slots = await db.parentMeetingSlot.findMany({
        where: { teacherId: teacher.id, startTime: { gte: new Date('2025-09-25T14:00:00') }, status: 'AVAILABLE' },
      })
      expect(slots.length).toBeGreaterThanOrEqual(1)
    })

    test('permet de réserver un créneau', async () => {
      const teacher = await db.employee.findFirst({ where: { schoolId } })
      if (!teacher) return

      // Créer un créneau
      await createMeetingSlots({
        schoolId,
        teacherId: teacher.id,
        startDate: new Date('2025-09-26T10:00:00'),
        endDate: new Date('2025-09-26T10:15:00'),
        slotDurationMinutes: 15,
      })

      const slot = await db.parentMeetingSlot.findFirst({
        where: { teacherId: teacher.id, status: 'AVAILABLE' },
      })
      if (!slot) return

      const guardian = await db.guardian.findFirst({ where: { schoolId } })
      if (!guardian) return

      const booked = await bookMeetingSlot(slot.id, guardian.id)
      expect(booked.status).toBe('BOOKED')
      expect(booked.bookedByGuardianId).toBe(guardian.id)
    })

    test('rejette la réservation d\'un créneau déjà pris', async () => {
      const teacher = await db.employee.findFirst({ where: { schoolId } })
      if (!teacher) return

      await createMeetingSlots({
        schoolId,
        teacherId: teacher.id,
        startDate: new Date('2025-09-27T09:00:00'),
        endDate: new Date('2025-09-27T09:15:00'),
        slotDurationMinutes: 15,
      })

      const slot = await db.parentMeetingSlot.findFirst({
        where: { teacherId: teacher.id, status: 'AVAILABLE' },
      })
      if (!slot) return

      const guardian1 = await db.guardian.findFirst({ where: { schoolId } })
      if (!guardian1) return
      await bookMeetingSlot(slot.id, guardian1.id)

      const guardian2 = await db.guardian.findFirst({
        where: { schoolId, id: { not: guardian1.id } },
      })
      if (!guardian2) return

      await expect(bookMeetingSlot(slot.id, guardian2.id)).rejects.toThrow()
    })
  })

  // ============================================================
  // Recrutement
  // ============================================================
  describe('Recrutement', () => {
    test('crée une offre d\'emploi', async () => {
      const offer = await createJobOffer({
        schoolId,
        title: 'Professeur de Mathématiques',
        description: 'Recherche professeur de maths pour classes de 6ème et 3ème.',
        requirements: 'Master de mathématiques + 2 ans d\'expérience.',
        contractType: 'CDI',
        closingDate: new Date('2025-10-15'),
      })

      expect(offer.id).toBeTruthy()
      expect(offer.status).toBe('OPEN')
      expect(offer.title).toContain('Mathématiques')
    })

    test('rejette un titre trop court', async () => {
      await expect(createJobOffer({
        schoolId,
        title: 'AB',
        description: 'Description test',
        contractType: 'CDD',
      })).rejects.toThrow()
    })

    test('permet de postuler à une offre', async () => {
      const offer = await createJobOffer({
        schoolId,
        title: 'Professeur de Français',
        description: 'Poste à pourvoir immédiatement.',
        contractType: 'CDD',
      })

      const application = await applyToJob({
        jobId: offer.id,
        candidateName: 'Marie Curie',
        candidateEmail: 'marie.curie@example.com',
        candidatePhone: '+243 81 999 9999',
        coverLetter: 'Je suis très intéressée par ce poste.',
      })

      expect(application.id).toBeTruthy()
      expect(application.status).toBe('RECEIVED')
      expect(application.candidateName).toBe('Marie Curie')
    })

    test('rejette une candidature sans email', async () => {
      const offer = await createJobOffer({
        schoolId,
        title: 'Professeur d\'Histoire',
        description: 'Poste à pourvoir.',
        contractType: 'INTERIM',
      })

      await expect(applyToJob({
        jobId: offer.id,
        candidateName: 'Test Candidat',
        candidateEmail: '',
      })).rejects.toThrow()
    })
  })
})
