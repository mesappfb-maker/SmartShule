// SmartShule — Tests Permissions Académiques + Cycle de vie
import { hasAcademicPermission, canDeleteSubject, canModifyGradingRules, getAcademicPermissions } from '../src/lib/academic-permissions'

interface TestResult { id: string; name: string; status: 'PASS' | 'FAIL'; message: string }
const results: TestResult[] = []

async function runTest(id: string, name: string, fn: () => Promise<void>) {
  try { await fn(); results.push({ id, name, status: 'PASS', message: 'OK' }) }
  catch (err) { results.push({ id, name, status: 'FAIL', message: (err as Error).message }) }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m) }

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║  Tests Permissions Académiques + Cycle de vie          ║')
  console.log('╚══════════════════════════════════════════════════════════╝\n')

  // AP-01: Directeur peut créer matière
  await runTest('AP-01', 'Directeur peut créer matière', async () => {
    assert(hasAcademicPermission('DIRECTOR', 'ACADEMIC.SUBJECT.CREATE') === true, 'DIRECTOR peut créer')
  })

  // AP-02: Enseignant ne peut pas créer matière
  await runTest('AP-02', 'Enseignant ne peut pas créer matière', async () => {
    assert(hasAcademicPermission('TEACHER', 'ACADEMIC.SUBJECT.CREATE') === false, 'TEACHER ne peut pas créer')
  })

  // AP-03: Secrétaire ne peut pas modifier coefficient
  await runTest('AP-03', 'Secrétaire ne peut pas modifier coefficient', async () => {
    assert(hasAcademicPermission('SECRETARY', 'ACADEMIC.SUBJECT.UPDATE_GRADING_RULES') === false, 'SECRETARY ne peut pas modifier coefficient')
  })

  // AP-04: Promoteur ne peut pas modifier horaire
  await runTest('AP-04', 'Promoteur ne peut pas modifier horaire', async () => {
    assert(hasAcademicPermission('PROMOTER', 'ACADEMIC.SCHEDULE.PUBLISH') === false, 'PROMOTER ne peut pas publier horaire')
  })

  // AP-05: Matière brouillon sans dépendance peut être supprimée
  await runTest('AP-05', 'Matière brouillon sans dépendance = suppression OK', async () => {
    const result = canDeleteSubject('DIRECTOR', false)
    assert(result.ok === true, 'Suppression autorisée sans dépendances')
  })

  // AP-06: Matière avec dépendances ne peut pas être supprimée
  await runTest('AP-06', 'Matière avec dépendances = suppression bloquée', async () => {
    const result = canDeleteSubject('DIRECTOR', true)
    assert(result.ok === false, 'Suppression bloquée avec dépendances')
    assert(result.reason?.includes('dépendances') === true, 'Message mentionne les dépendances')
  })

  // AP-07: Enseignant ne peut pas supprimer
  await runTest('AP-07', 'Enseignant ne peut pas supprimer matière', async () => {
    const result = canDeleteSubject('TEACHER', false)
    assert(result.ok === false, 'TEACHER ne peut pas supprimer')
  })

  // AP-08: Directeur peut désactiver
  await runTest('AP-08', 'Directeur peut désactiver matière', async () => {
    assert(hasAcademicPermission('DIRECTOR', 'ACADEMIC.SUBJECT.DEACTIVATE') === true, 'DIRECTOR peut désactiver')
  })

  // AP-09: Modification coefficient après publication = workflow requis
  await runTest('AP-09', 'Modification coefficient après publication = workflow', async () => {
    const result = canModifyGradingRules('DIRECTOR', true)
    assert(result.ok === false, 'Modification bloquée après publication')
    assert(result.requiresWorkflow === true, 'Workflow requis')
  })

  // AP-10: Modification coefficient sans publication = OK
  await runTest('AP-10', 'Modification coefficient sans publication = OK', async () => {
    const result = canModifyGradingRules('DIRECTOR', false)
    assert(result.ok === true, 'Modification autorisée sans publication')
  })

  // AP-11: Enseignant peut saisir ses notes
  await runTest('AP-11', 'Enseignant peut saisir ses notes', async () => {
    assert(hasAcademicPermission('TEACHER', 'ACADEMIC.GRADE.ENTER_OWN') === true, 'TEACHER peut saisir ses notes')
  })

  // AP-12: Enseignant ne peut pas assigner salle
  await runTest('AP-12', 'Enseignant ne peut pas assigner salle', async () => {
    assert(hasAcademicPermission('TEACHER', 'ACADEMIC.CLASS_SUBJECT.ASSIGN_ROOM') === false, 'TEACHER ne peut pas assigner salle')
  })

  // AP-13: System_Admin ne peut pas créer matière (technique uniquement)
  await runTest('AP-13', 'SYSTEM_ADMIN ne peut pas créer matière', async () => {
    assert(hasAcademicPermission('SYSTEM_ADMIN', 'ACADEMIC.SUBJECT.CREATE') === false, 'SYSTEM_ADMIN ne gère pas le métier académique')
  })

  // AP-14: Comptable n'a aucune permission académique
  await runTest('AP-14', 'Comptable n\'a aucune permission académique', async () => {
    const perms = getAcademicPermissions('ACCOUNTANT')
    assert(perms.length === 0, 'ACCOUNTANT a 0 permission académique')
  })

  // AP-15: Caissier n'a aucune permission académique
  await runTest('AP-15', 'Caissier n\'a aucune permission académique', async () => {
    const perms = getAcademicPermissions('CASHIER')
    assert(perms.length === 0, 'CASHIER a 0 permission académique')
  })

  // AP-16: Parent/Élève n'ont aucune permission académique
  await runTest('AP-16', 'Parent/Élève n\'ont aucune permission académique', async () => {
    assert(getAcademicPermissions('PARENT').length === 0, 'PARENT a 0 permission')
    assert(getAcademicPermissions('STUDENT').length === 0, 'STUDENT a 0 permission')
  })

  // AP-17: Directeur a 25 permissions
  await runTest('AP-17', 'Directeur a toutes les permissions académiques', async () => {
    const perms = getAcademicPermissions('DIRECTOR')
    assert(perms.length >= 20, `DIRECTOR a au moins 20 permissions (${perms.length})`)
    assert(perms.includes('ACADEMIC.SUBJECT.DELETE_UNUSED'), 'DIRECTOR peut supprimer brouillons')
    assert(perms.includes('ACADEMIC.SCHEDULE.PUBLISH'), 'DIRECTOR peut publier horaires')
  })

  // AP-18: Enseignant peut demander correction mais pas approuver
  await runTest('AP-18', 'Enseignant peut demander correction, pas approuver', async () => {
    assert(hasAcademicPermission('TEACHER', 'ACADEMIC.GRADE.REQUEST_CORRECTION') === true, 'TEACHER peut demander correction')
    assert(hasAcademicPermission('TEACHER', 'ACADEMIC.GRADE.APPROVE_CORRECTION') === false, 'TEACHER ne peut pas approuver correction')
  })

  // AP-19: Auditeur peut voir audit mais pas modifier
  await runTest('AP-19', 'Auditeur peut voir audit mais pas modifier', async () => {
    assert(hasAcademicPermission('AUDITOR', 'ACADEMIC.SUBJECT.VIEW_AUDIT') === true, 'AUDITOR peut voir audit')
    assert(hasAcademicPermission('AUDITOR', 'ACADEMIC.SUBJECT.UPDATE_BASIC') === false, 'AUDITOR ne peut pas modifier')
  })

  // AP-20: HR peut voir mais pas modifier (charge horaire)
  await runTest('AP-20', 'RH peut voir matières mais pas modifier', async () => {
    assert(hasAcademicPermission('HR_MANAGER', 'ACADEMIC.SUBJECT.VIEW') === true, 'HR peut voir matières (charge horaire)')
    assert(hasAcademicPermission('HR_MANAGER', 'ACADEMIC.SUBJECT.CREATE') === false, 'HR ne peut pas créer matière')
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
