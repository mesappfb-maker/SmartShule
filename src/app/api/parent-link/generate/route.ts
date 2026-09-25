// API : Génération code de liaison parent-élève
// POST { action: 'generate', studentId } → génère un code pour l'élève
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { hasRole } from '@/lib/rbac'
import { createLinkCode } from '@/lib/parent-link'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (!hasRole(user, ['SECRETARY', 'DIRECTION', 'ADMIN', 'ADMISSIONS_OFFICER'])) {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
    }
    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const { studentId } = await req.json()
    if (!studentId) return NextResponse.json({ ok: false, error: 'studentId requis.' }, { status: 400 })

    const linkCode = await createLinkCode(studentId, schoolId, user.id, user.displayName)

    const h = await headers()
    await logAudit({
      userId: user.id, userName: user.displayName, userRole: user.role, schoolId,
      action: 'CREATE', entityType: 'PARENT_LINK_CODE', entityId: linkCode.id,
      description: `Code de liaison généré pour élève ${studentId}`,
      ipAddress: getClientIP(h),
      // Ne pas stocker le code complet dans les logs
      metadata: { studentId, codePrefix: linkCode.code.slice(0, 4) + '****' },
    })

    return NextResponse.json({
      ok: true,
      code: linkCode.code,
      expiresAt: linkCode.expiresAt.toISOString(),
      message: 'Code de liaison généré. Remettez-le au parent de façon sécurisée.',
    })
  } catch (err) {
    console.error('[api/parent-link/generate] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
