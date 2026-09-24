// API : Centre de conflits de synchronisation
// ============================================================
// GET : liste des conflits (filtrés par statut, type)
// POST : résoudre un conflit (garder local, garder cloud, fusionner, revue)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { resolveConflict, CONFLICT_STRATEGIES } from '@/lib/offline'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (!['SECRETARY', 'DIRECTION', 'ACCOUNTANT', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
    }

    const url = new URL(req.url)
    const status = url.searchParams.get('status') || 'OPEN'
    const aggregateType = url.searchParams.get('aggregateType')

    const where: any = { status }
    if (aggregateType) where.aggregateType = aggregateType

    const conflicts = await db.syncConflict.findMany({
      where,
      orderBy: [{ createdAtUtc: 'desc' }],
      take: 100,
    })

    // Stats
    const [openCount, underReviewCount, resolvedCount] = await Promise.all([
      db.syncConflict.count({ where: { status: 'OPEN' } }),
      db.syncConflict.count({ where: { status: 'UNDER_REVIEW' } }),
      db.syncConflict.count({ where: { status: 'RESOLVED' } }),
    ])

    return NextResponse.json({
      ok: true,
      conflicts: conflicts.map((c) => ({
        id: c.id,
        conflictId: c.conflictId,
        operationId: c.operationId,
        aggregateType: c.aggregateType,
        aggregateId: c.aggregateId,
        localPayload: JSON.parse(c.localPayloadJson),
        serverPayload: c.serverPayloadJson ? JSON.parse(c.serverPayloadJson) : null,
        baseVersion: c.baseVersion,
        serverVersion: c.serverVersion,
        conflictType: c.conflictType,
        status: c.status,
        resolutionStrategy: c.resolutionStrategy,
        resolutionNote: c.resolutionNote,
        resolvedAt: c.resolvedAtUtc?.toISOString() || null,
        createdAt: c.createdAtUtc.toISOString(),
        suggestedStrategy: suggestStrategy(c.aggregateType, c.conflictType),
      })),
      stats: { open: openCount, underReview: underReviewCount, resolved: resolvedCount },
      strategies: CONFLICT_STRATEGIES,
    })
  } catch (err) {
    console.error('[api/sync/conflicts GET] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

function suggestStrategy(aggregateType: string, conflictType: string): string {
  // Chercher une stratégie par défaut selon le type d'agrégat
  const key = `${aggregateType}_${conflictType}`
  if (CONFLICT_STRATEGIES[key]) return CONFLICT_STRATEGIES[key]
  if (CONFLICT_STRATEGIES[aggregateType]) return CONFLICT_STRATEGIES[aggregateType]
  return 'BLOCKING_REVIEW' // défaut sécurisé
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (!['SECRETARY', 'DIRECTION', 'ACCOUNTANT', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
    }

    const body = await req.json()
    const { action } = body

    if (action === 'resolve') {
      const { conflictId, strategy, note } = body
      if (!conflictId || !strategy) {
        return NextResponse.json({ ok: false, error: 'conflictId et strategy requis.' }, { status: 400 })
      }

      await resolveConflict(conflictId, {
        strategy,
        note,
        resolvedById: user.id,
        resolvedByName: user.displayName,
      })

      return NextResponse.json({ ok: true, message: 'Conflit résolu' })
    }

    if (action === 'assign') {
      const { conflictId, assignedToId } = body
      if (!conflictId) return NextResponse.json({ ok: false, error: 'conflictId requis.' }, { status: 400 })

      await db.syncConflict.update({
        where: { conflictId },
        data: { assignedToId, status: 'UNDER_REVIEW' },
      })

      return NextResponse.json({ ok: true, message: 'Conflit assigné pour revue' })
    }

    return NextResponse.json({ ok: false, error: `Action "${action}" inconnue.` }, { status: 400 })
  } catch (err) {
    console.error('[api/sync/conflicts POST] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
