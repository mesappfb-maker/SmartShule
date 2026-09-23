// SmartShule — Helpers Appel & Notes (Cycle 03, §3.6 + §3.11 + §14.2.14)
//
// Implémente :
//   - L'appel professoral avec clé logique anti-doublon (SchoolId + SessionId + StudentId) ;
//   - Le verrouillage des sessions d'appel (status OPEN → LOCKED) ;
//   - La notification automatique des parents en cas d'absence ;
//   - Le workflow des notes (DRAFT → SUBMITTED → CONTROLLED → PUBLISHED) ;
//   - La validation des transitions de statut.
//
// Discipline de fer contre les erreurs silencieuses :
//   - Toutes les fonctions sont prévues pour être appelées dans une transaction Prisma ;
//   - Les erreurs sont levées explicitement (AttendanceError, GradeError) ;
//   - L'audit est assuré par l'appelant (Server Action).

import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'

// ============================================================
// Types
// ============================================================

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED'
export type AttendanceSessionStatus = 'OPEN' | 'LOCKED' | 'CANCELLED'
export type GradeStatus = 'DRAFT' | 'SUBMITTED' | 'CONTROLLED' | 'PUBLISHED'

export interface AttendanceEntry {
  studentId: string
  status: AttendanceStatus
  justified?: boolean
  justification?: string
}

export interface SessionCreationInput {
  schoolId: string
  courseId: string
  classroomId: string
  teacherId?: string
  courseSessionId?: string
  date: Date
}

// ============================================================
// Erreurs typées
// ============================================================

export class AttendanceError extends Error {
  constructor(
    public readonly code:
      | 'SESSION_NOT_FOUND'
      | 'SESSION_LOCKED'
      | 'STUDENT_NOT_ENROLLED'
      | 'DUPLICATE_ATTENDANCE'
      | 'INVALID_STATUS'
      | 'NOT_AUTHORIZED',
    message: string
  ) {
    super(message)
    this.name = 'AttendanceError'
  }
}

export class GradeError extends Error {
  constructor(
    public readonly code:
      | 'GRADE_NOT_FOUND'
      | 'INVALID_TRANSITION'
      | 'ALREADY_PUBLISHED'
      | 'NOT_AUTHORIZED'
      | 'INVALID_SCORE',
    message: string
  ) {
    super(message)
    this.name = 'GradeError'
  }
}

// ============================================================
// Sessions d'appel
// ============================================================

/**
 * Crée une session d'appel pour un cours + classe + date.
 * Si une session existe déjà pour ces critères, on la réutilise.
 */
export async function findOrCreateAttendanceSession(
  input: SessionCreationInput,
  tx?: Prisma.TransactionClient
): Promise<{ id: string; status: AttendanceSessionStatus }> {
  const client = tx || db
  const existing = await client.attendanceSession.findFirst({
    where: {
      schoolId: input.schoolId,
      courseId: input.courseId,
      classroomId: input.classroomId,
      date: input.date,
    },
  })
  if (existing) {
    return { id: existing.id, status: existing.status as AttendanceSessionStatus }
  }
  const session = await client.attendanceSession.create({
    data: {
      schoolId: input.schoolId,
      courseId: input.courseId,
      classroomId: input.classroomId,
      teacherId: input.teacherId,
      sessionId: input.courseSessionId,
      date: input.date,
      status: 'OPEN',
    },
  })
  return { id: session.id, status: 'OPEN' }
}

/**
 * Vérifie qu'une session d'appel est ouverte (modifiable).
 */
export function assertSessionOpen(session: { status: string }): void {
  if (session.status !== 'OPEN') {
    throw new AttendanceError(
      'SESSION_LOCKED',
      `La session d'appel est ${session.status}. Aucune modification n'est possible. ` +
        `Une correction passe par un workflow d'autorisation.`
    )
  }
}

/**
 * Verrouille une session d'appel.
 * Conforme au §14.2.14-J : empêche les modifications postérieures.
 */
export async function lockAttendanceSession(
  sessionId: string,
  lockedById: string,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx || db
  const session = await client.attendanceSession.findUnique({
    where: { id: sessionId },
  })
  if (!session) {
    throw new AttendanceError('SESSION_NOT_FOUND', `Session ${sessionId} introuvable.`)
  }
  if (session.status !== 'OPEN') {
    throw new AttendanceError(
      'SESSION_LOCKED',
      `La session est déjà ${session.status}. Impossible de la verrouiller à nouveau.`
    )
  }
  await client.attendanceSession.update({
    where: { id: sessionId },
    data: {
      status: 'LOCKED',
      lockedAt: new Date(),
      lockedById,
    },
  })
}

// ============================================================
// Enregistrement d'un appel (avec déduplication)
// ============================================================

/**
 * Enregistre ou met à jour une présence dans une session d'appel.
 *
 * La clé logique (schoolId + attendanceSessionId + studentId) garantit
 * l'idempotence : un même élève ne peut pas avoir deux présences
 * pour la même session d'appel.
 *
 * @returns `created: true` si la présence a été créée, `false` si mise à jour.
 */
export async function upsertAttendance(
  input: {
    schoolId: string
    attendanceSessionId: string
    studentId: string
    courseId: string
    date: Date
    status: AttendanceStatus
    justified?: boolean
    justification?: string
    recordedById?: string
  },
  tx?: Prisma.TransactionClient
): Promise<{ id: string; created: boolean }> {
  const client = tx || db

  // Vérifier que la session est ouverte
  const session = await client.attendanceSession.findUnique({
    where: { id: input.attendanceSessionId },
  })
  if (!session) {
    throw new AttendanceError('SESSION_NOT_FOUND', `Session introuvable.`)
  }
  assertSessionOpen(session)

  // Vérifier que l'élève est bien inscrit dans la classe de la session
  const enrollment = await client.enrollment.findFirst({
    where: {
      studentId: input.studentId,
      classroomId: session.classroomId,
      status: 'ACTIVE',
    },
  })
  if (!enrollment) {
    throw new AttendanceError(
      'STUDENT_NOT_ENROLLED',
      `L'élève n'est pas actif dans la classe ${session.classroomId}.`
    )
  }

  // Tentative d'upsert via la clé logique unique
  // (schoolId + attendanceSessionId + studentId)
  const existing = await client.attendance.findUnique({
    where: {
      schoolId_attendanceSessionId_studentId: {
        schoolId: input.schoolId,
        attendanceSessionId: input.attendanceSessionId,
        studentId: input.studentId,
      },
    },
  })

  if (existing) {
    // Mise à jour
    const updated = await client.attendance.update({
      where: { id: existing.id },
      data: {
        status: input.status,
        justified: input.justified || false,
        justification: input.justification,
        recordedAt: new Date(),
        recordedById: input.recordedById,
      },
    })
    return { id: updated.id, created: false }
  }

  // Création
  const created = await client.attendance.create({
    data: {
      schoolId: input.schoolId,
      attendanceSessionId: input.attendanceSessionId,
      studentId: input.studentId,
      courseId: input.courseId,
      date: input.date,
      status: input.status,
      justified: input.justified || false,
      justification: input.justification,
      recordedById: input.recordedById,
    },
  })
  return { id: created.id, created: true }
}

// ============================================================
// Notification parent en cas d'absence
// ============================================================

/**
 * Crée une notification pour chaque parent rattaché à l'élève,
 * en cas d'absence non justifiée.
 *
 * Conforme au §14.2.14-J : un échec d'envoi de notification ne doit
 * jamais faire échouer l'appel. La notification est créée en DB dans
 * la même transaction que l'absence.
 *
 * @returns Le nombre de notifications créées.
 */
export async function notifyParentsOfAbsence(
  input: {
    schoolId: string
    studentId: string
    studentName: string
    sessionDate: Date
    courseTitle?: string
  },
  tx?: Prisma.TransactionClient
): Promise<number> {
  const client = tx || db

  // Récupérer tous les parents rattachés à l'élève
  const links = await client.guardianStudentLink.findMany({
    where: { studentId: input.studentId },
    include: { guardian: true },
  })

  if (links.length === 0) return 0

  const dateStr = input.sessionDate.toLocaleDateString('fr-FR')
  const courseLabel = input.courseTitle ? ` (${input.courseTitle})` : ''

  // Créer une notification par parent
  await client.notification.createMany({
    data: links.map((link) => ({
      userId: link.guardian.userId!,
      type: 'ABSENCE_ALERT',
      title: `Absence de ${input.studentName}`,
      message: `Votre enfant ${input.studentName} était absent le ${dateStr}${courseLabel}. Merci de justifier cette absence auprès de la direction.`,
      read: false,
    })),
  })

  return links.length
}

// ============================================================
// Workflow des notes (DRAFT → SUBMITTED → CONTROLLED → PUBLISHED)
// ============================================================

/**
 * Matrice de transitions valides.
 * Conforme au §14.2.14-K.2 : une fois PUBLISHED, plus de modification directe.
 */
const VALID_GRADE_TRANSITIONS: Record<GradeStatus, GradeStatus[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['CONTROLLED', 'DRAFT'], // peut retourner en brouillon
  CONTROLLED: ['PUBLISHED', 'SUBMITTED'], // peut retourner en soumis
  PUBLISHED: [], // terminal — toute correction via GradeCorrection
}

/**
 * Vérifie qu'une transition de statut est valide.
 */
export function isValidGradeTransition(
  from: GradeStatus,
  to: GradeStatus
): boolean {
  return VALID_GRADE_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Effectue une transition de statut sur une note.
 * Lève une erreur si la transition est invalide.
 */
export async function transitionGradeStatus(
  gradeId: string,
  to: GradeStatus,
  userId: string,
  tx?: Prisma.TransactionClient
): Promise<{ id: string; previousStatus: GradeStatus; newStatus: GradeStatus }> {
  const client = tx || db

  const grade = await client.grade.findUnique({
    where: { id: gradeId },
  })
  if (!grade) {
    throw new GradeError('GRADE_NOT_FOUND', `Note ${gradeId} introuvable.`)
  }

  const currentStatus = grade.status as GradeStatus
  if (currentStatus === to) {
    return { id: grade.id, previousStatus: currentStatus, newStatus: to }
  }

  if (!isValidGradeTransition(currentStatus, to)) {
    throw new GradeError(
      'INVALID_TRANSITION',
      `Transition invalide : ${currentStatus} → ${to}. ` +
        `Transitions valides depuis ${currentStatus} : ${VALID_GRADE_TRANSITIONS[currentStatus].join(', ') || '(aucune — statut terminal)'}.`
    )
  }

  // Si PUBLISHED, refuser la modification directe du score (DEC-008)
  if (currentStatus === 'PUBLISHED') {
    throw new GradeError(
      'ALREADY_PUBLISHED',
      `Cette note est déjà publiée. Toute correction doit passer par GradeCorrection (workflow officiel).`
    )
  }

  // Métadonnées de transition
  const updateData: any = {
    status: to,
    updatedAt: new Date(),
  }
  if (to === 'SUBMITTED') {
    updateData.submittedAt = new Date()
    updateData.submittedById = userId
  } else if (to === 'CONTROLLED') {
    updateData.controlledAt = new Date()
    updateData.controlledById = userId
  } else if (to === 'PUBLISHED') {
    updateData.publishedAt = new Date()
    updateData.publishedById = userId
  }

  await client.grade.update({
    where: { id: gradeId },
    data: updateData,
  })

  return { id: grade.id, previousStatus: currentStatus, newStatus: to }
}

/**
 * Crée une note en brouillon professeur.
 */
export async function createGradeDraft(
  input: {
    schoolId: string
    studentId: string
    subjectId: string
    classroomId?: string
    teacherId?: string
    title: string
    score: number
    maxScore: number
    weight?: number
    teacherComment?: string
  },
  tx?: Prisma.TransactionClient
): Promise<{ id: string }> {
  const client = tx || db

  // Validation du score
  if (input.score < 0 || input.score > input.maxScore) {
    throw new GradeError(
      'INVALID_SCORE',
      `Le score ${input.score} doit être compris entre 0 et ${input.maxScore}.`
    )
  }

  const grade = await client.grade.create({
    data: {
      schoolId: input.schoolId,
      studentId: input.studentId,
      subjectId: input.subjectId,
      classroomId: input.classroomId,
      teacherId: input.teacherId,
      title: input.title,
      score: input.score,
      maxScore: input.maxScore,
      weight: input.weight ?? 1,
      status: 'DRAFT',
      draftedById: input.teacherId,
      teacherComment: input.teacherComment,
      scoreCents: Math.round(input.score * 100),
      maxScoreCents: Math.round(input.maxScore * 100),
      weightCents: Math.round((input.weight ?? 1) * 100),
    },
  })

  return { id: grade.id }
}

/**
 * Met à jour le score d'une note en brouillon.
 * Refuse toute modification si la note n'est pas en DRAFT.
 */
export async function updateGradeDraft(
  gradeId: string,
  updates: { score?: number; maxScore?: number; weight?: number; teacherComment?: string },
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx || db

  const grade = await client.grade.findUnique({ where: { id: gradeId } })
  if (!grade) {
    throw new GradeError('GRADE_NOT_FOUND', `Note ${gradeId} introuvable.`)
  }
  if (grade.status !== 'DRAFT') {
    throw new GradeError(
      'INVALID_TRANSITION',
      `Impossible de modifier une note en statut ${grade.status}. Seul un brouillon est modifiable.`
    )
  }

  const newScore = updates.score ?? grade.score
  const newMaxScore = updates.maxScore ?? grade.maxScore
  if (newScore < 0 || newScore > newMaxScore) {
    throw new GradeError('INVALID_SCORE', `Score invalide : ${newScore} / ${newMaxScore}.`)
  }

  await client.grade.update({
    where: { id: gradeId },
    data: {
      score: newScore,
      maxScore: newMaxScore,
      weight: updates.weight ?? grade.weight,
      teacherComment: updates.teacherComment,
      scoreCents: Math.round(newScore * 100),
      maxScoreCents: Math.round(newMaxScore * 100),
      weightCents: Math.round((updates.weight ?? grade.weight) * 100),
      updatedAt: new Date(),
    },
  })
}

/**
 * Crée une demande de correction pour une note publiée.
 * Conforme au §14.2.14-K.2 : la note publiée n'est jamais modifiée directement.
 */
export async function requestGradeCorrection(
  input: {
    gradeId: string
    correctedScore: number
    reason: string
    requestedById: string
    evidenceDocName?: string
  },
  tx?: Prisma.TransactionClient
): Promise<{ id: string }> {
  const client = tx || db

  const grade = await client.grade.findUnique({ where: { id: input.gradeId } })
  if (!grade) {
    throw new GradeError('GRADE_NOT_FOUND', `Note ${input.gradeId} introuvable.`)
  }
  if (grade.status !== 'PUBLISHED') {
    throw new GradeError(
      'INVALID_TRANSITION',
      `Une correction ne peut être demandée que sur une note PUBLISHED (actuel : ${grade.status}).`
    )
  }
  if (input.correctedScore < 0 || input.correctedScore > grade.maxScore) {
    throw new GradeError(
      'INVALID_SCORE',
      `Score corrigé invalide : ${input.correctedScore} / ${grade.maxScore}.`
    )
  }
  if (input.reason.length < 5) {
    throw new GradeError(
      'INVALID_SCORE',
      'Le motif de correction doit faire au moins 5 caractères.'
    )
  }

  const correction = await client.gradeCorrection.create({
    data: {
      gradeId: input.gradeId,
      previousScore: grade.score,
      previousScoreCents: grade.scoreCents,
      correctedScore: input.correctedScore,
      correctedScoreCents: Math.round(input.correctedScore * 100),
      reason: input.reason,
      requestedById: input.requestedById,
      evidenceDocName: input.evidenceDocName,
      status: 'PENDING',
    },
  })

  return { id: correction.id }
}
