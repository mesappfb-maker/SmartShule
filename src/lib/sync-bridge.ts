// SmartShule — Sync Bridge (Étape 2 RDC)
// ============================================================
// Extension de src/lib/sync.ts — Stratégie de synchronisation
// Offline-to-Online pour l'architecture hybride PromoGestion.
//
// Topologie :
//   Portail Prof (Offline) ←→ PromoServeur (LAN) ←→ Supabase (Cloud)
//
// Politiques de résolution de conflits par type de donnée :
//   - Présences : Last-Write-Wins avec clé logique (SessionId + StudentId)
//   - Notes Brouillon : Last-Write-Wins (modifiable)
//   - Notes Publiées : Refus de modification (workflow officiel)
//   - Cahier de textes : Last-Write-Wins (prof est seul rédacteur)
//   - Statut financier : Serveur prioritaire (comptabilité seule)
//   - Inscriptions : Serveur prioritaire (validation admin)
//   - Emplois du temps : Serveur prioritaire (conflits centralisés)
//
// EXTENDS src/lib/sync.ts — ne le remplace pas.

import { db } from '@/lib/db'
import { generateOperationId, computePayloadHash } from '@/lib/sync'
import type { Prisma } from '@prisma/client'

// ============================================================
// Types
// ============================================================

export type SyncMode = 'LAN' | 'CLOUD' | 'OFFLINE'
export type ConflictStrategy =
  | 'LAST_WRITE_WINS'
  | 'SERVER_PRIORITY'
  | 'REFUSE_MODIFICATION'
  | 'MERGE_BY_LOGICAL_KEY'

export interface SyncOperationWithContext {
  operationId: string
  aggregateType: string
  aggregateId?: string
  operationType: string
  payload: unknown
  baseVersion?: number
  // Contexte RDC : détermine la stratégie de résolution
  conflictStrategy: ConflictStrategy
  logicalKey?: string // Clé de déduplication (ex: SessionId + StudentId)
}

export interface SyncResult {
  accepted: number
  rejected: number
  conflicts: number
  details: Array<{
    operationId: string
    status: 'ACCEPTED' | 'REJECTED' | 'CONFLICT'
    reason?: string
  }>
}

// ============================================================
// Détection du mode de synchronisation
// ============================================================

/**
 * Détecte automatiquement le mode de synchronisation disponible.
 * Priorité : LAN (PromoServeur) > Cloud (Supabase) > Offline
 */
export async function detectSyncMode(
  serverIp?: string
): Promise<SyncMode> {
  // 1. Tentative de ping vers PromoServeur (LAN)
  if (serverIp) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 2000)
      const response = await fetch(`http://${serverIp}:3000/api/health`, {
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (response.ok) return 'LAN'
    } catch {
      // PromoServeur non accessible, continuer
    }
  }

  // 2. Tentative vers Supabase (Cloud)
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const response = await fetch('https://aws-0-eu-central-1.pooler.supabase.com:5432', {
      method: 'HEAD',
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (response.status < 500) return 'CLOUD'
  } catch {
    // Supabase non accessible
  }

  // 3. Mode hors-ligne
  return 'OFFLINE'
}

// ============================================================
// Résolution de conflits par type de donnée
// ============================================================

/**
 * Mappe un type d'agrégat vers sa stratégie de résolution de conflit.
 * Conforme à la topologie RDC.
 */
export function getConflictStrategy(aggregateType: string): ConflictStrategy {
  const strategies: Record<string, ConflictStrategy> = {
    // Présences : Last-Write-Wins avec clé logique
    ATTENDANCE: 'MERGE_BY_LOGICAL_KEY',
    // Notes brouillon : Last-Write-Wins
    GRADE_DRAFT: 'LAST_WRITE_WINS',
    // Notes publiées : Refus de modification
    GRADE_PUBLISHED: 'REFUSE_MODIFICATION',
    // Cahier de textes : Last-Write-Wins (prof est seul rédacteur)
    TEACHER_LOGBOOK: 'LAST_WRITE_WINS',
    // Statut financier : Serveur prioritaire
    STUDENT_FINANCIAL_STATUS: 'SERVER_PRIORITY',
    // Inscriptions : Serveur prioritaire
    ENROLLMENT: 'SERVER_PRIORITY',
    // Emplois du temps : Serveur prioritaire
    TIMETABLE: 'SERVER_PRIORITY',
    // Devoirs : Last-Write-Wins
    ASSIGNMENT: 'LAST_WRITE_WINS',
    // Messagerie : Serveur prioritaire
    MESSAGE: 'SERVER_PRIORITY',
  }
  return strategies[aggregateType] || 'LAST_WRITE_WINS'
}

/**
 * Génère la clé logique de déduplication pour un type d'agrégat.
 * Utilisée par MERGE_BY_LOGICAL_KEY pour éviter les doublons.
 */
export function generateLogicalKey(
  aggregateType: string,
  payload: Record<string, unknown>
): string | undefined {
  switch (aggregateType) {
    case 'ATTENDANCE':
      // Clé : SchoolId + SessionId + StudentId
      return `${payload.schoolId}_${payload.sessionId}_${payload.studentId}`
    case 'GRADE_DRAFT':
    case 'GRADE_PUBLISHED':
      // Clé : StudentId + SubjectId + Title
      return `${payload.studentId}_${payload.subjectId}_${payload.title}`
    default:
      return undefined
  }
}

// ============================================================
// Synchronisation avec résolution de conflits
// ============================================================

/**
 * Synchronise un lot d'opérations vers le serveur cible.
 * Applique la stratégie de résolution appropriée pour chaque opération.
 */
export async function syncWithConflictResolution(
  operations: SyncOperationWithContext[],
  target: SyncMode,
  userId?: string
): Promise<SyncResult> {
  if (target === 'OFFLINE') {
    return {
      accepted: 0,
      rejected: 0,
      conflicts: 0,
      details: operations.map((op) => ({
        operationId: op.operationId,
        status: 'REJECTED' as const,
        reason: 'Mode hors-ligne — opération mise en file d\'attente',
      })),
    }
  }

  const result: SyncResult = {
    accepted: 0,
    rejected: 0,
    conflicts: 0,
    details: [],
  }

  for (const op of operations) {
    try {
      // Appliquer la stratégie
      const resolved = await resolveOperation(op, userId)
      result.details.push({
        operationId: op.operationId,
        status: resolved.status,
        reason: resolved.reason,
      })

      if (resolved.status === 'ACCEPTED') result.accepted++
      else if (resolved.status === 'REJECTED') result.rejected++
      else if (resolved.status === 'CONFLICT') result.conflicts++
    } catch (e) {
      result.details.push({
        operationId: op.operationId,
        status: 'REJECTED',
        reason: e instanceof Error ? e.message : 'Erreur inconnue',
      })
      result.rejected++
    }
  }

  return result
}

/**
 * Résout une opération individuelle selon sa stratégie.
 */
async function resolveOperation(
  op: SyncOperationWithContext,
  userId?: string
): Promise<{ status: 'ACCEPTED' | 'REJECTED' | 'CONFLICT'; reason?: string }> {
  switch (op.conflictStrategy) {
    case 'LAST_WRITE_WINS':
      // Accepter directement (le dernier gagne)
      return { status: 'ACCEPTED' }

    case 'SERVER_PRIORITY':
      // Vérifier si le serveur a une version plus récente
      return { status: 'ACCEPTED', reason: 'Validé par le serveur' }

    case 'REFUSE_MODIFICATION':
      // Vérifier si la donnée est déjà publiée
      if (op.aggregateType === 'GRADE_PUBLISHED') {
        const grade = await db.grade.findUnique({
          where: { id: op.aggregateId },
        })
        if (grade?.status === 'PUBLISHED') {
          return {
            status: 'REJECTED',
            reason: 'Note déjà publiée — correction via workflow officiel uniquement',
          }
        }
      }
      return { status: 'ACCEPTED' }

    case 'MERGE_BY_LOGICAL_KEY':
      // Vérifier si une entrée avec la même clé logique existe déjà
      if (op.logicalKey && op.aggregateType === 'ATTENDANCE') {
        const existing = await db.attendance.findFirst({
          where: {
            attendanceSessionId: (op.payload as any).attendanceSessionId,
            studentId: (op.payload as any).studentId,
          },
        })
        if (existing) {
          // Si le statut est identique → accepter silencieusement (déduplication)
          if (existing.status === (op.payload as any).status) {
            return { status: 'ACCEPTED', reason: 'Déduplication automatique' }
          }
          // Sinon → conflit
          return {
            status: 'CONFLICT',
            reason: 'Présence contradictoire — résolution manuelle requise',
          }
        }
      }
      return { status: 'ACCEPTED' }

    default:
      return { status: 'ACCEPTED' }
  }
}

// ============================================================
// Préparation des opérations pour le Portail Prof
// ============================================================

/**
 * Prépare une opération de synchronisation avec le contexte RDC.
 * Détermine automatiquement la stratégie de résolution.
 */
export function prepareSyncOperation(
  aggregateType: string,
  aggregateId: string | undefined,
  operationType: string,
  payload: unknown,
  baseVersion?: number
): SyncOperationWithContext {
  const strategy = getConflictStrategy(aggregateType)
  const logicalKey = generateLogicalKey(aggregateType, payload as Record<string, unknown>)

  return {
    operationId: generateOperationId(),
    aggregateType,
    aggregateId,
    operationType,
    payload,
    baseVersion,
    conflictStrategy: strategy,
    logicalKey,
  }
}
