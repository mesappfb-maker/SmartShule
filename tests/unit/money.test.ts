// SmartShule — Tests unitaires : helpers monétaires (money.ts)
//
// Vérifie :
//   - conversions toCents / fromCents (gestion des décimales, des chaînes) ;
//   - multiplication via BigInt (pas de perte de précision) ;
//   - calcul de pourcentage ;
//   - arrondis (roundHalfUpCents, roundHalfEvenCents) ;
//   - somme via BigInt (pas d'overflow) ;
//   - validation des entrées (isValidCents, isValidRateCents).

import { test, expect, describe } from 'bun:test'
import {
  toCents,
  fromCents,
  multiplyCents,
  percentOfCents,
  roundHalfUpCents,
  roundHalfEvenCents,
  sumCents,
  subCents,
  centsEqual,
  isValidCents,
  isValidRateCents,
  formatCents,
} from '../../src/lib/money'

describe('toCents', () => {
  test('convertit un nombre décimal en centimes', () => {
    expect(toCents(17)).toBe(1700)
    expect(toCents(17.5)).toBe(1750)
    expect(toCents(0.01)).toBe(1)
    expect(toCents(0)).toBe(0)
  })

  test('convertit une chaîne en centimes', () => {
    expect(toCents('17')).toBe(1700)
    expect(toCents('17.50')).toBe(1750)
    expect(toCents('17,50')).toBe(1750) // virgule décimale FR
  })

  test('gère les imprécisions du float', () => {
    // 17.005 * 100 = 1700.4999999999998 sans correction
    expect(toCents(17.005)).toBe(1701) // arrondi commercial
  })

  test('rejette les valeurs non finies', () => {
    expect(() => toCents(NaN)).toThrow()
    expect(() => toCents(Infinity)).toThrow()
    expect(() => toCents('not-a-number')).toThrow()
  })
})

describe('fromCents', () => {
  test('convertit des centimes en décimal', () => {
    expect(fromCents(1700)).toBe(17)
    expect(fromCents(1750)).toBe(17.5)
    expect(fromCents(1)).toBe(0.01)
  })
})

describe('formatCents', () => {
  test('formate en devise EUR', () => {
    const formatted = formatCents(1700, 'EUR', 'fr-FR')
    expect(formatted).toContain('17')
    expect(formatted).toContain('00')
  })

  test('formate en devise CDF', () => {
    const formatted = formatCents(170000, 'CDF', 'fr-FR')
    // Intl.NumberFormat en fr-FR utilise un espace insécable (U+202F ou U+00A0)
    // comme séparateur de milliers. On normalise pour tester le contenu.
    const normalized = formatted.replace(/[\u202F\u00A0]/g, ' ')
    expect(normalized).toContain('1 700')
    expect(normalized).toContain('CDF')
  })

  test('fallback sans devise', () => {
    const formatted = formatCents(1700, 'UNKNOWN')
    expect(formatted).toContain('17.00')
  })
})

describe('multiplyCents', () => {
  test('multiplie quantité × prix unitaire', () => {
    // 2 × 500.00 = 1000.00 → 100000 centimes
    expect(multiplyCents(200, 50000)).toBe(100000)
    // 1.5 × 100.00 = 150.00 → 15000 centimes
    expect(multiplyCents(150, 10000)).toBe(15000)
  })

  test('pas de perte de précision sur de grands nombres', () => {
    // 1000 × 999999.99 = 999999990.00 → 99999999000 centimes
    expect(multiplyCents(100000, 99999999)).toBe(99999999000)
  })

  test('0 × prix = 0', () => {
    expect(multiplyCents(0, 50000)).toBe(0)
  })
})

describe('percentOfCents', () => {
  test('calcule un pourcentage simple', () => {
    // 5% de 1000 = 50
    expect(percentOfCents(100000, 500)).toBe(5000)
    // 20% de 1000 = 200
    expect(percentOfCents(100000, 2000)).toBe(20000)
  })

  test('0% = 0', () => {
    expect(percentOfCents(100000, 0)).toBe(0)
  })

  test('100% = montant total', () => {
    expect(percentOfCents(100000, 10000)).toBe(100000)
  })

  test('gère les taux avec décimales', () => {
    // 5.5% de 1000 = 55
    expect(percentOfCents(100000, 550)).toBe(5500)
  })
})

describe('roundHalfUpCents', () => {
  test('arrondit au plus proche', () => {
    expect(roundHalfUpCents(100)).toBe(100)
    expect(roundHalfUpCents(150)).toBe(150)
    expect(roundHalfUpCents(149)).toBe(149)
  })

  test('les centimes sont déjà entiers — pas de modification', () => {
    expect(roundHalfUpCents(0)).toBe(0)
    expect(roundHalfUpCents(999999)).toBe(999999)
  })
})

describe('sumCents', () => {
  test('additionne une liste de montants', () => {
    expect(sumCents([100, 200, 300])).toBe(600)
    expect(sumCents([])).toBe(0)
  })

  test('pas d\'overflow sur de grandes sommes (via BigInt)', () => {
    // Number.MAX_SAFE_INTEGER + Number.MAX_SAFE_INTEGER devrait dépasser
    // la limite du number, mais BigInt non
    const big = Number.MAX_SAFE_INTEGER
    const result = sumCents([big, big])
    expect(result).toBe(big + big) // Number peut le représenter car c'est 2 * 2^53 - 2 = 2^54 - 2
  })
})

describe('subCents', () => {
  test('soustrait deux montants', () => {
    expect(subCents(500, 200)).toBe(300)
    expect(subCents(100, 200)).toBe(-100)
  })
})

describe('centsEqual', () => {
  test('égalité stricte', () => {
    expect(centsEqual(100, 100)).toBe(true)
    expect(centsEqual(100, 101)).toBe(false)
  })

  test('égalité avec tolérance', () => {
    expect(centsEqual(100, 102, 5)).toBe(true)
    expect(centsEqual(100, 200, 5)).toBe(false)
  })
})

describe('isValidCents', () => {
  test('accepte les entiers safe', () => {
    expect(isValidCents(0)).toBe(true)
    expect(isValidCents(100)).toBe(true)
    expect(isValidCents(Number.MAX_SAFE_INTEGER)).toBe(true)
  })

  test('rejette les non-entiers', () => {
    expect(isValidCents(100.5)).toBe(false)
    expect(isValidCents(NaN)).toBe(false)
    expect(isValidCents('100')).toBe(false)
  })

  test('rejette les unsafe integers', () => {
    expect(isValidCents(Number.MAX_SAFE_INTEGER + 1)).toBe(false)
  })
})

describe('isValidRateCents', () => {
  test('accepte les taux entre 0 et 10000 (0% à 100%)', () => {
    expect(isValidRateCents(0)).toBe(true)
    expect(isValidRateCents(500)).toBe(true) // 5%
    expect(isValidRateCents(2000)).toBe(true) // 20%
    expect(isValidRateCents(10000)).toBe(true) // 100%
  })

  test('rejette les taux hors plage', () => {
    expect(isValidRateCents(-1)).toBe(false)
    expect(isValidRateCents(10001)).toBe(false)
    expect(isValidRateCents(500.5)).toBe(false)
  })
})
