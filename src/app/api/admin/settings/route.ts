// SmartShule — API Paramètres système (SYSTEM_ADMIN)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { hasRole } from '@/lib/rbac'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEFAULT_SETTINGS: Record<string, string | number | boolean> = {
  'app.name': 'SmartShule',
  'app.version': '1.0.0',
  'app.timezone': 'Africa/Kinshasa',
  'app.currency': 'FC',
  'app.language': 'fr',
  'sync.intervalSeconds': 60,
  'sync.retryMax': 3,
  'backup.enabled': true,
  'backup.retentionDays': 30,
  'security.passwordMinLength': 8,
  'security.sessionTimeoutMinutes': 60,
}

export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (!hasRole(user, ['SYSTEM_ADMIN'])) {
      return NextResponse.json({ ok: false, error: 'Accès réservé.' }, { status: 403 })
    }

    return NextResponse.json({ ok: true, settings: DEFAULT_SETTINGS })
  } catch (err) {
    console.error('[admin/settings] GET Error:', err)
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
    // Pour l'instant on ne persiste pas — on renvoie juste OK
    return NextResponse.json({ ok: true, key: body.key, value: body.value })
  } catch (err) {
    console.error('[admin/settings] POST Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
