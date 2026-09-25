// SmartShule — Dashboard Super Admin (TECHNIQUE, pas métier)
// ============================================================
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { hasRole } from '@/lib/rbac'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (!hasRole(user, ['SYSTEM_ADMIN'])) {
      return NextResponse.json({ ok: false, error: 'Dashboard réservé au Super Administrateur.' }, { status: 403 })
    }

    const [
      totalSchools,
      activeSchools,
      totalUsers,
      activeUsers,
      demoAccounts,
      blockedUsers,
      totalLicenses,
      activeLicenses,
      expiringLicenses,
      totalDevices,
      activeDevices,
      syncErrors,
      auditToday,
      failedLogins,
    ] = await Promise.all([
      db.school.count(),
      db.school.count({ where: {} }), // Toutes actives par défaut
      db.user.count(),
      db.user.count({ where: { active: true } }),
      db.user.count({ where: { isDemoAccount: true } }),
      db.user.count({ where: { active: false } }),
      db.license.count().catch(() => 0),
      db.license.count({ where: { status: 'ACTIVE' } }).catch(() => 0),
      db.license.count({ where: { expiresAt: { lt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } } }).catch(() => 0),
      db.syncDevice.count().catch(() => 0),
      db.syncDevice.count({ where: { status: 'ACTIVE' } }).catch(() => 0),
      db.syncError.count({ where: { resolvedAt: null } }).catch(() => 0),
      db.auditLog.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
      db.auditLog.count({ where: { action: 'LOGIN_FAILED', createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
    ])

    return NextResponse.json({
      ok: true,
      stats: {
        // Écoles
        totalSchools, activeSchools,
        // Licences
        totalLicenses, activeLicenses, expiringLicenses,
        // Utilisateurs
        totalUsers, activeUsers, demoAccounts, blockedUsers,
        // Sécurité
        failedLogins,
        auditToday,
        // Synchronisation
        totalDevices, activeDevices, syncErrors,
      },
      _note: 'Dashboard technique SYSTEM_ADMIN — aucun KPI métier (élèves, factures, caisse, notes)',
    })
  } catch (err) {
    console.error('[api/admin/dashboard] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
