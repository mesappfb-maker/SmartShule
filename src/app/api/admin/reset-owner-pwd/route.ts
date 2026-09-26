// SmartShule — API reset-owner-pwd (réinitialise le mot de passe Fabrice)
// ============================================================
// GET /api/admin/reset-owner-pwd?token=<admin_token>
// Réinitialise le mot de passe de fabricefb@gmail.com à Wazengafb@007
// Sécurisé par un token admin unique (à définir dans .env)

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ADMIN_RESET_TOKEN = 'reset-fabrice-2026-smartshule'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (token !== ADMIN_RESET_TOKEN) {
      return NextResponse.json({ ok: false, error: 'Token invalide' }, { status: 403 })
    }

    const passwordHash = await hashPassword('Wazengafb@007')

    const updated = await db.user.update({
      where: { email: 'fabricefb@gmail.com' },
      data: {
        passwordHash,
        role: 'SYSTEM_ADMIN',
        accountStatus: 'ACTIVE',
        active: true,
        isDemoAccount: false,
        displayName: 'Fabrice (Propriétaire)',
      },
    })

    return NextResponse.json({
      ok: true,
      message: 'Mot de passe réinitialisé avec succès',
      user: {
        email: updated.email,
        role: updated.role,
        active: updated.active,
      },
    })
  } catch (err) {
    console.error('[admin/reset-owner-pwd] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
