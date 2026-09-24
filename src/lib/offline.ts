// SmartShule — Service Offline-First
// ============================================================
// Gestion de l'état de connexion, file d'attente, synchronisation
// et mode dégradé (lecture seule après expiration licence).
//
// Architecture :
//   - L'app fonctionne 100% hors ligne (SQLite local via Prisma)
//   - sync_outbox : opérations en attente de synchronisation
//   - sync_inbox : changements reçus du cloud à appliquer
//   - sync_conflicts : conflits nécessitant résolution
//   - sync_checkpoints : curseur de progression par appareil
//   - sync_runs : journal des exécutions
//   - sync_errors : journal des erreurs
//
// Règles offline :
//   1. Toute modification locale est d'abord enregistrée dans SQLite
//   2. Un audit local est créé
//   3. Une ligne sync_outbox est créée
//   4. L'opération reste exploitable sans Internet
//   5. La synchronisation se fait quand une connexion fiable est disponible
//   6. Aucune opération locale n'est perdue si Internet est coupé
//   7. Aucune donnée sensible n'est écrasée silencieusement

import { db } from '@/lib/db'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'
import crypto from 'crypto'

// ============================================================
// Types
// ============================================================

export type ConnectionState = 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'ERROR' | 'CONFLICT' | 'LICENSE_LIMITED'
export type SyncMode = 'FULL' | 'INCREMENTAL' | 'FORCED' | 'RECOVERY'
export type ConflictStrategy =
  | 'LAST_WRITE_WINS'
  | 'LAST_WRITE_WINS_DRAFT'
  | 'SERVER_WINS'
  | 'CLIENT_WINS'
  | 'MERGE'
  | 'BLOCKING_REVIEW'
  | 'CORRECTION_WORKFLOW'
  | 'VERSION_NEW'

export interface OfflineOperation {
  operationId: string
  deviceId?: string
  userId?: string
  aggregateType: string
  aggregateId?: string
  operationType: 'CREATE' | 'UPDATE' | 'DELETE' | 'SUBMIT' | 'PUBLISH'
  payload: Record<string, any>
  baseVersion?: number
}

// ============================================================
// Stratégies de résolution de conflits par type de donnée
// ============================================================

export const CONFLICT_STRATEGIES: Record<string, ConflictStrategy> = {
  // Audit : ajout uniquement, jamais écrasé
  AUDIT_LOG: 'BLOCKING_REVIEW',
  // Paiement : conflit bloquant, revue comptable
  PAYMENT: 'BLOCKING_REVIEW',
  // Écriture comptable : jamais écrasée ; ajustement ou contrepassation
  JOURNAL_ENTRY: 'CORRECTION_WORKFLOW',
  // Paie validée : jamais écrasée ; correction par ajustement
  PAYROLL_VALIDATED: 'CORRECTION_WORKFLOW',
  // Note publiée : conflit bloquant ou validation direction
  GRADE_PUBLISHED: 'BLOCKING_REVIEW',
  // Admission validée : conflit bloquant avec revue secrétariat/direction
  ADMISSION_ACCEPTED: 'BLOCKING_REVIEW',
  // Adresse parent : fusion contrôlée avec historique
  GUARDIAN_ADDRESS: 'MERGE',
  // Brouillon : fusion possible si les champs ne se contredisent pas
  DRAFT: 'LAST_WRITE_WINS_DRAFT',
  // Document : version nouvelle, jamais écrasement silencieux
  DOCUMENT: 'VERSION_NEW',
  // Paramètres : cloud prioritaire avec historique
  SETTINGS: 'SERVER_WINS',
  // Licence : cloud prioritaire
  LICENSE: 'SERVER_WINS',
  // Présence : Last-Write-Wins avec clé logique
  ATTENDANCE: 'LAST_WRITE_WINS',
  // Notes brouillon : Last-Write-Wins
  GRADE_DRAFT: 'LAST_WRITE_WINS_DRAFT',
  // Cahier de textes : Last-Write-Wins (prof est seul rédacteur)
  LESSON_LOG: 'LAST_WRITE_WINS',
}

// ============================================================
// Helper : générer ID opération unique (GUID v4)
// ============================================================

export function generateOperationId(): string {
  return crypto.randomUUID()
}

// ============================================================
// Helper : calculer hash SHA-256 du payload
// ============================================================

export function computePayloadHash(payload: Record<string, any>): string {
  const json = JSON.stringify(payload, Object.keys(payload).sort())
  return crypto.createHash('sha256').update(json).digest('hex')
}

// ============================================================
// Enregistrer une opération dans sync_outbox (offline-first)
// ============================================================

export async function queueOperation(op: OfflineOperation): Promise<string> {
  const operationId = op.operationId || generateOperationId()
  const payloadHash = computePayloadHash(op.payload)

  // Vérifier l'idempotence : si l'opération existe déjà avec le même hash, ne pas recréer
  const existing = await db.syncOutbox.findUnique({ where: { operationId } })
  if (existing) {
    if (existing.payloadHash === payloadHash) {
      return operationId // Idempotent — même opération
    }
    // Payload différent pour même operationId → conflit
    throw new Error(`operationId ${operationId} déjà utilisé avec un payload différent`)
  }

  await db.syncOutbox.create({
    data: {
      operationId,
      deviceId: op.deviceId,
      aggregateType: op.aggregateType,
      aggregateId: op.aggregateId,
      operationType: op.operationType,
      payloadJson: JSON.stringify(op.payload),
      payloadHash,
      baseVersion: op.baseVersion,
      userId: op.userId,
      status: 'PENDING',
    },
  })

  return operationId
}

// ============================================================
// Récupérer les opérations en attente (PENDING ou RETRYING)
// ============================================================

export async function getPendingOperations(deviceId?: string, limit = 100): Promise<any[]> {
  const where: any = {
    status: { in: ['PENDING', 'RETRYING'] },
  }
  if (deviceId) where.deviceId = deviceId

  return db.syncOutbox.findMany({
    where,
    orderBy: [{ createdAtUtc: 'asc' }],
    take: limit,
  })
}

// ============================================================
// Marquer une opération comme envoyée (SENDING)
// ============================================================

export async function markOperationSending(operationId: string): Promise<void> {
  await db.syncOutbox.update({
    where: { operationId },
    data: {
      status: 'SENDING',
      lastAttemptAtUtc: new Date(),
      attemptCount: { increment: 1 },
    },
  })
}

// ============================================================
// Marquer une opération comme acceptée par le cloud
// ============================================================

export async function markOperationAccepted(operationId: string, result?: any): Promise<void> {
  await db.syncOutbox.update({
    where: { operationId },
    data: {
      status: 'ACCEPTED',
      lastErrorMessage: null,
      lastErrorCode: null,
    },
  })
}

// ============================================================
// Marquer une opération comme rejetée
// ============================================================

export async function markOperationRejected(operationId: string, errorCode: string, errorMessage: string): Promise<void> {
  await db.syncOutbox.update({
    where: { operationId },
    data: {
      status: 'REJECTED',
      lastErrorCode: errorCode,
      lastErrorMessage: errorMessage,
    },
  })
}

// ============================================================
// Créer un conflit de synchronisation
// ============================================================

export async function createSyncConflict(params: {
  operationId?: string
  deviceId?: string
  aggregateType: string
  aggregateId?: string
  localPayload: Record<string, any>
  serverPayload?: Record<string, any>
  baseVersion?: number
  serverVersion?: number
  conflictType: string // STALE_VERSION | CONTRADICTORY | PERMISSION_REVOKED | BUSINESS_RULE
}): Promise<string> {
  const conflictId = crypto.randomUUID()

  await db.syncConflict.create({
    data: {
      conflictId,
      operationId: params.operationId,
      deviceId: params.deviceId,
      aggregateType: params.aggregateType,
      aggregateId: params.aggregateId,
      localPayloadJson: JSON.stringify(params.localPayload),
      serverPayloadJson: params.serverPayload ? JSON.stringify(params.serverPayload) : null,
      baseVersion: params.baseVersion,
      serverVersion: params.serverVersion,
      conflictType: params.conflictType,
      status: 'OPEN',
    },
  })

  // Marquer l'opération outbox comme CONFLICT
  if (params.operationId) {
    await db.syncOutbox.update({
      where: { operationId: params.operationId },
      data: { status: 'CONFLICT' },
    })
  }

  return conflictId
}

// ============================================================
// Résoudre un conflit
// ============================================================

export async function resolveConflict(
  conflictId: string,
  resolution: {
    strategy: ConflictStrategy
    note?: string
    resolvedById: string
    resolvedByName: string
  }
): Promise<void> {
  const conflict = await db.syncConflict.findUnique({ where: { conflictId } })
  if (!conflict) throw new Error('Conflit introuvable')

  await db.syncConflict.update({
    where: { conflictId },
    data: {
      status: 'RESOLVED',
      resolutionStrategy: resolution.strategy,
      resolutionNote: resolution.note || null,
      resolvedAtUtc: new Date(),
      resolvedById: resolution.resolvedById,
    },
  })

  // Marquer l'opération outbox comme ACCEPTED ou REJECTED selon la stratégie
  if (conflict.operationId) {
    const clientWins = ['CLIENT_WINS', 'LAST_WRITE_WINS', 'LAST_WRITE_WINS_DRAFT', 'MERGE'].includes(resolution.strategy)
    await db.syncOutbox.update({
      where: { operationId: conflict.operationId },
      data: { status: clientWins ? 'ACCEPTED' : 'REJECTED' },
    })
  }

  // Audit (optionnel si hors contexte request)
  try {
    const h = await headers()
    await logAudit({
      userId: resolution.resolvedById,
      userName: resolution.resolvedByName,
      schoolId: undefined,
      action: 'CONFLICT_RESOLVED',
      entityType: 'SYNC_CONFLICT',
      entityId: conflictId,
      description: `Conflit résolu: ${resolution.strategy} — ${resolution.note || ''}`,
      ipAddress: getClientIP(h),
      metadata: { conflictId, strategy: resolution.strategy },
    })
  } catch {
    // Hors contexte request (ex: tests) — audit sans IP
  }
}

// ============================================================
// Démarrer un run de synchronisation
// ============================================================

export async function startSyncRun(deviceId?: string, schoolId?: string, runType: SyncMode = 'INCREMENTAL', triggeredBy?: { id: string; name: string }): Promise<string> {
  const run = await db.syncRun.create({
    data: {
      deviceId,
      schoolId,
      runType,
      status: 'RUNNING',
      triggeredById: triggeredBy?.id,
      triggeredByName: triggeredBy?.name,
    },
  })
  return run.id
}

// ============================================================
// Terminer un run de synchronisation
// ============================================================

export async function completeSyncRun(
  runId: string,
  stats: {
    outboxSent: number
    outboxAccepted: number
    outboxRejected: number
    outboxConflicts: number
    inboxReceived: number
    inboxApplied: number
    inboxSkipped: number
  },
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED' = 'SUCCESS',
  errorMessage?: string
): Promise<void> {
  const completedAt = new Date()
  const run = await db.syncRun.findUnique({ where: { id: runId } })
  const durationMs = run ? completedAt.getTime() - run.startedAt.getTime() : 0

  await db.syncRun.update({
    where: { id: runId },
    data: {
      ...stats,
      completedAt,
      durationMs,
      status,
      errorMessage: errorMessage || null,
    },
  })
}

// ============================================================
// Mettre à jour le checkpoint
// ============================================================

export async function updateCheckpoint(
  deviceId: string,
  lastServerSequence: number,
  lastOutboxOperationId?: string,
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED' = 'SUCCESS',
  durationMs?: number
): Promise<void> {
  const existing = await db.syncCheckpoint.findUnique({ where: { deviceId } })
  if (existing) {
    await db.syncCheckpoint.update({
      where: { deviceId },
      data: {
        lastServerSequence: Math.max(existing.lastServerSequence, lastServerSequence),
        lastOutboxOperationId: lastOutboxOperationId || existing.lastOutboxOperationId,
        lastSyncAt: new Date(),
        lastSyncStatus: status,
        lastSyncDurationMs: durationMs,
      },
    })
  } else {
    await db.syncCheckpoint.create({
      data: {
        deviceId,
        lastServerSequence,
        lastOutboxOperationId,
        lastSyncAt: new Date(),
        lastSyncStatus: status,
        lastSyncDurationMs: durationMs,
      },
    })
  }
}

// ============================================================
// Journaliser une erreur de synchronisation
// ============================================================

export async function logSyncError(params: {
  deviceId?: string
  schoolId?: string
  errorCode: string
  errorMessage: string
  errorStack?: string
  operationId?: string
  aggregateType?: string
  aggregateId?: string
  retryable?: boolean
}): Promise<void> {
  await db.syncError.create({
    data: {
      deviceId: params.deviceId,
      schoolId: params.schoolId,
      errorCode: params.errorCode,
      errorMessage: params.errorMessage,
      errorStack: params.errorStack,
      operationId: params.operationId,
      aggregateType: params.aggregateType,
      aggregateId: params.aggregateId,
      retryable: params.retryable !== false,
    },
  })
}

// ============================================================
// Statut de synchronisation (pour UI)
// ============================================================

export async function getSyncStatus(deviceId?: string): Promise<{
  pendingCount: number
  conflictCount: number
  errorCount: number
  lastSyncAt?: Date
  lastSyncStatus?: string
  lastSyncDurationMs?: number
}> {
  const whereOutbox: any = { status: { in: ['PENDING', 'RETRYING', 'SENDING'] } }
  if (deviceId) whereOutbox.deviceId = deviceId

  const [pendingCount, conflictCount, errorCount, checkpoint] = await Promise.all([
    db.syncOutbox.count({ where: whereOutbox }),
    db.syncConflict.count({ where: { status: 'OPEN' } }),
    db.syncError.count({ where: { resolvedAt: null } }),
    deviceId ? db.syncCheckpoint.findUnique({ where: { deviceId } }) : null,
  ])

  return {
    pendingCount,
    conflictCount,
    errorCount,
    lastSyncAt: checkpoint?.lastSyncAt,
    lastSyncStatus: checkpoint?.lastSyncStatus,
    lastSyncDurationMs: checkpoint?.lastSyncDurationMs,
  }
}

// ============================================================
// État de la licence (période de grâce offline)
// ============================================================

export async function getLicenseStatus(schoolId: string): Promise<{
  isActive: boolean
  isExpired: boolean
  isGracePeriod: boolean
  daysRemaining: number
  daysGraceRemaining: number
  isReadOnly: boolean
  maxStudents: number
  currentStudents: number
  planType: string
  expiresAt?: Date
}> {
  const license = await db.license.findUnique({ where: { schoolId } })
  if (!license) {
    return {
      isActive: false,
      isExpired: true,
      isGracePeriod: false,
      daysRemaining: 0,
      daysGraceRemaining: 0,
      isReadOnly: false,
      maxStudents: 0,
      currentStudents: 0,
      planType: 'NONE',
    }
  }

  const now = new Date()
  const expiresAt = license.expiresAt
  const isExpired = expiresAt ? now > expiresAt : false

  // Période de grâce : 30 jours après expiration (configurable)
  const gracePeriodDays = 30
  const graceEnd = expiresAt ? new Date(expiresAt.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000) : null
  const isGracePeriod = isExpired && graceEnd ? now < graceEnd : false

  const daysRemaining = expiresAt
    ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
    : 999

  const daysGraceRemaining = graceEnd && isExpired
    ? Math.max(0, Math.ceil((graceEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
    : 0

  // Mode lecture seule si expiré et hors période de grâce
  const isReadOnly = isExpired && !isGracePeriod

  const currentStudents = await db.student.count({ where: { schoolId } })

  return {
    isActive: license.status === 'ACTIVE' && !isExpired,
    isExpired,
    isGracePeriod,
    daysRemaining,
    daysGraceRemaining,
    isReadOnly,
    maxStudents: license.maxStudents,
    currentStudents,
    planType: license.planType,
    expiresAt: expiresAt || undefined,
  }
}

// ============================================================
// Vérifier si une écriture est autorisée (licence non expirée)
// ============================================================

export async function canWrite(schoolId: string): Promise<{ ok: boolean; reason?: string }> {
  const status = await getLicenseStatus(schoolId)
  if (status.isReadOnly) {
    return {
      ok: false,
      reason: 'Licence expirée — mode lecture seule. Renouvelez votre licence pour créer/modifier des données.',
    }
  }
  if (status.currentStudents >= status.maxStudents) {
    return {
      ok: false,
      reason: `Limite d'élèves atteinte (${status.maxStudents}). Passez à une offre supérieure.`,
    }
  }
  return { ok: true }
}

// ============================================================
// Multi-écoles : vérifier l'isolation stricte
// ============================================================

export function assertSchoolIsolation(schoolId: string, entitySchoolId: string | null | undefined, entityType: string): void {
  if (!entitySchoolId) {
    throw new Error(`Isolation violée : ${entityType} sans schoolId`)
  }
  if (schoolId !== entitySchoolId) {
    throw new Error(`Isolation violée : ${entityType} ${entitySchoolId} n'appartient pas à l'école ${schoolId}`)
  }
}

// ============================================================
// Enregistrer ou récupérer un appareil
// ============================================================

export async function registerDevice(params: {
  deviceId: string
  schoolId?: string
  userId?: string
  deviceType: string // DESKTOP | WEB | MOBILE
  appVersion?: string
}): Promise<any> {
  const existing = await db.syncDevice.findUnique({ where: { deviceId: params.deviceId } })
  if (existing) {
    return db.syncDevice.update({
      where: { deviceId: params.deviceId },
      data: {
        schoolId: params.schoolId || existing.schoolId,
        userId: params.userId || existing.userId,
        appVersion: params.appVersion || existing.appVersion,
        lastSeenAtUtc: new Date(),
        status: 'ACTIVE',
      },
    })
  }
  return db.syncDevice.create({
    data: {
      deviceId: params.deviceId,
      schoolId: params.schoolId,
      userId: params.userId,
      deviceType: params.deviceType,
      appVersion: params.appVersion,
      lastSeenAtUtc: new Date(),
      status: 'ACTIVE',
    },
  })
}
