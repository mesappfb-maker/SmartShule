// API : Journal des notifications
// ============================================================
// GET : liste paginée avec filtres (statut, canal, date, destinataire, template)
// POST : annuler une notification PENDING

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'

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
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = parseInt(url.searchParams.get('limit') || '50', 10)
    const status = url.searchParams.get('status')
    const channel = url.searchParams.get('channel')
    const templateCode = url.searchParams.get('templateCode')
    const search = url.searchParams.get('search')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')

    const where: any = { schoolId }
    if (status) where.status = status
    if (channel) where.channel = channel
    if (templateCode) where.templateCode = templateCode
    if (search) {
      where.OR = [
        { recipientName: { contains: search } },
        { recipientPhone: { contains: search } },
        { recipientEmail: { contains: search } },
        { senderName: { contains: search } },
      ]
    }
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from)
      if (to) where.createdAt.lte = new Date(to)
    }

    const [logs, total] = await Promise.all([
      db.notificationLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.notificationLog.count({ where }),
    ])

    // Stats
    const [pending, sent, failed, rejected] = await Promise.all([
      db.notificationLog.count({ where: { schoolId, status: 'PENDING' } }),
      db.notificationLog.count({ where: { schoolId, status: 'SENT' } }),
      db.notificationLog.count({ where: { schoolId, status: 'FAILED' } }),
      db.notificationLog.count({ where: { schoolId, status: 'REJECTED' } }),
    ])

    return NextResponse.json({
      ok: true,
      logs: logs.map((l) => ({
        id: l.id,
        templateCode: l.templateCode,
        templateVersion: l.templateVersion,
        senderName: l.senderName,
        senderRole: l.senderRole,
        recipientName: l.recipientName,
        recipientPhone: l.recipientPhone,
        recipientEmail: l.recipientEmail,
        channel: l.channel,
        priority: l.priority,
        renderedSubject: l.renderedSubject,
        renderedBody: l.renderedBody,
        status: l.status,
        attempts: l.attempts,
        maxAttempts: l.maxAttempts,
        lastAttemptAt: l.lastAttemptAt?.toISOString() || null,
        nextAttemptAt: l.nextAttemptAt?.toISOString() || null,
        errorCode: l.errorCode,
        errorMessage: l.errorMessage,
        deliveredAt: l.deliveredAt?.toISOString() || null,
        readAt: l.readAt?.toISOString() || null,
        isSandbox: l.isSandbox,
        providerName: l.providerName,
        providerMessageId: l.providerMessageId,
        studentId: l.studentId,
        relatedType: l.relatedType,
        relatedId: l.relatedId,
        createdAt: l.createdAt.toISOString(),
      })),
      stats: { pending, sent, failed, rejected, total },
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error('[api/notifications/log GET] Error:', err)
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
    const { action, logId } = body

    if (action === 'cancel') {
      if (!logId) return NextResponse.json({ ok: false, error: 'logId requis.' }, { status: 400 })
      const log = await db.notificationLog.findUnique({ where: { id: logId } })
      if (!log || log.schoolId !== schoolId) {
        return NextResponse.json({ ok: false, error: 'Log introuvable.' }, { status: 404 })
      }
      if (log.status !== 'PENDING') {
        return NextResponse.json({ ok: false, error: 'Seules les notifications PENDING peuvent être annulées.' }, { status: 400 })
      }
      await db.notificationLog.update({
        where: { id: logId },
        data: { status: 'CANCELLED' },
      })

      const h = await headers()
      await logAudit({
        userId: user.id, userName: user.displayName, userRole: user.role, schoolId,
        action: 'CANCEL',
        entityType: 'NOTIFICATION',
        entityId: logId,
        description: `Notification ${log.templateCode} annulée`,
        ipAddress: getClientIP(h),
      })

      return NextResponse.json({ ok: true, message: 'Notification annulée' })
    }

    if (action === 'retry') {
      if (!logId) return NextResponse.json({ ok: false, error: 'logId requis.' }, { status: 400 })
      const log = await db.notificationLog.findUnique({ where: { id: logId } })
      if (!log || log.schoolId !== schoolId) {
        return NextResponse.json({ ok: false, error: 'Log introuvable.' }, { status: 404 })
      }
      if (log.status !== 'FAILED') {
        return NextResponse.json({ ok: false, error: 'Seules les notifications FAILED peuvent être relancées.' }, { status: 400 })
      }
      // Reset pour retry
      await db.notificationLog.update({
        where: { id: logId },
        data: {
          status: 'PENDING',
          nextAttemptAt: new Date(),
        },
      })
      return NextResponse.json({ ok: true, message: 'Notification replanée pour réenvoi' })
    }

    return NextResponse.json({ ok: false, error: `Action "${action}" inconnue.` }, { status: 400 })
  } catch (err) {
    console.error('[api/notifications/log POST] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
