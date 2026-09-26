// SmartShule — Seed commercial (v1.2.0)
// ============================================================
// Crée UNIQUEMENT :
//   1. Une école générique vide (Mon École / Bienvenue)
//   2. Une année scolaire active
//   3. Un compte admin propriétaire unique : fabricefb@gmail.com / Wazengafb@007
//
// AUCUNE donnée démo. Utilisé pour l'installateur commercial.

import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/auth'

const prisma = new PrismaClient()

async function main() {
  console.log('🧹 Nettoyage AGRESSIF de la base...')

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
  console.log('✅ Base totalement vidée\n')

  // École générique
  console.log('🏫 Création de l\'école...')
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

  // Année scolaire
  console.log('📅 Création de l\'année scolaire...')
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

  // Compte propriétaire
  console.log('👤 Création du compte propriétaire...')
  const adminPassword = await hashPassword('Wazengafb@007')
  const admin = await prisma.user.create({
    data: {
      email: 'fabricefb@gmail.com',
      passwordHash: adminPassword,
      role: 'SYSTEM_ADMIN',
      accountStatus: 'ACTIVE',
      displayName: 'Fabrice (Propriétaire)',
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
      description: 'Initialisation du système — installation commerciale',
      ipAddress: '127.0.0.1',
      metadata: JSON.stringify({
        schoolName: school.name,
        academicYear: academicYear.label,
        version: '1.2.0-commercial',
        owner: 'fabricefb@gmail.com',
        timestamp: new Date().toISOString(),
      }),
    },
  })

  console.log('')
  console.log('============================================')
  console.log('✅ INSTALLATION COMMERCIALE TERMINÉE')
  console.log('============================================')
  console.log(`🏫 École : ${school.name}`)
  console.log(`📅 Année : ${academicYear.label}`)
  console.log(`👤 Propriétaire : fabricefb@gmail.com`)
  console.log(`🔑 Mot de passe : Wazengafb@007`)
  console.log('============================================')

  await prisma.$disconnect()
}

main().catch(e => {
  console.error('❌ Erreur:', e)
  process.exit(1)
})
