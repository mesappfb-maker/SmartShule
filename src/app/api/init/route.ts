// SmartShule — API d'initialisation (appelée au premier démarrage)
// ============================================================
// GET /api/init — vérifie et initialise la base si vide
// Idempotent : ne fait rien si déjà peuplée

import { NextResponse } from 'next/server'
import { ensureDatabaseInitialized } from '@/lib/auto-init'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    await ensureDatabaseInitialized()
    return NextResponse.json({ ok: true, message: 'Base initialisée' })
  } catch (err) {
    console.error('[api/init] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
