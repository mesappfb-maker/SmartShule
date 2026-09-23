// API : Authentification Staging
// ============================================================
// Vérifie le mot de passe et définit le cookie staging_auth

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const STAGING_PASSWORD = process.env.STAGING_PASSWORD || 'SmartShule2026Staging'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const password = String(formData.get('password') || '')
    const redirect = String(formData.get('redirect') || '/')

    if (password === STAGING_PASSWORD) {
      const response = NextResponse.redirect(new URL(redirect, req.url))
      response.cookies.set('staging_auth', 'authenticated', {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 jours
        path: '/',
      })
      return response
    }

    // Mauvais mot de passe → retour page login avec erreur
    const loginUrl = new URL('/staging-login', req.url)
    loginUrl.searchParams.set('error', '1')
    if (redirect && redirect !== '/') {
      loginUrl.searchParams.set('redirect', redirect)
    }
    return NextResponse.redirect(loginUrl)
  } catch (err) {
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}
