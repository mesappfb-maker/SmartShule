// API : Traitement de la file d'attente (cron endpoint)
// ============================================================
// POST : traite les notifications en retry
// Sécurisé par clé API ou ADMIN

import { NextRequest, NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth'
import { processPendingNotifications } from '@/lib/notifications'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    // Authentification : soit admin, soit clé API dédiée
    const authHeader = req.headers.get('authorization')
    const cronKey = process.env.CRON_API_KEY
    if (cronKey && authHeader === `Bearer ${cronKey}`) {
      const result = await processPendingNotifications()
      return NextResponse.json({ ok: true, ...result })
    }

    // Sinon, vérifier session admin
    const user = await getUserFromSession()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'Non autorisé.' }, { status: 401 })
    }
    const result = await processPendingNotifications()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[api/notifications/process] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
