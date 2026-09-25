// API : Rollback d'un import
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { hasRole } from '@/lib/rbac'
import { rollbackImport } from '@/lib/import-engine'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (!hasRole(user, ['SECRETARY', 'ADMIN'])) {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé. SECRETARY/ADMIN requis.' }, { status: 403 })
    }

    const body = await req.json()
    const { jobId, reason } = body
    if (!jobId || !reason) {
      return NextResponse.json({ ok: false, error: 'jobId et reason requis.' }, { status: 400 })
    }

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const result = await rollbackImport(jobId, schoolId, user.id, user.displayName, user.role, reason)

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, deletedCount: result.deletedCount, message: result.message })
  } catch (err) {
    console.error('[api/imports/rollback] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
