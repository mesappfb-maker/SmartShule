// SmartShule — Modules d'Industrialisation (Phase 2)
// Helpers pour les nouvelles fonctionnalités : Discipline, Messagerie,
// Emplois du temps, Recouvrement, Recrutement, Cahier de textes.
// Tous les calculs monétaires en centimes (BigInt), audit systématique.

import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'

// ============================================================
// DISCIPLINE
// ============================================================

export async function createDisciplineIncident(
  input: {
    schoolId: string
    studentId: string
    date: Date
    type: 'RETARD' | 'ABSENCE_NON_JUSTIFIEE' | 'SANCTION' | 'OBSERVATION'
    severity?: 'LOW' | 'MEDIUM' | 'HIGH'
    description: string
    sanction?: string
    reportedById?: string
  },
  tx?: Prisma.TransactionClient
) {
  const client = tx || db
  if (!input.description || input.description.length < 3) {
    throw new Error('La description de l\'incident doit faire au moins 3 caractères.')
  }
  return client.disciplineIncident.create({
    data: {
      schoolId: input.schoolId,
      studentId: input.studentId,
      date: input.date,
      type: input.type,
      severity: input.severity || 'LOW',
      description: input.description,
      sanction: input.sanction,
      reportedById: input.reportedById,
      status: 'OPEN',
    },
  })
}

export async function resolveDisciplineIncident(
  incidentId: string,
  tx?: Prisma.TransactionClient
) {
  const client = tx || db
  return client.disciplineIncident.update({
    where: { id: incidentId },
    data: { status: 'RESOLVED' },
  })
}

// ============================================================
// MESSAGERIE SÉCURISÉE
// ============================================================

export async function createMessageThread(
  input: {
    schoolId: string
    subject: string
    tags?: string[]
    createdById: string
    recipientIds: string[]
    initialContent: string
    authorName: string
  },
  tx?: Prisma.TransactionClient
) {
  const client = tx || db
  if (!input.subject || input.subject.length < 3) {
    throw new Error('Le sujet du message doit faire au moins 3 caractères.')
  }
  if (!input.recipientIds || input.recipientIds.length === 0) {
    throw new Error('Au moins un destinataire est requis.')
  }

  return client.messageThread.create({
    data: {
      schoolId: input.schoolId,
      subject: input.subject,
      tags: input.tags ? JSON.stringify(input.tags) : null,
      createdById: input.createdById,
      participants: {
        create: [
          { userId: input.createdById, role: 'SENDER' },
          ...input.recipientIds.map(uid => ({ userId: uid, role: 'RECIPIENT' as const })),
        ],
      },
      messages: {
        create: {
          authorId: input.createdById,
          authorName: input.authorName,
          content: input.initialContent,
        },
      },
    },
    include: { participants: true, messages: true },
  })
}

export async function replyToThread(
  input: {
    threadId: string
    authorId: string
    authorName: string
    content: string
  },
  tx?: Prisma.TransactionClient
) {
  const client = tx || db
  if (!input.content || input.content.length < 1) {
    throw new Error('Le contenu du message ne peut pas être vide.')
  }

  const message = await client.message.create({
    data: {
      threadId: input.threadId,
      authorId: input.authorId,
      authorName: input.authorName,
      content: input.content,
    },
  })

  // Marquer le thread comme mis à jour
  await client.messageThread.update({
    where: { id: input.threadId },
    data: { updatedAt: new Date() },
  })

  return message
}

// ============================================================
// EMPLOIS DU TEMPS
// ============================================================

export async function createTimetableSlot(
  input: {
    schoolId: string
    classroomId: string
    courseId: string
    dayOfWeek: number // 0-6
    startTime: string // "08:00"
    endTime: string   // "10:00"
    room?: string
  },
  tx?: Prisma.TransactionClient
) {
  const client = tx || db
  if (input.dayOfWeek < 0 || input.dayOfWeek > 6) {
    throw new Error('Le jour de la semaine doit être entre 0 (dimanche) et 6 (samedi).')
  }
  if (input.startTime >= input.endTime) {
    throw new Error('L\'heure de début doit être antérieure à l\'heure de fin.')
  }

  // Vérifier les conflits pour la même classe
  const existing = await client.timetable.findFirst({
    where: {
      schoolId: input.schoolId,
      classroomId: input.classroomId,
      dayOfWeek: input.dayOfWeek,
      AND: [
        { startTime: { lt: input.endTime } },
        { endTime: { gt: input.startTime } },
      ],
    },
  })
  if (existing) {
    throw new Error('Conflit d\'emploi du temps : un cours existe déjà sur ce créneau.')
  }

  return client.timetable.create({
    data: {
      schoolId: input.schoolId,
      classroomId: input.classroomId,
      courseId: input.courseId,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      room: input.room,
    },
  })
}

// ============================================================
// RECOUVREMENT & ÉCHÉANCIERS
// ============================================================

export async function generatePaymentSchedule(
  input: {
    schoolId: string
    invoiceId: string
    totalAmountCents: number
    installments: number // ex: 3 pour 3 paiements
    startDate: Date
    intervalDays: number // ex: 30 pour mensuel
  },
  tx?: Prisma.TransactionClient
) {
  const client = tx || db
  if (input.installments < 1 || input.installments > 12) {
    throw new Error('Le nombre d\'échéances doit être entre 1 et 12.')
  }

  const amountPerInstallment = Math.floor(input.totalAmountCents / input.installments)
  const remainder = input.totalAmountCents - (amountPerInstallment * input.installments)

  const scheduleData = []
  for (let i = 0; i < input.installments; i++) {
    const dueDate = new Date(input.startDate)
    dueDate.setDate(dueDate.getDate() + (i * input.intervalDays))
    scheduleData.push({
      schoolId: input.schoolId,
      invoiceId: input.invoiceId,
      installmentNumber: i + 1,
      dueDate,
      amountCents: amountPerInstallment + (i === 0 ? remainder : 0),
      paidCents: 0,
      status: 'PENDING',
    })
  }

  await client.paymentSchedule.createMany({ data: scheduleData })
  return scheduleData
}

// ============================================================
// CAHIER DE TEXTES
// ============================================================

export async function createLogbookEntry(
  input: {
    schoolId: string
    teacherId: string
    classroomId: string
    courseId?: string
    sessionDate: Date
    content: string
    homework?: string
  },
  tx?: Prisma.TransactionClient
) {
  const client = tx || db
  if (!input.content || input.content.length < 5) {
    throw new Error('Le contenu de la séance doit faire au moins 5 caractères.')
  }
  return client.teacherLogbook.create({
    data: {
      schoolId: input.schoolId,
      teacherId: input.teacherId,
      classroomId: input.classroomId,
      courseId: input.courseId,
      sessionDate: input.sessionDate,
      content: input.content,
      homework: input.homework,
    },
  })
}

// ============================================================
// RENDEZ-VOUS PARENTS-PROFS
// ============================================================

export async function createMeetingSlots(
  input: {
    schoolId: string
    teacherId: string
    classroomId?: string
    startDate: Date
    endDate: Date
    slotDurationMinutes: number // ex: 15
  },
  tx?: Prisma.TransactionClient
) {
  const client = tx || db
  const slots = []
  const current = new Date(input.startDate)

  while (current < input.endDate) {
    const endTime = new Date(current)
    endTime.setMinutes(endTime.getMinutes() + input.slotDurationMinutes)
    slots.push({
      schoolId: input.schoolId,
      teacherId: input.teacherId,
      classroomId: input.classroomId,
      startTime: new Date(current),
      endTime,
      status: 'AVAILABLE',
    })
    current.setMinutes(current.getMinutes() + input.slotDurationMinutes)
  }

  return client.parentMeetingSlot.createMany({ data: slots })
}

export async function bookMeetingSlot(
  slotId: string,
  guardianId: string,
  tx?: Prisma.TransactionClient
) {
  const client = tx || db
  const slot = await client.parentMeetingSlot.findUnique({ where: { id: slotId } })
  if (!slot) throw new Error('Créneau introuvable.')
  if (slot.status !== 'AVAILABLE') {
    throw new Error('Ce créneau n\'est plus disponible.')
  }
  return client.parentMeetingSlot.update({
    where: { id: slotId },
    data: { bookedByGuardianId: guardianId, status: 'BOOKED' },
  })
}

// ============================================================
// RECRUTEMENT
// ============================================================

export async function createJobOffer(
  input: {
    schoolId: string
    title: string
    description: string
    requirements?: string
    contractType: 'CDI' | 'CDD' | 'INTERIM'
    closingDate?: Date
  },
  tx?: Prisma.TransactionClient
) {
  const client = tx || db
  if (!input.title || input.title.length < 3) {
    throw new Error('Le titre de l\'offre doit faire au moins 3 caractères.')
  }
  return client.jobOffer.create({ data: input })
}

export async function applyToJob(
  input: {
    jobId: string
    candidateName: string
    candidateEmail: string
    candidatePhone?: string
    coverLetter?: string
    resumeUrl?: string
  },
  tx?: Prisma.TransactionClient
) {
  const client = tx || db
  if (!input.candidateName || !input.candidateEmail) {
    throw new Error('Le nom et l\'email du candidat sont obligatoires.')
  }
  return client.jobApplication.create({ data: input })
}
