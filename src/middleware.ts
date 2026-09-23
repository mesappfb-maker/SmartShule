// SmartShule — Middleware de protection Staging
// ============================================================
// Protège TOUTES les routes du site en mode staging.
// L'utilisateur doit saisir un mot de passe pour accéder au site.
//
// Fonctionnement :
//   1. Vérifie si le cookie `staging_auth` est présent et valide
//   2. Si non → redirige vers /staging-login
//   3. Si oui → laisse passer la requête
//
// Le mot de passe est configurable via STAGING_PASSWORD (env var)
// En production (main), ce middleware ne fait rien (DEV/PROD bypass)

import { NextRequest, NextResponse } from 'next/server'

const STAGING_COOKIE = 'staging_auth'
const STAGING_LOGIN_PATH = '/staging-login'
const STAGING_PASSWORD = process.env.STAGING_PASSWORD || 'SmartShule2026Staging'

// Routes à ignorer (API + assets statiques)
const PUBLIC_PATHS = [
  '/_next',
  '/favicon',
  '/icon',
  '/logo',
  '/manifest',
  '/sw.js',
  '/robots.txt',
]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // En production (pas de STAGING_PASSWORD ou STAGING_MODE != 'true'), on bypass
  if (process.env.STAGING_MODE !== 'true') {
    return NextResponse.next()
  }

  // Ignorer les assets statiques
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Ignorer la page de login staging elle-même
  if (pathname === STAGING_LOGIN_PATH) {
    return NextResponse.next()
  }

  // Vérifier le cookie
  const authCookie = req.cookies.get(STAGING_COOKIE)?.value
  if (authCookie === 'authenticated') {
    return NextResponse.next()
  }

  // Non authentifié → rediriger vers login staging
  const loginUrl = new URL(STAGING_LOGIN_PATH, req.url)
  loginUrl.searchParams.set('redirect', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // Appliquer sur toutes les routes sauf les assets statiques
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon|logo|manifest|sw.js|robots.txt).*)'],
}
