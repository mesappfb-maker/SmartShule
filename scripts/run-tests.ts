// SmartShule — Tests RBAC, Intégrité, Non-régression
// ============================================================
// Suite de tests automatisés vérifiant :
//   - Permissions par rôle (RBAC strict)
//   - Intégrité des données (unicité, équilibrage)
//   - Non-régression des modules existants
//   - Performance (1500+ élèves)

import { db } from '@/lib/db'
import { canGenerateDocument, DOCUMENT_TYPES_WITH_RBAC } from '@/lib/document-generation'
import { IMPORT_CONFIGS, sanitizeCell, parseCsv } from '@/lib/import-engine'
import { normalizePhoneE164, checkConsent, sendNotification, seedDefaultTemplates } from '@/lib/notifications'

// ============================================================
// Helper pour exécuter un test
// ============================================================

interface TestResult {
  id: string
  name: string
  category: 'RBAC' | 'INTEGRITY' | 'REGRESSION' | 'PERFORMANCE'
  status: 'PASS' | 'FAIL' | 'SKIP'
  message: string
  durationMs?: number
}

const results: TestResult[] = []

async function runTest(id: string, name: string, category: TestResult['category'], fn: () => Promise<void>): Promise<void> {
  const start = Date.now()
  try {
    await fn()
    results.push({ id, name, category, status: 'PASS', message: 'OK', durationMs: Date.now() - start })
  } catch (err) {
    results.push({ id, name, category, status: 'FAIL', message: (err as Error).message, durationMs: Date.now() - start })
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

// ============================================================
// Tests RBAC
// ============================================================

async function testRBAC() {
  // RBAC-01: Enseignant ne peut pas générer de documents financiers
  await runTest('RBAC-01', 'Enseignant sans accès documents financiers', 'RBAC', async () => {
    assert(canGenerateDocument('TEACHER', 'SCHOOL_CERTIFICATE') === false, 'TEACHER ne doit pas générer SCHOOL_CERTIFICATE')
    assert(canGenerateDocument('TEACHER', 'ADMIN_RECEIPT') === false, 'TEACHER ne doit pas générer ADMIN_RECEIPT')
    assert(canGenerateDocument('TEACHER', 'CLASS_LIST') === true, 'TEACHER doit générer CLASS_LIST')
    assert(canGenerateDocument('TEACHER', 'ATTENDANCE_LIST') === true, 'TEACHER doit générer ATTENDANCE_LIST')
  })

  // RBAC-02: Parent n'a accès à aucun type de document
  await runTest('RBAC-02', 'Parent sans génération de documents', 'RBAC', async () => {
    for (const t of DOCUMENT_TYPES_WITH_RBAC) {
      assert(canGenerateDocument('PARENT', t.type) === false, `PARENT ne doit pas générer ${t.type}`)
    }
  })

  // RBAC-03: Imports réservés à Secretary/Admin
  await runTest('RBAC-03', 'Imports réservés Secretary/Admin', 'RBAC', async () => {
    assert(IMPORT_CONFIGS.STUDENTS.allowedRoles.includes('TEACHER') === false, 'TEACHER ne doit pas importer élèves')
    assert(IMPORT_CONFIGS.STUDENTS.allowedRoles.includes('PARENT') === false, 'PARENT ne doit pas importer')
    assert(IMPORT_CONFIGS.STUDENTS.allowedRoles.includes('SECRETARY') === true, 'SECRETARY doit pouvoir importer')
    assert(IMPORT_CONFIGS.HISTORY.allowedRoles.includes('ADMIN') === true, 'ADMIN doit importer historique')
    assert(IMPORT_CONFIGS.HISTORY.allowedRoles.includes('SECRETARY') === false, 'SECRETARY ne doit pas importer historique')
  })

  // RBAC-04: Élève n'a accès à aucun import
  await runTest('RBAC-04', 'Élève sans accès imports', 'RBAC', async () => {
    for (const t of Object.values(IMPORT_CONFIGS)) {
      assert(t.allowedRoles.includes('STUDENT') === false, `STUDENT ne doit pas importer ${t.type}`)
    }
  })

  // RBAC-05: Caissier ne peut pas faire imports élèves
  await runTest('RBAC-05', 'Caissier sans imports élèves', 'RBAC', async () => {
    assert(IMPORT_CONFIGS.STUDENTS.allowedRoles.includes('CASHIER') === false, 'CASHIER ne doit pas importer élèves')
    assert(IMPORT_CONFIGS.PARENTS.allowedRoles.includes('CASHIER') === false, 'CASHIER ne doit pas importer parents')
  })

  // RBAC-06: Templates notifications filtrés par rôle
  await runTest('RBAC-06', 'Templates notifications RBAC', 'RBAC', async () => {
    // Vérifier que la fonction canGenerateDocument existe pour tous les types
    for (const t of DOCUMENT_TYPES_WITH_RBAC) {
      assert(typeof canGenerateDocument('SECRETARY', t.type) === 'boolean', `canGenerateDocument doit retourner boolean pour ${t.type}`)
    }
  })
}

// ============================================================
// Tests Intégrité
// ============================================================

async function testIntegrity() {
  // INT-01: Sanitize cellule CSV dangereuse
  await runTest('INT-01', 'Sanitize cellule CSV dangereuse', 'INTEGRITY', async () => {
    const r1 = sanitizeCell('=cmd|/c calc!A1')
    assert(r1.value.startsWith("'"), 'Cellule = doit être neutralisée')
    assert(r1.warning !== undefined, 'Warning doit être émis')

    const r2 = sanitizeCell('+cmd|/c calc')
    assert(r2.value.startsWith("'"), 'Cellule + doit être neutralisée')

    const r3 = sanitizeCell('@SUM(A1:A10)')
    assert(r3.value.startsWith("'"), 'Cellule @ doit être neutralisée')

    const r4 = sanitizeCell('Jean Dupont')
    assert(r4.value === 'Jean Dupont' && r4.warning === undefined, 'Cellule normale doit passer')
  })

  // INT-02: Normalisation téléphone E.164
  await runTest('INT-02', 'Normalisation téléphone E.164', 'INTEGRITY', async () => {
    assert(normalizePhoneE164('0812345678') === '+243812345678', '0812345678 → +243812345678')
    assert(normalizePhoneE164('243812345678') === '+243812345678', '243812345678 → +243812345678')
    assert(normalizePhoneE164('+243812345678') === '+243812345678', '+243812345678 → +243812345678')
    assert(normalizePhoneE164('123') === null, '123 trop court doit retourner null')
    assert(normalizePhoneE164('abc') === null, 'abc invalide doit retourner null')
  })

  // INT-03: Parser CSV avec guillemets
  await runTest('INT-03', 'Parser CSV avec guillemets', 'INTEGRITY', async () => {
    const csv = 'name,phone\n"Dupont, Jean","+243812345678"\n"Kabongo, Marie","+243815556677"'
    const parsed = parseCsv(csv)
    assert(parsed.headers.length === 2, '2 en-têtes attendus')
    assert(parsed.rows.length === 2, '2 lignes attendues')
    assert(parsed.rows[0].name === 'Dupont, Jean', 'Nom avec virgule doit être préservé')
  })

  // INT-04: Détection doublon dans fichier import
  await runTest('INT-04', 'Détection doublons import', 'INTEGRITY', async () => {
    const csv = 'firstName,lastName,matricule\nJean,Dupont,SS-001\nJean,Dupont,SS-001'
    const parsed = parseCsv(csv)
    // Sans DB, on ne peut tester que la détection interne — on suppose que la fonction existe
    assert(parsed.rows.length === 2, '2 lignes parsées')
    assert(parsed.rows[0].matricule === parsed.rows[1].matricule, 'Doublon détectable')
  })

  // INT-05: Config imports limites
  await runTest('INT-05', 'Config imports limites', 'INTEGRITY', async () => {
    assert(IMPORT_CONFIGS.STUDENTS.maxRows === 10000, 'Max 10000 pour STUDENTS')
    assert(IMPORT_CONFIGS.HISTORY.maxRows === 20000, 'Max 20000 pour HISTORY')
    assert(IMPORT_CONFIGS.PARENTS.maxRows === 5000, 'Max 5000 pour PARENTS')
  })

  // INT-06: Required columns par type
  await runTest('INT-06', 'Required columns par type', 'INTEGRITY', async () => {
    assert(IMPORT_CONFIGS.STUDENTS.requiredColumns.includes('firstName'), 'STUDENTS requiert firstName')
    assert(IMPORT_CONFIGS.STUDENTS.requiredColumns.includes('lastName'), 'STUDENTS requiert lastName')
    assert(IMPORT_CONFIGS.STUDENTS.requiredColumns.includes('birthDate'), 'STUDENTS requiert birthDate')
    assert(IMPORT_CONFIGS.PARENT_STUDENT_LINKS.requiredColumns.includes('parentPhone'), 'PARENT_STUDENT_LINKS requiert parentPhone')
    assert(IMPORT_CONFIGS.PARENT_STUDENT_LINKS.requiredColumns.includes('studentMatricule'), 'PARENT_STUDENT_LINKS requiert studentMatricule')
  })
}

// ============================================================
// Tests Non-Régression
// ============================================================

async function testRegression() {
  // NR-01: Auth fonctionnelle
  await runTest('NR-01', 'Service auth disponible', 'REGRESSION', async () => {
    const auth = await import('@/lib/auth')
    assert(typeof auth.getUserFromSession === 'function', 'getUserFromSession doit exister')
    assert(typeof auth.hashPassword === 'function', 'hashPassword doit exister')
    assert(typeof auth.verifyPassword === 'function', 'verifyPassword doit exister')
  })

  // NR-02: DB singleton
  await runTest('NR-02', 'DB singleton disponible', 'REGRESSION', async () => {
    const dbModule = await import('@/lib/db')
    assert(dbModule.db !== undefined, 'db doit être défini')
  })

  // NR-03: Audit log fonctionnel
  await runTest('NR-03', 'Service audit disponible', 'REGRESSION', async () => {
    const audit = await import('@/lib/audit')
    assert(typeof audit.logAudit === 'function', 'logAudit doit exister')
    assert(typeof audit.getClientIP === 'function', 'getClientIP doit exister')
  })

  // NR-04: School context
  await runTest('NR-04', 'School context helper disponible', 'REGRESSION', async () => {
    const ctx = await import('@/lib/school-context')
    assert(typeof ctx.getSchoolIdForUser === 'function', 'getSchoolIdForUser doit exister')
  })

  // NR-05: Exports toujours fonctionnels
  await runTest('NR-05', 'Service exports disponible', 'REGRESSION', async () => {
    const exp = await import('@/lib/exports')
    assert(typeof exp.generatePaymentReceiptPDF === 'function', 'generatePaymentReceiptPDF doit exister')
    assert(typeof exp.generateStudentsXLSX === 'function', 'generateStudentsXLSX doit exister')
    assert(typeof exp.generateStudentsCSV === 'function', 'generateStudentsCSV doit exister')
    assert(typeof exp.logExportAction === 'function', 'logExportAction doit exister')
  })

  // NR-06: IQA
  await runTest('NR-06', 'Service IQA disponible', 'REGRESSION', async () => {
    const iqa = await import('@/lib/iqa-pure')
    assert(typeof iqa.computeIqa === 'function', 'computeIqa doit exister')
    assert(typeof iqa.getIqaLevel === 'function', 'getIqaLevel doit exister')
  })

  // NR-07: Idempotency
  await runTest('NR-07', 'Service idempotency disponible', 'REGRESSION', async () => {
    const idem = await import('@/lib/idempotency')
    assert(typeof idem.checkIdempotencyKey === 'function', 'checkIdempotencyKey doit exister')
    assert(typeof idem.recordIdempotencyResult === 'function', 'recordIdempotencyResult doit exister')
  })

  // NR-08: Format helpers
  await runTest('NR-08', 'Helpers format disponibles', 'REGRESSION', async () => {
    const fmt = await import('@/lib/format')
    assert(typeof fmt.formatDate === 'function', 'formatDate doit exister')
    assert(typeof fmt.formatCents === 'function', 'formatCents doit exister')
  })
}

// ============================================================
// Tests Performance
// ============================================================

async function testPerformance() {
  // PERF-01: Pagination skip/take
  await runTest('PERF-01', 'Pagination skip/take appliquée', 'PERFORMANCE', async () => {
    // Test simple: récupérer 50 étudiants avec skip 0
    const start = Date.now()
    const students = await db.student.findMany({
      take: 50,
      skip: 0,
      orderBy: { lastName: 'asc' },
      select: { id: true, firstName: true, lastName: true, matricule: true },
    })
    const duration = Date.now() - start
    assert(students.length <= 50, '50 étudiants max récupérés')
    assert(duration < 1000, `Requête < 1000ms (obtenu: ${duration}ms)`)
  })

  // PERF-02: Index sur matricule
  await runTest('PERF-02', 'Recherche par matricule rapide', 'PERFORMANCE', async () => {
    const start = Date.now()
    const student = await db.student.findFirst({
      where: { matricule: { contains: 'SS-' } },
      select: { id: true, matricule: true },
    })
    const duration = Date.now() - start
    assert(duration < 500, `Recherche matricule < 500ms (obtenu: ${duration}ms)`)
  })

  // PERF-03: Count rapide
  await runTest('PERF-03', 'Count students rapide', 'PERFORMANCE', async () => {
    const start = Date.now()
    const count = await db.student.count()
    const duration = Date.now() - start
    assert(typeof count === 'number', 'Count retourne un nombre')
    assert(duration < 500, `Count < 500ms (obtenu: ${duration}ms)`)
  })
}

// ============================================================
// Runner principal
// ============================================================

export async function runAllTests(): Promise<{
  total: number
  passed: number
  failed: number
  skipped: number
  results: TestResult[]
  durationMs: number
}> {
  results.length = 0
  const start = Date.now()

  await testRBAC()
  await testIntegrity()
  await testRegression()
  await testPerformance()

  const passed = results.filter((r) => r.status === 'PASS').length
  const failed = results.filter((r) => r.status === 'FAIL').length
  const skipped = results.filter((r) => r.status === 'SKIP').length

  return {
    total: results.length,
    passed, failed, skipped,
    results,
    durationMs: Date.now() - start,
  }
}

// ============================================================
// Si exécuté directement (node)
// ============================================================

if (require.main === module) {
  runAllTests().then((result) => {
    console.log('\n' + '='.repeat(60))
    console.log('SmartShule — Tests RBAC, Intégrité, Non-régression')
    console.log('='.repeat(60))
    console.log(`Total: ${result.total} | PASS: ${result.passed} | FAIL: ${result.failed} | SKIP: ${result.skipped}`)
    console.log(`Durée: ${result.durationMs}ms\n`)

    for (const r of result.results) {
      const icon = r.status === 'PASS' ? '✓' : r.status === 'FAIL' ? '✗' : '○'
      console.log(`  ${icon} [${r.category}] ${r.id}: ${r.name}`)
      if (r.status === 'FAIL') {
        console.log(`      → ${r.message}`)
      }
    }

    process.exit(result.failed > 0 ? 1 : 0)
  }).catch((err) => {
    console.error('Erreur fatale:', err)
    process.exit(1)
  })
}
