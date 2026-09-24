// API : Modèles d'import téléchargeables
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { IMPORT_CONFIGS, generateImportTemplate, ImportType } from '@/lib/import-engine'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })

    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'list'

    if (action === 'list') {
      // Liste des types disponibles (filtrés par RBAC)
      const allowed = Object.values(IMPORT_CONFIGS).filter((c) =>
        c.allowedRoles.includes(user.role) || user.role === 'ADMIN'
      )
      return NextResponse.json({ ok: true, configs: allowed })
    }

    if (action === 'download') {
      const type = url.searchParams.get('type') as ImportType
      const format = (url.searchParams.get('format') || 'xlsx') as 'csv' | 'xlsx'
      const config = IMPORT_CONFIGS[type]
      if (!config) return NextResponse.json({ ok: false, error: 'Type inconnu.' }, { status: 400 })
      if (!config.allowedRoles.includes(user.role) && user.role !== 'ADMIN') {
        return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
      }

      const result = await generateImportTemplate(type, format)
      return new NextResponse(new Uint8Array(result.buffer), {
        status: 200,
        headers: {
          'Content-Type': result.mimeType,
          'Content-Disposition': `attachment; filename="${result.filename}"`,
        },
      })
    }

    return NextResponse.json({ ok: false, error: `Action "${action}" inconnue.` }, { status: 400 })
  } catch (err) {
    console.error('[api/imports/template] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
