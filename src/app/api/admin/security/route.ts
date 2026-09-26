// SmartShule — API Sécurité (SYSTEM_ADMIN)
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
    if (!hasRole(user, ['SYSTEM_ADMIN', 'AUDITOR'])) {
      return NextResponse.json({ ok: false, error: 'Accès réservé.' }, { status: 403 })
    }

    const blockedUsers = await db.user.findMany({
      where: { active: false },
      select: { id: true, displayName: true, email: true, role: true },
      take: 100,
    })

    return NextResponse.json({
      ok: true,
      policies: {
        enforceTwoFactor: false,
        sessionTimeoutMinutes: 60,
        maxLoginAttempts: 5,
        lockoutDurationMinutes: 15,
        passwordMinLength: 8,
        passwordExpiryDays: 90,
      },
      blockedUsers: blockedUsers.map(u => ({
        id: u.id, displayName: u.displayName, email: u.email, role: u.role,
        active: false, isDemoAccount: false, lastLoginAt: null, schoolName: null,
      })),
    })
  } catch (err) {
    console.error('[admin/security] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
