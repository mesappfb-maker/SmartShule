// SmartShule — API Synchronisation (SYSTEM_ADMIN)
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
      return NextResponse.json({ ok: false, error: 'Accès réservé.' }, { status: 403 })
    }

    // Séquentiel (anti EMAXCONNSESSION)
    const devices = await db.syncDevice.findMany({
      include: { school: { select: { name: true, logoUrl: true } } },
      orderBy: { lastSeenAtUtc: 'desc' },
      take: 100,
    }).catch(() => [])

    const errors = await db.syncError.findMany({
      where: { resolvedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }).catch(() => [])

    const totalErrors = await db.syncError.count().catch(() => 0)
    const pendingErrors = await db.syncError.count({ where: { resolvedAt: null } }).catch(() => 0)
    const resolvedErrors = await db.syncError.count({ where: { resolvedAt: { not: null } } }).catch(() => 0)

    return NextResponse.json({
      ok: true,
      devices: devices.map(d => ({
        id: d.id, uuid: d.deviceId, name: d.appVersion || null,
        platform: d.deviceType || 'unknown', status: d.status,
        lastSyncAt: d.lastSeenAtUtc ? d.lastSeenAtUtc.toISOString() : null,
        schoolName: (d as { school?: { name: string } }).school?.name || null,
        schoolLogo: (d as { school?: { logoUrl: string } }).school?.logoUrl || null,
      })),
      errors: errors.map(e => ({
        id: e.id,
        operation: e.errorCode || 'unknown',
        errorMessage: e.errorMessage || '',
        resolvedAt: e.resolvedAt ? e.resolvedAt.toISOString() : null,
        createdAt: e.createdAt.toISOString(),
      })),
      stats: { total: totalErrors, pending: pendingErrors, resolved: resolvedErrors },
    })
  } catch (err) {
    console.error('[admin/sync] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
