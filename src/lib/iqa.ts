// SmartShule — Module IQA (Indicateur Qualité d'Assiduité) — Couche DB
// Étape 4 RDC — Portail Prof complet
//
// Réexporte les fonctions pures depuis iqa-pure.ts (utilisables côté client)
// et ajoute les fonctions nécessitant la base de données (côté serveur seulement).

import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'

// Réexport des fonctions pures (compatibilité descendante)
export {
  computeIqa,
  getIqaLevel,
  getIqaColor,
  formatIqaTooltip,
  type IqaLevel,
  type IqaInput,
  type IqaResult,
} from '@/lib/iqa-pure'

import type { IqaLevel, IqaResult } from '@/lib/iqa-pure'

// ============================================================
// Helpers DB : IQA Global pour un élève
// ============================================================

/**
 * Calcule l'IQA global d'un élève sur une période donnée (mois/semaine/trimestre).
 * Compte toutes les StudentAttendanceCalls de l'élève sur la période.
 */
export async function computeIqaForStudent(
  studentId: string,
  periodStart: Date,
  periodEnd: Date,
  tx?: Prisma.TransactionClient
): Promise<IqaResult> {
  const client = tx || db

  const calls = await client.studentAttendanceCall.findMany({
    where: {
      studentId,
      emargement: {
        signatureAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    },
    select: {
      status: true,
      justified: true,
      emargement: { select: { id: true } },
    },
  })

  const uniqueEmargements = new Set(calls.map((c) => c.emargement.id))
  const totalSessions = uniqueEmargements.size

  let absencesUnexcused = 0
  let absencesExcused = 0
  let lateCount = 0

  for (const c of calls) {
    if (c.status === 'ABSENT' && !c.justified) absencesUnexcused++
    if (c.status === 'EXCUSED' || (c.status === 'ABSENT' && c.justified)) absencesExcused++
    if (c.status === 'LATE') lateCount++
  }

  return computeIqa({
    totalSessions,
    absencesUnexcused,
    absencesExcused,
    lateCount,
  })
}

// ============================================================
// Helpers DB : IQA par matière pour un élève
// ============================================================

/**
 * Calcule l'IQA d'un élève pour une matière spécifique.
 * Filtre uniquement les StudentAttendanceCalls liées à un émargement dont subjectId correspond.
 */
export async function computeIqaForSubject(
  studentId: string,
  subjectId: string,
  periodStart: Date,
  periodEnd: Date,
  tx?: Prisma.TransactionClient
): Promise<IqaResult> {
  const client = tx || db

  const calls = await client.studentAttendanceCall.findMany({
    where: {
      studentId,
      subjectId,
      emargement: {
        signatureAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    },
    select: {
      status: true,
      justified: true,
      emargement: { select: { id: true } },
    },
  })

  const uniqueEmargements = new Set(calls.map((c) => c.emargement.id))
  const totalSessions = uniqueEmargements.size

  let absencesUnexcused = 0
  let absencesExcused = 0
  let lateCount = 0

  for (const c of calls) {
    if (c.status === 'ABSENT' && !c.justified) absencesUnexcused++
    if (c.status === 'EXCUSED' || (c.status === 'ABSENT' && c.justified)) absencesExcused++
    if (c.status === 'LATE') lateCount++
  }

  return computeIqa({
    totalSessions,
    absencesUnexcused,
    absencesExcused,
    lateCount,
  })
}

// ============================================================
// Snapshot IQA — Persistance pour requêtes rapides
// ============================================================

/**
 * Persiste un snapshot IQA en base (upsert).
 * Évite de recalculer à chaque requête.
 * Gère le cas subjectId=null en cherchant par clé composite manuelle.
 */
export async function persistIqaSnapshot(
  input: {
    schoolId: string
    studentId: string
    subjectId?: string | null
    classroomId?: string
    period: string
    iqa: IqaResult
  },
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx || db

  // Recherche du snapshot existant (par student + period + subject null-or-matched)
  const existing = await client.iqaSnapshot.findFirst({
    where: {
      studentId: input.studentId,
      period: input.period,
      subjectId: input.subjectId ?? null,
    },
  })

  if (existing) {
    await client.iqaSnapshot.update({
      where: { id: existing.id },
      data: {
        iqaValue: input.iqa.iqa,
        level: input.iqa.level,
        totalSessions: input.iqa.totalSessions,
        absencesUnexcused: input.iqa.absencesUnexcused,
        absencesExcused: input.iqa.absencesExcused,
        lateCount: input.iqa.lateCount,
        computedAt: new Date(),
      },
    })
  } else {
    await client.iqaSnapshot.create({
      data: {
        schoolId: input.schoolId,
        studentId: input.studentId,
        subjectId: input.subjectId || null,
        classroomId: input.classroomId || null,
        period: input.period,
        iqaValue: input.iqa.iqa,
        level: input.iqa.level,
        totalSessions: input.iqa.totalSessions,
        absencesUnexcused: input.iqa.absencesUnexcused,
        absencesExcused: input.iqa.absencesExcused,
        lateCount: input.iqa.lateCount,
      },
    })
  }
}

/**
 * Récupère les snapshots IQA pour une classe entière sur une période.
 * Retourne un tableau trié par IQA croissant (les plus critiques en premier).
 */
export async function getClassroomIqaSnapshots(
  classroomId: string,
  period: string,
  tx?: Prisma.TransactionClient
): Promise<
  Array<{
    studentId: string
    studentName: string
    matricule: string
    iqa: number
    level: IqaLevel
    totalSessions: number
    absencesUnexcused: number
    absencesExcused: number
    lateCount: number
  }>
> {
  const client = tx || db

  // Trouver les élèves actifs dans la classe
  const enrollments = await client.enrollment.findMany({
    where: { classroomId, status: 'ACTIVE' },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          matricule: true,
          schoolId: true,
        },
      },
    },
  })

  if (enrollments.length === 0) return []

  const studentIds = enrollments.map((e) => e.studentId)
  const schoolId = enrollments[0].student.schoolId

  // Snapshot IQA global (subjectId IS NULL) par élève
  const snapshots = await client.iqaSnapshot.findMany({
    where: {
      schoolId,
      studentId: { in: studentIds },
      subjectId: null,
      period,
    },
  })

  const snapshotMap = new Map(snapshots.map((s) => [s.studentId, s]))

  const result = enrollments.map((e) => {
    const snap = snapshotMap.get(e.studentId)
    return {
      studentId: e.student.id,
      studentName: `${e.student.firstName} ${e.student.lastName}`,
      matricule: e.student.matricule,
      iqa: snap?.iqaValue ?? 100,
      level: (snap?.level as IqaLevel) ?? 'EXCELLENT',
      totalSessions: snap?.totalSessions ?? 0,
      absencesUnexcused: snap?.absencesUnexcused ?? 0,
      absencesExcused: snap?.absencesExcused ?? 0,
      lateCount: snap?.lateCount ?? 0,
    }
  })

  // Tri par IQA croissant (les plus critiques en premier)
  return result.sort((a, b) => a.iqa - b.iqa)
}

// (formatIqaTooltip est défini dans iqa-pure.ts et réexporté en haut de ce fichier)
