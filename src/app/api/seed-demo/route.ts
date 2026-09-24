// API : Seed Démo Complet (14 rôles + 100 élèves)
// ============================================================
// Fonctionne sur Vercel — importe directement le runner (pas d'exec)
import { NextRequest, NextResponse } from 'next/server'
import { runSeedDemo } from '@/lib/seed-demo-runner'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    // Vérifier le secret si configuré
    const seedSecret = process.env.SEED_SECRET
    if (seedSecret) {
      const provided = req.headers.get('x-seed-secret')
      if (provided !== seedSecret) {
        return NextResponse.json({ ok: false, error: 'Non autorisé.' }, { status: 401 })
      }
    }

    const body = await req.json().catch(() => ({}))
    const shouldReset = body?.reset === true

    // allowProduction=true car Vercel = NODE_ENV=production mais on veut seed démo
    const result = await runSeedDemo({
      reset: shouldReset,
      force: shouldReset,
      allowProduction: true,
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[api/seed-demo] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return POST(req)
}
