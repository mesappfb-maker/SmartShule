// SmartShule — API Échecs de connexion (SYSTEM_ADMIN, AUDITOR)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { hasRole } from '@/lib/rbac'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (!hasRole(user, ['SYSTEM_ADMIN', 'AUDITOR'])) {
      return NextResponse.json({ ok: false, error: 'Accès réservé.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 1000)

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    // Séquentiel (anti EMAXCONNSESSION)
    const logs = await db.auditLog.findMany({
      where: { action: 'LOGIN_FAILED', createdAt: { gte: since } },
      include: { user: { select: { displayName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    const total = await db.auditLog.count({ where: { action: 'LOGIN_FAILED', createdAt: { gte: since } } })

    const rows = logs.map(l => ({
      id: l.id,
      action: l.action,
      userName: (l as { user?: { displayName: string } }).user?.displayName || l.userName || null,
      userEmail: (l as { user?: { email: string } }).user?.email || null,
      target: null,
      ip: l.ipAddress || null,
      details: l.metadata ? (() => { try { return JSON.parse(l.metadata) } catch { return l.metadata } })() : null,
      createdAt: l.createdAt.toISOString(),
    }))

    return NextResponse.json({ ok: true, logs: rows, total })
  } catch (err) {
    console.error('[admin/failed-logins] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
