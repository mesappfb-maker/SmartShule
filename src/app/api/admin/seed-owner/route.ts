// SmartShule — API seed-owner (crée le compte Fabrice si absent)
// ============================================================
// GET /api/admin/seed-owner
// Idempotent : ne fait rien si fabricefb@gmail.com existe déjà.
// Si le compte existe mais avec un mauvais rôle → met à jour vers SYSTEM_ADMIN.

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const existing = await db.user.findUnique({ where: { email: 'fabricefb@gmail.com' } })

    if (existing) {
      // Vérifier que le rôle est correct — sinon corriger
      if (existing.role !== 'SYSTEM_ADMIN' || !existing.active) {
        const updated = await db.user.update({
          where: { id: existing.id },
          data: {
            role: 'SYSTEM_ADMIN',
            accountStatus: 'ACTIVE',
            active: true,
            isDemoAccount: false,
            displayName: 'Fabrice (Propriétaire)',
          },
        })
        return NextResponse.json({
          ok: true,
          message: 'Compte propriétaire corrigé (rôle mis à jour vers SYSTEM_ADMIN)',
          user: { email: updated.email, role: updated.role, active: updated.active },
        })
      }

      return NextResponse.json({
        ok: true,
        message: 'Compte propriétaire déjà existant',
        user: { email: existing.email, role: existing.role, active: existing.active },
      })
    }

    // Crée le compte propriétaire
    const passwordHash = await hashPassword('Wazengafb@007')
    const owner = await db.user.create({
      data: {
        email: 'fabricefb@gmail.com',
        passwordHash,
        role: 'SYSTEM_ADMIN',
        accountStatus: 'ACTIVE',
        displayName: 'Fabrice (Propriétaire)',
        active: true,
        isDemoAccount: false,
      },
    })

    return NextResponse.json({
      ok: true,
      message: 'Compte propriétaire créé avec succès',
      user: { email: owner.email, role: owner.role, active: owner.active },
    })
  } catch (err) {
    console.error('[admin/seed-owner] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
