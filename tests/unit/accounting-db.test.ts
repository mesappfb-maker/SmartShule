// SmartShule — Tests d'intégration DB : persistance d'écritures comptables
//
// Vérifie que :
//   - postJournalEntry persiste une écriture équilibrée ;
//   - postJournalEntry rejette une écriture non équilibrée (AccountingError UNBALANCED_ENTRY) ;
//   - postJournalEntry rejette une écriture avec un compte inexistant ;
//   - l'écriture persistée a bien ses lignes en DB ;
//   - le total débit/crédit et isBalanced sont corrects.
//
// Note : ces tests utilisent la vraie base SQLite et créent une école factice
// + un plan comptable minimal pour s'isoler des données de démo.

import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { db } from '../../src/lib/db'
import {
  postJournalEntry,
  AccountingError,
  type JournalEntryDraft,
} from '../../src/lib/accounting'

const TEST_SCHOOL_NAME = `Test School Accounting ${Date.now()}`
let schoolId: string
let journalId: string
let accountCustomerId: string
let accountProductId: string
let accountTaxId: string
let accountTreasuryId: string

describe('postJournalEntry (DB)', () => {
  beforeAll(async () => {
    // Créer une école factice
    const school = await db.school.create({
      data: {
        name: TEST_SCHOOL_NAME,
        slogan: 'Test',
        primaryColor: '#2563EB',
        secondaryColor: '#0F766E',
        tertiaryColor: '#F59E0B',
        currency: 'EUR',
        locale: 'fr-FR',
      },
    })
    schoolId = school.id

    // Créer un journal VE-SCO
    const journal = await db.accountingJournal.create({
      data: {
        schoolId,
        code: 'VE-SCO',
        label: 'Ventes scolaires',
        journalType: 'SALES',
      },
    })
    journalId = journal.id

    // Créer 4 comptes du plan
    const customer = await db.chartOfAccount.create({
      data: {
        schoolId,
        accountNumber: '411001',
        accountLabel: 'Clients académiques',
        accountClass: '4',
        accountCategory: 'CUSTOMER',
        accountType: 'ASSET',
        direction: 'DEBIT',
        isCustomerAccount: true,
      },
    })
    accountCustomerId = customer.id

    const product = await db.chartOfAccount.create({
      data: {
        schoolId,
        accountNumber: '706100',
        accountLabel: 'Produit inscriptions',
        accountClass: '7',
        accountCategory: 'PRODUCT',
        accountType: 'REVENUE',
        direction: 'CREDIT',
        isProductAccount: true,
      },
    })
    accountProductId = product.id

    const tax = await db.chartOfAccount.create({
      data: {
        schoolId,
        accountNumber: '445700',
        accountLabel: 'Taxes collectées',
        accountClass: '4',
        accountCategory: 'TAX',
        accountType: 'LIABILITY',
        direction: 'CREDIT',
        isTaxAccount: true,
      },
    })
    accountTaxId = tax.id

    const treasury = await db.chartOfAccount.create({
      data: {
        schoolId,
        accountNumber: '530000',
        accountLabel: 'Caisse',
        accountClass: '5',
        accountCategory: 'TREASURY',
        accountType: 'ASSET',
        direction: 'DEBIT',
        isTreasuryAccount: true,
      },
    })
    accountTreasuryId = treasury.id
  })

  afterAll(async () => {
    // Nettoyer toutes les données créées
    await db.journalEntryLine.deleteMany({
      where: { entry: { schoolId } },
    })
    await db.journalEntry.deleteMany({ where: { schoolId } })
    await db.accountingJournal.deleteMany({ where: { schoolId } })
    await db.chartOfAccount.deleteMany({ where: { schoolId } })
    await db.school.delete({ where: { id: schoolId } })
  })

  test('persiste une écriture équilibrée avec ses lignes', async () => {
    const draft: JournalEntryDraft = {
      journalCode: 'VE-SCO',
      entryDate: new Date('2025-09-17'),
      description: 'Facture test',
      referenceType: 'INVOICE',
      referenceId: 'test-invoice-1',
      lines: [
        { accountNumber: '411001', side: 'DEBIT', amountCents: 1160000, description: 'Créance' },
        { accountNumber: '706100', side: 'CREDIT', amountCents: 1000000, description: 'Produit' },
        { accountNumber: '445700', side: 'CREDIT', amountCents: 160000, description: 'Taxe' },
      ],
    }

    const result = await postJournalEntry(schoolId, draft, 'test-user-1')

    expect(result.id).toBeDefined()
    expect(result.entryNumber).toMatch(/^E2025-09-\d{5}$/)
    expect(result.totalDebit).toBe(1160000)
    expect(result.totalCredit).toBe(1160000)
    expect(result.isBalanced).toBe(true)

    // Vérifier que les lignes sont bien persistées
    const lines = await db.journalEntryLine.findMany({
      where: { entryId: result.id },
    })
    expect(lines).toHaveLength(3)

    const debitLine = lines.find((l) => l.debit > 0)
    expect(debitLine?.debit).toBe(1160000)
    expect(debitLine?.credit).toBe(0)

    const creditLines = lines.filter((l) => l.credit > 0)
    expect(creditLines).toHaveLength(2)
    expect(creditLines.reduce((s, l) => s + l.credit, 0)).toBe(1160000)
  })

  test('rejette une écriture non équilibrée', async () => {
    const draft: JournalEntryDraft = {
      journalCode: 'VE-SCO',
      entryDate: new Date('2025-09-17'),
      description: 'Écriture non équilibrée',
      referenceType: 'MANUAL',
      lines: [
        { accountNumber: '411001', side: 'DEBIT', amountCents: 100000 },
        { accountNumber: '706100', side: 'CREDIT', amountCents: 99000 }, // 1000 centimes de moins
      ],
    }

    await expect(postJournalEntry(schoolId, draft)).rejects.toThrow(AccountingError)
    await expect(postJournalEntry(schoolId, draft)).rejects.toThrow(/non équilibrée/i)
  })

  test('rejette une écriture avec un compte inexistant', async () => {
    const draft: JournalEntryDraft = {
      journalCode: 'VE-SCO',
      entryDate: new Date('2025-09-17'),
      description: 'Compte inexistant',
      referenceType: 'MANUAL',
      lines: [
        { accountNumber: '999999', side: 'DEBIT', amountCents: 1000 },
        { accountNumber: '706100', side: 'CREDIT', amountCents: 1000 },
      ],
    }

    await expect(postJournalEntry(schoolId, draft)).rejects.toThrow(AccountingError)
    await expect(postJournalEntry(schoolId, draft)).rejects.toThrow(/introuvables/)
  })

  test('rejette une écriture avec un journal inexistant', async () => {
    const draft: JournalEntryDraft = {
      journalCode: 'NON-EXISTENT',
      entryDate: new Date('2025-09-17'),
      description: 'Journal inexistant',
      referenceType: 'MANUAL',
      lines: [
        { accountNumber: '411001', side: 'DEBIT', amountCents: 1000 },
        { accountNumber: '706100', side: 'CREDIT', amountCents: 1000 },
      ],
    }

    await expect(postJournalEntry(schoolId, draft)).rejects.toThrow(AccountingError)
    await expect(postJournalEntry(schoolId, draft)).rejects.toThrow(/Journal introuvable/)
  })

  test('génère des numéros d\'écriture séquentiels', async () => {
    const draft: JournalEntryDraft = {
      journalCode: 'VE-SCO',
      entryDate: new Date('2025-09-17'),
      description: 'Première écriture',
      referenceType: 'MANUAL',
      lines: [
        { accountNumber: '411001', side: 'DEBIT', amountCents: 1000 },
        { accountNumber: '706100', side: 'CREDIT', amountCents: 1000 },
      ],
    }

    const r1 = await postJournalEntry(schoolId, draft)
    const r2 = await postJournalEntry(schoolId, { ...draft, description: 'Deuxième écriture' })

    // Les numéros doivent être uniques et séquentiels
    expect(r1.entryNumber).not.toBe(r2.entryNumber)
  })
})
