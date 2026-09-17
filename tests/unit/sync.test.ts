// SmartShule — Tests unitaires : sync helpers (empreinte, idempotence, UUID)
//
// Vérifie :
//   - computePayloadHash produit une empreinte SHA-256 hexadécimale stable ;
//   - deux payloads équivalents produisent la même empreinte (clés ordre indifférent) ;
//   - deux payloads différents produisent des empreintes différentes ;
//   - canonicalJsonStringify trie les clés récursivement ;
//   - generateOperationId / generateChangeId / generateConflictId produisent des UUID v4 valides ;
//   - isValidUuid reconnaît les UUID v4 valides et rejette les invalides ;
//   - isJsonSerializable détecte les valeurs non sérialisables.

import { test, expect, describe } from 'bun:test'
import {
  computePayloadHash,
  canonicalJsonStringify,
  generateOperationId,
  generateChangeId,
  generateConflictId,
  isValidUuid,
  isJsonSerializable,
} from '../../src/lib/sync'

describe('computePayloadHash', () => {
  test('produit une chaîne hexadécimale de 64 caractères (SHA-256)', () => {
    const hash = computePayloadHash({ foo: 'bar' })
    expect(typeof hash).toBe('string')
    expect(hash.length).toBe(64)
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true)
  })

  test('est déterministe : même payload → même hash', () => {
    const p = { a: 1, b: 'hello', c: [1, 2, 3] }
    expect(computePayloadHash(p)).toBe(computePayloadHash(p))
  })

  test('deux payloads avec clés dans ordre différent → même hash', () => {
    const p1 = { a: 1, b: 2, c: 3 }
    const p2 = { c: 3, b: 2, a: 1 }
    expect(computePayloadHash(p1)).toBe(computePayloadHash(p2))
  })

  test('deux payloads différents → hash différents', () => {
    const p1 = { a: 1 }
    const p2 = { a: 2 }
    expect(computePayloadHash(p1)).not.toBe(computePayloadHash(p2))
  })

  test('payloads imbriqués : clés triées récursivement', () => {
    const p1 = { outer: { z: 1, a: 2 }, list: [1, 2] }
    const p2 = { outer: { a: 2, z: 1 }, list: [1, 2] }
    expect(computePayloadHash(p1)).toBe(computePayloadHash(p2))
  })

  test('null et undefined donnent "null"', () => {
    expect(computePayloadHash(null)).toBe(computePayloadHash(undefined))
  })

  test('undefined dans un objet est ignoré', () => {
    const p1 = { a: 1, b: undefined }
    const p2 = { a: 1 }
    expect(computePayloadHash(p1)).toBe(computePayloadHash(p2))
  })
})

describe('canonicalJsonStringify', () => {
  test('trie les clés au premier niveau', () => {
    const result = canonicalJsonStringify({ b: 2, a: 1 })
    expect(result).toBe('{"a":1,"b":2}')
  })

  test('trie récursivement les objets imbriqués', () => {
    const result = canonicalJsonStringify({ outer: { z: 1, a: 2 } })
    expect(result).toBe('{"outer":{"a":2,"z":1}}')
  })

  test('préserve l\'ordre des tableaux', () => {
    expect(canonicalJsonStringify([3, 1, 2])).toBe('[3,1,2]')
  })

  test('null → "null"', () => {
    expect(canonicalJsonStringify(null)).toBe('null')
  })

  test('types primitifs', () => {
    expect(canonicalJsonStringify(42)).toBe('42')
    expect(canonicalJsonStringify('hello')).toBe('"hello"')
    expect(canonicalJsonStringify(true)).toBe('true')
  })
})

describe('generateOperationId / generateChangeId / generateConflictId', () => {
  test('produisent des UUID v4 valides', () => {
    expect(isValidUuid(generateOperationId())).toBe(true)
    expect(isValidUuid(generateChangeId())).toBe(true)
    expect(isValidUuid(generateConflictId())).toBe(true)
  })

  test('sont aléatoires (deux appels différents)', () => {
    expect(generateOperationId()).not.toBe(generateOperationId())
    expect(generateChangeId()).not.toBe(generateChangeId())
    expect(generateConflictId()).not.toBe(generateConflictId())
  })
})

describe('isValidUuid', () => {
  test('accepte un UUID v4 valide', () => {
    expect(isValidUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
    expect(isValidUuid('12345678-1234-4123-8123-123456789012')).toBe(true)
  })

  test('rejette un UUID v1 (mauvaise version)', () => {
    expect(isValidUuid('550e8400-e29b-11d4-a716-446655440000')).toBe(false)
  })

  test('rejette un UUID v5 (mauvaise version)', () => {
    expect(isValidUuid('550e8400-e29b-51d4-a716-446655440000')).toBe(false)
  })

  test('rejette une chaîne vide ou trop courte', () => {
    expect(isValidUuid('')).toBe(false)
    expect(isValidUuid('not-a-uuid')).toBe(false)
    expect(isValidUuid('550e8400-e29b-41d4-a716')).toBe(false)
  })

  test('rejette un UUID avec caractères invalides', () => {
    expect(isValidUuid('550e8400-e29b-41d4-a716-44665544000g')).toBe(false)
  })
})

describe('isJsonSerializable', () => {
  test('accepte les objets simples, tableaux, primitives', () => {
    expect(isJsonSerializable({ a: 1 })).toBe(true)
    expect(isJsonSerializable([1, 2, 3])).toBe(true)
    expect(isJsonSerializable('hello')).toBe(true)
    expect(isJsonSerializable(42)).toBe(true)
    expect(isJsonSerializable(null)).toBe(true)
  })

  test('rejette les fonctions, undefined, symboles', () => {
    expect(isJsonSerializable(undefined)).toBe(false)
    expect(isJsonSerializable(() => 'x')).toBe(false)
    expect(isJsonSerializable(Symbol('s'))).toBe(false)
  })

  test('rejette les objets avec cycles', () => {
    const cyclic: any = { a: 1 }
    cyclic.self = cyclic
    expect(isJsonSerializable(cyclic)).toBe(false)
  })
})
