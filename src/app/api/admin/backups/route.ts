// SmartShule — API Sauvegardes (SYSTEM_ADMIN)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { hasRole } from '@/lib/rbac'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (!hasRole(user, ['SYSTEM_ADMIN'])) {
      return NextResponse.json({ ok: false, error: 'Accès réservé.' }, { status: 403 })
    }

    // Si pas de table Backup, on renvoie une liste vide + config par défaut
    const backups = await (db as unknown as { backup?: { findMany: (args: unknown) => Promise<unknown[]> } }).backup?.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    }).catch(() => []) || []

    const rows = (backups as Array<{ id: string; filename: string; type: string; status: string; sizeBytes: number; createdAt: Date }>).map(b => ({
      id: b.id,
      filename: b.filename,
      type: b.type || 'manual',
      status: b.status || 'SUCCESS',
      sizeBytes: b.sizeBytes || 0,
      createdAt: b.createdAt.toISOString(),
    }))

    return NextResponse.json({
      ok: true,
      backups: rows,
      config: {
        frequency: 'Quotidienne (03:00)',
        retentionDays: 30,
        destination: 'Local + Cloud',
        auto: true,
      },
    })
  } catch (err) {
    console.error('[admin/backups] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
