// SmartShule — Seed du plan comptable et des journaux (Cycle 02)
// À exécuter après seed.ts principal pour ajouter les tables comptables.

import { db } from '../src/lib/db'
import { DEFAULT_CHART_OF_ACCOUNTS, DEFAULT_JOURNALS } from '../src/lib/accounting'

async function main() {
  console.log('📊 Seed comptable — Cycle 02')
  console.log('')

  const school = await db.school.findFirst()
  if (!school) {
    console.error('❌ Aucune école trouvée. Exécutez d\'abord scripts/seed.ts.')
    process.exit(1)
  }

  console.log(`🏫 École : ${school.name} (${school.id})`)

  // ============================================================
  // 1. Plan comptable
  // ============================================================
  console.log('')
  console.log('📊 Création du plan comptable...')

  let accountsCreated = 0
  for (const acc of DEFAULT_CHART_OF_ACCOUNTS) {
    const existing = await db.chartOfAccount.findUnique({
      where: { schoolId_accountNumber: { schoolId: school.id, accountNumber: acc.number } },
    })
    if (existing) {
      continue
    }

    // Déterminer la classe PCG à partir du premier chiffre du numéro
    const accountClass = acc.number[0]

    await db.chartOfAccount.create({
      data: {
        schoolId: school.id,
        accountNumber: acc.number,
        accountLabel: acc.label,
        accountClass,
        accountCategory: acc.category,
        accountType: acc.type,
        direction: acc.direction,
        isProductAccount: 'isProduct' in acc ? acc.isProduct : false,
        isTaxAccount: 'isTax' in acc ? acc.isTax : false,
        isTreasuryAccount: 'isTreasury' in acc ? acc.isTreasury : false,
        isCustomerAccount: 'isCustomer' in acc ? acc.isCustomer : false,
        isSupplierAccount: 'isSupplier' in acc ? acc.isSupplier : false,
        status: 'ACTIVE',
      },
    })
    accountsCreated++
  }

  console.log(`  ✓ ${accountsCreated} compte(s) créé(s)`)
  const totalAccounts = await db.chartOfAccount.count({ where: { schoolId: school.id } })
  console.log(`  Total comptes actifs : ${totalAccounts}`)

  // ============================================================
  // 2. Journaux comptables
  // ============================================================
  console.log('')
  console.log('📚 Création des journaux comptables...')

  let journalsCreated = 0
  for (const j of DEFAULT_JOURNALS) {
    const existing = await db.accountingJournal.findUnique({
      where: { schoolId_code: { schoolId: school.id, code: j.code } },
    })
    if (existing) continue

    await db.accountingJournal.create({
      data: {
        schoolId: school.id,
        code: j.code,
        label: j.label,
        journalType: j.type,
        status: 'ACTIVE',
      },
    })
    journalsCreated++
  }

  console.log(`  ✓ ${journalsCreated} journal(aux) créé(s)`)
  const totalJournals = await db.accountingJournal.count({ where: { schoolId: school.id } })
  console.log(`  Total journaux actifs : ${totalJournals}`)

  // ============================================================
  // 3. Mettre à jour les InvoiceLine existantes avec les centimes
  // ============================================================
  console.log('')
  console.log('🧮 Migration des InvoiceLine existantes vers les centimes...')

  const existingLines = await db.invoiceLine.findMany({
    include: { invoice: true },
  })

  let migrated = 0
  for (const line of existingLines) {
    if (line.totalAmountCents !== 0) continue // déjà migrée

    const quantityCents = Math.round(line.quantity * 100)
    const unitPriceCents = Math.round(line.unitPrice * 100)
    const discountRateCents = Math.round(line.discount * 100)
    const taxRateCents = Math.round(line.taxRate * 100)
    const grossAmountCents = Math.round(line.quantity * line.unitPrice * 100)
    const discountAmountCents = Math.round((grossAmountCents * discountRateCents) / 10000)
    const netAmountCents = grossAmountCents - discountAmountCents
    const taxAmountCents = Math.round((netAmountCents * taxRateCents) / 10000)
    const totalAmountCents = netAmountCents + taxAmountCents

    await db.invoiceLine.update({
      where: { id: line.id },
      data: {
        quantityCents,
        unitPriceCents,
        discountCents: discountRateCents,
        taxRateCents,
        grossAmountCents,
        discountAmountCents,
        netAmountCents,
        taxAmountCents,
        totalAmountCents,
        // Associer les comptes par défaut pour les frais académiques existants
        productAccountNumber: '706200', // scolarité par défaut
        taxAccountNumber: line.taxRate > 0 ? '445700' : null,
      },
    })
    migrated++
  }
  console.log(`  ✓ ${migrated} ligne(s) migrée(s) vers les centimes`)

  // Mettre à jour les Invoice avec totalAmountCents
  const existingInvoices = await db.invoice.findMany()
  let invoicesMigrated = 0
  for (const inv of existingInvoices) {
    if (inv.totalAmountCents !== 0) continue
    const totalCents = Math.round(inv.totalAmount * 100)
    const paidCents = Math.round(inv.paidAmount * 100)
    await db.invoice.update({
      where: { id: inv.id },
      data: { totalAmountCents: totalCents, paidAmountCents: paidCents },
    })
    invoicesMigrated++
  }
  console.log(`  ✓ ${invoicesMigrated} facture(s) migrée(s)`)

  // Mettre à jour les Payment avec amountCents
  const existingPayments = await db.payment.findMany()
  let paymentsMigrated = 0
  for (const p of existingPayments) {
    if (p.amountCents !== 0) continue
    const amountCents = Math.round(p.amount * 100)
    await db.payment.update({
      where: { id: p.id },
      data: { amountCents },
    })
    paymentsMigrated++
  }
  console.log(`  ✓ ${paymentsMigrated} paiement(s) migré(s)`)

  // ============================================================
  // 4. Générer les écritures comptables pour les factures existantes
  // ============================================================
  console.log('')
  console.log('📒 Génération des écritures comptables pour les factures existantes...')

  const invoicesWithoutEntry = await db.invoice.findMany({
    where: { accountingEntryId: null, status: { in: ['UNPAID', 'PARTIALLY_PAID', 'PAID'] } },
    include: { lines: true, student: true },
  })

  let entriesCreated = 0
  for (const inv of invoicesWithoutEntry) {
    // Construire les lignes de l'écriture
    const entryLines = []
    let totalHT = 0
    let totalTax = 0
    let totalTTC = 0

    for (const line of inv.lines) {
      totalHT += line.netAmountCents
      totalTax += line.taxAmountCents
      totalTTC += line.totalAmountCents

      if (line.netAmountCents > 0 && line.productAccountNumber) {
        entryLines.push({
          accountNumber: line.productAccountNumber,
          side: 'CREDIT' as const,
          amountCents: line.netAmountCents,
          description: `Produit — ${line.description}`,
          analyticalActivity: 'ECOLE',
        })
      }
    }

    if (totalTax > 0) {
      entryLines.push({
        accountNumber: '445700',
        side: 'CREDIT' as const,
        amountCents: totalTax,
        description: 'Taxe collectée',
        analyticalActivity: 'ECOLE',
      })
    }

    // Débit du compte client
    entryLines.unshift({
      accountNumber: '411001',
      side: 'DEBIT' as const,
      amountCents: totalTTC,
      description: 'Créance client (facture)',
      analyticalActivity: 'ECOLE',
    })

    const period = inv.issueDate.toISOString().slice(0, 7)
    const entryCount = await db.journalEntry.count({
      where: { schoolId: inv.schoolId, accountingPeriod: period },
    })
    const entryNumber = `E${period}-${String(entryCount + 1).padStart(5, '0')}`

    const journal = await db.accountingJournal.findUnique({
      where: { schoolId_code: { schoolId: inv.schoolId, code: 'VE-SCO' } },
    })
    if (!journal) continue

    // Résoudre les comptes
    const accountNumbers = Array.from(new Set(entryLines.map((l) => l.accountNumber)))
    const accounts = await db.chartOfAccount.findMany({
      where: { schoolId: inv.schoolId, accountNumber: { in: accountNumbers } },
    })
    const accountMap = new Map(accounts.map((a) => [a.accountNumber, a.id]))

    const totalDebit = entryLines.filter((l) => l.side === 'DEBIT').reduce((s, l) => s + l.amountCents, 0)
    const totalCredit = entryLines.filter((l) => l.side === 'CREDIT').reduce((s, l) => s + l.amountCents, 0)

    if (totalDebit !== totalCredit) {
      console.warn(`  ⚠️ Facture ${inv.invoiceNumber} non équilibrée (D=${totalDebit}, C=${totalCredit}) — skipping`)
      continue
    }

    const entry = await db.journalEntry.create({
      data: {
        schoolId: inv.schoolId,
        entryNumber,
        journalId: journal.id,
        entryDate: inv.issueDate,
        accountingPeriod: period,
        description: `Facture ${inv.invoiceNumber}`,
        referenceType: 'INVOICE',
        referenceId: inv.id,
        status: 'POSTED',
        totalDebit,
        totalCredit,
        isBalanced: true,
        postedAt: inv.issueDate,
        lines: {
          create: entryLines.map((line) => ({
            accountId: accountMap.get(line.accountNumber)!,
            debit: line.side === 'DEBIT' ? line.amountCents : 0,
            credit: line.side === 'CREDIT' ? line.amountCents : 0,
            description: line.description,
            analyticalActivity: line.analyticalActivity,
          })),
        },
      },
    })

    await db.invoice.update({
      where: { id: inv.id },
      data: { accountingEntryId: entry.id },
    })
    entriesCreated++
  }
  console.log(`  ✓ ${entriesCreated} écriture(s) comptable(s) créée(s) pour les factures existantes`)

  // ============================================================
  // 5. Générer les écritures pour les paiements existants
  // ============================================================
  console.log('')
  console.log('💰 Génération des écritures pour les paiements existants...')

  const paymentsWithoutEntry = await db.payment.findMany({
    where: { accountingEntryId: null, status: 'CONFIRMED' },
    include: { invoice: true },
  })

  let paymentEntriesCreated = 0
  for (const p of paymentsWithoutEntry) {
    if (p.amountCents === 0) continue

    const treasuryAccountNumber =
      p.method === 'CASH' ? '530000' :
      p.method === 'BANK' ? '510000' :
      p.method === 'MOBILE_MONEY' ? '540000' : '510000'

    const period = p.paidAt.toISOString().slice(0, 7)
    const entryCount = await db.journalEntry.count({
      where: { schoolId: p.schoolId, accountingPeriod: period },
    })
    const entryNumber = `E${period}-${String(entryCount + 1).padStart(5, '0')}`

    const journalCode = p.method === 'BANK' ? 'BQ' : 'CAIS'
    const journal = await db.accountingJournal.findUnique({
      where: { schoolId_code: { schoolId: p.schoolId, code: journalCode } },
    })
    if (!journal) continue

    const accounts = await db.chartOfAccount.findMany({
      where: { schoolId: p.schoolId, accountNumber: { in: [treasuryAccountNumber, '411001'] } },
    })
    const treasuryAcc = accounts.find((a) => a.accountNumber === treasuryAccountNumber)
    const customerAcc = accounts.find((a) => a.accountNumber === '411001')
    if (!treasuryAcc || !customerAcc) continue

    const entry = await db.journalEntry.create({
      data: {
        schoolId: p.schoolId,
        entryNumber,
        journalId: journal.id,
        entryDate: p.paidAt,
        accountingPeriod: period,
        description: `Encaissement ${p.receiptNumber}`,
        referenceType: 'PAYMENT',
        referenceId: p.id,
        status: 'POSTED',
        totalDebit: p.amountCents,
        totalCredit: p.amountCents,
        isBalanced: true,
        postedAt: p.paidAt,
        lines: {
          create: [
            {
              accountId: treasuryAcc.id,
              debit: p.amountCents,
              credit: 0,
              description: `Encaissement (${p.method})`,
            },
            {
              accountId: customerAcc.id,
              debit: 0,
              credit: p.amountCents,
              description: 'Solde client',
            },
          ],
        },
      },
    })

    await db.payment.update({
      where: { id: p.id },
      data: { accountingEntryId: entry.id },
    })
    paymentEntriesCreated++
  }
  console.log(`  ✓ ${paymentEntriesCreated} écriture(s) de paiement créée(s)`)

  // ============================================================
  // Résumé final
  // ============================================================
  console.log('')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  RÉCAPITULATIF COMPTABLE')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`  Plan comptable : ${totalAccounts} comptes`)
  console.log(`  Journaux : ${totalJournals} journaux`)
  console.log(`  Factures migrées : ${invoicesMigrated}`)
  console.log(`  Lignes migrées : ${migrated}`)
  console.log(`  Paiements migrés : ${paymentsMigrated}`)
  console.log(`  Écritures factures : ${entriesCreated}`)
  console.log(`  Écritures paiements : ${paymentEntriesCreated}`)
  console.log('═══════════════════════════════════════════════════════════════')
}

main()
  .then(() => {
    console.log('Fin du seed comptable.')
    process.exit(0)
  })
  .catch((e) => {
    console.error('Erreur lors du seed comptable:', e)
    process.exit(1)
  })
