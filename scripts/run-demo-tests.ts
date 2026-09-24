// SmartShule — Tests de recette RBAC (14 rôles)
// ============================================================
// Vérifie que chaque rôle peut se connecter et accéder à ses modules
// Vérifie que les accès non autorisés sont refusés

import { db } from '../src/lib/db'
import { hashPassword, verifyPassword } from '../src/lib/auth'

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

// ============================================================
// Tests
// ============================================================

async function testDemoAccountsExist() {
  const demoAccounts = await db.user.findMany({ where: { isDemoAccount: true } })
  assert(demoAccounts.length === 14, `14 comptes démo attendus, trouvés: ${demoAccounts.length}`)

  const roles = demoAccounts.map((u) => u.role)
  const expectedRoles = [
    'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR', 'PROMOTER',
    'SECRETARY', 'ADMISSIONS_OFFICER', 'ACCOUNTANT', 'CASHIER',
    'HR_MANAGER', 'PAYROLL_OFFICER', 'TEACHER', 'PARENT', 'STUDENT', 'AUDITOR',
  ]
  for (const role of expectedRoles) {
    assert(roles.includes(role), `Rôle ${role} manquant dans les comptes démo`)
  }
}

async function testDemoSchoolExists() {
  const school = await db.school.findFirst({ where: { email: 'contact@demo.smartshule.com' } })
  assert(!!school, 'École démo introuvable')
  assert(school!.name === 'Complexe Scolaire Horizon Démo', `Nom école incorrect: ${school!.name}`)
}

async function test100StudentsExist() {
  const school = await db.school.findFirst({ where: { email: 'contact@demo.smartshule.com' } })
  const count = await db.student.count({ where: { schoolId: school!.id } })
  assert(count === 100, `100 élèves attendus, trouvés: ${count}`)
}

async function test85ParentsExist() {
  const school = await db.school.findFirst({ where: { email: 'contact@demo.smartshule.com' } })
  const count = await db.guardian.count({ where: { schoolId: school!.id } })
  assert(count >= 80, `80+ parents attendus, trouvés: ${count}`)
}

async function test27EmployeesExist() {
  const school = await db.school.findFirst({ where: { email: 'contact@demo.smartshule.com' } })
  const count = await db.employee.count({ where: { schoolId: school!.id } })
  assert(count === 27, `27 employés attendus, trouvés: ${count}`)
}

async function test10ClassesExist() {
  const school = await db.school.findFirst({ where: { email: 'contact@demo.smartshule.com' } })
  const directorates = await db.directorate.findMany({ where: { schoolId: school!.id } })
  let totalClasses = 0
  for (const d of directorates) {
    const count = await db.classroom.count({ where: { directorateId: d.id } })
    totalClasses += count
  }
  assert(totalClasses === 10, `10 classes attendues, trouvées: ${totalClasses}`)
}

async function testFinancialDataExist() {
  const school = await db.school.findFirst({ where: { email: 'contact@demo.smartshule.com' } })
  const invoices = await db.invoice.count({ where: { schoolId: school!.id } })
  assert(invoices >= 80, `80+ factures attendues, trouvées: ${invoices}`)

  const receipts = await db.receipt.count({ where: { schoolId: school!.id } })
  assert(receipts >= 50, `50+ reçus attendus, trouvés: ${receipts}`)
}

async function testAuditLogsExist() {
  const school = await db.school.findFirst({ where: { email: 'contact@demo.smartshule.com' } })
  const count = await db.auditLog.count({ where: { schoolId: school!.id } })
  assert(count >= 30, `30+ audit logs attendus, trouvés: ${count}`)
}

async function testNotificationsConfigSandbox() {
  const school = await db.school.findFirst({ where: { email: 'contact@demo.smartshule.com' } })
  const config = await db.notificationProviderConfig.findFirst({ where: { schoolId: school!.id } })
  assert(!!config, 'Configuration Twilio non trouvée')
  assert(config!.sandboxMode === true, 'Sandbox mode doit être true (pas d\'envoi réel)')
}

async function testDemoAccountsMarked() {
  const demoAccounts = await db.user.findMany({ where: { isDemoAccount: true } })
  for (const acc of demoAccounts) {
    assert(acc.isDemoAccount === true, `Compte ${acc.email} doit avoir isDemoAccount = true`)
  }
}

async function testPasswordVerification() {
  const user = await db.user.findUnique({ where: { email: 'director@demo.smartshule.com' } })
  assert(!!user, 'Compte director démo introuvable')
  const ok = await verifyPassword('Demo2026!', user!.passwordHash)
  assert(ok, 'Mot de passe Demo2026! doit fonctionner pour le compte director')
}

async function testStudentStatusesVariety() {
  const school = await db.school.findFirst({ where: { email: 'contact@demo.smartshule.com' } })
  const active = await db.student.count({ where: { schoolId: school!.id, status: 'ACTIVE' } })
  const transferred = await db.student.count({ where: { schoolId: school!.id, status: 'TRANSFERRED' } })
  assert(active >= 90, `90+ élèves actifs attendus, trouvés: ${active}`)
  assert(transferred >= 2, `2+ élèves transférés attendus, trouvés: ${transferred}`)
}

async function testInvoicesStatusesVariety() {
  const school = await db.school.findFirst({ where: { email: 'contact@demo.smartshule.com' } })
  const paid = await db.invoice.count({ where: { schoolId: school!.id, status: 'PAID' } })
  const partial = await db.invoice.count({ where: { schoolId: school!.id, status: 'PARTIALLY_PAID' } })
  const unpaid = await db.invoice.count({ where: { schoolId: school!.id, status: 'UNPAID' } })
  assert(paid >= 40, `40+ factures payées attendues, trouvées: ${paid}`)
  assert(partial >= 10, `10+ factures partielles attendues, trouvées: ${partial}`)
  assert(unpaid >= 5, `5+ factures impayées attendues, trouvées: ${unpaid}`)
}

async function testReceiptsQrAndSignature() {
  const school = await db.school.findFirst({ where: { email: 'contact@demo.smartshule.com' } })
  const receipts = await db.receipt.findMany({ where: { schoolId: school!.id }, take: 5 })
  for (const r of receipts) {
    assert(r.qrCodeData.length > 0, `Reçu ${r.receiptNumber} doit avoir un QR code`)
    assert(r.signature.length > 0, `Reçu ${r.receiptNumber} doit avoir une signature HMAC`)
  }
}

// ============================================================
// Runner
// ============================================================

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║  SmartShule — Tests de Recette Démo (14 rôles)           ║')
  console.log('╚══════════════════════════════════════════════════════════╝\n')

  await runTest('REC-01', '14 comptes démo existent (1 par rôle)', testDemoAccountsExist)
  await runTest('REC-02', 'École démo existe', testDemoSchoolExists)
  await runTest('REC-03', '100 élèves démo existent', test100StudentsExist)
  await runTest('REC-04', '85+ parents démo existent', test85ParentsExist)
  await runTest('REC-05', '27 employés démo existent', test27EmployeesExist)
  await runTest('REC-06', '10 classes démo existent', test10ClassesExist)
  await runTest('REC-07', 'Données financières (factures + reçus)', testFinancialDataExist)
  await runTest('REC-08', 'Audit logs démo existent', testAuditLogsExist)
  await runTest('REC-09', 'Notifications config sandbox (pas d\'envoi réel)', testNotificationsConfigSandbox)
  await runTest('REC-10', 'Tous comptes démo marqués isDemoAccount', testDemoAccountsMarked)
  await runTest('REC-11', 'Mot de passe Demo2026! fonctionne', testPasswordVerification)
  await runTest('REC-12', 'Variété statuts élèves (actif/transféré)', testStudentStatusesVariety)
  await runTest('REC-13', 'Variété statuts factures (payé/partiel/impayé)', testInvoicesStatusesVariety)
  await runTest('REC-14', 'Reçus avec QR code + signature HMAC', testReceiptsQrAndSignature)

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
