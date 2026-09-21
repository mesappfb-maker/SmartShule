// SmartShule — Endpoint Healthcheck (Railway/Render/Vercel)
// ============================================================
// Répond rapidement (200 OK) pour confirmer que le serveur tourne.
// N'effectue PAS de requête DB pour ne pas ralentir le healthcheck.

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'smartshule',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    region: process.env.RAILWAY_REGION || process.env.VERCEL_REGION || 'unknown',
  }, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    }
  })
}
