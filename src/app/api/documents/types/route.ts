// API : Types de documents disponibles + RBAC
// ============================================================
import { NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth'
import { DOCUMENT_TYPES_WITH_RBAC } from '@/lib/document-generation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })

    // Filtrer les types que l'utilisateur peut générer
    const allowed = DOCUMENT_TYPES_WITH_RBAC.filter((t) => t.allowedRoles.includes(user.role) || user.role === 'ADMIN')

    return NextResponse.json({ ok: true, types: allowed })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
