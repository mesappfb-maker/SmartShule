// SmartShule — Callback Google OAuth
// GET /api/auth/google/callback?code=...&state=...
// Échange le code contre un token + crée/connecte l'utilisateur

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSession, setSessionCookie } from '@/lib/auth'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const error = req.nextUrl.searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(error)}`, req.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', req.url))
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = `${process.env.NEXTAUTH_URL || 'https://smart-shule-seven.vercel.app'}/api/auth/google/callback`

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/?error=oauth_not_configured', req.url))
  }

  try {
    // 1. Échanger le code contre un token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      console.error('[google] Token exchange failed:', err)
      return NextResponse.redirect(new URL('/?error=token_exchange_failed', req.url))
    }

    const tokens = await tokenRes.json()

    // 2. Récupérer les infos utilisateur
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    if (!userRes.ok) {
      return NextResponse.redirect(new URL('/?error=userinfo_failed', req.url))
    }

    const googleUser = await userRes.json()
    const { email, given_name, family_name } = googleUser

    if (!email) {
      return NextResponse.redirect(new URL('/?error=no_email', req.url))
    }

    // 3. Trouver ou créer l'utilisateur
    let user = await db.user.findUnique({ where: { email } })
    let isNewUser = false

    if (!user) {
      // Créer un compte PARENT par défaut
      user = await db.user.create({
        data: {
          email,
          passwordHash: `google-oauth:${googleUser.id}`,
          role: 'PARENT',
          displayName: `${given_name || ''} ${family_name || ''}`.trim() || email,
          active: true,
        },
      })
      isNewUser = true

      // Créer le Guardian associé
      const school = await db.school.findFirst()
      if (school) {
        await db.guardian.create({
          data: {
            schoolId: school.id,
            firstName: given_name || '',
            lastName: family_name || '',
            email,
            userId: user.id,
          },
        })
      }
    }

    if (!user.active) {
      return NextResponse.redirect(new URL('/?error=account_disabled', req.url))
    }

    // 4. Créer la session
    const session = await createSession({ userId: user.id })

    const h = await headers()
    await logAudit({
      userId: user.id,
      userName: user.displayName,
      userRole: user.role,
      action: isNewUser ? 'CREATE' : 'LOGIN',
      entityType: 'USER',
      entityId: user.id,
      description: `${isNewUser ? 'Inscription' : 'Connexion'} Google OAuth : ${email}`,
      ipAddress: getClientIP(h),
    })

    // 5. Rediriger vers l'accueil avec cookie de session
    const response = NextResponse.redirect(new URL('/', req.url))
    await setSessionCookie(session.token, session.expiresAt)
    return response
  } catch (err) {
    console.error('[google] Callback error:', err)
    return NextResponse.redirect(new URL('/?error=callback_error', req.url))
  }
}
