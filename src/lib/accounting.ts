// SmartShule — Module Comptabilité (Cycle 02, §3.11 du cahier des charges)
//
// Implémente :
//   - Le calcul d'une ligne de facture selon le §3.11.4 :
//       Montant brut = Quantité × Prix unitaire
//       Montant remise = Brut × TauxRemise / 100
//       Net HT = Brut - Remise
//       Montant taxe = Net HT × TauxTaxe / 100
//       Montant TTC = Net HT + Taxe
//   - La génération des écritures comptables en double entrée (§3.11.5) :
//       Sur facture :  Débit 411xxx Client / Crédit 706xxx Produit + Crédit 4457xx Taxe
//       Sur encaissement : Débit 53xxx Caisse / Crédit 411xxx Client
//   - L'immutabilité des paiements validés : pas de modification directe,
//     toute correction passe par un avoir (CreditNote) ou une écriture inverse.
//
// Les montants sont en centimes (Int) — voir src/lib/money.ts (DEC-005).

import { db } from '@/lib/db'
import {
  type Cents,
  type RateCents,
  type QuantityCents,
  multiplyCents,
  percentOfCents,
  roundHalfUpCents,
  sumCents,
  subCents,
} from '@/lib/money'

// ============================================================
// Types
// ============================================================

export interface InvoiceLineInput {
  description: string
  quantity: number // ex: 1, 1.5, 2
  unitPrice: number // ex: 50000 (= 500.00 dans la devise)
  discountRate: number // ex: 0, 5, 10 (en %)
  taxRate: number // ex: 0, 16, 20 (en %)
  productAccountNumber: string // ex: "706100"
  taxAccountNumber?: string // ex: "445700" (si taxe)
  feeDefinitionId?: string
}

export interface ComputedInvoiceLine {
  description: string
  quantityCents: QuantityCents
  unitPriceCents: Cents
  discountRateCents: RateCents
  taxRateCents: RateCents
  grossAmountCents: Cents
  discountAmountCents: Cents
  netAmountCents: Cents
  taxAmountCents: Cents
  totalAmountCents: Cents // TTC
  productAccountNumber: string
  taxAccountNumber?: string
  feeDefinitionId?: string
}

export interface ComputedInvoice {
  lines: ComputedInvoiceLine[]
  totalGrossCents: Cents
  totalDiscountCents: Cents
  totalNetHTCents: Cents
  totalTaxCents: Cents
  totalTTCCents: Cents
}

export type EntrySide = 'DEBIT' | 'CREDIT'

export interface JournalEntryLineDraft {
  accountNumber: string
  side: EntrySide
  amountCents: Cents
  description?: string
  analyticalActivity?: string
  analyticalPeriod?: string
  analyticalDirection?: string
}

export interface JournalEntryDraft {
  journalCode: string // VE-SCO, CAIS, etc.
  entryDate: Date
  description: string
  referenceType: 'INVOICE' | 'PAYMENT' | 'CREDIT_NOTE' | 'REFUND' | 'MANUAL'
  referenceId?: string
  lines: JournalEntryLineDraft[]
  reversalOfId?: string
}

export interface PostedJournalEntry {
  id: string
  entryNumber: string
  totalDebit: Cents
  totalCredit: Cents
  isBalanced: boolean
}

// ============================================================
// Calcul d'une ligne de facture (§3.11.4)
// ============================================================

/**
 * Calcule une ligne de facture à partir des inputs décimaux.
 *
 * Étapes (conformes au cahier des charges) :
 *   Montant brut = Quantité × Prix unitaire
 *   Montant remise = Brut × TauxRemise / 100
 *   Net HT = Brut - Remise
 *   Montant taxe = Net HT × TauxTaxe / 100
 *   TTC = Net HT + Taxe
 *
 * Tous les calculs se fontent en centimes via BigInt (src/lib/money.ts).
 */
export function computeInvoiceLine(input: InvoiceLineInput): ComputedInvoiceLine {
  // Validation
  if (input.quantity < 0) throw new Error('La quantité ne peut pas être négative.')
  if (input.unitPrice < 0) throw new Error('Le prix unitaire ne peut pas être négatif.')
  if (input.discountRate < 0 || input.discountRate > 100) {
    throw new Error('Le taux de remise doit être entre 0 et 100.')
  }
  if (input.taxRate < 0 || input.taxRate > 100) {
    throw new Error('Le taux de taxe doit être entre 0 et 100.')
  }

  // Conversion en centimes
  const quantityCents = Math.round(input.quantity * 100)
  const unitPriceCents = Math.round(input.unitPrice * 100)
  const discountRateCents = Math.round(input.discountRate * 100)
  const taxRateCents = Math.round(input.taxRate * 100)

  // Calculs
  const grossAmountCents = multiplyCents(quantityCents, unitPriceCents)
  const discountAmountCents = percentOfCents(grossAmountCents, discountRateCents)
  const netAmountCents = subCents(grossAmountCents, discountAmountCents)
  const taxAmountCents = percentOfCents(netAmountCents, taxRateCents)
  const totalAmountCents = netAmountCents + taxAmountCents

  return {
    description: input.description,
    quantityCents,
    unitPriceCents,
    discountRateCents,
    taxRateCents,
    grossAmountCents: roundHalfUpCents(grossAmountCents),
    discountAmountCents: roundHalfUpCents(discountAmountCents),
    netAmountCents: roundHalfUpCents(netAmountCents),
    taxAmountCents: roundHalfUpCents(taxAmountCents),
    totalAmountCents: roundHalfUpCents(totalAmountCents),
    productAccountNumber: input.productAccountNumber,
    taxAccountNumber: input.taxAccountNumber,
    feeDefinitionId: input.feeDefinitionId,
  }
}

/**
 * Calcule une facture complète à partir d'une liste de lignes.
 * Retourne les totaux (brut, remise, HT, taxe, TTC).
 */
export function computeInvoice(lines: InvoiceLineInput[]): ComputedInvoice {
  if (lines.length === 0) {
    throw new Error('Une facture doit comporter au moins une ligne.')
  }

  const computedLines = lines.map(computeInvoiceLine)

  return {
    lines: computedLines,
    totalGrossCents: roundHalfUpCents(sumCents(computedLines.map((l) => l.grossAmountCents))),
    totalDiscountCents: roundHalfUpCents(sumCents(computedLines.map((l) => l.discountAmountCents))),
    totalNetHTCents: roundHalfUpCents(sumCents(computedLines.map((l) => l.netAmountCents))),
    totalTaxCents: roundHalfUpCents(sumCents(computedLines.map((l) => l.taxAmountCents))),
    totalTTCCents: roundHalfUpCents(sumCents(computedLines.map((l) => l.totalAmountCents))),
  }
}

// ============================================================
// Génération d'écritures comptables en double entrée (§3.11.5)
// ============================================================

/**
 * Génère le brouillon d'écriture comptable pour la validation d'une facture
 * de frais académiques (§3.11.5).
 *
 * Écriture :
 *   Débit  411xxx  Client ou responsable payeur       Montant TTC
 *   Crédit 706xxx  Produit d'inscription/scolarité     Montant HT (par ligne)
 *   Crédit 4457xx  Taxe collectée éventuelle           Montant taxe (si applicable)
 *
 * @param invoice Facture calculée
 * @param customerAccountNumber Numéro de compte client (ex: "411001")
 * @returns Brouillon d'écriture à poster
 */
export function generateInvoiceEntryDraft(
  invoice: ComputedInvoice,
  customerAccountNumber: string,
  invoiceId: string,
  entryDate: Date = new Date()
): JournalEntryDraft {
  const lines: JournalEntryLineDraft[] = []

  // 1. Débit du compte client pour le montant TTC total
  lines.push({
    accountNumber: customerAccountNumber,
    side: 'DEBIT',
    amountCents: invoice.totalTTCCents,
    description: 'Créance client (facture)',
    analyticalActivity: 'ECOLE',
  })

  // 2. Crédit des comptes de produit (un par ligne de facture)
  for (const line of invoice.lines) {
    lines.push({
      accountNumber: line.productAccountNumber,
      side: 'CREDIT',
      amountCents: line.netAmountCents,
      description: `Produit — ${line.description}`,
      analyticalActivity: 'ECOLE',
    })
  }

  // 3. Crédit du compte de taxe (un seul agrégé si toutes les lignes utilisent le même compte taxe)
  if (invoice.totalTaxCents > 0) {
    // On prend le compte de taxe de la première ligne qui en a un
    const taxAccount = invoice.lines.find((l) => l.taxAccountNumber)?.taxAccountNumber
    if (taxAccount) {
      lines.push({
        accountNumber: taxAccount,
        side: 'CREDIT',
        amountCents: invoice.totalTaxCents,
        description: 'Taxe collectée',
        analyticalActivity: 'ECOLE',
      })
    }
  }

  return {
    journalCode: 'VE-SCO', // Ventes scolaires
    entryDate,
    description: `Facture de frais académiques`,
    referenceType: 'INVOICE',
    referenceId: invoiceId,
    lines,
  }
}

/**
 * Génère le brouillon d'écriture comptable pour un encaissement (§3.11.5).
 *
 * Écriture :
 *   Débit  53xxx  Caisse ou 51xxx Banque ou 54xxx Mobile Money    Montant encaissé
 *   Crédit 411xxx Client                                            Montant encaissé
 *
 * @param amountCents Montant encaissé en centimes
 * @param treasuryAccountNumber Compte de trésorerie (ex: "530000" pour caisse)
 * @param customerAccountNumber Compte client (ex: "411001")
 * @param paymentId ID du paiement
 * @param method Méthode de paiement (CASH, BANK, MOBILE_MONEY)
 */
export function generatePaymentEntryDraft(
  amountCents: Cents,
  treasuryAccountNumber: string,
  customerAccountNumber: string,
  paymentId: string,
  method: string,
  entryDate: Date = new Date()
): JournalEntryDraft {
  const treasuryLabel =
    method === 'CASH' ? 'Caisse' :
    method === 'BANK' ? 'Banque' :
    method === 'MOBILE_MONEY' ? 'Mobile Money' :
    method === 'CARD' ? 'Carte bancaire' :
    'Trésorerie'

  return {
    journalCode: method === 'BANK' ? 'BQ' : 'CAIS',
    entryDate,
    description: `Encaissement (${treasuryLabel})`,
    referenceType: 'PAYMENT',
    referenceId: paymentId,
    lines: [
      {
        accountNumber: treasuryAccountNumber,
        side: 'DEBIT',
        amountCents,
        description: `Encaissement ${treasuryLabel.toLowerCase()}`,
      },
      {
        accountNumber: customerAccountNumber,
        side: 'CREDIT',
        amountCents,
        description: 'Solde client (encaissement)',
      },
    ],
  }
}

/**
 * Génère le brouillon d'écriture d'inversion (avoir) pour annuler un paiement
 * validé. Conforme au §3.11.9 : un avoir doit reprendre les lignes originales,
 * les comptes et les taxes, en inversant le sens (débit ↔ crédit).
 *
 * @param originalEntryId ID de l'écriture originale à inverser
 * @param paymentId ID du paiement d'avoir/régularisation
 * @param reason Motif d'annulation
 */
export async function generateReversalEntryDraft(
  originalEntryId: string,
  newPaymentId: string,
  reason: string,
  entryDate: Date = new Date()
): Promise<JournalEntryDraft> {
  const original = await db.journalEntry.findUnique({
    where: { id: originalEntryId },
    include: { lines: true, journal: true },
  })
  if (!original) {
    throw new Error(`Écriture originale introuvable : ${originalEntryId}`)
  }

  // Inverser le sens de chaque ligne
  const reversedLines: JournalEntryLineDraft[] = original.lines.map((line) => ({
    accountNumber: line.account.accountNumber,
    side: line.debit > 0 ? 'CREDIT' : 'DEBIT',
    amountCents: line.debit > 0 ? line.debit : line.credit,
    description: line.description || undefined,
    analyticalActivity: line.analyticalActivity || undefined,
    analyticalPeriod: line.analyticalPeriod || undefined,
    analyticalDirection: line.analyticalDirection || undefined,
  }))

  return {
    journalCode: original.journal.code,
    entryDate,
    description: `Avoir/Inversion — ${reason}`,
    referenceType: 'CREDIT_NOTE',
    referenceId: newPaymentId,
    lines: reversedLines,
    reversalOfId: originalEntryId,
  }
}

// ============================================================
// Vérification de l'équilibre (Débit = Crédit)
// ============================================================

/**
 * Vérifie qu'un brouillon d'écriture est équilibré (Débit = Crédit).
 * Renvoie les totaux et le booléen isBalanced.
 */
export function verifyEntryBalance(
  draft: JournalEntryDraft
): { totalDebit: Cents; totalCredit: Cents; isBalanced: boolean } {
  const totalDebit = sumCents(
    draft.lines.filter((l) => l.side === 'DEBIT').map((l) => l.amountCents)
  )
  const totalCredit = sumCents(
    draft.lines.filter((l) => l.side === 'CREDIT').map((l) => l.amountCents)
  )
  return {
    totalDebit,
    totalCredit,
    isBalanced: totalDebit === totalCredit,
  }
}

// ============================================================
// Persistance d'une écriture (transaction ACID)
// ============================================================

/**
 * Persiste une écriture comptable dans une transaction ACID.
 *
 * Étapes :
 *   1. Vérifier l'équilibre Débit = Crédit (sinon refuser).
 *   2. Résoudre les numéros de compte en IDs (ChartOfAccount).
 *   3. Générer un numéro d'écriture séquentiel.
 *   4. Insérer dans JournalEntry + JournalEntryLine[] de façon atomique.
 *
 * @param schoolId ID de l'école
 * @param draft Brouillon d'écriture
 * @param postedById ID de l'utilisateur qui poste
 * @param tx Transaction Prisma optionnelle (pour composition dans une transaction parente)
 * @returns L'écriture persistée avec son ID et son numéro
 */
export async function postJournalEntry(
  schoolId: string,
  draft: JournalEntryDraft,
  postedById?: string,
  tx?: typeof db
): Promise<PostedJournalEntry> {
  const client = tx || db
  const balance = verifyEntryBalance(draft)
  if (!balance.isBalanced) {
    throw new AccountingError(
      'UNBALANCED_ENTRY',
      `Écriture non équilibrée : débit ${balance.totalDebit} centimes ≠ crédit ${balance.totalCredit} centimes. ` +
        `Différence : ${Math.abs(balance.totalDebit - balance.totalCredit)} centimes.`
    )
  }

  // Résoudre le journal
  const journal = await client.accountingJournal.findUnique({
    where: { schoolId_code: { schoolId, code: draft.journalCode } },
  })
  if (!journal) {
    throw new AccountingError(
      'JOURNAL_NOT_FOUND',
      `Journal introuvable pour l'école ${schoolId} et le code ${draft.journalCode}.`
    )
  }

  // Résoudre les comptes
  const accountNumbers = Array.from(
    new Set(draft.lines.map((l) => l.accountNumber))
  )
  const accounts = await client.chartOfAccount.findMany({
    where: { schoolId, accountNumber: { in: accountNumbers } },
  })

  const accountMap = new Map(accounts.map((a) => [a.accountNumber, a.id]))
  const missingAccounts = accountNumbers.filter((n) => !accountMap.has(n))
  if (missingAccounts.length > 0) {
    throw new AccountingError(
      'ACCOUNT_NOT_FOUND',
      `Comptes introuvables dans le plan comptable : ${missingAccounts.join(', ')}`
    )
  }

  // Générer le numéro d'écriture (AAAA-MM-SEQ)
  const period = draft.entryDate.toISOString().slice(0, 7)
  const entryCount = await client.journalEntry.count({
    where: { schoolId, accountingPeriod: period },
  })
  const entryNumber = `E${period}-${String(entryCount + 1).padStart(5, '0')}`

  // Insertion : si on est dans une transaction parente, on y participe ;
  // sinon on en crée une nouvelle.
  const doCreate = async (c: typeof db) => {
    return c.journalEntry.create({
      data: {
        schoolId,
        entryNumber,
        journalId: journal.id,
        entryDate: draft.entryDate,
        accountingPeriod: period,
        description: draft.description,
        referenceType: draft.referenceType,
        referenceId: draft.referenceId,
        status: 'POSTED',
        totalDebit: balance.totalDebit,
        totalCredit: balance.totalCredit,
        isBalanced: true,
        reversalOfId: draft.reversalOfId,
        postedById,
        lines: {
          create: draft.lines.map((line) => ({
            accountId: accountMap.get(line.accountNumber)!,
            debit: line.side === 'DEBIT' ? line.amountCents : 0,
            credit: line.side === 'CREDIT' ? line.amountCents : 0,
            description: line.description,
            analyticalActivity: line.analyticalActivity,
            analyticalPeriod: line.analyticalPeriod,
            analyticalDirection: line.analyticalDirection,
          })),
        },
      },
      include: { lines: true },
    })
  }

  const entry = tx
    ? await doCreate(tx)
    : await client.$transaction(async (t) => doCreate(t), {
        timeout: 30000,
        maxWait: 10000,
      })

  return {
    id: entry.id,
    entryNumber: entry.entryNumber,
    totalDebit: entry.totalDebit,
    totalCredit: entry.totalCredit,
    isBalanced: entry.isBalanced,
  }
}

// ============================================================
// Erreurs typées
// ============================================================

export class AccountingError extends Error {
  constructor(
    public readonly code:
      | 'UNBALANCED_ENTRY'
      | 'JOURNAL_NOT_FOUND'
      | 'ACCOUNT_NOT_FOUND'
      | 'PAYMENT_ALREADY_CANCELLED'
      | 'PAYMENT_NOT_FOUND'
      | 'INVOICE_NOT_FOUND'
      | 'INVALID_INVOICE_STATE'
      | 'INVALID_AMOUNT',
    message: string
  ) {
    super(message)
    this.name = 'AccountingError'
  }
}

// ============================================================
// Constantes du plan comptable (§3.11.2)
// ============================================================

/**
 * Plan comptable fonctionnel par défaut (§3.11.2 du cahier des charges).
 * Numéros proposés à titre indicatif — doivent être mappés vers le plan
 * comptable légal du pays d'exploitation.
 */
export const DEFAULT_CHART_OF_ACCOUNTS = [
  // Trésorerie (classe 5)
  { number: '510000', label: 'Banque', category: 'TREASURY', type: 'ASSET', direction: 'DEBIT', isTreasury: true },
  { number: '530000', label: 'Caisse', category: 'TREASURY', type: 'ASSET', direction: 'DEBIT', isTreasury: true },
  { number: '540000', label: 'Mobile Money', category: 'TREASURY', type: 'ASSET', direction: 'DEBIT', isTreasury: true },
  // Clients (classe 411)
  { number: '411001', label: 'Clients académiques', category: 'CUSTOMER', type: 'ASSET', direction: 'DEBIT', isCustomer: true },
  { number: '411002', label: 'Clients location salles', category: 'CUSTOMER', type: 'ASSET', direction: 'DEBIT', isCustomer: true },
  { number: '411003', label: 'Clients location véhicules', category: 'CUSTOMER', type: 'ASSET', direction: 'DEBIT', isCustomer: true },
  // Taxes
  { number: '445700', label: 'Taxes collectées', category: 'TAX', type: 'LIABILITY', direction: 'CREDIT', isTax: true },
  { number: '445600', label: 'Taxes récupérables', category: 'TAX', type: 'ASSET', direction: 'DEBIT', isTax: true },
  // Avances et cautions
  { number: '419000', label: 'Avances reçues des clients', category: 'CUSTOMER', type: 'LIABILITY', direction: 'CREDIT', isCustomer: true },
  // Fournisseurs (classe 401)
  { number: '401000', label: 'Fournisseurs d\'achats', category: 'SUPPLIER', type: 'LIABILITY', direction: 'CREDIT', isSupplier: true },
  { number: '404000', label: 'Fournisseurs d\'immobilisations', category: 'SUPPLIER', type: 'LIABILITY', direction: 'CREDIT', isSupplier: true },
  // Produits scolaires (classe 7061)
  { number: '706100', label: 'Produit inscriptions', category: 'PRODUCT', type: 'REVENUE', direction: 'CREDIT', isProduct: true },
  { number: '706200', label: 'Produit scolarité', category: 'PRODUCT', type: 'REVENUE', direction: 'CREDIT', isProduct: true },
  { number: '706300', label: 'Produit transport scolaire', category: 'PRODUCT', type: 'REVENUE', direction: 'CREDIT', isProduct: true },
  { number: '706400', label: 'Produit cantine', category: 'PRODUCT', type: 'REVENUE', direction: 'CREDIT', isProduct: true },
  // Produits locations (classe 7065/7066)
  { number: '706500', label: 'Produit location de salles', category: 'PRODUCT', type: 'REVENUE', direction: 'CREDIT', isProduct: true },
  { number: '706510', label: 'Prestations annexes salles', category: 'PRODUCT', type: 'REVENUE', direction: 'CREDIT', isProduct: true },
  { number: '706520', label: 'Pénalités facturables salles', category: 'PRODUCT', type: 'REVENUE', direction: 'CREDIT', isProduct: true },
  { number: '706600', label: 'Produit location de véhicules', category: 'PRODUCT', type: 'REVENUE', direction: 'CREDIT', isProduct: true },
  { number: '706610', label: 'Kilomètres / carburant', category: 'PRODUCT', type: 'REVENUE', direction: 'CREDIT', isProduct: true },
  { number: '706620', label: 'Service chauffeur', category: 'PRODUCT', type: 'REVENUE', direction: 'CREDIT', isProduct: true },
  { number: '706630', label: 'Pénalités facturables véhicules', category: 'PRODUCT', type: 'REVENUE', direction: 'CREDIT', isProduct: true },
  // Charges (classe 6)
  { number: '600000', label: 'Achats', category: 'CHARGE', type: 'EXPENSE', direction: 'DEBIT' },
  { number: '610000', label: 'Services extérieurs', category: 'CHARGE', type: 'EXPENSE', direction: 'DEBIT' },
  { number: '615000', label: 'Maintenance véhicules et salles', category: 'CHARGE', type: 'EXPENSE', direction: 'DEBIT' },
  { number: '640000', label: 'Personnel (rémunérations)', category: 'CHARGE', type: 'EXPENSE', direction: 'DEBIT' },
  { number: '681000', label: 'Amortissements', category: 'CHARGE', type: 'EXPENSE', direction: 'DEBIT' },
] as const

/**
 * Journaux comptables par défaut (§3.11.3 du cahier des charges).
 */
export const DEFAULT_JOURNALS = [
  { code: 'VE-SCO', label: 'Ventes scolaires', type: 'SALES' },
  { code: 'VE-SAL', label: 'Ventes salles', type: 'SALES' },
  { code: 'VE-VEH', label: 'Ventes véhicules', type: 'SALES' },
  { code: 'CAIS', label: 'Caisse', type: 'CASH' },
  { code: 'BQ', label: 'Banque', type: 'BANK' },
  { code: 'ACHA', label: 'Achats', type: 'PURCHASE' },
  { code: 'PAIE', label: 'Paie', type: 'PAYROLL' },
  { code: 'OD', label: 'Opérations diverses', type: 'MISC' },
] as const

/**
 * Mapping des méthodes de paiement vers le compte de trésorerie.
 */
export const PAYMENT_METHOD_TO_TREASURY: Record<string, string> = {
  CASH: '530000',
  BANK: '510000',
  MOBILE_MONEY: '540000',
  CARD: '510000',
}
