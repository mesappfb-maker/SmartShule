// SmartShule — API Liste des écoles (SYSTEM_ADMIN)
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

    const schools = await db.school.findMany({
      select: {
        id: true, name: true, email: true, phone: true, address: true,
        createdAt: true, locale: true, currency: true,
      },
      orderBy: { name: 'asc' },
    })

    const rows = schools.map(s => ({
      id: s.id,
      name: s.name,
      code: s.id.slice(-6).toUpperCase(),
      email: s.email || null,
      phone: s.phone || null,
      city: s.address || null,
      active: true,
      createdAt: s.createdAt.toISOString(),
    }))

    return NextResponse.json({ ok: true, schools: rows })
  } catch (err) {
    console.error('[admin/schools] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
