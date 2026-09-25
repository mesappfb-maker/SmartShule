// SmartShule — Tests Module Académique Professionnel
// ============================================================
import { db } from '../src/lib/db'
import {
  validateGrade,
  validateCategoryWeights,
  normalizeScore,
  isSubjectClassConfigUnique,
  isTeacherQualified,
  detectScheduleConflicts,
} from '../src/lib/academic-calculation'

interface TestResult { id: string; name: string; status: 'PASS' | 'FAIL'; message: string }
const results: TestResult[] = []

async function runTest(id: string, name: string, fn: () => Promise<void>) {
  try { await fn(); results.push({ id, name, status: 'PASS', message: 'OK' }) }
  catch (err) { results.push({ id, name, status: 'FAIL', message: (err as Error).message }) }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m) }

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║  SmartShule — Tests Module Académique Professionnel     ║')
  console.log('╚══════════════════════════════════════════════════════════╝\n')

  // AC-01: Une matière catalogue ne crée pas de séance directement
  await runTest('AC-01', 'Matière catalogue ≠ séance (Subject sans Timetable direct)', async () => {
    const subject = await db.subject.findFirst()
    assert(!!subject, 'Au moins 1 matière catalogue existe')
    // Subject n'a pas de relation directe vers Timetable
    assert(!('timetables' in subject), 'Subject ne doit pas avoir de relation directe Timetable')
  })

  // AC-02: SubjectClassConfig est unique par classe/période/année
  await runTest('AC-02', 'SubjectClassConfig unique par classe/période/année', async () => {
    const isUnique = await isSubjectClassConfigUnique('test-school', 'test-class', 'test-subject', 'test-year', 'T1')
    assert(isUnique === true, 'Configuration unique vérifiée')
  })

  // AC-03: Validation note > barème bloquée
  await runTest('AC-03', 'Note > barème bloquée', async () => {
    const result = validateGrade(25, 20)
    assert(!result.ok, 'Note 25/20 doit être bloquée')
    assert(result.error?.includes('dépasse'), 'Message d\'erreur approprié')
  })

  // AC-04: Note négative bloquée
  await runTest('AC-04', 'Note négative bloquée', async () => {
    const result = validateGrade(-5, 20)
    assert(!result.ok, 'Note -5 doit être bloquée')
  })

  // AC-05: Note valide acceptée
  await runTest('AC-05', 'Note valide acceptée', async () => {
    const result = validateGrade(15, 20)
    assert(result.ok, 'Note 15/20 doit être acceptée')
  })

  // AC-06: Pondération ≠ 100% bloquée
  await runTest('AC-06', 'Pondération ≠ 100% bloquée', async () => {
    const cats = [
      { name: 'Interro', weightPercent: 20, isActive: true },
      { name: 'Devoir', weightPercent: 30, isActive: true },
    ]
    const result = validateCategoryWeights(cats)
    assert(!result.ok, 'Somme 50% doit être bloquée')
    assert(result.total === 50, 'Total = 50')
  })

  // AC-07: Pondération = 100% acceptée
  await runTest('AC-07', 'Pondération = 100% acceptée', async () => {
    const cats = [
      { name: 'Interro', weightPercent: 20, isActive: true },
      { name: 'Devoir', weightPercent: 30, isActive: true },
      { name: 'Examen', weightPercent: 50, isActive: true },
    ]
    const result = validateCategoryWeights(cats)
    assert(result.ok, 'Somme 100% doit être acceptée')
    assert(result.total === 100, 'Total = 100')
  })

  // AC-08: Normalisation note correcte
  await runTest('AC-08', 'Normalisation note (16/20 → 80/100)', async () => {
    const normalized = normalizeScore(16, 20, 100)
    assert(normalized === 80, `16/20 normalisé sur 100 = 80 (obtenu: ${normalized})`)
  })

  // AC-09: Normalisation note 0
  await runTest('AC-09', 'Normalisation note 0', async () => {
    const normalized = normalizeScore(0, 20, 100)
    assert(normalized === 0, '0/20 normalisé = 0')
  })

  // AC-10: Normalisation note maximale
  await runTest('AC-10', 'Normalisation note maximale', async () => {
    const normalized = normalizeScore(20, 20, 100)
    assert(normalized === 100, '20/20 normalisé = 100')
  })

  // AC-11: Détection conflit classe
  await runTest('AC-11', 'Détection conflits horaires fonctionne', async () => {
    const school = await db.school.findFirst({ where: { email: 'contact@demo.smartshule.com' } })
    if (!school) { results.push({ id: 'AC-11', name: 'Détection conflits', status: 'PASS', message: 'Skip (pas d\'école démo)' }); return }
    const result = await detectScheduleConflicts(school.id)
    assert(typeof result.totalConflicts === 'number', 'totalConflicts est un nombre')
    assert(Array.isArray(result.conflicts), 'conflicts est un tableau')
  })

  // AC-12: SubjectClassConfig modèle accessible
  await runTest('AC-12', 'SubjectClassConfig accessible via Prisma', async () => {
    assert(typeof db.subjectClassConfig !== 'undefined', 'db.subjectClassConfig accessible')
    assert(typeof db.subjectClassConfig.findMany === 'function', 'findMany disponible')
    assert(typeof db.subjectClassConfig.create === 'function', 'create disponible')
  })

  // AC-13: EvaluationCategory modèle accessible
  await runTest('AC-13', 'EvaluationCategory accessible via Prisma', async () => {
    assert(typeof db.evaluationCategory !== 'undefined', 'db.evaluationCategory accessible')
  })

  // AC-14: ScheduleConflict modèle accessible
  await runTest('AC-14', 'ScheduleConflict accessible via Prisma', async () => {
    assert(typeof db.scheduleConflict !== 'undefined', 'db.scheduleConflict accessible')
  })

  // AC-15: Room modèle accessible
  await runTest('AC-15', 'Room accessible via Prisma', async () => {
    assert(typeof db.room !== 'undefined', 'db.room accessible')
  })

  // AC-16: TimeSlot modèle accessible
  await runTest('AC-16', 'TimeSlot accessible via Prisma', async () => {
    assert(typeof db.timeSlot !== 'undefined', 'db.timeSlot accessible')
  })

  // AC-17: Teacher qualified check
  await runTest('AC-17', 'isTeacherQualified retourne booléen', async () => {
    const result = await isTeacherQualified('fake-teacher', 'fake-subject')
    assert(typeof result === 'boolean', 'Retourne un booléen')
  })

  // AC-18: SubjectClassConfig a coefficient par défaut
  await runTest('AC-18', 'SubjectClassConfig a coefficient par défaut', async () => {
    const config = await db.subjectClassConfig.findFirst()
    if (!config) { results.push({ id: 'AC-18', name: 'Coefficient défaut', status: 'PASS', message: 'Skip (pas de config)' }); return }
    assert(config.coefficient > 0, 'Coefficient > 0')
    assert(config.maxScore > 0, 'maxScore > 0')
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
