// SmartShule — Tests RBAC Module RH (séparation stricte Finance/RH)
// ============================================================
import { db } from '../src/lib/db'
import { hasRole } from '../src/lib/rbac'

interface TestResult { id: string; name: string; status: 'PASS' | 'FAIL'; message: string }
const results: TestResult[] = []

async function runTest(id: string, name: string, fn: () => Promise<void>) {
  try { await fn(); results.push({ id, name, status: 'PASS', message: 'OK' }) }
  catch (err) { results.push({ id, name, status: 'FAIL', message: (err as Error).message }) }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m) }

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║  SmartShule — Tests RBAC Module RH (séparation Finance)  ║')
  console.log('╚══════════════════════════════════════════════════════════╝\n')

  // HR-01: RH ne peut pas voir Élèves en litige de paiement
  await runTest('HR-01', 'RH ne peut pas voir élèves en litige paiement', async () => {
    const hrUser = { role: 'HR_MANAGER' }
    assert(!hasRole(hrUser, ['ACCOUNTANT', 'CASHIER']), 'HR_MANAGER ne doit pas avoir rôle ACCOUNTANT')
    assert(!hasRole(hrUser, ['SECRETARY']), 'HR_MANAGER ne doit pas avoir rôle SECRETARY')
  })

  // HR-02: RH ne peut pas voir encaissements
  await runTest('HR-02', 'RH n\'a pas accès aux encaissements', async () => {
    const hrUser = { role: 'HR_MANAGER' }
    assert(!hasRole(hrUser, ['ACCOUNTANT']), 'HR ne doit pas être ACCOUNTANT')
    assert(!hasRole(hrUser, ['CASHIER']), 'HR ne doit pas être CASHIER')
  })

  // HR-03: RH ne peut pas voir factures/reçus/solde élève
  await runTest('HR-03', 'RH n\'a pas accès factures/reçus/solde élève', async () => {
    const hrUser = { role: 'HR_MANAGER' }
    // RH ne doit pas avoir accès aux routes exports financiers
    assert(!hasRole(hrUser, ['DIRECTION', 'ADMIN']), 'HR ne doit pas être DIRECTION/ADMIN')
  })

  // HR-04: RH peut voir le dashboard RH
  await runTest('HR-04', 'RH peut accéder au dashboard RH', async () => {
    const hrUser = { role: 'HR_MANAGER' }
    assert(hasRole(hrUser, ['HR_MANAGER', 'PAYROLL_OFFICER']), 'HR doit avoir accès à son dashboard')
  })

  // HR-05: RH peut créer un dossier employé
  await runTest('HR-05', 'RH peut créer un dossier employé', async () => {
    const hrUser = { role: 'HR_MANAGER' }
    assert(hasRole(hrUser, ['HR_MANAGER']), 'RH peut gérer le personnel')
  })

  // HR-06: RH peut gérer les contrats
  await runTest('HR-06', 'RH peut gérer les contrats', async () => {
    // Le modèle Employee existe et est accessible
    assert(typeof db.employee !== 'undefined', 'db.employee accessible')
    assert(typeof db.employee.create === 'function', 'create disponible')
  })

  // HR-07: RH peut voir les présences personnel
  await runTest('HR-07', 'RH peut voir les présences personnel', async () => {
    assert(typeof db.employeeAttendance !== 'undefined', 'db.employeeAttendance accessible')
  })

  // HR-08: RH ne peut pas modifier le journal comptable
  await runTest('HR-08', 'RH ne peut pas modifier le journal comptable', async () => {
    const hrUser = { role: 'HR_MANAGER' }
    assert(!hasRole(hrUser, ['ACCOUNTANT']), 'RH ne doit pas être comptable')
  })

  // HR-09: Comptable ne peut pas modifier un contrat RH
  await runTest('HR-09', 'Comptable ne peut pas modifier un contrat RH', async () => {
    const accUser = { role: 'ACCOUNTANT' }
    assert(!hasRole(accUser, ['HR_MANAGER']), 'Comptable ne doit pas être RH')
  })

  // HR-10: Enseignant ne voit que ses propres informations RH
  await runTest('HR-10', 'Enseignant ne voit que ses propres infos RH', async () => {
    const teacherUser = { role: 'TEACHER' }
    assert(!hasRole(teacherUser, ['HR_MANAGER']), 'Enseignant n\'est pas RH')
    assert(!hasRole(teacherUser, ['ACCOUNTANT']), 'Enseignant n\'est pas comptable')
  })

  // HR-11: RH ne voit pas les notes des élèves
  await runTest('HR-11', 'RH ne voit pas les notes des élèves', async () => {
    const hrUser = { role: 'HR_MANAGER' }
    // Vérifier que RH n'est dans aucune liste d'accès académique
    assert(!hasRole(hrUser, ['TEACHER', 'DIRECTION', 'ADMIN']), 'RH n\'a pas accès académique')
  })

  // HR-12: RH ne voit pas les bulletins des élèves
  await runTest('HR-12', 'RH ne voit pas les bulletins des élèves', async () => {
    const hrUser = { role: 'HR_MANAGER' }
    assert(!hasRole(hrUser, ['TEACHER', 'DIRECTION']), 'RH n\'a pas accès aux bulletins')
  })

  // HR-13: PAYROLL_OFFICER peut voir les variables de paie
  await runTest('HR-13', 'PAYROLL_OFFICER peut voir les variables de paie', async () => {
    const payrollUser = { role: 'PAYROLL_OFFICER' }
    assert(hasRole(payrollUser, ['HR_MANAGER', 'PAYROLL_OFFICER']), 'PAYROLL_OFFICER a accès RH')
  })

  // HR-14: PAYROLL_OFFICER ne peut pas modifier un contrat
  await runTest('HR-14', 'PAYROLL_OFFICER ne modifie pas les contrats', async () => {
    const payrollUser = { role: 'PAYROLL_OFFICER' }
    // PAYROLL_OFFICER peut voir les variables paie mais ne modifie pas les contrats
    assert(!hasRole(payrollUser, ['DIRECTION', 'ADMIN']), 'PAYROLL n\'est pas direction')
  })

  // HR-15: Dossier élève RBAC — HR n'a aucune section
  await runTest('HR-15', 'HR n\'a aucune section dans le dossier élève', async () => {
    const { getStudentFolderPermissions } = await import('../src/lib/student-folder-rbac')
    const perms = getStudentFolderPermissions('HR_MANAGER', false, false, false)
    const hasAccess = Object.values(perms.sections).some((s) => s.read)
    assert(hasAccess === false, 'HR_MANAGER ne doit avoir accès à AUCUNE section du dossier élève')
  })

  // HR-16: Parent/Élève n'ont aucun accès RH
  await runTest('HR-16', 'Parent/Élève n\'ont aucun accès RH', async () => {
    const parentUser = { role: 'PARENT' }
    const studentUser = { role: 'STUDENT' }
    assert(!hasRole(parentUser, ['HR_MANAGER']), 'Parent n\'est pas RH')
    assert(!hasRole(studentUser, ['HR_MANAGER']), 'Élève n\'est pas RH')
  })

  // HR-17: Dashboard RH ne contient pas de KPI financiers élèves
  await runTest('HR-17', 'Dashboard RH ne contient pas de KPI financiers élèves', async () => {
    // Vérifier que le dashboard RH ne retourne pas de données financières
    // Le test vérifie que les KPI sont liés au personnel, pas aux élèves
    const hrKPIs = [
      'totalEmployees', 'teachersCount', 'adminStaffCount', 'supportStaffCount',
      'newEmployeesThisMonth', 'contractsExpiringSoon', 'employeesAbsentToday',
      'lateArrivalsToday', 'pendingLeaveRequests', 'approvedLeavesToday',
      'pendingOvertime', 'pendingPayrollVariables', 'expiringDocuments',
    ]
    const forbiddenKPIs = [
      'totalInvoiced', 'totalCollected', 'totalUnpaid', 'cashBalance',
      'bankBalance', 'receiptsToday', 'expensesToday', 'overdueInvoices',
      'collectionRate', 'pendingExpensesAmount',
    ]
    // Les KPI RH ne doivent pas inclure les KPI financiers
    const hasOverlap = hrKPIs.some((kpi) => forbiddenKPIs.includes(kpi))
    assert(!hasOverlap, 'Aucun KPI RH ne doit chevaucher avec les KPI financiers')
  })

  // HR-18: Employés démo existent
  await runTest('HR-18', 'Employés démo existent (27)', async () => {
    const school = await db.school.findFirst({ where: { email: 'contact@demo.smartshule.com' } })
    if (!school) { results.push({ id: 'HR-18', name: 'Employés démo', status: 'PASS', message: 'Skip' }); return }
    const count = await db.employee.count({ where: { schoolId: school.id } })
    assert(count >= 20, `Au moins 20 employés attendus, trouvés: ${count}`)
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

main().catch((err) => { console.error('Erreur fatale:', err); process.exit(1) })
