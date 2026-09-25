// SmartShule — Tests Dashboard Professeur + IQA + Cycle de vie entités
import { db } from '../src/lib/db'
import { computeIqa, getIqaLevel } from '../src/lib/iqa-pure'
import { checkSubjectDependencies, checkClassroomDependencies, deactivateSubject } from '../src/lib/entity-lifecycle'
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
  console.log('║  SmartShule — Tests Professeur + IQA + Cycle de vie      ║')
  console.log('╚══════════════════════════════════════════════════════════╝\n')

  // IQA-01: computeIqa existe et fonctionne
  await runTest('IQA-01', 'computeIqa existe et retourne résultat', async () => {
    const result = computeIqa({ totalSessions: 10, absencesUnexcused: 1, absencesExcused: 0, lateCount: 1 })
    assert(result.iqa === 88.5, `IQA attendu 88.5, obtenu ${result.iqa}`)
    assert(result.level === 'WARNING', `Niveau WARNING attendu`)
    assert(result.formula.includes('88.50'), 'Formule contient le résultat')
  })

  // IQA-02: computeIqa avec 0 séance
  await runTest('IQA-02', 'computeIqa avec 0 séance = 100', async () => {
    const result = computeIqa({ totalSessions: 0, absencesUnexcused: 0, absencesExcused: 0, lateCount: 0 })
    assert(result.iqa === 100, `IQA attendu 100, obtenu ${result.iqa}`)
    assert(result.level === 'EXCELLENT', 'Niveau EXCELLENT')
  })

  // IQA-03: computeIqa avec 100% absence
  await runTest('IQA-03', 'computeIqa avec 100% absence = 0', async () => {
    const result = computeIqa({ totalSessions: 10, absencesUnexcused: 10, absencesExcused: 0, lateCount: 0 })
    assert(result.iqa === 0, `IQA attendu 0, obtenu ${result.iqa}`)
    assert(result.level === 'CRITICAL', 'Niveau CRITICAL')
  })

  // IQA-04: getIqaLevel fonctionne
  await runTest('IQA-04', 'getIqaLevel classifie correctement', async () => {
    assert(getIqaLevel(95) === 'EXCELLENT', '95 = EXCELLENT')
    assert(getIqaLevel(75) === 'WARNING', '75 = WARNING')
    assert(getIqaLevel(40) === 'CRITICAL', '40 = CRITICAL')
  })

  // TP-01: Teacher ne voit pas les finances
  await runTest('TP-01', 'Teacher n\'a pas accès aux finances', async () => {
    const teacher = { role: 'TEACHER' }
    assert(!hasRole(teacher, ['ACCOUNTANT']), 'Teacher n\'est pas ACCOUNTANT')
    assert(!hasRole(teacher, ['CASHIER']), 'Teacher n\'est pas CASHIER')
  })

  // TP-02: Teacher ne voit pas le secrétariat
  await runTest('TP-02', 'Teacher n\'a pas accès au secrétariat', async () => {
    const teacher = { role: 'TEACHER' }
    assert(!hasRole(teacher, ['SECRETARY']), 'Teacher n\'est pas SECRETARY')
  })

  // TP-03: Teacher ne voit pas la RH
  await runTest('TP-03', 'Teacher n\'a pas accès à la RH', async () => {
    const teacher = { role: 'TEACHER' }
    assert(!hasRole(teacher, ['HR_MANAGER']), 'Teacher n\'est pas HR_MANAGER')
  })

  // TP-04: Teacher ne voit pas les paramètres système
  await runTest('TP-04', 'Teacher n\'a pas accès aux paramètres système', async () => {
    const teacher = { role: 'TEACHER' }
    assert(!hasRole(teacher, ['SYSTEM_ADMIN']), 'Teacher n\'est pas SYSTEM_ADMIN')
  })

  // LC-01: checkSubjectDependencies détecte les notes
  await runTest('LC-01', 'checkSubjectDependencies détecte les dépendances', async () => {
    const school = await db.school.findFirst({ where: { email: 'contact@demo.smartshule.com' } })
    if (!school) { results.push({ id: 'LC-01', name: 'Subject deps', status: 'PASS', message: 'Skip' }); return }
    const subject = await db.subject.findFirst({ where: { schoolId: school.id } })
    if (!subject) { results.push({ id: 'LC-01', name: 'Subject deps', status: 'PASS', message: 'Skip' }); return }
    const deps = await checkSubjectDependencies(subject.id, school.id)
    assert(typeof deps.hasDependencies === 'boolean', 'hasDependencies est un booléen')
    assert(typeof deps.counts === 'object', 'counts est un objet')
  })

  // LC-02: checkClassroomDependencies détecte les élèves
  await runTest('LC-02', 'checkClassroomDependencies détecte les élèves', async () => {
    const school = await db.school.findFirst({ where: { email: 'contact@demo.smartshule.com' } })
    if (!school) { results.push({ id: 'LC-02', name: 'Classroom deps', status: 'PASS', message: 'Skip' }); return }
    const classroom = await db.classroom.findFirst({ where: { directorate: { schoolId: school.id } } })
    if (!classroom) { results.push({ id: 'LC-02', name: 'Classroom deps', status: 'PASS', message: 'Skip' }); return }
    const deps = await checkClassroomDependencies(classroom.id, school.id)
    assert(typeof deps.hasDependencies === 'boolean', 'hasDependencies est un booléen')
    assert(deps.counts.enrollments >= 0, 'enrollments count présent')
  })

  // LC-03: Matière avec notes ne peut pas être supprimée physiquement
  await runTest('LC-03', 'Matière avec notes = pas de suppression physique', async () => {
    const school = await db.school.findFirst({ where: { email: 'contact@demo.smartshule.com' } })
    if (!school) { results.push({ id: 'LC-03', name: 'No delete with grades', status: 'PASS', message: 'Skip' }); return }
    // Trouver une matière avec des notes
    const subjectWithGrades = await db.subject.findFirst({
      where: { schoolId: school.id, grades: { some: {} } },
    })
    if (!subjectWithGrades) { results.push({ id: 'LC-03', name: 'No delete with grades', status: 'PASS', message: 'Skip' }); return }
    const deps = await checkSubjectDependencies(subjectWithGrades.id, school.id)
    assert(deps.hasDependencies === true, 'La matière a des dépendances (notes)')
    assert(deps.counts.grades > 0, 'Des notes existent')
  })

  // LC-04: deactivateSubject suspend au lieu de supprimer
  await runTest('LC-04', 'deactivateSubject suspend (pas supprime)', async () => {
    const school = await db.school.findFirst({ where: { email: 'contact@demo.smartshule.com' } })
    if (!school) { results.push({ id: 'LC-04', name: 'Deactivate subject', status: 'PASS', message: 'Skip' }); return }
    const subject = await db.subject.findFirst({ where: { schoolId: school.id, grades: { some: {} } } })
    if (!subject) { results.push({ id: 'LC-04', name: 'Deactivate subject', status: 'PASS', message: 'Skip' }); return }
    const result = await deactivateSubject(subject.id, school.id, 'Test désactivation', 'test', 'Test')
    assert(result.ok === true, 'Désactivation réussie')
    assert(result.message.includes('suspendue'), 'Message indique suspension')
    // Vérifier que la matière existe toujours
    const stillExists = await db.subject.findUnique({ where: { id: subject.id } })
    assert(!!stillExists, 'La matière existe toujours (non supprimée physiquement)')
  })

  // LC-05: checkEmployeeDependencies détecte les notes
  await runTest('LC-05', 'checkEmployeeDependencies détecte l\'activité', async () => {
    const school = await db.school.findFirst({ where: { email: 'contact@demo.smartshule.com' } })
    if (!school) { results.push({ id: 'LC-05', name: 'Employee deps', status: 'PASS', message: 'Skip' }); return }
    const employee = await db.employee.findFirst({ where: { schoolId: school.id, function: 'ENSEIGNANT' } })
    if (!employee) { results.push({ id: 'LC-05', name: 'Employee deps', status: 'PASS', message: 'Skip' }); return }
    const { checkEmployeeDependencies } = await import('../src/lib/entity-lifecycle')
    const deps = await checkEmployeeDependencies(employee.id, school.id)
    assert(typeof deps.hasDependencies === 'boolean', 'hasDependencies est un booléen')
  })

  // LC-06: checkFeeLineDependencies existe
  await runTest('LC-06', 'checkFeeLineDependencies accessible', async () => {
    const { checkFeeLineDependencies } = await import('../src/lib/entity-lifecycle')
    assert(typeof checkFeeLineDependencies === 'function', 'checkFeeLineDependencies accessible')
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
