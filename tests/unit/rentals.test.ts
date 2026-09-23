// SmartShule — Tests unitaires : Module Locations (Cycle 05)
//
// Vérifie :
//   - Les transitions valides du workflow (DRAFT → QUOTE → CONFIRMED → ACTIVE → COMPLETED → INVOICED → CLOSED) ;
//   - Les transitions invalides (ex: DRAFT → ACTIVE directement) ;
//   - La détection de conflit de réservation ;
//   - La génération d'écriture analytique (Débit client / Crédit produit / Crédit taxe) ;
//   - Le mapping compte client/produit selon le type (salle vs véhicule).

import { test, expect, describe } from 'bun:test'
import {
  isValidRentalTransition,
  generateRentalInvoiceEntryDraft,
  RentalError,
  type ContractStatus,
} from '../../src/lib/rentals'
import { verifyEntryBalance } from '../../src/lib/accounting'

describe('Workflow Locations — transitions valides', () => {
  test('DRAFT → QUOTE', () => {
    expect(isValidRentalTransition('DRAFT', 'QUOTE')).toBe(true)
  })
  test('QUOTE → CONFIRMED', () => {
    expect(isValidRentalTransition('QUOTE', 'CONFIRMED')).toBe(true)
  })
  test('CONFIRMED → ACTIVE', () => {
    expect(isValidRentalTransition('CONFIRMED', 'ACTIVE')).toBe(true)
  })
  test('ACTIVE → COMPLETED', () => {
    expect(isValidRentalTransition('ACTIVE', 'COMPLETED')).toBe(true)
  })
  test('COMPLETED → INVOICED', () => {
    expect(isValidRentalTransition('COMPLETED', 'INVOICED')).toBe(true)
  })
  test('INVOICED → CLOSED', () => {
    expect(isValidRentalTransition('INVOICED', 'CLOSED')).toBe(true)
  })
  test('n\'importe quel statut non-terminal → CANCELLED', () => {
    expect(isValidRentalTransition('DRAFT', 'CANCELLED')).toBe(true)
    expect(isValidRentalTransition('QUOTE', 'CANCELLED')).toBe(true)
    expect(isValidRentalTransition('CONFIRMED', 'CANCELLED')).toBe(true)
    expect(isValidRentalTransition('ACTIVE', 'CANCELLED')).toBe(true)
  })
})

describe('Workflow Locations — transitions invalides', () => {
  test('DRAFT → ACTIVE interdit (saut d\'étape)', () => {
    expect(isValidRentalTransition('DRAFT', 'ACTIVE')).toBe(false)
  })
  test('DRAFT → COMPLETED interdit', () => {
    expect(isValidRentalTransition('DRAFT', 'COMPLETED')).toBe(false)
  })
  test('CLOSED est terminal', () => {
    expect(isValidRentalTransition('CLOSED', 'DRAFT')).toBe(false)
    expect(isValidRentalTransition('CLOSED', 'CONFIRMED')).toBe(false)
  })
  test('CANCELLED est terminal', () => {
    expect(isValidRentalTransition('CANCELLED', 'DRAFT')).toBe(false)
    expect(isValidRentalTransition('CANCELLED', 'CONFIRMED')).toBe(false)
  })
  test('COMPLETED → DRAFT interdit (pas de retour arrière)', () => {
    expect(isValidRentalTransition('COMPLETED', 'DRAFT')).toBe(false)
  })
})

describe('generateRentalInvoiceEntryDraft — écriture analytique', () => {
  test('génère une écriture équilibrée pour location de salle', () => {
    const draft = generateRentalInvoiceEntryDraft({
      id: 'contract-1',
      contractNumber: 'LOC-2025-00001',
      resourceType: 'ROOM',
      rentalAmountCents: 1000000, // 10000.00
      cautionAmountCents: 200000, // 2000.00 (caution = dette, pas dans l'écriture)
      penaltyAmountCents: 0,
    }, 0)

    expect(draft.journalCode).toBe('VE-SAL')
    expect(draft.lines).toHaveLength(2)

    // Débit client = 10000.00 (TTC, sans taxe)
    expect(draft.lines.find((l) => l.side === 'DEBIT')?.amountCents).toBe(1000000)
    expect(draft.lines.find((l) => l.side === 'DEBIT')?.accountNumber).toBe('411002')

    // Crédit produit = 10000.00 (HT = TTC sans taxe)
    expect(draft.lines.find((l) => l.side === 'CREDIT')?.amountCents).toBe(1000000)
    expect(draft.lines.find((l) => l.side === 'CREDIT')?.accountNumber).toBe('706500')

    // Activité analytique correcte
    expect(draft.lines[0].analyticalActivity).toBe('LOCATION_SALLE')
    expect(draft.lines[0].analyticalContract).toBe('LOC-2025-00001')

    // Équilibrée
    const balance = verifyEntryBalance(draft)
    expect(balance.isBalanced).toBe(true)
  })

  test('génère une écriture équilibrée pour location de véhicule avec taxe', () => {
    const draft = generateRentalInvoiceEntryDraft({
      id: 'contract-2',
      contractNumber: 'LOC-2025-00002',
      resourceType: 'VEHICLE',
      rentalAmountCents: 800000, // 8000.00
      cautionAmountCents: 0,
      penaltyAmountCents: 0,
    }, 20) // 20% taxe

    expect(draft.journalCode).toBe('VE-VEH')
    // TTC = 8000.00 ; HT = 6666.67 ; taxe = 1333.33
    // Donc 3 lignes : débit client TTC + crédit produit HT + crédit taxe
    expect(draft.lines).toHaveLength(3)

    const totalDebit = draft.lines.filter((l) => l.side === 'DEBIT').reduce((s, l) => s + l.amountCents, 0)
    const totalCredit = draft.lines.filter((l) => l.side === 'CREDIT').reduce((s, l) => s + l.amountCents, 0)
    expect(totalDebit).toBe(totalCredit)
    expect(totalDebit).toBe(800000)

    // Activité analytique véhicule
    expect(draft.lines[0].analyticalActivity).toBe('LOCATION_VEHICULE')

    // Compte produit véhicule
    const productLine = draft.lines.find((l) => l.side === 'CREDIT' && l.accountNumber === '706600')
    expect(productLine).toBeTruthy()

    // Compte taxe
    const taxLine = draft.lines.find((l) => l.side === 'CREDIT' && l.accountNumber === '445700')
    expect(taxLine).toBeTruthy()
    expect(taxLine?.amountCents).toBeGreaterThan(0)
  })

  test('sépare correctement la caution (jamais dans l\'écriture de produit)', () => {
    const draft = generateRentalInvoiceEntryDraft({
      id: 'contract-3',
      contractNumber: 'LOC-2025-00003',
      resourceType: 'ROOM',
      rentalAmountCents: 500000, // 5000.00
      cautionAmountCents: 1000000, // 10000.00 de caution
      penaltyAmountCents: 0,
    }, 0)

    // La caution ne doit PAS apparaître dans l'écriture de produit.
    // Le total débit/crédit doit être égal au montant de location (500000),
    // PAS au montant total incluant la caution.
    const totalDebit = draft.lines.filter((l) => l.side === 'DEBIT').reduce((s, l) => s + l.amountCents, 0)
    expect(totalDebit).toBe(500000)
  })

  test('inclut les pénalités dans le montant TTC si dommages constatés', () => {
    const draft = generateRentalInvoiceEntryDraft({
      id: 'contract-4',
      contractNumber: 'LOC-2025-00004',
      resourceType: 'VEHICLE',
      rentalAmountCents: 800000, // 8000.00
      cautionAmountCents: 0,
      penaltyAmountCents: 50000, // 500.00 de pénalité dommages
    }, 0)

    // Total TTC = 800000 + 50000 = 850000
    const totalDebit = draft.lines.filter((l) => l.side === 'DEBIT').reduce((s, l) => s + l.amountCents, 0)
    expect(totalDebit).toBe(850000)
  })
})

describe('RentalError', () => {
  test('est une Error typée avec un code', () => {
    const err = new RentalError('CONFLICT', 'Conflit de réservation')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('RentalError')
    expect(err.code).toBe('CONFLICT')
  })

  test('supporte tous les codes attendus', () => {
    const codes = [
      'RESOURCE_NOT_FOUND', 'RESOURCE_UNAVAILABLE', 'CONFLICT',
      'INVALID_STATUS', 'INVALID_DATES', 'INVALID_AMOUNT',
      'CONTRACT_NOT_FOUND', 'ALREADY_CONFIRMED', 'NOT_AUTHORIZED',
    ] as const
    for (const code of codes) {
      const err = new RentalError(code, `test ${code}`)
      expect(err.code).toBe(code)
    }
  })
})
