// SmartShule — Idempotence des commandes
// Implémente le mécanisme décrit au §14.2.6 du cahier des charges.
//
// Une commande reçue deux fois avec la même Idempotency-Key doit :
//   - si le payload est identique : renvoyer le même résultat sans rejouer l'effet ;
//   - si le payload est différent : être rejetée (409 Conflict).
//
// La clé est liée à l'utilisateur ; un même key utilisée par deux utilisateurs
// est considérée comme deux entrées distinctes.

import { db } from '@/lib/db'
import { computePayloadHash, IDEMPOTENCY_TTL_HOURS, isValidUuid } from '@/lib/sync'

export interface IdempotencyCheckResult {
  /** Une entrée pré-existante existe. */
  exists: boolean
  /** Le payload hash correspond à l'entrée existante. */
  payloadMatches: boolean
  /** Le résultat mis en cache (si exists && payloadMatches). */
  cachedResult?: unknown
  /** Le code HTTP mis en cache. */
  cachedStatus?: number
  /** L'empreinte du payload fournie. */
  payloadHash: string
  /** Date d'expiration de l'entrée. */
  expiresAt: Date
}

/**
 * Vérifie une clé d'idempotence pour un utilisateur et un payload donnés.
 * Ne crée PAS l'entrée — c'est à l'appelant de le faire via `recordIdempotencyResult`.
 *
 * @param userId Utilisateur effectuant la commande
 * @param key Clé d'idempotence (UUID)
 * @param payload Payload de la commande (sera hashé)
 * @returns Le résultat de la vérification
 */
export async function checkIdempotencyKey(
  userId: string,
  key: string,
  payload: unknown
): Promise<IdempotencyCheckResult> {
  if (!isValidUuid(key)) {
    throw new Error('La clé d\'idempotence doit être un UUID valide.')
  }

  const payloadHash = computePayloadHash(payload)
  const expiresAt = new Date(
    Date.now() + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000
  )

  const existing = await db.idempotencyRecord.findUnique({
    where: { userId_key: { userId, key } },
  })

  if (!existing) {
    return { exists: false, payloadMatches: false, payloadHash, expiresAt }
  }

  // Si l'entrée existante a expiré, on la supprime et on considère qu'elle n'existe pas
  if (existing.expiresAtUtc < new Date()) {
    await db.idempotencyRecord.delete({ where: { id: existing.id } })
    return { exists: false, payloadMatches: false, payloadHash, expiresAt }
  }

  const payloadMatches = existing.payloadHash === payloadHash
  return {
    exists: true,
    payloadMatches,
    payloadHash,
    cachedResult: existing.resultJson ? JSON.parse(existing.resultJson) : undefined,
    cachedStatus: existing.resultStatus ?? undefined,
    expiresAt: existing.expiresAtUtc,
  }
}

/**
 * Enregistre le résultat d'une commande idempotente.
 * À appeler après une exécution réussie (ou après un échec de validation),
 * pour que les replays reçoivent la même réponse.
 *
 * @param userId Utilisateur effectuant la commande
 * @param key Clé d'idempotence (UUID)
 * @param payloadHash Empreinte du payload (préalablement calculée)
 * @param result Résultat à mettre en cache
 * @param status Code HTTP à renvoyer en cas de replay
 */
export async function recordIdempotencyResult(
  userId: string,
  key: string,
  payloadHash: string,
  result: unknown,
  status: number
): Promise<void> {
  const expiresAt = new Date(
    Date.now() + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000
  )

  // Upsert : si l'entrée existe déjà (cas rare de concurrence), on met à jour
  await db.idempotencyRecord.upsert({
    where: { userId_key: { userId, key } },
    create: {
      userId,
      key,
      payloadHash,
      resultJson: JSON.stringify(result),
      resultStatus: status,
      expiresAtUtc: expiresAt,
    },
    update: {
      payloadHash,
      resultJson: JSON.stringify(result),
      resultStatus: status,
      expiresAtUtc: expiresAt,
    },
  })
}

/**
 * Nettoie les entrées d'idempotence expirées.
 * À appeler périodiquement (job planifié, ou au démarrage).
 */
export async function purgeExpiredIdempotencyRecords(): Promise<number> {
  const result = await db.idempotencyRecord.deleteMany({
    where: { expiresAtUtc: { lt: new Date() } },
  })
  return result.count
}
