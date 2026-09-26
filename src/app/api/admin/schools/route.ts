// SmartShule — API Liste des écoles (SYSTEM_ADMIN)
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
    if (!hasRole(user, ['SYSTEM_ADMIN'])) {
      return NextResponse.json({ ok: false, error: 'Accès réservé au Super Administrateur.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ]
    }

    const schools = await db.school.findMany({
      where,
      select: {
        id: true, name: true, email: true, phone: true, address: true,
        logoUrl: true, primaryColor: true, createdAt: true, locale: true, currency: true,
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
      logoUrl: s.logoUrl || null,
      primaryColor: s.primaryColor || '#2563EB',
      active: true,
      createdAt: s.createdAt.toISOString(),
    }))

    return NextResponse.json({ ok: true, schools: rows, total: rows.length })
  } catch (err) {
    console.error('[admin/schools] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
