// SmartShule — Initie le login Google OAuth 2.0
// GET /api/auth/google → redirige vers Google

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = `${process.env.NEXTAUTH_URL || 'https://smart-shule-seven.vercel.app'}/api/auth/google/callback`
  const scope = 'openid email profile'
  const state = Math.random().toString(36).substring(7)

  if (!clientId) {
    return NextResponse.json(
      { error: 'Google OAuth non configuré. Ajoutez GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET dans les variables d\'environnement.' },
      { status: 500 }
    )
  }

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', scope)
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('prompt', 'select_account')

  return NextResponse.redirect(authUrl)
}
