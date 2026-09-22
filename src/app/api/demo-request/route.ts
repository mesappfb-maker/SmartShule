// API : Demande de démonstration
// ============================================================
// POST /api/demo-request
// Stocke la demande et notifie l'équipe commerciale

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { schoolName, directorName, email, phone, city, studentCount, message } = body

    if (!schoolName || !email || !phone) {
      return NextResponse.json({ ok: false, error: 'Nom école, email et téléphone obligatoires.' }, { status: 400 })
    }

    // Trouver le premier utilisateur ADMIN ou DIRECTION pour notifier
    const admin = await db.user.findFirst({
      where: { role: { in: ['ADMIN', 'DIRECTION'] }, active: true },
      select: { id: true, displayName: true, email: true },
    })

    // Créer une notification pour l'admin
    if (admin) {
      await db.notification.create({
        data: {
          userId: admin.id,
          type: 'DEMO_REQUEST',
          title: '🎯 Nouvelle demande de démonstration',
          message: `École: ${schoolName}\nResponsable: ${directorName || 'N/A'}\nEmail: ${email}\nTéléphone: ${phone}\nVille: ${city || 'N/A'}\nÉlèves: ${studentCount || 'N/A'}\nMessage: ${message || 'N/A'}`,
          read: false,
        },
      })
    }

    // Audit
    const h = await headers()
    const school = await db.school.findFirst()
    if (school) {
      await logAudit({
        schoolId: school.id,
        action: 'CREATE',
        entityType: 'OTHER',
        description: `Demande démo : ${schoolName} (${email}, ${phone})`,
        ipAddress: getClientIP(h),
      })
    }

    return NextResponse.json({
      ok: true,
      message: 'Demande envoyée avec succès. Nous vous contacterons sous 24h.',
    })
  } catch (err) {
    console.error('[api/demo-request] Error:', err)
    return NextResponse.json(
      { ok: false, error: (err as Error).message || 'Erreur inconnue.' },
      { status: 500 }
    )
  }
}
