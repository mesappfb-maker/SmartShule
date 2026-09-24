// API : Génération de documents PDF
// ============================================================
// POST : génère un document PDF (16 types officiels)
// Vérifications: session, schoolId, RBAC type, élève dans école

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { generateDocument, canGenerateDocument, DocumentType } from '@/lib/document-generation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (!['SECRETARY', 'DIRECTION', 'TEACHER', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
    }
    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const body = await req.json()
    const { studentId, documentType, reason, isDuplicata, certificateId } = body

    if (!studentId || !documentType) {
      return NextResponse.json({ ok: false, error: 'studentId et documentType requis.' }, { status: 400 })
    }

    // Vérifier que l'élève appartient à l'école
    const student = await db.student.findUnique({ where: { id: studentId } })
    if (!student || student.schoolId !== schoolId) {
      return NextResponse.json({ ok: false, error: 'Élève introuvable ou hors périmètre.' }, { status: 404 })
    }

    // Vérifier RBAC pour ce type
    if (!canGenerateDocument(user.role, documentType as DocumentType)) {
      return NextResponse.json({
        ok: false,
        error: `Rôle ${user.role} non autorisé à générer ce type de document.`,
      }, { status: 403 })
    }

    const result = await generateDocument(documentType as DocumentType, {
      schoolId,
      studentId,
      certificateId,
      generatedBy: { id: user.id, name: user.displayName, role: user.role },
      reason,
      isDuplicata,
    })

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      pdfUrl: result.pdfUrl,
      pdfFileName: result.pdfFileName,
      referenceNumber: result.referenceNumber,
      verificationCode: result.verificationCode,
      versionId: result.versionId,
      message: 'Document généré avec succès',
    })
  } catch (err) {
    console.error('[api/documents/generate] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
