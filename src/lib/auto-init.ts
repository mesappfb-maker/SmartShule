// SmartShule — Auto-initialisation de la base (installateur propre)
// ============================================================
// Vérifie au démarrage si la base a au moins 1 école.
// Si non, exécute le seed minimal (1 école générique + 1 admin).
// Idempotent : ne fait rien si la base est déjà peuplée.

import { db } from './db'
import { hashPassword } from './auth'

let initialized = false

export async function ensureDatabaseInitialized(): Promise<void> {
  if (initialized) return

  try {
    const schoolCount = await db.school.count().catch(() => 0)

    if (schoolCount > 0) {
      // Base déjà peuplée — ne rien faire
      initialized = true
      return
    }

    console.log('[init] Base vide — exécution du seed minimal...')

    // 1. Créer l'école générique
    const school = await db.school.create({
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

    // 2. Branding initial
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

    // 3. Année scolaire active
    const now = new Date()
    await db.academicYear.create({
      data: {
        schoolId: school.id,
        label: `${now.getFullYear()}-${now.getFullYear() + 1}`,
        startDate: new Date(now.getFullYear(), 8, 1),
        endDate: new Date(now.getFullYear() + 1, 6, 15),
        active: true,
      },
    })

    // 4. Admin unique
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
      },
    })

    // 5. Audit log
    await db.auditLog.create({
      data: {
        schoolId: school.id,
        userId: admin.id,
        userName: admin.displayName,
        userRole: admin.role,
        action: 'SYSTEM_INIT',
        entityType: 'SCHOOL',
        entityId: school.id,
        description: 'Initialisation automatique du système',
        ipAddress: '127.0.0.1',
        metadata: JSON.stringify({
          schoolName: school.name,
          version: '1.1.0-clean',
          timestamp: new Date().toISOString(),
        }),
      },
    })

    console.log('[init] ✅ Initialisation terminée')
    console.log('[init] Admin : admin@mon-ecole.cd / Admin@2026')
    initialized = true
  } catch (err) {
    console.error('[init] Erreur:', err)
    // Ne pas planter l'app — l'utilisateur pourra seed manuellement
  }
}
