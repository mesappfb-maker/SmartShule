// API : Historique des versions d'un document / certificat
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { hasRole } from '@/lib/rbac'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (!hasRole(user, ['SECRETARY', 'DIRECTION', 'ADMIN'])) {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
    }
    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const url = new URL(req.url)
    const certificateId = url.searchParams.get('certificateId')
    const studentId = url.searchParams.get('studentId')

    const where: any = { schoolId }
    if (certificateId) where.certificateId = certificateId
    if (studentId) {
      where.OR = [
        { certificateId: { in: (await db.certificate.findMany({ where: { studentId }, select: { id: true } })).map((c) => c.id) } },
      ]
    }

    const versions = await db.documentVersion.findMany({
      where,
      orderBy: [{ versionNumber: 'desc' }],
    })

    return NextResponse.json({
      ok: true,
      versions: versions.map((v) => ({
        id: v.id,
        certificateId: v.certificateId,
        versionNumber: v.versionNumber,
        isOriginal: v.isOriginal,
        isDuplicata: v.isDuplicata,
        pdfUrl: v.pdfUrl,
        pdfFileName: v.pdfFileName,
        pdfHash: v.pdfHash,
        verificationCode: v.verificationCode,
        generatedById: v.generatedById,
        generatedByName: v.generatedByName,
        generatedAt: v.generatedAt.toISOString(),
        createdAt: v.createdAt.toISOString(),
      })),
    })
  } catch (err) {
    console.error('[api/documents/versions GET] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
