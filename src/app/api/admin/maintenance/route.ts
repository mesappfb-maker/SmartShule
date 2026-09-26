// SmartShule — API Maintenance (SYSTEM_ADMIN)
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

    // Pour l'instant, on renvoie une config statique (pas encore en base)
    return NextResponse.json({
      ok: true,
      maintenanceMode: false,
      scheduledAt: null,
      message: null,
    })
  } catch (err) {
    console.error('[admin/maintenance] GET Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (!hasRole(user, ['SYSTEM_ADMIN'])) {
      return NextResponse.json({ ok: false, error: 'Accès réservé.' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    // Pour l'instant, on simule juste le retour — pas encore persisté en base
    return NextResponse.json({
      ok: true,
      maintenanceMode: !!body.enabled,
      scheduledAt: body.scheduledAt || null,
      message: body.message || null,
    })
  } catch (err) {
    console.error('[admin/maintenance] POST Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
