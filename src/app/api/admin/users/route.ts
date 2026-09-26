// SmartShule — API Liste des utilisateurs (SYSTEM_ADMIN)
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

    const users = await db.user.findMany({
      select: {
        id: true, displayName: true, email: true, role: true,
        active: true, isDemoAccount: true, lastLoginAt: true,
        guardian: { select: { school: { select: { name: true } } } },
        student: { select: { school: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })

    const rows = users.map(u => ({
      id: u.id,
      displayName: u.displayName,
      email: u.email,
      role: u.role,
      active: u.active,
      isDemoAccount: u.isDemoAccount || false,
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      schoolName: u.guardian?.school?.name || u.student?.school?.name || null,
    }))

    return NextResponse.json({ ok: true, users: rows })
  } catch (err) {
    console.error('[admin/users] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
