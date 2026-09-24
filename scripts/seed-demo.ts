// SmartShule — Seed Démo CLI (wrapper pour scripts/seed-demo-runner.ts)
// ============================================================
// Usage :
//   npx tsx scripts/seed-demo.ts           # Crée les données démo si absentes
//   npx tsx scripts/seed-demo.ts --reset   # Reset + recréation
//   npx tsx scripts/seed-demo.ts --force   # Force recréation

import { runSeedDemo } from '../src/lib/seed-demo-runner'

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║  SmartShule — Seed Démo Complet                          ║')
  console.log('║  14 rôles RBAC + 100 élèves + 80 parents + 27 employés  ║')
  console.log('╚══════════════════════════════════════════════════════════╝\n')

  const args = process.argv.slice(2)
  const shouldReset = args.includes('--reset') || args.includes('--force')

  try {
    const result = await runSeedDemo({
      reset: shouldReset,
      force: shouldReset,
      allowProduction: false, // CLI refuse production
    })

    console.log('\n' + '═'.repeat(60))
    console.log('✅ SEED DÉMO TERMINÉ AVEC SUCCÈS')
    console.log('═'.repeat(60))
    console.log(`\n🏫 École : ${result.schoolName}`)
    console.log(`👥 Comptes démo : ${result.counts.demoAccounts} (1 par rôle RBAC)`)
    console.log(`👔 Employés : ${result.counts.employees}`)
    console.log(`👨‍👩‍👧‍👦 Parents : ${result.counts.guardians}`)
    console.log(`🎓 Élèves : ${result.counts.students} (10 classes x 10)`)
    console.log(`💰 Factures : ${result.counts.invoices}`)
    console.log(`🧾 Reçus : ${result.counts.receipts}`)
    console.log(`\n🔑 Mot de passe tous comptes : ${result.defaultPassword}`)
    console.log(`\n⚠️  ENVIRONNEMENT DE DÉMONSTRATION — DONNÉES FICTIVES`)
    console.log(`⚠️  Aucun SMS/Email/WhatsApp réel envoyé (sandbox mode)\n`)
    console.log('📧 Comptes démo :')
    for (const acc of result.demoAccounts) {
      console.log(`   ${acc.role.padEnd(20)} → ${acc.email}`)
    }
  } catch (err) {
    console.error('❌ Erreur:', (err as Error).message)
    process.exit(1)
  }
}

main()
  .catch((err) => {
    console.error('❌ Erreur fatale:', err)
    process.exit(1)
  })
  .finally(async () => {
    const { db } = await import('../src/lib/db')
    await db.$disconnect()
  })
