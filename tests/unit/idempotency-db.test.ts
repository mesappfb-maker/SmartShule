// SmartShule — Tests d'intégration : idempotence via DB
//
// Ces tests utilisent la vraie base SQLite (en lecture seule / via transactions
// nettoyées). Ils valident que :
//   - checkIdempotencyKey retourne exists=false pour une clé nouvelle ;
//   - recordIdempotencyResult crée l'entrée et permet un replay ;
//   - checkIdempotencyKey détecte un payload divergent sous la même clé ;
//   - purgeExpiredIdempotencyRecords supprime les entrées expirées.
//
// Note : ces tests nécessitent que la DB soit poussée (bun run db:push).
// Ils créent un utilisateur factice puis le suppriment à la fin.

import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { db } from '../../src/lib/db'
import {
  checkIdempotencyKey,
  recordIdempotencyResult,
  purgeExpiredIdempotencyRecords,
} from '../../src/lib/idempotency'

const TEST_USER_EMAIL = `test-idempotency-${Date.now()}@smartshule.test`

describe('IdempotencyRecord (DB)', () => {
  let userId: string

  beforeAll(async () => {
    // Créer un utilisateur de test
    const user = await db.user.create({
      data: {
        email: TEST_USER_EMAIL,
        passwordHash: 'pbkdf2$100000$sha512$salt$hash',
        role: 'PARENT',
        displayName: 'Test Idempotency',
        active: true,
      },
    })
    userId = user.id
  })

  afterAll(async () => {
    // Nettoyer
    await db.idempotencyRecord.deleteMany({ where: { userId } })
    await db.user.delete({ where: { id: userId } })
  })

  test('checkIdempotencyKey retourne exists=false pour une clé nouvelle', async () => {
    const result = await checkIdempotencyKey(
      userId,
      '550e8400-e29b-41d4-a716-446655440000',
      { action: 'create', data: { foo: 'bar' } }
    )
    expect(result.exists).toBe(false)
    expect(result.payloadMatches).toBe(false)
    expect(result.payloadHash.length).toBe(64)
  })

  test('recordIdempotencyResult crée une entrée persistante', async () => {
    const key = '660e8400-e29b-41d4-a716-446655440001'
    const payload = { action: 'create', data: { foo: 'bar' } }
    const result = await checkIdempotencyKey(userId, key, payload)

    await recordIdempotencyResult(
      userId,
      key,
      result.payloadHash,
      { ok: true, id: 'recorded-1' },
      201
    )

    // Vérifier le replay
    const replay = await checkIdempotencyKey(userId, key, payload)
    expect(replay.exists).toBe(true)
    expect(replay.payloadMatches).toBe(true)
    expect(replay.cachedResult).toEqual({ ok: true, id: 'recorded-1' })
    expect(replay.cachedStatus).toBe(201)
  })

  test('checkIdempotencyKey détecte un payload divergent', async () => {
    const key = '770e8400-e29b-41d4-a716-446655440002'
    const originalPayload = { action: 'create', data: { value: 1 } }
    const divergentPayload = { action: 'create', data: { value: 2 } }

    const result1 = await checkIdempotencyKey(userId, key, originalPayload)
    await recordIdempotencyResult(
      userId,
      key,
      result1.payloadHash,
      { ok: true },
      201
    )

    const result2 = await checkIdempotencyKey(userId, key, divergentPayload)
    expect(result2.exists).toBe(true)
    expect(result2.payloadMatches).toBe(false)
    // Le hash du nouveau payload doit être différent
    expect(result2.payloadHash).not.toBe(result1.payloadHash)
  })

  test('purgeExpiredIdempotencyRecords supprime les entrées expirées', async () => {
    // Créer une entrée expirée
    const key = '880e8400-e29b-41d4-a716-446655440003'
    const payload = { action: 'create' }
    const result = await checkIdempotencyKey(userId, key, payload)

    // Insérer directement avec expiresAtUtc dans le passé
    await db.idempotencyRecord.upsert({
      where: { userId_key: { userId, key } },
      create: {
        userId,
        key,
        payloadHash: result.payloadHash,
        expiresAtUtc: new Date(Date.now() - 1000),
      },
      update: {
        expiresAtUtc: new Date(Date.now() - 1000),
      },
    })

    const purged = await purgeExpiredIdempotencyRecords()
    expect(purged).toBeGreaterThanOrEqual(1)

    // L'entrée doit être absente
    const after = await db.idempotencyRecord.findUnique({
      where: { userId_key: { userId, key } },
    })
    expect(after).toBeNull()
  })

  test('rejette une clé qui n\'est pas un UUID valide', async () => {
    await expect(checkIdempotencyKey(userId, 'not-a-uuid', {})).rejects.toThrow(
      /UUID/
    )
  })
})
