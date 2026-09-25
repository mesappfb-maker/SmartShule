// SmartShule — Tests RBAC Dossier Élève
// ============================================================
// Vérifie que chaque rôle ne voit que les sections autorisées.
// Vérifie que les champs sensibles sont masqués.
// Vérifie que les parents ne voient que leurs enfants.

import { db } from '../src/lib/db'
import { getStudentFolderPermissions, maskSensitiveFields } from '../src/lib/student-folder-rbac'

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
  console.log('║  SmartShule — Tests RBAC Dossier Élève                   ║')
  console.log('╚══════════════════════════════════════════════════════════╝\n')

  // DF-01: DIRECTOR voit toutes les 9 sections
  await runTest('DF-01', 'DIRECTOR voit toutes les 9 sections', async () => {
    const perms = getStudentFolderPermissions('DIRECTOR', false, false, false)
    const sections = Object.keys(perms.sections) as any[]
    assert(sections.length === 9, `9 sections attendues, trouvées: ${sections.length}`)
    for (const s of sections) {
      assert(perms.sections[s].read === true, `Section ${s} doit être readable pour DIRECTOR`)
    }
    assert(perms.canExport === true, 'DIRECTOR peut exporter')
    assert(perms.canSeeAuditTrail === true, 'DIRECTOR voit audit')
  })

  // DF-02: SECRETARY ne voit pas AUDIT (canSeeAuditTrail=false)
  await runTest('DF-02', 'SECRETARY ne voit pas AUDIT (canSeeAuditTrail=false)', async () => {
    const perms = getStudentFolderPermissions('SECRETARY', false, false, false)
    assert(perms.canSeeAuditTrail === false, 'SECRETARY ne doit pas voir audit trail')
    assert(perms.sections.IDENTITE_STATUT.read === true, 'SECRETARY voit IDENTITE')
    assert(perms.sections.FINANCIER.read === true, 'SECRETARY voit FINANCIER (summary)')
    assert(perms.sections.FINANCIER.summaryOnly === true, 'SECRETARY voit FINANCIER en summary seulement')
  })

  // DF-03: ACCOUNTANT ne voit pas ACADEMIQUE ni SANTE
  await runTest('DF-03', 'ACCOUNTANT ne voit pas ACADEMIQUE ni SANTE', async () => {
    const perms = getStudentFolderPermissions('ACCOUNTANT', false, false, false)
    assert(perms.sections.ACADEMIQUE.read === false, 'ACCOUNTANT ne doit pas voir ACADEMIQUE')
    assert(perms.sections.SANTE_URGENCE.read === false, 'ACCOUNTANT ne doit pas voir SANTE')
    assert(perms.sections.VIE_SCOLAIRE.read === false, 'ACCOUNTANT ne doit pas voir VIE_SCOLAIRE')
    assert(perms.sections.FINANCIER.read === true, 'ACCOUNTANT voit FINANCIER')
    assert(perms.sections.FINANCIER.write === true, 'ACCOUNTANT peut écrire FINANCIER')
  })

  // DF-04: CASHIER ne voit pas ACADEMIQUE, VIE_SCOLAIRE, SANTE, AUDIT
  await runTest('DF-04', 'CASHIER limité à caisse/reçus', async () => {
    const perms = getStudentFolderPermissions('CASHIER', false, false, false)
    assert(perms.sections.ACADEMIQUE.read === false, 'CASHIER ne voit pas ACADEMIQUE')
    assert(perms.sections.SANTE_URGENCE.read === false, 'CASHIER ne voit pas SANTE')
    assert(perms.canSeeAuditTrail === false, 'CASHIER ne voit pas audit trail')
    assert(perms.sections.FINANCIER.read === true, 'CASHIER voit FINANCIER')
    assert(perms.sections.FINANCIER.write === true, 'CASHIER peut encaisser')
  })

  // DF-05: TEACHER ne voit pas FINANCIER ni SANTE
  await runTest('DF-05', 'TEACHER ne voit pas FINANCIER ni SANTE', async () => {
    const perms = getStudentFolderPermissions('TEACHER', false, false, true)
    assert(perms.sections.FINANCIER.read === false, 'TEACHER ne doit JAMAIS voir FINANCIER')
    assert(perms.sections.SANTE_URGENCE.read === false, 'TEACHER ne doit JAMAIS voir SANTE')
    assert(perms.sections.ACADEMIQUE.read === true, 'TEACHER voit ACADEMIQUE')
    assert(perms.sections.ACADEMIQUE.write === true, 'TEACHER peut saisir notes')
    assert(perms.sections.IDENTITE_STATUT.maskSensitive?.includes('phone') === true, 'TEACHER: phone masqué')
  })

  // DF-06: TEACHER non assigné à l'élève = aucun accès
  await runTest('DF-06', 'TEACHER non assigné = aucun accès', async () => {
    const perms = getStudentFolderPermissions('TEACHER', false, false, false)
    const hasAccess = Object.values(perms.sections).some((s) => s.read)
    assert(hasAccess === false, 'TEACHER non assigné ne doit rien voir')
  })

  // DF-07: PARENT ne voit que son enfant
  await runTest('DF-07', 'PARENT ne voit que son enfant', async () => {
    const permsOwn = getStudentFolderPermissions('PARENT', true, false, false)
    assert(permsOwn.sections.IDENTITE_STATUT.read === true, 'PARENT voit IDENTITE de son enfant')
    assert(permsOwn.sections.ACADEMIQUE.read === true, 'PARENT voit ACADEMIQUE de son enfant')
    assert(permsOwn.sections.FINANCIER.read === true, 'PARENT voit FINANCIER de son enfant')
    assert(permsOwn.sections.AUDIT.read === false, 'PARENT ne voit pas AUDIT')

    // Parent d'un autre enfant = aucun accès
    const permsOther = getStudentFolderPermissions('PARENT', false, false, false)
    const hasAccess = Object.values(permsOther.sections).some((s) => s.read)
    assert(hasAccess === false, 'PARENT d\'un autre enfant ne doit rien voir')
  })

  // DF-08: STUDENT ne voit pas FINANCIER global
  await runTest('DF-08', 'STUDENT ne voit pas FINANCIER global', async () => {
    const perms = getStudentFolderPermissions('STUDENT', false, true, false)
    assert(perms.sections.FINANCIER.read === false, 'STUDENT ne doit pas voir FINANCIER global')
    assert(perms.sections.ACADEMIQUE.read === true, 'STUDENT voit ses notes')
    assert(perms.sections.AUDIT.read === false, 'STUDENT ne voit pas AUDIT')
  })

  // DF-09: AUDITOR ne voit pas SANTE
  await runTest('DF-09', 'AUDITOR ne voit pas SANTE', async () => {
    const perms = getStudentFolderPermissions('AUDITOR', false, false, false)
    assert(perms.sections.SANTE_URGENCE.read === false, 'AUDITOR ne doit pas voir SANTE sans autorisation')
    assert(perms.sections.AUDIT.read === true, 'AUDITOR voit AUDIT')
    assert(perms.sections.FINANCIER.read === true, 'AUDITOR voit FINANCIER (lecture)')
    assert(perms.sections.FINANCIER.write === false, 'AUDITOR ne peut pas écrire FINANCIER')
  })

  // DF-10: HR n'a aucun accès au dossier élève
  await runTest('DF-10', 'HR_MANAGER n\'a aucun accès dossier élève', async () => {
    const perms = getStudentFolderPermissions('HR_MANAGER', false, false, false)
    const hasAccess = Object.values(perms.sections).some((s) => s.read)
    assert(hasAccess === false, 'HR_MANAGER ne doit pas accéder au dossier élève')
  })

  // DF-11: maskSensitiveFields masque correctement
  await runTest('DF-11', 'maskSensitiveFields masque les champs', async () => {
    const data = { name: 'Jean', phone: '+243123', email: 'jean@test.com', address: '123 rue' }
    const masked = maskSensitiveFields(data, ['phone', 'email'])
    assert(masked.name === 'Jean', 'name non masqué')
    assert(masked.phone === '***', 'phone masqué')
    assert(masked.email === '***', 'email masqué')
    assert(masked.address === '123 rue', 'address non masqué')
  })

  // DF-12: ADMIN a tout accès
  await runTest('DF-12', 'ADMIN/SYSTEM_ADMIN a tout accès', async () => {
    const perms = getStudentFolderPermissions('SYSTEM_ADMIN', false, false, false)
    const sections = Object.values(perms.sections)
    assert(sections.every((s) => s.read === true), 'SYSTEM_ADMIN voit toutes les sections')
    assert(perms.canSeeAuditTrail === true, 'SYSTEM_ADMIN voit audit')
  })

  // DF-13: SECRETARY SANTE en summaryOnly avec masquage
  await runTest('DF-13', 'SECRETARY SANTE en summary avec masquage', async () => {
    const perms = getStudentFolderPermissions('SECRETARY', false, false, false)
    assert(perms.sections.SANTE_URGENCE.read === true, 'SECRETARY voit SANTE')
    assert(perms.sections.SANTE_URGENCE.summaryOnly === true, 'SECRETARY SANTE en summary seulement')
    assert(perms.sections.SANTE_URGENCE.maskSensitive?.length === 4, 'SECRETARY SANTE 4 champs masqués')
  })

  // DF-14: TEACHER peut écrire notes mais pas identité
  await runTest('DF-14', 'TEACHER peut écrire notes mais pas identité', async () => {
    const perms = getStudentFolderPermissions('TEACHER', false, false, true)
    assert(perms.sections.ACADEMIQUE.write === true, 'TEACHER peut écrire ACADEMIQUE')
    assert(perms.sections.IDENTITE_STATUT.write === false, 'TEACHER ne peut pas écrire IDENTITE')
    assert(perms.sections.FINANCIER.write === false, 'TEACHER ne peut pas écrire FINANCIER')
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
