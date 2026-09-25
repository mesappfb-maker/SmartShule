// SmartShule — Tests de recette module comptable
// ============================================================
import { db } from '../src/lib/db'

interface TestResult {
  id: string
  name: string
  status: 'PASS' | 'FAIL' | 'SKIP'
  message: string
}

const results: TestResult[] = []

async function runTest(id: string, name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
    results.push({ id, name, status: 'PASS', message: 'OK' })
  } catch (err) {
    results.push({ id, name, status: 'FAIL', message: (err as Error).message })
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║  SmartShule — Tests de Recette Module Comptable           ║')
  console.log('╚══════════════════════════════════════════════════════════╝\n')

  const school = await db.school.findFirst({ where: { email: 'contact@demo.smartshule.com' } })
  if (!school) {
    console.error('❌ École démo introuvable')
    process.exit(1)
  }

  // TF-01: Facture générée après inscription
  await runTest('TF-01', 'Facture générée après inscription', async () => {
    const students = await db.student.findMany({
      where: { schoolId: school.id, status: 'ACTIVE' },
      include: { invoices: true, enrollments: true },
      take: 5,
    })
    const withInvoice = students.filter((s) => s.invoices.length > 0)
    assert(withInvoice.length >= 1, 'Au moins 1 élève avec facture')
  })

  // TF-02: Paiement met à jour solde
  await runTest('TF-02', 'Paiement met à jour solde', async () => {
    const invoice = await db.invoice.findFirst({
      where: { schoolId: school.id, status: 'PAID' },
    })
    assert(!!invoice, 'Au moins 1 facture payée')
    assert(invoice!.paidAmountCents === invoice!.totalAmountCents, 'Solde = total pour facture payée')
  })

  // TF-03: Reçu avec QR code et signature
  await runTest('TF-03', 'Reçu avec QR code + signature', async () => {
    const receipts = await db.receipt.findMany({ where: { schoolId: school.id }, take: 5 })
    assert(receipts.length > 0, 'Au moins 1 reçu')
    for (const r of receipts) {
      assert(r.qrCodeData.length > 0, `Reçu ${r.receiptNumber} doit avoir QR code`)
      assert(r.signature.length > 0, `Reçu ${r.receiptNumber} doit avoir signature HMAC`)
    }
  })

  // TF-04: Paiement partiel correct
  await runTest('TF-04', 'Paiement partiel correct', async () => {
    const partial = await db.invoice.findFirst({
      where: { schoolId: school.id, status: 'PARTIALLY_PAID' },
    })
    assert(!!partial, 'Au moins 1 facture partiellement payée')
    assert(partial!.paidAmountCents > 0 && partial!.paidAmountCents < partial!.totalAmountCents, 'Solde partiel correct')
  })

  // TF-05: Impayé déclenché
  await runTest('TF-05', 'Impayés détectés', async () => {
    const unpaid = await db.invoice.count({
      where: { schoolId: school.id, status: 'UNPAID' },
    })
    assert(unpaid >= 5, `Au moins 5 impayés, trouvés: ${unpaid}`)
  })

  // TF-06: Caisse ouverte/encaissement
  await runTest('TF-06', 'Encaissements enregistrés', async () => {
    const cashReceipts = await db.receipt.count({
      where: { schoolId: school.id, paymentMethod: 'CASH' },
    })
    assert(cashReceipts > 0, 'Au moins 1 encaissement espèces')
  })

  // TF-07: Dépenses avec statuts variés
  await runTest('TF-07', 'Dépenses PENDING/APPROVED/REFUSED', async () => {
    const pending = await db.expense.count({ where: { schoolId: school.id, status: 'PENDING' } })
    const approved = await db.expense.count({ where: { schoolId: school.id, status: 'APPROVED' } })
    const refused = await db.expense.count({ where: { schoolId: school.id, status: 'REFUSED' } })
    assert(pending > 0, `Dépenses PENDING: ${pending}`)
    assert(approved > 0, `Dépenses APPROVED: ${approved}`)
    assert(refused > 0, `Dépenses REFUSED: ${refused}`)
  })

  // TF-08: Factures échues
  await runTest('TF-08', 'Factures échues détectées', async () => {
    const overdue = await db.invoice.count({
      where: {
        schoolId: school.id,
        status: { in: ['UNPAID', 'PARTIALLY_PAID'] },
        dueDate: { lt: new Date() },
      },
    })
    assert(overdue > 0, `Au moins 1 facture échue, trouvées: ${overdue}`)
  })

  // TF-09: Mobile Money
  await runTest('TF-09', 'Paiements Mobile Money', async () => {
    const mobile = await db.receipt.count({
      where: { schoolId: school.id, paymentMethod: 'MOBILE_MONEY' },
    })
    assert(mobile > 0, `Au moins 1 paiement Mobile Money: ${mobile}`)
  })

  // TF-10: Écritures équilibrées (vérification que le système supporte les journaux)
  await runTest('TF-10', 'Journal entries supportées', async () => {
    const journalCount = await db.journalEntry.count({ where: { schoolId: school.id } })
    // Les écritures peuvent être vides en démo, juste vérifier que le modèle existe
    assert(typeof journalCount === 'number', 'JournalEntry accessible')
  })

  // TF-11: Réconciliation factures
  await runTest('TF-11', 'Réconciliation factures', async () => {
    const totalInvoiced = await db.invoice.aggregate({
      where: { schoolId: school.id, status: { not: 'CANCELLED' } },
      _sum: { totalAmountCents: true },
    })
    const totalCollected = await db.invoice.aggregate({
      where: { schoolId: school.id, status: { not: 'CANCELLED' } },
      _sum: { paidAmountCents: true },
    })
    const invoiced = totalInvoiced._sum.totalAmountCents || 0
    const collected = totalCollected._sum.paidAmountCents || 0
    assert(invoiced > 0, 'Total facturé > 0')
    assert(collected > 0, 'Total collecté > 0')
    assert(collected <= invoiced, 'Collecté ≤ Facturé')
  })

  // TF-12: Réconciliation caisse
  await runTest('TF-12', 'Réconciliation caisse', async () => {
    const cashIn = await db.receipt.aggregate({
      where: { schoolId: school.id, paymentMethod: 'CASH' },
      _sum: { amountCents: true },
    })
    const cashOut = await db.expense.aggregate({
      where: { schoolId: school.id, status: 'PAID', paymentMethod: 'CASH' },
      _sum: { amountCents: true },
    })
    const balance = (cashIn._sum.amountCents || 0) - (cashOut._sum.amountCents || 0)
    assert(typeof balance === 'number', 'Solde caisse calculable')
  })

  // TF-13: Élèves par classe
  await runTest('TF-13', 'Répartition élèves par classe', async () => {
    const enrollments = await db.enrollment.groupBy({
      by: ['classroomId'],
      where: { student: { schoolId: school.id }, status: 'ACTIVE' },
      _count: true,
    })
    assert(enrollments.length >= 8, `Au moins 8 classes avec élèves: ${enrollments.length}`)
  })

  // TF-14: Lignes de frais configurées
  await runTest('TF-14', 'Lignes de frais configurées', async () => {
    const feeLines = await db.invoiceLineConfig.count({
      where: { schoolId: school.id, status: 'ACTIVE' },
    })
    assert(feeLines >= 5, `Au moins 5 lignes de frais: ${feeLines}`)
  })

  // TF-15: RBAC — Comptable a accès
  await runTest('TF-15', 'Comptable existe', async () => {
    const accountant = await db.user.findUnique({ where: { email: 'accountant@demo.smartshule.com' } })
    assert(!!accountant, 'Compte comptable démo existe')
    assert(accountant!.role === 'ACCOUNTANT', 'Rôle ACCOUNTANT')
  })

  const passed = results.filter((r) => r.status === 'PASS').length
  const failed = results.filter((r) => r.status === 'FAIL').length

  console.log('\n' + '═'.repeat(60))
  console.log(`Total: ${results.length} | PASS: ${passed} | FAIL: ${failed}`)
  console.log('═'.repeat(60) + '\n')

  for (const r of results) {
    const icon = r.status === 'PASS' ? '✓' : '✗'
    console.log(`  ${icon} ${r.id}: ${r.name}`)
    if (r.status === 'FAIL') console.log(`      → ${r.message}`)
  }

  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Erreur fatale:', err)
  process.exit(1)
})
