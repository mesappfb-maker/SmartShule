// SmartShule — API Liste des licences (SYSTEM_ADMIN)
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

    const licenses = await db.license.findMany({
      include: { school: { select: { name: true } } },
      orderBy: { issuedAt: 'desc' },
    }).catch(() => [])

    const rows = licenses.map(l => ({
      id: l.id,
      key: l.key,
      plan: l.plan,
      status: l.status,
      issuedAt: l.issuedAt.toISOString(),
      expiresAt: l.expiresAt.toISOString(),
      schoolName: (l as { school?: { name: string } }).school?.name || '—',
    }))

    return NextResponse.json({ ok: true, licenses: rows })
  } catch (err) {
    console.error('[admin/licenses] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
