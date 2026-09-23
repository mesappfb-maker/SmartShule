// SmartShule — Tests unitaires : Module IQA
// Étape 4 RDC — Portail Prof
//
// Valide la formule IQA :
//   IQA = MAX(0, 100 - ((100 * A_non_exc + 50 * A_exc + 15 * R) / Total))
// + seuils : EXCELLENT ≥ 90, WARNING 75-89, CRITICAL < 75

import { describe, it, expect } from 'bun:test'
import { computeIqa, getIqaLevel, getIqaColor, formatIqaTooltip } from '@/lib/iqa-pure'

describe('IQA - Indicateur Qualité d\'Assiduité', () => {
  describe('computeIqa - formule mathématique', () => {
    it('IQA = 100 quand aucune absence, aucun retard', () => {
      const result = computeIqa({
        totalSessions: 20,
        absencesUnexcused: 0,
        absencesExcused: 0,
        lateCount: 0,
      })
      expect(result.iqa).toBe(100)
      expect(result.level).toBe('EXCELLENT')
    })

    it('IQA = 100 par défaut quand 0 séance', () => {
      const result = computeIqa({
        totalSessions: 0,
        absencesUnexcused: 0,
        absencesExcused: 0,
        lateCount: 0,
      })
      expect(result.iqa).toBe(100)
      expect(result.level).toBe('EXCELLENT')
    })

    it('pénalise une absence non excusée (poids 100)', () => {
      // 20 séances, 1 absence non excusée
      // IQA = MAX(0, 100 - (100*1)/20) = 100 - 5 = 95
      const result = computeIqa({
        totalSessions: 20,
        absencesUnexcused: 1,
        absencesExcused: 0,
        lateCount: 0,
      })
      expect(result.iqa).toBe(95)
      expect(result.level).toBe('EXCELLENT')
    })

    it('pénalise une absence excusée (poids 50)', () => {
      // 20 séances, 1 absence excusée
      // IQA = 100 - (50*1)/20 = 100 - 2.5 = 97.5
      const result = computeIqa({
        totalSessions: 20,
        absencesUnexcused: 0,
        absencesExcused: 1,
        lateCount: 0,
      })
      expect(result.iqa).toBe(97.5)
      expect(result.level).toBe('EXCELLENT')
    })

    it('pénalise un retard (poids 15)', () => {
      // 20 séances, 1 retard
      // IQA = 100 - (15*1)/20 = 100 - 0.75 = 99.25
      const result = computeIqa({
        totalSessions: 20,
        absencesUnexcused: 0,
        absencesExcused: 0,
        lateCount: 1,
      })
      expect(result.iqa).toBe(99.25)
      expect(result.level).toBe('EXCELLENT')
    })

    it('combine les trois pénalités', () => {
      // 20 séances, 3 absences non excusées, 2 excusées, 4 retards
      // IQA = 100 - (100*3 + 50*2 + 15*4) / 20
      //     = 100 - (300 + 100 + 60) / 20
      //     = 100 - 460/20 = 100 - 23 = 77
      const result = computeIqa({
        totalSessions: 20,
        absencesUnexcused: 3,
        absencesExcused: 2,
        lateCount: 4,
      })
      expect(result.iqa).toBe(77)
      expect(result.level).toBe('WARNING')
    })

    it('plafonne à 0 si pénalités > 100', () => {
      // 10 séances, 10 absences non excusées
      // IQA = MAX(0, 100 - (100*10)/10) = MAX(0, 0) = 0
      const result = computeIqa({
        totalSessions: 10,
        absencesUnexcused: 10,
        absencesExcused: 0,
        lateCount: 0,
      })
      expect(result.iqa).toBe(0)
      expect(result.level).toBe('CRITICAL')
    })

    it('retourne la formule détaillée', () => {
      const result = computeIqa({
        totalSessions: 10,
        absencesUnexcused: 2,
        absencesExcused: 1,
        lateCount: 3,
      })
      expect(result.formula).toContain('100')
      expect(result.formula).toContain('2')  // A_non_exc
      expect(result.formula).toContain('1')  // A_exc
      expect(result.formula).toContain('3')  // R
      expect(result.formula).toContain('10') // Total
    })
  })

  describe('getIqaLevel - seuils', () => {
    it('EXCELLENT quand IQA >= 90', () => {
      expect(getIqaLevel(100)).toBe('EXCELLENT')
      expect(getIqaLevel(95)).toBe('EXCELLENT')
      expect(getIqaLevel(90)).toBe('EXCELLENT')
    })

    it('WARNING quand 75 <= IQA < 90', () => {
      expect(getIqaLevel(89.99)).toBe('WARNING')
      expect(getIqaLevel(85)).toBe('WARNING')
      expect(getIqaLevel(75)).toBe('WARNING')
    })

    it('CRITICAL quand IQA < 75', () => {
      expect(getIqaLevel(74.99)).toBe('CRITICAL')
      expect(getIqaLevel(50)).toBe('CRITICAL')
      expect(getIqaLevel(0)).toBe('CRITICAL')
    })
  })

  describe('getIqaColor - palette SmartShule', () => {
    it('couleurs EXCELLENT (vert)', () => {
      const c = getIqaColor('EXCELLENT')
      expect(c.bg).toContain('emerald')
      expect(c.dot).toContain('emerald')
      expect(c.emoji).toBe('🟢')
      expect(c.label).toBe('Excellent')
    })

    it('couleurs WARNING (orange)', () => {
      const c = getIqaColor('WARNING')
      expect(c.bg).toContain('amber')
      expect(c.dot).toContain('amber')
      expect(c.emoji).toBe('🟡')
      expect(c.label).toBe('À surveiller')
    })

    it('couleurs CRITICAL (rouge)', () => {
      const c = getIqaColor('CRITICAL')
      expect(c.bg).toContain('red')
      expect(c.dot).toContain('red')
      expect(c.emoji).toBe('🔴')
      expect(c.label).toBe('Critique')
    })
  })

  describe('formatIqaTooltip', () => {
    it('formate correctement le tooltip [X Abs | Y Ret | Z Exc]', () => {
      const tooltip = formatIqaTooltip({
        iqa: 85.5,
        level: 'WARNING',
        totalSessions: 20,
        absencesUnexcused: 2,
        absencesExcused: 1,
        lateCount: 3,
        formula: '',
      })
      expect(tooltip).toBe('[2 Abs | 3 Ret | 1 Exc] · IQA 85.5%')
    })

    it('gère les valeurs nulles (aucune absence)', () => {
      const tooltip = formatIqaTooltip({
        iqa: 100,
        level: 'EXCELLENT',
        totalSessions: 10,
        absencesUnexcused: 0,
        absencesExcused: 0,
        lateCount: 0,
        formula: '',
      })
      expect(tooltip).toBe('[0 Abs | 0 Ret | 0 Exc] · IQA 100.0%')
    })
  })

  describe('Cas limites et invariants anti-régression', () => {
    it('IQA toujours entre 0 et 100', () => {
      // Test aléatoire pour vérifier l'invariant
      for (let i = 0; i < 50; i++) {
        const total = Math.floor(Math.random() * 30) + 1
        const an = Math.floor(Math.random() * (total + 1))
        const ae = Math.floor(Math.random() * (total - an + 1))
        const r = Math.floor(Math.random() * (total + 1))
        const result = computeIqa({
          totalSessions: total,
          absencesUnexcused: an,
          absencesExcused: ae,
          lateCount: r,
        })
        expect(result.iqa).toBeGreaterThanOrEqual(0)
        expect(result.iqa).toBeLessThanOrEqual(100)
      }
    })

    it('poids relatifs respectés : 100 > 50 > 15', () => {
      // Une absence non excusée pénalise plus qu'une excusée, qui pénalise plus qu'un retard
      const base = { totalSessions: 20, absencesUnexcused: 0, absencesExcused: 0, lateCount: 0 }
      const iqaAbsent = computeIqa({ ...base, absencesUnexcused: 1 }).iqa
      const iqaExcused = computeIqa({ ...base, absencesExcused: 1 }).iqa
      const iqaLate = computeIqa({ ...base, lateCount: 1 }).iqa
      expect(iqaAbsent).toBeLessThan(iqaExcused)
      expect(iqaExcused).toBeLessThan(iqaLate)
    })

    it('idempotence : même input → même output', () => {
      const input = {
        totalSessions: 15,
        absencesUnexcused: 2,
        absencesExcused: 1,
        lateCount: 2,
      }
      const r1 = computeIqa(input)
      const r2 = computeIqa(input)
      expect(r1).toEqual(r2)
    })
  })
})
