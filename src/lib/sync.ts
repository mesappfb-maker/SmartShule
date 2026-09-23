// SmartShule — Infrastructure de synchronisation technique
// Implémente les primitives de l'architecture hub-and-spoke décrites
// au §14.2.15 du cahier des charges, adaptées à Next.js.
//
// IMPORTANT : cette librairie ne fait pas dehors-ligne réel (pas de SQLite
// par poste navigateur). Elle fournit :
//   - la génération d'identifiants globaux (GUID v4 robustes) ;
//   - l'empreinte SHA-256 des payloads (détection de divergence) ;
//   - les types et états conformes au cahier des charges ;
//   - des helpers d'enregistrement des opérations de sync côté serveur ;
//   - une API idempotente qui peut être appelée par un futur client desktop.

import crypto from 'crypto'
import { db } from '@/lib/db'

// ============================================================
// Types conformes au cahier des charges §14.2.14 — Cycle complet
// ============================================================

export type OperationStatus =
  | 'PENDING'
  | 'SENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CONFLICT'
  | 'RETRYING'
  | 'CANCELLED'

export type OperationType =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'SUBMIT'
  | 'PUBLISH'

export type AggregateType =
  | 'STUDENT'
  | 'GUARDIAN'
  | 'INVOICE'
  | 'PAYMENT'
  | 'ANNOUNCEMENT'
  | 'PARENT_REQUEST'
  | 'ASSIGNMENT'
  | 'SUBMISSION'
  | 'GRADE'
  | 'ATTENDANCE'
  | 'REPORT_CARD'
  | 'COURSE'
  | 'OTHER'

export type ConflictType =
  | 'STALE_VERSION'
  | 'CONTRADICTORY'
  | 'PERMISSION_REVOKED'
  | 'BUSINESS_RULE'

export type ConflictResolutionStrategy =
  | 'AUTO_DEDUPLICATED'
  | 'MERGED'
  | 'LAST_WRITE_WINS_DRAFT'
  | 'MANUAL_RESOLUTION'
  | 'CORRECTION_WORKFLOW'

export type InboxChangeType = 'CREATE' | 'UPDATE' | 'DELETE'

// ============================================================
// Génération d'identifiants globaux
// ============================================================

/**
 * Génère un identifiant global d'opération (GUID v4 robuste).
 * Utilisé pour l'idempotence : une même opération renvoyée
 * deux fois doit produire le même effet qu'une seule fois.
 */
export function generateOperationId(): string {
  return crypto.randomUUID()
}

/**
 * Génère un identifiant de changement (pour la Inbox).
 * Permet à un client d'ignorer un changement déjà appliqué.
 */
export function generateChangeId(): string {
  return crypto.randomUUID()
}

/**
 * Génère un identifiant de conflit pour la table SyncConflict.
 */
export function generateConflictId(): string {
  return crypto.randomUUID()
}

// ============================================================
// Empreinte SHA-256 d'un payload JSON
// ============================================================

/**
 * Sérialise un objet en JSON canonique (clés triées) puis calcule
 * l'empreinte SHA-256 hexadécimale. Permet de détecter qu'un payload
 * répété est strictement identique, ou qu'un même Idempotency-Key
 * est réutilisé avec un payload différent (interdit).
 */
export function computePayloadHash(payload: unknown): string {
  const canonical = canonicalJsonStringify(payload)
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex')
}

/**
 * Sérialisation canonique : clés triées, espaces standardisés.
 * Permet de comparer deux payloads de façon déterministe.
 */
export function canonicalJsonStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJsonStringify).join(',') + ']'
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return (
    '{' +
    keys
      .filter((k) => obj[k] !== undefined)
      .map((k) => JSON.stringify(k) + ':' + canonicalJsonStringify(obj[k]))
      .join(',') +
    '}'
  )
}

// ============================================================
// Enregistrement des opérations de sync côté serveur
// ============================================================

export interface RecordOperationInput {
  operationId: string
  deviceId?: string
  userId?: string
  aggregateType: AggregateType | string
  aggregateId?: string
  operationType: OperationType | string
  payload: unknown
  baseVersion?: number
}

export interface RecordedOperation {
  id: string
  operationId: string
  status: OperationStatus
  payloadHash: string
  isReplay: boolean // true si l'opération a déjà été reçue avec le même operationId
  previousResult?: unknown
}

/**
 * Enregistre (ou rejoue) une opération de synchronisation.
 *
 * Idempotence garantie par la contrainte unique sur `operationId`.
 * Si l'opération a déjà été reçue :
 *   - si le payloadHash correspond : on renvoie le résultat précédent (REPLAY_OK) ;
 *   - sinon : on rejette avec une erreur (DIVERGENT_PAYLOAD).
 *
 * @param input Les données de l'opération
 * @returns L'opération enregistrée + indicateur de replay
 */
export async function recordOperation(
  input: RecordOperationInput
): Promise<RecordedOperation> {
  const payloadJson = JSON.stringify(input.payload)
  const payloadHash = computePayloadHash(input.payload)

  // Vérifier si une opération avec le même operationId existe déjà
  const existing = await db.syncOperation.findUnique({
    where: { operationId: input.operationId },
  })

  if (existing) {
    if (existing.payloadHash !== payloadHash) {
      // Même operationId mais payload divergent — c'est une attaque ou un bug client
      throw new SyncIdempotencyError(
        'DIVERGENT_PAYLOAD',
        `L'opération ${input.operationId} a déjà été reçue avec un payload différent. ` +
          `Empreinte attendue: ${existing.payloadHash}, reçue: ${payloadHash}.`
      )
    }
    // Replay identique : renvoyer le résultat précédent
    return {
      id: existing.id,
      operationId: existing.operationId,
      status: existing.status as OperationStatus,
      payloadHash: existing.payloadHash,
      isReplay: true,
      previousResult: existing.resultJson
        ? JSON.parse(existing.resultJson)
        : undefined,
    }
  }

  // Nouvelle opération : l'enregistrer
  const op = await db.syncOperation.create({
    data: {
      operationId: input.operationId,
      deviceId: input.deviceId,
      userId: input.userId,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      operationType: input.operationType,
      payloadHash,
      payloadJson,
      baseVersion: input.baseVersion,
      status: 'PENDING',
    },
  })

  return {
    id: op.id,
    operationId: op.operationId,
    status: 'PENDING',
    payloadHash,
    isReplay: false,
  }
}

/**
 * Marque une opération comme acceptée et enregistre son résultat
 * pour le renvoyer en cas de replay.
 */
export async function acknowledgeOperation(
  operationId: string,
  result: unknown,
  serverSequence?: number
): Promise<void> {
  await db.syncOperation.update({
    where: { operationId },
    data: {
      status: 'ACCEPTED',
      processedAtUtc: new Date(),
      resultJson: JSON.stringify(result),
    },
  })
}

/**
 * Marque une opération comme rejetée avec un code d'erreur.
 */
export async function rejectOperation(
  operationId: string,
  errorCode: string,
  errorMessage: string
): Promise<void> {
  await db.syncOperation.update({
    where: { operationId },
    data: {
      status: 'REJECTED',
      processedAtUtc: new Date(),
      errorCode,
      errorMessage,
    },
  })
}

/**
 * Crée un conflit pour une opération donnée.
 * Conformément au §14.2.15.K, un conflit ne doit jamais être résolu
 * silencieusement par Last-Write-Wins pour les données sensibles.
 */
export async function createConflict(input: {
  operationId?: string
  deviceId?: string
  aggregateType: AggregateType | string
  aggregateId?: string
  localPayload: unknown
  serverPayload?: unknown
  baseVersion?: number
  serverVersion?: number
  conflictType: ConflictType | string
  assignedToId?: string
}): Promise<string> {
  const conflictId = generateConflictId()
  await db.syncConflict.create({
    data: {
      conflictId,
      operationId: input.operationId,
      deviceId: input.deviceId,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      localPayloadJson: JSON.stringify(input.localPayload),
      serverPayloadJson: input.serverPayload
        ? JSON.stringify(input.serverPayload)
        : null,
      baseVersion: input.baseVersion,
      serverVersion: input.serverVersion,
      conflictType: input.conflictType,
      assignedToId: input.assignedToId,
      status: 'OPEN',
    },
  })

  if (input.operationId) {
    await db.syncOperation.update({
      where: { operationId: input.operationId },
      data: { status: 'CONFLICT', conflictId },
    })
  }

  return conflictId
}

// ============================================================
// Inbox : changements reçus du serveur à appliquer localement
// ============================================================

export interface PublishChangeInput {
  changeId: string
  serverSequence: number
  aggregateType: AggregateType | string
  aggregateId?: string
  changeType: InboxChangeType
  payload: unknown
  deviceId?: string
}

/**
 * Publie un changement dans l'Inbox d'un device.
 * Idempotent sur `changeId` (un changement reçu deux fois est ignoré).
 */
export async function publishChange(
  input: PublishChangeInput
): Promise<{ applied: boolean; existing: boolean }> {
  const existing = await db.syncInbox.findUnique({
    where: { changeId: input.changeId },
  })
  if (existing) {
    return { applied: false, existing: true }
  }

  await db.syncInbox.create({
    data: {
      changeId: input.changeId,
      deviceId: input.deviceId,
      serverSequence: input.serverSequence,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      changeType: input.changeType,
      payloadJson: JSON.stringify(input.payload),
      status: 'PENDING',
    },
  })
  return { applied: true, existing: false }
}

// ============================================================
// Erreurs typées
// ============================================================

export class SyncIdempotencyError extends Error {
  constructor(
    public readonly code:
      | 'DIVERGENT_PAYLOAD'
      | 'UNKNOWN_OPERATION'
      | 'STALE_VERSION'
      | 'PERMISSION_REVOKED',
    message: string
  ) {
    super(message)
    this.name = 'SyncIdempotencyError'
  }
}

// ============================================================
// Helpers de validation
// ============================================================

/**
 * Valide qu'une chaîne a le format d'un UUID v4.
 * Utilisé pour valider les `operationId` et `Idempotency-Key`.
 */
export function isValidUuid(value: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(value)
}

/**
 * Valide qu'un payload est sérialisable en JSON canonique
 * (pas de fonction, pas de cycles, pas de undefined au premier niveau).
 *
 * Note : `JSON.stringify(undefined)` retourne `undefined` (pas une erreur),
 * il faut donc le traiter explicitement.
 */
export function isJsonSerializable(value: unknown): boolean {
  if (value === undefined) return false
  if (typeof value === 'function') return false
  if (typeof value === 'symbol') return false
  try {
    const result = JSON.stringify(value)
    return result !== undefined
  } catch {
    return false
  }
}

/**
 * Constante : durée de rétention d'une clé d'idempotence (24h).
 */
export const IDEMPOTENCY_TTL_HOURS = 24
