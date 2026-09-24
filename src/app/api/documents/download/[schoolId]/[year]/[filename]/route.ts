// API : Téléchargement sécurisé de PDF (par schoolId + year + filename)
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import fs from 'fs/promises'
import path from 'path'

const STORAGE_ROOT = process.env.STORAGE_ROOT || '/home/z/my-project/storage/documents'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: Promise<{ schoolId: string; year: string; filename: string }> }) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })

    const { schoolId, year, filename } = await params

    const userSchoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!userSchoolId || userSchoolId !== schoolId) {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
    }

    const safeFilename = path.basename(filename)
    const safeYear = path.basename(year)
    const safeSchoolId = path.basename(schoolId)

    const fullPath = path.join(STORAGE_ROOT, safeSchoolId, safeYear, safeFilename)
    if (!fullPath.startsWith(STORAGE_ROOT)) {
      return NextResponse.json({ ok: false, error: 'Chemin invalide.' }, { status: 400 })
    }

    const buffer = await fs.readFile(fullPath)

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${safeFilename}"`,
        'Cache-Control': 'private, no-cache',
      },
    })
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return NextResponse.json({ ok: false, error: 'Document introuvable.' }, { status: 404 })
    }
    console.error('[api/documents/download] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
