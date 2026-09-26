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

    // Requêtes SÉQUENTIELLES (anti EMAXCONNSESSION — pool_size=1 sur Supabase)
    const totalSchools = await db.school.count()
    const activeSchools = totalSchools // Toutes actives par défaut
    const totalUsers = await db.user.count()
    const activeUsers = await db.user.count({ where: { active: true } })
    const demoAccounts = await db.user.count({ where: { isDemoAccount: true } })
    const blockedUsers = await db.user.count({ where: { active: false } })
    const totalLicenses = await db.license.count().catch(() => 0)
    const activeLicenses = await db.license.count({ where: { status: 'ACTIVE' } }).catch(() => 0)
    const expiringLicenses = await db.license.count({ where: { expiresAt: { lt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } } }).catch(() => 0)
    const totalDevices = await db.syncDevice.count().catch(() => 0)
    const activeDevices = await db.syncDevice.count({ where: { status: 'ACTIVE' } }).catch(() => 0)
    const syncErrors = await db.syncError.count({ where: { resolvedAt: null } }).catch(() => 0)
    const auditToday = await db.auditLog.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
    const failedLogins = await db.auditLog.count({ where: { action: 'LOGIN_FAILED', createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })

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
