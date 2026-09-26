// SmartShule — Seed VIDE (installateur commercial v2.0)
// ============================================================
// Crée UNE base TOTALEMENT vide.
// AUCUN compte utilisateur, AUCUNE école, AUCUNE donnée.
// L'utilisateur devra activer une licence puis créer son compte admin.

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🧹 Nettoyage TOTAL de la base (installateur commercial v2.0)...')

  // Désactiver les foreign keys (SQLite)
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF')

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

  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON')
  console.log('✅ Base TOTALEMENT vide')
  console.log('')
  console.log('============================================')
  console.log('✅ INSTALLATEUR COMMERCIAL v2.0 PRÊT')
  console.log('============================================')
  console.log('Aucun compte dans la base.')
  console.log('Au premier lancement, l\'app affichera :')
  console.log('  1. Page d\'activation de licence')
  console.log('  2. Wizard de configuration (école + admin)')
  console.log('============================================')

  await prisma.$disconnect()
}

main().catch(e => {
  console.error('❌ Erreur:', e)
  process.exit(1)
})
