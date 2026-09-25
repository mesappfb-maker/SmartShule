// API : Lister les sauvegardes
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { hasRole } from '@/lib/rbac'
import { listBackups } from '@/lib/backup-restore'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (!hasRole(user, ['DIRECTOR', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'AUDITOR'])) {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
    }
    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const backups = await listBackups(schoolId)

    return NextResponse.json({
      ok: true,
      backups,
      total: backups.length,
      totalSize: backups.reduce((sum, b) => sum + b.fileSize, 0),
    })
  } catch (err) {
    console.error('[api/backup/list] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
