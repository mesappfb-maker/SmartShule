// API : Statut de synchronisation (offline-first)
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { getSyncStatus, getLicenseStatus } from '@/lib/offline'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const [syncStatus, licStatus] = await Promise.all([
      getSyncStatus(),
      getLicenseStatus(schoolId),
    ])

    // Déterminer l'état de connexion
    let connectionState: string
    if (licStatus?.isReadOnly) {
      connectionState = 'LICENSE_LIMITED'
    } else if (syncStatus.conflictCount > 0) {
      connectionState = 'CONFLICT'
    } else if (syncStatus.errorCount > 0) {
      connectionState = 'ERROR'
    } else if (syncStatus.pendingCount > 0) {
      connectionState = 'OFFLINE' // opérations en attente
    } else {
      connectionState = 'ONLINE'
    }

    return NextResponse.json({
      ok: true,
      connectionState,
      sync: syncStatus,
      license: licStatus,
      banner: getBannerMessage(connectionState, syncStatus, licStatus),
    })
  } catch (err) {
    console.error('[api/sync/status] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

function getBannerMessage(state: string, sync: any, license: any): string {
  switch (state) {
    case 'ONLINE':
      return 'En ligne'
    case 'OFFLINE':
      return `Hors ligne — ${sync.pendingCount} opération(s) en attente de synchronisation`
    case 'SYNCING':
      return 'Synchronisation en cours...'
    case 'ERROR':
      return `Erreur de synchronisation — ${sync.errorCount} erreur(s)`
    case 'CONFLICT':
      return `${sync.conflictCount} conflit(s) à résoudre`
    case 'LICENSE_LIMITED':
      return licStatus?.isExpired
        ? `Licence expirée — mode lecture seule. ${licStatus?.daysGraceRemaining} jours de grâce restants.`
        : `Limite atteinte : ${licStatus?.currentStudents}/${licStatus?.maxStudents} élèves`
    default:
      return state
  }
}
