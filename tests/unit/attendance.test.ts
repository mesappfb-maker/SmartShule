// SmartShule — Tests unitaires : helpers Appel & Notes (attendance.ts)
//
// Vérifie :
//   - Les transitions valides du workflow notes (DRAFT→SUBMITTED→CONTROLLED→PUBLISHED) ;
//   - Les transitions invalides sont rejetées (ex: DRAFT→PUBLISHED directement) ;
//   - PUBLISHED est terminal (aucune transition sortante) ;
//   - Les erreurs typées AttendanceError et GradeError ont les bons codes.

import { test, expect, describe } from 'bun:test'
import {
  isValidGradeTransition,
  AttendanceError,
  GradeError,
  type GradeStatus,
} from '../../src/lib/attendance'

describe('Workflow des notes — transitions valides', () => {
  test('DRAFT → SUBMITTED est valide', () => {
    expect(isValidGradeTransition('DRAFT', 'SUBMITTED')).toBe(true)
  })

  test('SUBMITTED → CONTROLLED est valide', () => {
    expect(isValidGradeTransition('SUBMITTED', 'CONTROLLED')).toBe(true)
  })

  test('SUBMITTED → DRAFT est valide (retour en brouillon)', () => {
    expect(isValidGradeTransition('SUBMITTED', 'DRAFT')).toBe(true)
  })

  test('CONTROLLED → PUBLISHED est valide', () => {
    expect(isValidGradeTransition('CONTROLLED', 'PUBLISHED')).toBe(true)
  })

  test('CONTROLLED → SUBMITTED est valide (retour)', () => {
    expect(isValidGradeTransition('CONTROLLED', 'SUBMITTED')).toBe(true)
  })
})

describe('Workflow des notes — transitions invalides', () => {
  test('DRAFT → PUBLISHED est interdit (saut d\'étapes)', () => {
    expect(isValidGradeTransition('DRAFT', 'PUBLISHED')).toBe(false)
  })

  test('DRAFT → CONTROLLED est interdit', () => {
    expect(isValidGradeTransition('DRAFT', 'CONTROLLED')).toBe(false)
  })

  test('PUBLISHED → n\'importe quel statut est interdit (terminal)', () => {
    expect(isValidGradeTransition('PUBLISHED', 'DRAFT')).toBe(false)
    expect(isValidGradeTransition('PUBLISHED', 'SUBMITTED')).toBe(false)
    expect(isValidGradeTransition('PUBLISHED', 'CONTROLLED')).toBe(false)
    expect(isValidGradeTransition('PUBLISHED', 'PUBLISHED')).toBe(false)
  })

  test('SUBMITTED → PUBLISHED est interdit (saut d\'étape)', () => {
    expect(isValidGradeTransition('SUBMITTED', 'PUBLISHED')).toBe(false)
  })
})

describe('AttendanceError', () => {
  test('est une Error typée avec un code', () => {
    const err = new AttendanceError('SESSION_LOCKED', 'Session verrouillée')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('AttendanceError')
    expect(err.code).toBe('SESSION_LOCKED')
    expect(err.message).toBe('Session verrouillée')
  })

  test('supporte tous les codes attendus', () => {
    const codes = [
      'SESSION_NOT_FOUND', 'SESSION_LOCKED', 'STUDENT_NOT_ENROLLED',
      'DUPLICATE_ATTENDANCE', 'INVALID_STATUS', 'NOT_AUTHORIZED',
    ] as const
    for (const code of codes) {
      const err = new AttendanceError(code, `test ${code}`)
      expect(err.code).toBe(code)
    }
  })
})

describe('GradeError', () => {
  test('est une Error typée avec un code', () => {
    const err = new GradeError('ALREADY_PUBLISHED', 'Déjà publiée')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('GradeError')
    expect(err.code).toBe('ALREADY_PUBLISHED')
  })

  test('supporte tous les codes attendus', () => {
    const codes = [
      'GRADE_NOT_FOUND', 'INVALID_TRANSITION', 'ALREADY_PUBLISHED',
      'NOT_AUTHORIZED', 'INVALID_SCORE',
    ] as const
    for (const code of codes) {
      const err = new GradeError(code, `test ${code}`)
      expect(err.code).toBe(code)
    }
  })
})
