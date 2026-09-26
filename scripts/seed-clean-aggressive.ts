// SmartShule — Nettoyage AGRESSIF de la base (installateur propre)
// ============================================================
// Désactive les foreign keys, supprime TOUT, recrée uniquement
// 1 école + 1 admin. À utiliser pour générer un installateur propre.

import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/auth'

const prisma = new PrismaClient()

async function main() {
  console.log('🧹 Nettoyage AGRESSIF de la base...')

  // Désactiver les foreign keys (SQLite)
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF')

  // Liste de toutes les tables à vider (ordre n'a plus d'importance avec FK off)
  const tables = [
    'Session', 'AuditLog', 'Notification', 'RequestMessage',
    'Expense', 'Receipt', 'Encashment', 'StudentFinancialStatus',
    'Invoice', 'InvoiceLineConfig', 'Grade', 'Attendance',
    'Enrollment', 'Classroom', 'Directorate', 'AcademicYear',
    'Employee', 'Student', 'Guardian',
    'SyncError', 'SyncOperation', 'SyncConflict', 'SyncOutbox', 'SyncDevice',
    'DocumentVersion', 'Certificate',
    'NotificationTemplate', 'NotificationConsent', 'NotificationLog',
    'Branding', 'License', 'User', 'School',
    // Tables supplémentaires potentielles
    'Announcement', 'Request', 'AdminTask', 'EmployeeAttendance',
    'PayrollVariable', 'Message', 'Conversation',
    'StudentDebt', 'ParentStudentLink', 'ImportJob', 'ExportJob',
    'PaymentProvider', 'AccountConfig',
  ]

  for (const table of tables) {
    try {
      const result = await (prisma as unknown as Record<string, { deleteMany: () => Promise<{ count: number }> }>)[table]?.deleteMany()
      if (result && result.count > 0) {
        console.log(`  ✓ ${table}: ${result.count} supprimés`)
      }
    } catch (e) {
      // Table n'existe pas — ignorer
    }
  }

  // Réactiver les foreign keys
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON')

  console.log('✅ Base totalement vidée')
  console.log('')

  // =============================================
  // Création école générique
  // =============================================
  console.log('🏫 Création de l\'école générique...')
  const school = await prisma.school.create({
    data: {
      name: 'Mon École',
      slogan: 'Bienvenue',
      primaryColor: '#2563EB',
      secondaryColor: '#0F766E',
      tertiaryColor: '#F59E0B',
      address: 'À configurer',
      currency: 'CDF',
      locale: 'fr-FR',
    },
  })

  // Branding initial
  await prisma.branding.create({
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
  const academicYear = await prisma.academicYear.create({
    data: {
      schoolId: school.id,
      label: `${now.getFullYear()}-${now.getFullYear() + 1}`,
      startDate: new Date(now.getFullYear(), 8, 1),
      endDate: new Date(now.getFullYear() + 1, 6, 15),
      active: true,
    },
  })

  // =============================================
  // Compte admin unique
  // =============================================
  console.log('👤 Création du compte admin...')
  const adminPassword = await hashPassword('Admin@2026')
  const admin = await prisma.user.create({
    data: {
      email: 'admin@mon-ecole.cd',
      passwordHash: adminPassword,
      role: 'SYSTEM_ADMIN',
      accountStatus: 'ACTIVE',
      displayName: 'Administrateur',
      active: true,
      isDemoAccount: false,
    },
  })

  // Audit log initial
  await prisma.auditLog.create({
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
  console.log(`📅 Année : ${academicYear.label}`)
  console.log(`👤 Admin : admin@mon-ecole.cd`)
  console.log(`🔑 Mot de passe : Admin@2026`)
  console.log(`⚠️  Changez ce mot de passe au 1er login !`)
  console.log('============================================')

  await prisma.$disconnect()
}

main().catch(e => {
  console.error('❌ Erreur:', e)
  process.exit(1)
})
