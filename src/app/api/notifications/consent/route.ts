// API : Consentement parent multi-canal
// ============================================================
// GET : liste des consentements
// POST : enregistrer / révoquer un consentement

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'
import { normalizePhoneE164 } from '@/lib/notifications'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (!['SECRETARY', 'DIRECTION', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
    }
    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const url = new URL(req.url)
    const search = url.searchParams.get('search')
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = parseInt(url.searchParams.get('limit') || '50', 10)

    const where: any = { schoolId, revokedAt: null }
    if (search) {
      where.OR = [
        { recipientName: { contains: search } },
        { recipientPhone: { contains: search } },
        { recipientEmail: { contains: search } },
      ]
    }

    const [consents, total] = await Promise.all([
      db.notificationConsent.findMany({
        where,
        orderBy: [{ consentDate: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.notificationConsent.count({ where }),
    ])

    return NextResponse.json({
      ok: true,
      consents: consents.map((c) => ({
        id: c.id,
        guardianId: c.guardianId,
        recipientName: c.recipientName,
        recipientPhone: c.recipientPhone,
        recipientEmail: c.recipientEmail,
        consentSms: c.consentSms,
        consentWhatsapp: c.consentWhatsapp,
        consentEmail: c.consentEmail,
        consentApp: c.consentApp,
        preferredChannel: c.preferredChannel,
        consentProof: c.consentProof,
        consentDate: c.consentDate.toISOString(),
        revokedAt: c.revokedAt?.toISOString() || null,
        revokedReason: c.revokedReason,
        createdByName: c.createdByName,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error('[api/notifications/consent GET] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (!['SECRETARY', 'DIRECTION', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
    }
    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const body = await req.json()
    const { action } = body

    if (action === 'record') {
      const { guardianId, recipientName, recipientPhone, recipientEmail, consentSms, consentWhatsapp, consentEmail, consentApp, preferredChannel, consentProof } = body

      if (!recipientName) {
        return NextResponse.json({ ok: false, error: 'recipientName requis.' }, { status: 400 })
      }

      const phoneNorm = normalizePhoneE164(recipientPhone)

      // Vérifier qu'un consentement n'existe pas déjà pour ce destinataire
      const existing = await db.notificationConsent.findFirst({
        where: {
          schoolId,
          OR: [
            phoneNorm ? { recipientPhone: phoneNorm } : {},
            recipientEmail ? { recipientEmail } : {},
          ].filter((c: any) => Object.keys(c).length > 0),
          revokedAt: null,
        },
      })

      if (existing) {
        // Mettre à jour
        const updated = await db.notificationConsent.update({
          where: { id: existing.id },
          data: {
            consentSms: !!consentSms,
            consentWhatsapp: !!consentWhatsapp,
            consentEmail: !!consentEmail,
            consentApp: consentApp === undefined ? true : !!consentApp,
            preferredChannel: preferredChannel || 'APP',
            consentProof: consentProof || null,
            consentDate: new Date(),
            createdById: user.id,
            createdByName: user.displayName,
          },
        })
        return NextResponse.json({ ok: true, id: updated.id, message: 'Consentement mis à jour' })
      }

      const consent = await db.notificationConsent.create({
        data: {
          schoolId,
          guardianId: guardianId || null,
          recipientName,
          recipientPhone: phoneNorm,
          recipientEmail: recipientEmail || null,
          consentSms: !!consentSms,
          consentWhatsapp: !!consentWhatsapp,
          consentEmail: !!consentEmail,
          consentApp: consentApp === undefined ? true : !!consentApp,
          preferredChannel: preferredChannel || 'APP',
          consentProof: consentProof || null,
          consentDate: new Date(),
          createdById: user.id,
          createdByName: user.displayName,
        },
      })

      const h = await headers()
      await logAudit({
        userId: user.id, userName: user.displayName, userRole: user.role, schoolId,
        action: 'CREATE',
        entityType: 'NOTIFICATION_CONSENT',
        entityId: consent.id,
        description: `Consentement enregistré pour ${recipientName} (SMS:${!!consentSms} WA:${!!consentWhatsapp} Email:${!!consentEmail})`,
        ipAddress: getClientIP(h),
        metadata: { recipientName, channels: { sms: !!consentSms, whatsapp: !!consentWhatsapp, email: !!consentEmail } },
      })

      return NextResponse.json({ ok: true, id: consent.id, message: 'Consentement enregistré' })
    }

    if (action === 'revoke') {
      const { consentId, reason } = body
      if (!consentId) return NextResponse.json({ ok: false, error: 'consentId requis.' }, { status: 400 })

      await db.notificationConsent.update({
        where: { id: consentId },
        data: {
          revokedAt: new Date(),
          revokedReason: reason || null,
          revokedById: user.id,
        },
      })

      const h = await headers()
      await logAudit({
        userId: user.id, userName: user.displayName, userRole: user.role, schoolId,
        action: 'UPDATE',
        entityType: 'NOTIFICATION_CONSENT',
        entityId: consentId,
        description: `Consentement révoqué: ${reason || 'aucune raison'}`,
        ipAddress: getClientIP(h),
      })

      return NextResponse.json({ ok: true, message: 'Consentement révoqué' })
    }

    return NextResponse.json({ ok: false, error: `Action "${action}" inconnue.` }, { status: 400 })
  } catch (err) {
    console.error('[api/notifications/consent POST] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
