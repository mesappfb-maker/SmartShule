// SmartShule — Tests unitaires : module comptable (accounting.ts)
//
// Vérifie :
//   - calcul d'une ligne de facture selon §3.11.4 (brut → remise → HT → taxe → TTC) ;
//   - calcul d'une facture complète (totaux corrects) ;
//   - génération d'écritures en double entrée pour facture ;
//   - génération d'écritures pour encaissement ;
//   - vérification de l'équilibre Débit = Crédit (verifyEntryBalance) ;
//   - détection d'écritures non équilibrées ;
//   - constantes du plan comptable (§3.11.2) et des journaux (§3.11.3).

import { test, expect, describe } from 'bun:test'
import {
  computeInvoiceLine,
  computeInvoice,
  generateInvoiceEntryDraft,
  generatePaymentEntryDraft,
  verifyEntryBalance,
  AccountingError,
  DEFAULT_CHART_OF_ACCOUNTS,
  DEFAULT_JOURNALS,
  PAYMENT_METHOD_TO_TREASURY,
  type InvoiceLineInput,
} from '../../src/lib/accounting'

describe('computeInvoiceLine — calcul d\'une ligne selon §3.11.4', () => {
  const baseLine: InvoiceLineInput = {
    description: 'Frais d\'inscription',
    quantity: 1,
    unitPrice: 50000,
    discountRate: 0,
    taxRate: 0,
    productAccountNumber: '706100',
    taxAccountNumber: '445700',
  }

  test('calcul sans remise ni taxe', () => {
    const result = computeInvoiceLine(baseLine)
    expect(result.grossAmountCents).toBe(5000000) // 50000.00 en centimes
    expect(result.discountAmountCents).toBe(0)
    expect(result.netAmountCents).toBe(5000000)
    expect(result.taxAmountCents).toBe(0)
    expect(result.totalAmountCents).toBe(5000000) // TTC = HT
  })

  test('calcul avec remise de 10%', () => {
    const result = computeInvoiceLine({
      ...baseLine,
      discountRate: 10,
    })
    expect(result.grossAmountCents).toBe(5000000) // 50000.00
    expect(result.discountAmountCents).toBe(500000) // 5000.00 (10%)
    expect(result.netAmountCents).toBe(4500000) // 45000.00
    expect(result.taxAmountCents).toBe(0)
    expect(result.totalAmountCents).toBe(4500000)
  })

  test('calcul avec taxe de 20%', () => {
    const result = computeInvoiceLine({
      ...baseLine,
      unitPrice: 1000, // 10.00
      taxRate: 20,
    })
    expect(result.grossAmountCents).toBe(100000) // 1000.00
    expect(result.netAmountCents).toBe(100000) // pas de remise
    expect(result.taxAmountCents).toBe(20000) // 200.00 (20%)
    expect(result.totalAmountCents).toBe(120000) // 1200.00 TTC
  })

  test('calcul combiné remise 5% + taxe 16%', () => {
    // Brut = 100000 (= 1000.00)
    // Remise = 5% × 100000 = 5000
    // Net HT = 95000
    // Taxe = 16% × 95000 = 15200
    // TTC = 110200
    const result = computeInvoiceLine({
      ...baseLine,
      unitPrice: 1000,
      discountRate: 5,
      taxRate: 16,
    })
    expect(result.grossAmountCents).toBe(100000)
    expect(result.discountAmountCents).toBe(5000)
    expect(result.netAmountCents).toBe(95000)
    expect(result.taxAmountCents).toBe(15200)
    expect(result.totalAmountCents).toBe(110200)
  })

  test('quantité décimale (1.5)', () => {
    const result = computeInvoiceLine({
      ...baseLine,
      quantity: 1.5,
      unitPrice: 100,
    })
    expect(result.grossAmountCents).toBe(15000) // 1.5 × 100 = 150.00
  })

  test('rejette une quantité négative', () => {
    expect(() =>
      computeInvoiceLine({ ...baseLine, quantity: -1 })
    ).toThrow(/négative/)
  })

  test('rejette un prix négatif', () => {
    expect(() =>
      computeInvoiceLine({ ...baseLine, unitPrice: -100 })
    ).toThrow(/négatif/)
  })

  test('rejette une remise > 100%', () => {
    expect(() =>
      computeInvoiceLine({ ...baseLine, discountRate: 150 })
    ).toThrow(/remise/)
  })

  test('rejette une taxe > 100%', () => {
    expect(() =>
      computeInvoiceLine({ ...baseLine, taxRate: 150 })
    ).toThrow(/taxe/)
  })
})

describe('computeInvoice — calcul d\'une facture complète', () => {
  test('additionne correctement les totaux de plusieurs lignes', () => {
    const lines: InvoiceLineInput[] = [
      {
        description: 'Frais d\'inscription',
        quantity: 1,
        unitPrice: 50000,
        discountRate: 0,
        taxRate: 0,
        productAccountNumber: '706100',
      },
      {
        description: 'Scolarité T1',
        quantity: 1,
        unitPrice: 120000,
        discountRate: 0,
        taxRate: 0,
        productAccountNumber: '706200',
      },
    ]
    const result = computeInvoice(lines)
    expect(result.lines).toHaveLength(2)
    expect(result.totalGrossCents).toBe(17000000) // 170000.00
    expect(result.totalDiscountCents).toBe(0)
    expect(result.totalNetHTCents).toBe(17000000)
    expect(result.totalTaxCents).toBe(0)
    expect(result.totalTTCCents).toBe(17000000)
  })

  test('rejette une facture vide', () => {
    expect(() => computeInvoice([])).toThrow(/au moins une ligne/)
  })
})

describe('generateInvoiceEntryDraft — écriture de facture (§3.11.5)', () => {
  test('génère une écriture équilibrée (Débit client = Crédit produit + Crédit taxe)', () => {
    const lines: InvoiceLineInput[] = [
      {
        description: 'Frais d\'inscription',
        quantity: 1,
        unitPrice: 50000,
        discountRate: 0,
        taxRate: 16,
        productAccountNumber: '706100',
        taxAccountNumber: '445700',
      },
    ]
    const invoice = computeInvoice(lines)
    const draft = generateInvoiceEntryDraft(invoice, '411001', 'invoice-1')

    // 3 lignes : 1 débit client + 1 crédit produit + 1 crédit taxe
    expect(draft.lines).toHaveLength(3)

    // Débit client = TTC
    expect(draft.lines.find((l) => l.side === 'DEBIT' && l.accountNumber === '411001')?.amountCents)
      .toBe(5800000) // 50000 × 1.16 = 58000

    // Crédit produit = HT
    expect(draft.lines.find((l) => l.side === 'CREDIT' && l.accountNumber === '706100')?.amountCents)
      .toBe(5000000) // 50000

    // Crédit taxe = montant taxe
    expect(draft.lines.find((l) => l.side === 'CREDIT' && l.accountNumber === '445700')?.amountCents)
      .toBe(800000) // 50000 × 0.16 = 8000

    // Vérifier l'équilibre
    const balance = verifyEntryBalance(draft)
    expect(balance.isBalanced).toBe(true)
    expect(balance.totalDebit).toBe(balance.totalCredit)
  })

  test('génère une écriture sans taxe (taxRate = 0)', () => {
    const lines: InvoiceLineInput[] = [
      {
        description: 'Scolarité',
        quantity: 1,
        unitPrice: 100000,
        discountRate: 0,
        taxRate: 0,
        productAccountNumber: '706200',
      },
    ]
    const invoice = computeInvoice(lines)
    const draft = generateInvoiceEntryDraft(invoice, '411001', 'invoice-2')

    // 2 lignes seulement : 1 débit client + 1 crédit produit (pas de taxe)
    expect(draft.lines).toHaveLength(2)

    const balance = verifyEntryBalance(draft)
    expect(balance.isBalanced).toBe(true)
  })

  test('génère une écriture avec plusieurs lignes de produit', () => {
    const lines: InvoiceLineInput[] = [
      {
        description: 'Inscription',
        quantity: 1,
        unitPrice: 50000,
        discountRate: 0,
        taxRate: 0,
        productAccountNumber: '706100',
      },
      {
        description: 'Scolarité',
        quantity: 1,
        unitPrice: 120000,
        discountRate: 0,
        taxRate: 0,
        productAccountNumber: '706200',
      },
    ]
    const invoice = computeInvoice(lines)
    const draft = generateInvoiceEntryDraft(invoice, '411001', 'invoice-3')

    // 1 débit + 2 crédits (un par produit)
    expect(draft.lines).toHaveLength(3)
    expect(draft.lines.filter((l) => l.side === 'DEBIT')).toHaveLength(1)
    expect(draft.lines.filter((l) => l.side === 'CREDIT')).toHaveLength(2)

    const balance = verifyEntryBalance(draft)
    expect(balance.isBalanced).toBe(true)
    expect(balance.totalDebit).toBe(17000000) // 170000.00
  })
})

describe('generatePaymentEntryDraft — écriture d\'encaissement (§3.11.5)', () => {
  test('génère une écriture équilibrée Débit trésorerie = Crédit client', () => {
    const draft = generatePaymentEntryDraft(
      17000000, // 170000.00
      '530000',  // Caisse
      '411001',  // Client
      'payment-1',
      'CASH',
      new Date('2025-09-17')
    )

    expect(draft.lines).toHaveLength(2)
    expect(draft.lines[0].accountNumber).toBe('530000')
    expect(draft.lines[0].side).toBe('DEBIT')
    expect(draft.lines[0].amountCents).toBe(17000000)
    expect(draft.lines[1].accountNumber).toBe('411001')
    expect(draft.lines[1].side).toBe('CREDIT')
    expect(draft.lines[1].amountCents).toBe(17000000)

    expect(draft.journalCode).toBe('CAIS')

    const balance = verifyEntryBalance(draft)
    expect(balance.isBalanced).toBe(true)
  })

  test('utilise le journal BQ pour les paiements bancaires', () => {
    const draft = generatePaymentEntryDraft(
      1000000,
      '510000',
      '411001',
      'payment-2',
      'BANK',
      new Date()
    )
    expect(draft.journalCode).toBe('BQ')
  })
})

describe('verifyEntryBalance — vérification d\'équilibre', () => {
  test('détecte une écriture équilibrée', () => {
    const draft = {
      journalCode: 'CAIS',
      entryDate: new Date(),
      description: 'Test',
      referenceType: 'MANUAL' as const,
      lines: [
        { accountNumber: '530000', side: 'DEBIT' as const, amountCents: 100000 },
        { accountNumber: '411001', side: 'CREDIT' as const, amountCents: 100000 },
      ],
    }
    const balance = verifyEntryBalance(draft)
    expect(balance.isBalanced).toBe(true)
    expect(balance.totalDebit).toBe(100000)
    expect(balance.totalCredit).toBe(100000)
  })

  test('détecte une écriture non équilibrée', () => {
    const draft = {
      journalCode: 'CAIS',
      entryDate: new Date(),
      description: 'Test unbalanced',
      referenceType: 'MANUAL' as const,
      lines: [
        { accountNumber: '530000', side: 'DEBIT' as const, amountCents: 100000 },
        { accountNumber: '411001', side: 'CREDIT' as const, amountCents: 99000 }, // 1000 centimes de moins
      ],
    }
    const balance = verifyEntryBalance(draft)
    expect(balance.isBalanced).toBe(false)
    expect(balance.totalDebit).toBe(100000)
    expect(balance.totalCredit).toBe(99000)
  })
})

describe('AccountingError', () => {
  test('est une Error typée avec un code', () => {
    const err = new AccountingError('UNBALANCED_ENTRY', 'Test message')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('AccountingError')
    expect(err.code).toBe('UNBALANCED_ENTRY')
    expect(err.message).toBe('Test message')
  })
})

describe('Constantes du plan comptable (§3.11.2)', () => {
  test('DEFAULT_CHART_OF_ACCOUNTS contient les comptes essentiels', () => {
    const numbers = DEFAULT_CHART_OF_ACCOUNTS.map((a) => a.number)
    expect(numbers).toContain('510000') // Banque
    expect(numbers).toContain('530000') // Caisse
    expect(numbers).toContain('411001') // Clients académiques
    expect(numbers).toContain('706100') // Produit inscriptions
    expect(numbers).toContain('706200') // Produit scolarité
    expect(numbers).toContain('706500') // Location salles
    expect(numbers).toContain('706600') // Location véhicules
    expect(numbers).toContain('445700') // Taxes collectées
  })

  test('DEFAULT_JOURNALS contient les 8 journaux requis', () => {
    const codes = DEFAULT_JOURNALS.map((j) => j.code)
    expect(codes).toEqual(
      expect.arrayContaining(['VE-SCO', 'VE-SAL', 'VE-VEH', 'CAIS', 'BQ', 'ACHA', 'PAIE', 'OD'])
    )
    expect(DEFAULT_JOURNALS).toHaveLength(8)
  })

  test('PAYMENT_METHOD_TO_TREASURY mappe les 4 méthodes', () => {
    expect(PAYMENT_METHOD_TO_TREASURY.CASH).toBe('530000')
    expect(PAYMENT_METHOD_TO_TREASURY.BANK).toBe('510000')
    expect(PAYMENT_METHOD_TO_TREASURY.MOBILE_MONEY).toBe('540000')
    expect(PAYMENT_METHOD_TO_TREASURY.CARD).toBe('510000')
  })
})
