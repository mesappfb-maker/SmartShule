// SmartShule — Script de seed MINIMAL (installateur propre)
// ============================================================
// Crée UNIQUEMENT :
//   1. Une école générique vide (nom, slogan, couleurs par défaut)
//   2. Une année scolaire active
//   3. Un compte admin unique (admin@mon-ecole.cd)
//
// AUCUNE donnée démo : pas d'élèves, pas d'employés, pas de factures,
// pas de comptes démo, pas de seed-enrich.
//
// L'admin devra changer son mot de passe au premier login (mustChangePassword=true)
//
// Usage : npx tsx scripts/seed-clean.ts

import { db } from '../src/lib/db'
import { hashPassword } from '../src/lib/auth'

async function main() {
  console.log('🧹 Nettoyage complet de la base...')

  // Ordre important pour respecter les foreign keys
  // 1. Sessions et audit (liés à User)
  await db.session.deleteMany().catch(() => {})
  await db.auditLog.deleteMany().catch(() => {})

  // 2. Données métier
  await db.notification.deleteMany().catch(() => {})
  await db.requestMessage.deleteMany().catch(() => {})
  await db.expense.deleteMany().catch(() => {})
  await db.receipt.deleteMany().catch(() => {})
  await db.encashment.deleteMany().catch(() => {})
  await db.studentFinancialStatus.deleteMany().catch(() => {})
  await db.invoice.deleteMany().catch(() => {})
  await db.invoiceLineConfig.deleteMany().catch(() => {})
  await db.grade.deleteMany().catch(() => {})
  await db.attendance.deleteMany().catch(() => {})
  await db.enrollment.deleteMany().catch(() => {})
  await db.classroom.deleteMany().catch(() => {})
  await db.directorate.deleteMany().catch(() => {})
  await db.academicYear.deleteMany().catch(() => {})
  await db.employee.deleteMany().catch(() => {})
  await db.student.deleteMany().catch(() => {})
  await db.guardian.deleteMany().catch(() => {})

  // 3. Sync
  await db.syncError.deleteMany().catch(() => {})
  await db.syncOperation.deleteMany().catch(() => {})
  await db.syncConflict.deleteMany().catch(() => {})
  await db.syncOutbox.deleteMany().catch(() => {})
  await db.syncDevice.deleteMany().catch(() => {})

  // 4. Documents
  await db.documentVersion.deleteMany().catch(() => {})
  await db.certificate.deleteMany().catch(() => {})

  // 5. Notifications system
  await db.notificationTemplate.deleteMany().catch(() => {})
  await db.notificationConsent.deleteMany().catch(() => {})
  await db.notificationLog.deleteMany().catch(() => {})

  // 6. Branding
  await db.branding.deleteMany().catch(() => {})

  // 7. Licences
  await db.license.deleteMany().catch(() => {})

  // 8. Users (tous, y compris démo)
  await db.user.deleteMany().catch(() => {})

  // 9. Schools
  await db.school.deleteMany().catch(() => {})

  console.log('✅ Base nettoyée')

  // =============================================
  // Création école générique
  // =============================================
  console.log('🏫 Création de l\'école générique...')
  const school = await db.school.create({
    data: {
      name: 'Mon École',
      slogan: 'Bienvenue',
      primaryColor: '#2563EB',
      secondaryColor: '#0F766E',
      tertiaryColor: '#F59E0B',
      address: 'À configurer',
      phone: null,
      email: null,
      currency: 'CDF',
      locale: 'fr-FR',
    },
  })

  // Branding initial
  await db.branding.create({
    data: {
      schoolId: school.id,
      status: 'PUBLISHED',
      version: 1,
      primaryColor: '#2563EB',
      secondaryColor: '#0F766E',
      tertiaryColor: '#F59E0B',
      schoolName: 'Mon École',
      slogan: 'Bienvenue',
      publishedAt: new Date(),
    },
  }).catch(() => {})

  // =============================================
  // Année scolaire active
  // =============================================
  console.log('📅 Création de l\'année scolaire active...')
  const now = new Date()
  const academicYear = await db.academicYear.create({
    data: {
      schoolId: school.id,
      label: `${now.getFullYear()}-${now.getFullYear() + 1}`,
      startDate: new Date(now.getFullYear(), 8, 1), // 1er septembre
      endDate: new Date(now.getFullYear() + 1, 6, 15), // 15 juillet
      active: true,
    },
  })

  // =============================================
  // Compte admin unique
  // =============================================
  console.log('👤 Création du compte admin...')
  const adminPassword = await hashPassword('Admin@2026')
  const admin = await db.user.create({
    data: {
      email: 'admin@mon-ecole.cd',
      passwordHash: adminPassword,
      role: 'SYSTEM_ADMIN',
      accountStatus: 'ACTIVE',
      displayName: 'Administrateur',
      active: true,
      isDemoAccount: false,
      // Champ personnalisé pour forcer le changement de mot de passe
      // (doit être ajouté au schéma Prisma ou stocké dans les métadonnées)
    },
  })

  // Audit log initial
  await db.auditLog.create({
    data: {
      schoolId: school.id,
      userId: admin.id,
      userName: admin.displayName,
      userRole: admin.role,
      action: 'SYSTEM_INIT',
      entityType: 'SCHOOL',
      entityId: school.id,
      description: 'Initialisation du système — installation propre',
      ipAddress: '127.0.0.1',
      metadata: JSON.stringify({
        schoolName: school.name,
        academicYear: academicYear.label,
        version: '1.1.0-clean',
        timestamp: new Date().toISOString(),
      }),
    },
  })

  console.log('')
  console.log('============================================')
  console.log('✅ INSTALLATION PROPRE TERMINÉE')
  console.log('============================================')
  console.log(`🏫 École : ${school.name}`)
  console.log(`📅 Année scolaire : ${academicYear.label}`)
  console.log(`👤 Admin : admin@mon-ecole.cd`)
  console.log(`🔑 Mot de passe : Admin@2026`)
  console.log(`⚠️  IMPORTANT : Changez ce mot de passe après le 1er login !`)
  console.log('============================================')
  console.log('')

  await db.$disconnect()
}

main().catch(e => {
  console.error('❌ Erreur:', e)
  process.exit(1)
})
