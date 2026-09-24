// API : Configuration Provider Twilio (admin seulement)
// ============================================================
// GET : récupérer config (sans exposer les credentials)
// POST : créer / mettre à jour config (chiffrement des credentials)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'
import { seedDefaultTemplates } from '@/lib/notifications'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (user.role !== 'ADMIN' && user.role !== 'DIRECTION') {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
    }
    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const config = await db.notificationProviderConfig.findFirst({
      where: { schoolId, providerName: 'TWILIO', isActive: true },
    })

    return NextResponse.json({
      ok: true,
      config: config ? {
        id: config.id,
        providerName: config.providerName,
        hasCredentials: !!config.accountSidEnc && !!config.authTokenEnc,
        fromSmsNumber: config.fromSmsNumber,
        fromWhatsappNumber: config.fromWhatsappNumber,
        fromEmail: config.fromEmail,
        sandboxMode: config.sandboxMode,
        sandboxWhitelist: config.sandboxWhitelist ? JSON.parse(config.sandboxWhitelist) : [],
        rateLimitPerMin: config.rateLimitPerMin,
        rateLimitPerDay: config.rateLimitPerDay,
        isActive: config.isActive,
      } : null,
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (user.role !== 'ADMIN' && user.role !== 'DIRECTION') {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé. Admin/Directeur requis.' }, { status: 403 })
    }
    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const body = await req.json()
    const { action } = body

    if (action === 'save-config') {
      const { accountSid, authToken, fromSmsNumber, fromWhatsappNumber, fromEmail, sandboxMode, sandboxWhitelist, rateLimitPerMin, rateLimitPerDay } = body

      if (!accountSid || !authToken) {
        return NextResponse.json({ ok: false, error: 'Account SID et Auth Token requis.' }, { status: 400 })
      }

      // Chiffrement des credentials
      const { encryptCredential } = await import('@/lib/notifications')

      const existing = await db.notificationProviderConfig.findFirst({
        where: { schoolId, providerName: 'TWILIO' },
      })

      const data = {
        accountSidEnc: encryptCredential(accountSid),
        authTokenEnc: encryptCredential(authToken),
        fromSmsNumber: fromSmsNumber || null,
        fromWhatsappNumber: fromWhatsappNumber || null,
        fromEmail: fromEmail || null,
        sandboxMode: sandboxMode !== undefined ? sandboxMode : true,
        sandboxWhitelist: sandboxWhitelist ? JSON.stringify(sandboxWhitelist) : null,
        rateLimitPerMin: rateLimitPerMin || 10,
        rateLimitPerDay: rateLimitPerDay || 500,
        isActive: true,
        createdById: user.id,
        createdByName: user.displayName,
      }

      if (existing) {
        await db.notificationProviderConfig.update({ where: { id: existing.id }, data })
      } else {
        await db.notificationProviderConfig.create({ data: { schoolId, ...data } })
      }

      // Seed default templates si première config
      await seedDefaultTemplates(schoolId, user.id, user.displayName)

      // Audit
      const h = await headers()
      await logAudit({
        userId: user.id, userName: user.displayName, userRole: user.role, schoolId,
        action: 'UPDATE',
        entityType: 'NOTIFICATION_CONFIG',
        description: 'Configuration Twilio mise à jour',
        ipAddress: getClientIP(h),
        metadata: { sandboxMode: data.sandboxMode },
      })

      return NextResponse.json({ ok: true, message: 'Configuration enregistrée. Modèles par défaut initialisés.' })
    }

    if (action === 'activate-sandbox') {
      // Active sandbox avec whitelist vide
      const existing = await db.notificationProviderConfig.findFirst({
        where: { schoolId, providerName: 'TWILIO' },
      })
      if (existing) {
        await db.notificationProviderConfig.update({
          where: { id: existing.id },
          data: { sandboxMode: true, sandboxWhitelist: JSON.stringify([]) },
        })
      }
      // Seed default templates
      await seedDefaultTemplates(schoolId, user.id, user.displayName)
      return NextResponse.json({ ok: true, message: 'Mode sandbox activé. Modèles par défaut créés.' })
    }

    if (action === 'add-whitelist') {
      const { phone } = body
      if (!phone) return NextResponse.json({ ok: false, error: 'phone requis.' }, { status: 400 })

      const existing = await db.notificationProviderConfig.findFirst({
        where: { schoolId, providerName: 'TWILIO' },
      })
      if (!existing) return NextResponse.json({ ok: false, error: 'Configuration Twilio manquante.' }, { status: 404 })

      const list: string[] = existing.sandboxWhitelist ? JSON.parse(existing.sandboxWhitelist) : []
      if (!list.includes(phone)) list.push(phone)

      await db.notificationProviderConfig.update({
        where: { id: existing.id },
        data: { sandboxWhitelist: JSON.stringify(list) },
      })

      return NextResponse.json({ ok: true, message: 'Numéro ajouté à la whitelist', whitelist: list })
    }

    return NextResponse.json({ ok: false, error: `Action "${action}" inconnue.` }, { status: 400 })
  } catch (err) {
    console.error('[api/notifications/config] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
