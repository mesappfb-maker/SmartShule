// API : Envoi de notification
// ============================================================
// POST : envoie une notification via le service multicanaux
// Vérifications: session, schoolId, RBAC modèle, consentement

import { NextRequest, NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { hasRole } from '@/lib/rbac'
import { sendNotification } from '@/lib/notifications'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (!hasRole(user, ['SECRETARY', 'DIRECTION', 'ADMIN', 'TEACHER', 'ACCOUNTANT'])) {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
    }
    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const body = await req.json()
    const {
      templateCode, recipientId, recipientName, recipientPhone, recipientEmail,
      channel, priority, studentId, relatedType, relatedId, variables,
    } = body

    if (!templateCode || !recipientName) {
      return NextResponse.json({ ok: false, error: 'templateCode et recipientName requis.' }, { status: 400 })
    }

    const result = await sendNotification({
      schoolId,
      templateCode,
      senderId: user.id,
      senderName: user.displayName,
      senderRole: user.role,
      recipientId,
      recipientName,
      recipientPhone,
      recipientEmail,
      channel,
      priority,
      studentId,
      relatedType,
      relatedId,
      variables,
    })

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.message, logId: result.logId, status: result.status }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      logId: result.logId,
      status: result.status,
      message: result.message,
      providerMessageId: result.providerMessageId,
    })
  } catch (err) {
    console.error('[api/notifications/send] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
