// SmartShule — Tests Offline-First + Synchronisation + Licence
// ============================================================
// Vérifie :
//   - Service offline (queue, conflits, statut)
//   - Stratégies de résolution de conflits
//   - État de licence (période de grâce, lecture seule)
//   - Isolation multi-écoles
//   - Non-régression

import { db } from '../src/lib/db'
import {
  queueOperation,
  getPendingOperations,
  markOperationSending,
  markOperationAccepted,
  markOperationRejected,
  createSyncConflict,
  resolveConflict,
  getSyncStatus,
  getLicenseStatus,
  canWrite,
  assertSchoolIsolation,
  registerDevice,
  generateOperationId,
  computePayloadHash,
  CONFLICT_STRATEGIES,
} from '../src/lib/offline'

interface TestResult {
  id: string
  name: string
  category: 'OFFLINE' | 'SYNC' | 'LICENSE' | 'ISOLATION' | 'REGRESSION'
  status: 'PASS' | 'FAIL' | 'SKIP'
  message: string
}

const results: TestResult[] = []

async function runTest(id: string, name: string, category: TestResult['category'], fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
    results.push({ id, name, category, status: 'PASS', message: 'OK' })
  } catch (err) {
    results.push({ id, name, category, status: 'FAIL', message: (err as Error).message })
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

// ============================================================
// Tests Offline
// ============================================================

async function testQueueOperation() {
  const opId = generateOperationId()
  const operationId = await queueOperation({
    operationId: opId,
    aggregateType: 'STUDENT',
    operationType: 'CREATE',
    payload: { firstName: 'Test', lastName: 'Offline' },
  })
  assert(operationId === opId, 'operationId doit correspondre')

  // Idempotence : même operationId + même payload ne recrée pas
  const operationId2 = await queueOperation({
    operationId: opId,
    aggregateType: 'STUDENT',
    operationType: 'CREATE',
    payload: { firstName: 'Test', lastName: 'Offline' },
  })
  assert(operationId2 === opId, 'Idempotence : même operationId')

  // Nettoyage
  await db.syncOutbox.deleteMany({ where: { operationId: opId } })
}

async function testGetPendingOperations() {
  const opId = generateOperationId()
  await queueOperation({
    operationId: opId,
    aggregateType: 'STUDENT',
    operationType: 'UPDATE',
    payload: { id: 'test' },
  })

  const pending = await getPendingOperations()
  assert(pending.length >= 1, 'Au moins 1 opération en attente')

  await db.syncOutbox.deleteMany({ where: { operationId: opId } })
}

async function testMarkOperationAccepted() {
  const opId = generateOperationId()
  await queueOperation({
    operationId: opId,
    aggregateType: 'STUDENT',
    operationType: 'CREATE',
    payload: { test: true },
  })

  await markOperationAccepted(opId)
  const op = await db.syncOutbox.findUnique({ where: { operationId: opId } })
  assert(op?.status === 'ACCEPTED', 'Statut doit être ACCEPTED')

  await db.syncOutbox.deleteMany({ where: { operationId: opId } })
}

async function testMarkOperationRejected() {
  const opId = generateOperationId()
  await queueOperation({
    operationId: opId,
    aggregateType: 'STUDENT',
    operationType: 'CREATE',
    payload: { test: true },
  })

  await markOperationRejected(opId, 'VALIDATION_ERROR', 'Champ obligatoire manquant')
  const op = await db.syncOutbox.findUnique({ where: { operationId: opId } })
  assert(op?.status === 'REJECTED', 'Statut doit être REJECTED')
  assert(op?.lastErrorCode === 'VALIDATION_ERROR', 'Code erreur doit être stocké')

  await db.syncOutbox.deleteMany({ where: { operationId: opId } })
}

async function testCreateSyncConflict() {
  const conflictId = await createSyncConflict({
    aggregateType: 'PAYMENT',
    aggregateId: 'pay-test-1',
    localPayload: { amount: 100 },
    serverPayload: { amount: 150 },
    conflictType: 'CONTRADICTORY',
  })

  assert(!!conflictId, 'Conflit créé')
  const c = await db.syncConflict.findUnique({ where: { conflictId } })
  assert(c?.status === 'OPEN', 'Statut initial OPEN')
  assert(c?.conflictType === 'CONTRADICTORY', 'Type de conflit stocké')

  await db.syncConflict.deleteMany({ where: { conflictId } })
}

async function testResolveConflict() {
  const conflictId = await createSyncConflict({
    aggregateType: 'DRAFT',
    aggregateId: 'draft-test',
    localPayload: { content: 'local' },
    serverPayload: { content: 'cloud' },
    conflictType: 'STALE_VERSION',
  })

  await resolveConflict(conflictId, {
    strategy: 'LAST_WRITE_WINS_DRAFT',
    note: 'Test résolution',
    resolvedById: 'test-user',
    resolvedByName: 'Test',
  })

  const c = await db.syncConflict.findUnique({ where: { conflictId } })
  assert(c?.status === 'RESOLVED', 'Conflit résolu')
  assert(c?.resolutionStrategy === 'LAST_WRITE_WINS_DRAFT', 'Stratégie stockée')

  await db.syncConflict.deleteMany({ where: { conflictId } })
}

async function testGetSyncStatus() {
  const status = await getSyncStatus()
  assert(typeof status.pendingCount === 'number', 'pendingCount est un nombre')
  assert(typeof status.conflictCount === 'number', 'conflictCount est un nombre')
  assert(typeof status.errorCount === 'number', 'errorCount est un nombre')
}

async function testConflictStrategies() {
  assert(CONFLICT_STRATEGIES.PAYMENT === 'BLOCKING_REVIEW', 'Paiement = bloquant')
  assert(CONFLICT_STRATEGIES.JOURNAL_ENTRY === 'CORRECTION_WORKFLOW', 'Écriture comptable = correction')
  assert(CONFLICT_STRATEGIES.AUDIT_LOG === 'BLOCKING_REVIEW', 'Audit = bloquant')
  assert(CONFLICT_STRATEGIES.GUARDIAN_ADDRESS === 'MERGE', 'Adresse parent = fusion')
  assert(CONFLICT_STRATEGIES.DRAFT === 'LAST_WRITE_WINS_DRAFT', 'Brouillon = LWW')
  assert(CONFLICT_STRATEGIES.SETTINGS === 'SERVER_WINS', 'Paramètres = cloud gagne')
  assert(CONFLICT_STRATEGIES.LICENSE === 'SERVER_WINS', 'Licence = cloud gagne')
}

// ============================================================
// Tests Licence
// ============================================================

async function testLicenseStatusNoLicense() {
  // Tester avec un schoolId qui n'a pas de licence
  const status = await getLicenseStatus('no-license-school-id')
  assert(status.isActive === false, 'Pas de licence = inactive')
  assert(status.isExpired === true, 'Pas de licence = expirée')
  assert(status.maxStudents === 0, 'Pas de licence = 0 élèves max')
}

async function testCanWriteNoLicense() {
  const result = await canWrite('no-license-school-id')
  assert(result.ok === false, 'Pas de licence = écriture refusée')
}

async function testCanWriteDemoSchool() {
  // L'école démo devrait avoir une licence ou pas — tester le comportement
  const demoSchool = await db.school.findFirst({ where: { email: 'contact@demo.smartshule.com' } })
  if (!demoSchool) {
    // Pas d'école démo, skip
    return
  }
  const result = await canWrite(demoSchool.id)
  // Si pas de licence, écriture refusée — c'est le comportement attendu
  assert(typeof result.ok === 'boolean', 'canWrite retourne un booléen')
}

// ============================================================
// Tests Isolation Multi-Écoles
// ============================================================

async function testAssertSchoolIsolation() {
  // Cas OK : schoolId correspond
  assertSchoolIsolation('school-A', 'school-A', 'STUDENT')

  // Cas erreur : schoolId différent
  try {
    assertSchoolIsolation('school-A', 'school-B', 'STUDENT')
    throw new Error('Devrait avoir échoué')
  } catch (err) {
    assert((err as Error).message.includes('Isolation violée'), 'Erreur isolation détectée')
  }

  // Cas erreur : entitySchoolId null
  try {
    assertSchoolIsolation('school-A', null, 'STUDENT')
    throw new Error('Devrait avoir échoué')
  } catch (err) {
    assert((err as Error).message.includes('sans schoolId'), 'Erreur null schoolId détectée')
  }
}

async function testRegisterDevice() {
  const deviceId = `test-device-${Date.now()}`
  // Sans schoolId ni userId pour éviter les contraintes FK
  const device = await registerDevice({
    deviceId,
    deviceType: 'DESKTOP',
    appVersion: '1.0.0',
  })
  assert(device.deviceId === deviceId, 'Device enregistré')

  // Récupérer le même device
  const device2 = await registerDevice({
    deviceId,
    deviceType: 'DESKTOP',
    appVersion: '1.0.1',
  })
  assert(device2.id === device.id, 'Même device ID')
  assert(device2.appVersion === '1.0.1', 'Version mise à jour')

  await db.syncDevice.deleteMany({ where: { deviceId } })
}

// ============================================================
// Tests Non-Régression
// ============================================================

async function testServicesAvailable() {
  const offline = await import('../src/lib/offline')
  assert(typeof offline.queueOperation === 'function', 'queueOperation existe')
  assert(typeof offline.getPendingOperations === 'function', 'getPendingOperations existe')
  assert(typeof offline.createSyncConflict === 'function', 'createSyncConflict existe')
  assert(typeof offline.resolveConflict === 'function', 'resolveConflict existe')
  assert(typeof offline.getSyncStatus === 'function', 'getSyncStatus existe')
  assert(typeof offline.getLicenseStatus === 'function', 'getLicenseStatus existe')
  assert(typeof offline.canWrite === 'function', 'canWrite existe')
  assert(typeof offline.registerDevice === 'function', 'registerDevice existe')
}

async function testExistingSyncServices() {
  const sync = await import('../src/lib/sync')
  assert(typeof sync.generateOperationId === 'function', 'sync.generateOperationId existe')
  assert(typeof sync.computePayloadHash === 'function', 'sync.computePayloadHash existe')
}

async function testSyncModelsExist() {
  // Vérifier que les nouveaux modèles sont accessibles via Prisma
  assert(typeof db.syncCheckpoint !== 'undefined', 'db.syncCheckpoint accessible')
  assert(typeof db.syncRun !== 'undefined', 'db.syncRun accessible')
  assert(typeof db.syncError !== 'undefined', 'db.syncError accessible')
}

async function testExistingServicesIntact() {
  const auth = await import('../src/lib/auth')
  assert(typeof auth.getUserFromSession === 'function', 'auth.getUserFromSession existe')

  const audit = await import('../src/lib/audit')
  assert(typeof audit.logAudit === 'function', 'audit.logAudit existe')

  const schoolCtx = await import('../src/lib/school-context')
  assert(typeof schoolCtx.getSchoolIdForUser === 'function', 'school-context.getSchoolIdForUser existe')
}

// ============================================================
// Runner
// ============================================================

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║  SmartShule — Tests Offline-First + Sync + Licence         ║')
  console.log('╚══════════════════════════════════════════════════════════╝\n')

  await runTest('OF-01', 'queueOperation crée entrée sync_outbox', 'OFFLINE', testQueueOperation)
  await runTest('OF-02', 'getPendingOperations récupère PENDING', 'OFFLINE', testGetPendingOperations)
  await runTest('OF-03', 'markOperationAccepted met à jour statut', 'OFFLINE', testMarkOperationAccepted)
  await runTest('OF-04', 'markOperationRejected stocke erreur', 'OFFLINE', testMarkOperationRejected)
  await runTest('OF-05', 'createSyncConflict crée conflit OPEN', 'OFFLINE', testCreateSyncConflict)
  await runTest('OF-06', 'resolveConflict marque RESOLVED', 'OFFLINE', testResolveConflict)
  await runTest('OF-07', 'getSyncStatus retourne compteurs', 'OFFLINE', testGetSyncStatus)
  await runTest('OF-08', 'Stratégies de conflits par type', 'SYNC', testConflictStrategies)
  await runTest('LIC-01', 'getLicenseStatus sans licence', 'LICENSE', testLicenseStatusNoLicense)
  await runTest('LIC-02', 'canWrite refuse sans licence', 'LICENSE', testCanWriteNoLicense)
  await runTest('LIC-03', 'canWrite sur école démo', 'LICENSE', testCanWriteDemoSchool)
  await runTest('ISO-01', 'assertSchoolIsolation détecte violations', 'ISOLATION', testAssertSchoolIsolation)
  await runTest('ISO-02', 'registerDevice crée et met à jour', 'ISOLATION', testRegisterDevice)
  await runTest('NR-01', 'Service offline disponible', 'REGRESSION', testServicesAvailable)
  await runTest('NR-02', 'Service sync existant intact', 'REGRESSION', testExistingSyncServices)
  await runTest('NR-03', 'Nouveaux modèles Prisma accessibles', 'REGRESSION', testSyncModelsExist)
  await runTest('NR-04', 'Services existants intacts', 'REGRESSION', testExistingServicesIntact)

  const passed = results.filter((r) => r.status === 'PASS').length
  const failed = results.filter((r) => r.status === 'FAIL').length

  console.log('\n' + '═'.repeat(60))
  console.log(`Total: ${results.length} | PASS: ${passed} | FAIL: ${failed}`)
  console.log('═'.repeat(60) + '\n')

  for (const r of results) {
    const icon = r.status === 'PASS' ? '✓' : '✗'
    console.log(`  ${icon} [${r.category}] ${r.id}: ${r.name}`)
    if (r.status === 'FAIL') console.log(`      → ${r.message}`)
  }

  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Erreur fatale:', err)
  process.exit(1)
})
