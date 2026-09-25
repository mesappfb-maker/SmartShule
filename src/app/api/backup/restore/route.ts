// API : Restaurer depuis une sauvegarde
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { hasRole } from '@/lib/rbac'
import { restoreFromBackup } from '@/lib/backup-restore'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (!hasRole(user, ['DIRECTOR', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN'])) {
      return NextResponse.json({ ok: false, error: 'Restauration réservée à la Direction.' }, { status: 403 })
    }
    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const { backupFileName } = await req.json()
    if (!backupFileName) {
      return NextResponse.json({ ok: false, error: 'backupFileName requis.' }, { status: 400 })
    }

    const result = await restoreFromBackup(schoolId, backupFileName, { id: user.id, name: user.displayName, role: user.role })

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[api/backup/restore] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
