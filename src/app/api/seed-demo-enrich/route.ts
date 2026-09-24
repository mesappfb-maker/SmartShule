// API : Enrichissement seed démo (données relationnelles)
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { enrichDemoData } from '@/lib/enrich-demo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const result = await enrichDemoData()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[api/seed-demo-enrich] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return POST(req)
}
