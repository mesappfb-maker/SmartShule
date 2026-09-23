// SmartShule — Tests unitaires : auth (hashing password)
//
// Vérifie :
//   - que hashPassword produit une chaîne au format attendu (pbkdf2$iterations$digest$salt$hash) ;
//   - que verifyPassword retourne true pour le bon mot de passe ;
//   - que verifyPassword retourne false pour un mauvais mot de passe ;
//   - que deux hashings du même mot de passe produisent des sels différents ;
//   - que verifyPassword ne lève pas d'exception sur un hash corrompu.

import { test, expect, describe } from 'bun:test'
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
} from '../../src/lib/auth'

describe('hashPassword', () => {
  test('produit une chaîne au format pbkdf2$iter$digest$salt$hash', async () => {
    const hash = await hashPassword('SmartShule2026!')
    expect(typeof hash).toBe('string')
    const parts = hash.split('$')
    expect(parts).toHaveLength(5)
    expect(parts[0]).toBe('pbkdf2')
    expect(parts[1]).toBe('100000')
    expect(parts[2]).toBe('sha512')
    expect(parts[3].length).toBeGreaterThan(0) // sel hex
    expect(parts[4].length).toBeGreaterThan(0) // hash hex
  })

  test('deux hashings du même mot de passe produisent des sels différents', async () => {
    const h1 = await hashPassword('SmartShule2026!')
    const h2 = await hashPassword('SmartShule2026!')
    expect(h1).not.toBe(h2)
    const salt1 = h1.split('$')[3]
    const salt2 = h2.split('$')[3]
    expect(salt1).not.toBe(salt2)
  })
})

describe('verifyPassword', () => {
  test('retourne true pour le bon mot de passe', async () => {
    const hash = await hashPassword('SmartShule2026!')
    const ok = await verifyPassword('SmartShule2026!', hash)
    expect(ok).toBe(true)
  })

  test('retourne false pour un mauvais mot de passe', async () => {
    const hash = await hashPassword('SmartShule2026!')
    const ok = await verifyPassword('wrong-password', hash)
    expect(ok).toBe(false)
  })

  test('retourne false pour un hash corrompu (ne lève pas)', async () => {
    const ok1 = await verifyPassword('whatever', '')
    expect(ok1).toBe(false)

    const ok2 = await verifyPassword('whatever', 'not-a-valid-hash')
    expect(ok2).toBe(false)

    const ok3 = await verifyPassword('whatever', 'pbkdf2$not-a-number$sha512$abc$def')
    expect(ok3).toBe(false)
  })

  test('retourne false pour un hash avec algorithme inconnu', async () => {
    const ok = await verifyPassword('whatever', 'bcrypt$10000$sha256$salt$hash')
    expect(ok).toBe(false)
  })
})

describe('generateSessionToken', () => {
  test('produit une chaîne suffisamment longue et URL-safe', () => {
    const token = generateSessionToken()
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThanOrEqual(64)
    expect(/^[A-Za-z0-9_-]+$/.test(token)).toBe(true)
  })

  test('deux appels produisent des tokens différents (aléatoires)', () => {
    const t1 = generateSessionToken()
    const t2 = generateSessionToken()
    expect(t1).not.toBe(t2)
  })
})
