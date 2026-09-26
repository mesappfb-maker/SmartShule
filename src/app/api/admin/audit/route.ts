// SmartShule — API Journal d'audit (SYSTEM_ADMIN, AUDITOR)
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
    const action = searchParams.get('action')

    const where = action ? { action } : {}
    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: { user: { select: { displayName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      db.auditLog.count({ where }),
    ])

    const rows = logs.map(l => ({
      id: l.id,
      action: l.action,
      userName: (l as { user?: { displayName: string } }).user?.displayName || l.userName || null,
      target: l.entityType ? `${l.entityType}${l.entityId ? ':' + l.entityId.slice(0, 8) : ''}` : null,
      ip: l.ipAddress || null,
      details: l.metadata ? (() => { try { return JSON.parse(l.metadata) } catch { return l.metadata } })() : null,
      createdAt: l.createdAt.toISOString(),
    }))

    return NextResponse.json({ ok: true, logs: rows, total })
  } catch (err) {
    console.error('[admin/audit] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
