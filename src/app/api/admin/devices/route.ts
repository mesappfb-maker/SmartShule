// SmartShule — API Liste des appareils sync (SYSTEM_ADMIN)
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
      return NextResponse.json({ ok: false, error: 'Accès réservé au Super Administrateur.' }, { status: 403 })
    }

    const devices = await db.syncDevice.findMany({
      include: { school: { select: { name: true } } },
      orderBy: { lastSeenAtUtc: 'desc' },
    }).catch(() => [])

    const rows = devices.map(d => ({
      id: d.id,
      uuid: d.deviceId,
      name: d.appVersion || null,
      platform: d.deviceType || 'unknown',
      status: d.status,
      lastSyncAt: d.lastSeenAtUtc ? d.lastSeenAtUtc.toISOString() : null,
      schoolName: (d as { school?: { name: string } }).school?.name || null,
    }))

    return NextResponse.json({ ok: true, devices: rows })
  } catch (err) {
    console.error('[admin/devices] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
