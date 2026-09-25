// API : Calcul moyenne élève
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { hasRole } from '@/lib/rbac'
import { calculateGeneralAverage, calculateSubjectAverage } from '@/lib/academic-calculation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (!hasRole(user, ['DIRECTION', 'ADMIN', 'SECRETARY', 'TEACHER', 'PARENT', 'STUDENT'])) {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
    }
    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const url = new URL(req.url)
    const studentId = url.searchParams.get('studentId')
    const classroomId = url.searchParams.get('classroomId')
    const configId = url.searchParams.get('configId')
    const period = url.searchParams.get('period') || 'T1'

    if (!studentId) return NextResponse.json({ ok: false, error: 'studentId requis.' }, { status: 400 })

    if (configId) {
      // Calcul moyenne matière
      const result = await calculateSubjectAverage(studentId, configId)
      return NextResponse.json({ ok: true, subjectAverage: result })
    }

    if (classroomId) {
      // Calcul moyenne générale
      const result = await calculateGeneralAverage(studentId, classroomId, period)
      return NextResponse.json({ ok: true, generalAverage: result })
    }

    return NextResponse.json({ ok: false, error: 'configId ou classroomId requis.' }, { status: 400 })
  } catch (err) {
    console.error('[api/academic/calculate-average] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
