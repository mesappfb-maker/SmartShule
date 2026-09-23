// SmartShule — Middleware (désactivé)
// ============================================================
// Le middleware de protection staging est désactivé.
// Pour le réactiver, définir STAGING_MODE=true et décommenter le code.

import { NextRequest, NextResponse } from 'next/server'

export function middleware(_req: NextRequest) {
  // Middleware désactivé — pas de protection par mot de passe
  return NextResponse.next()
}

export const config = {
  matcher: [],
}
