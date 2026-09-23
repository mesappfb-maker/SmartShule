// API : Login (remplace le Server Action qui échouait sur Vercel)
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, createSession, setSessionCookie } from '@/lib/auth'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')

    if (!email || !password) {
      return NextResponse.json({ ok: false, error: 'Email et mot de passe obligatoires.' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Email ou mot de passe incorrect.' }, { status: 401 })
    }

    if (!user.active) {
      return NextResponse.json({ ok: false, error: 'Compte désactivé.' }, { status: 403 })
    }

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ ok: false, error: 'Email ou mot de passe incorrect.' }, { status: 401 })
    }

    const h = await headers()
    const ipAddress = getClientIP(h)
    const userAgent = h.get('user-agent') || undefined

    const { token, expiresAt } = await createSession({
      userId: user.id,
      ipAddress,
      userAgent,
    })
    await setSessionCookie(token, expiresAt)

    // Audit (ne pas faire échouer le login si l'audit échoue)
    try {
      await logAudit({
        userId: user.id,
        userName: user.displayName,
        userRole: user.role,
        action: 'LOGIN',
        entityType: 'SESSION',
        description: 'Connexion réussie',
        ipAddress,
      })
    } catch (auditErr) {
      console.error('[login] Audit error (non-blocking):', auditErr)
    }

    return NextResponse.json({
      ok: true,
      role: user.role,
      displayName: user.displayName,
      redirect: '/dashboard',
    })
  } catch (err) {
    console.error('[login] Error:', err)
    return NextResponse.json(
      { ok: false, error: (err as Error).message || 'Erreur de connexion.' },
      { status: 500 }
    )
  }
}
