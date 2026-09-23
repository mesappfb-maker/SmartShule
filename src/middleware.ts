// SmartShule — Middleware de protection Staging
// ============================================================
// Ne s'active QUE si STAGING_MODE=true
// En production (main), STAGING_MODE n'est pas défini → bypass total

import { NextRequest, NextResponse } from 'next/server'

const STAGING_COOKIE = 'staging_auth'
const STAGING_LOGIN_PATH = '/staging-login'

const PUBLIC_PATHS = [
  '/_next',
  '/favicon',
  '/icon',
  '/logo',
  '/manifest',
  '/sw.js',
  '/robots.txt',
  '/api/staging-auth',
  '/staging-login',
]

export function middleware(req: NextRequest) {
  // CRITIQUE : Ne rien faire si STAGING_MODE n'est pas 'true'
  // En production (main), cette variable n'existe pas → bypass
  if (process.env.STAGING_MODE !== 'true') {
    return NextResponse.next()
  }

  const { pathname } = req.nextUrl

  // Ignorer les assets statiques + API staging-auth + page login
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon|logo|manifest|sw.js|robots.txt).*)'],
}
