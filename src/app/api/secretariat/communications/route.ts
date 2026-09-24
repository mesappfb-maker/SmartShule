// API : Centre Communications — Messagerie, Appels, Visiteurs, Rendez-vous
// ============================================================
// GET : liste communications + filtres
// POST : créer/modifier communication, appel, visiteur, rendez-vous

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { hasRole } from '@/lib/rbac'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (!hasRole(user, ['SECRETARY', 'DIRECTION', 'ADMIN', 'DIRECTOR', 'SCHOOL_ADMIN', 'SYSTEM_ADMIN', 'ADMISSIONS_OFFICER'])) {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
    }

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const url = new URL(req.url)
    const sub = url.searchParams.get('sub') || 'messages' // messages | calls | visitors | appointments
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = parseInt(url.searchParams.get('limit') || '50', 10)
    const status = url.searchParams.get('status')
    const category = url.searchParams.get('category')

    if (sub === 'messages') {
      const where: any = { schoolId }
      if (status) where.status = status
      if (category) where.category = category

      const [messages, total] = await Promise.all([
        db.communication.findMany({
          where,
          include: { student: { select: { firstName: true, lastName: true, matricule: true } } },
          orderBy: [{ createdAt: 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        db.communication.count({ where }),
      ])

      return NextResponse.json({
        ok: true,
        sub: 'messages',
        messages: messages.map((m) => ({
          id: m.id,
          senderName: m.senderName,
          senderRole: m.senderRole,
          recipientName: m.recipientName,
          recipientPhone: m.recipientPhone,
          recipientEmail: m.recipientEmail,
          channel: m.channel,
          subject: m.subject,
          body: m.body,
          status: m.status,
          category: m.category,
          assignedToName: m.assignedToName,
          studentName: m.student ? `${m.student.firstName} ${m.student.lastName}` : null,
          studentMatricule: m.student?.matricule || null,
          deliveredAt: m.deliveredAt?.toISOString() || null,
          deliveryStatus: m.deliveryStatus,
          parentReply: m.parentReply,
          parentReplyAt: m.parentReplyAt?.toISOString() || null,
          createdAt: m.createdAt.toISOString(),
        })),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      })
    }

    if (sub === 'calls') {
      const calls = await db.callLog.findMany({
        where: { schoolId },
        include: { student: { select: { firstName: true, lastName: true, matricule: true } } },
        orderBy: [{ callDate: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      })
      const total = await db.callLog.count({ where: { schoolId } })

      return NextResponse.json({
        ok: true,
        sub: 'calls',
        calls: calls.map((c) => ({
          id: c.id,
          callerName: c.callerName,
          callerPhone: c.callerPhone,
          direction: c.direction,
          contactedName: c.contactedName,
          contactedPhone: c.contactedPhone,
          subject: c.subject,
          notes: c.notes,
          durationMinutes: c.durationMinutes,
          outcome: c.outcome,
          studentName: c.student ? `${c.student.firstName} ${c.student.lastName}` : null,
          followUpRequired: c.followUpRequired,
          followUpDate: c.followUpDate?.toISOString() || null,
          handledByName: c.handledByName,
          callDate: c.callDate.toISOString(),
        })),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      })
    }

    if (sub === 'visitors') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const visitors = await db.visitorLog.findMany({
        where: { schoolId, checkInAt: { gte: today } },
        include: { student: { select: { firstName: true, lastName: true } } },
        orderBy: [{ checkInAt: 'desc' }],
        take: limit,
      })
      const activeVisitors = visitors.filter((v) => !v.checkOutAt)

      return NextResponse.json({
        ok: true,
        sub: 'visitors',
        visitors: visitors.map((v) => ({
          id: v.id,
          visitorName: v.visitorName,
          visitorPhone: v.visitorPhone,
          visitorIdNumber: v.visitorIdNumber,
          visitorType: v.visitorType,
          purpose: v.purpose,
          visitedName: v.visitedName,
          badgeNumber: v.badgeNumber,
          badgeReturned: v.badgeReturned,
          checkInAt: v.checkInAt.toISOString(),
          checkOutAt: v.checkOutAt?.toISOString() || null,
          studentName: v.student ? `${v.student.firstName} ${v.student.lastName}` : null,
          handledByName: v.handledByName,
        })),
        activeCount: activeVisitors.length,
      })
    }

    if (sub === 'appointments') {
      const appointmentStatus = url.searchParams.get('appointmentStatus')
      const where: any = { schoolId }
      if (appointmentStatus) where.status = appointmentStatus

      const appointments = await db.appointment.findMany({
        where,
        include: { student: { select: { firstName: true, lastName: true, matricule: true } } },
        orderBy: [{ date: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      })
      const total = await db.appointment.count({ where })

      return NextResponse.json({
        ok: true,
        sub: 'appointments',
        appointments: appointments.map((a) => ({
          id: a.id,
          title: a.title,
          description: a.description,
          date: a.date.toISOString(),
          durationMinutes: a.durationMinutes,
          location: a.location,
          withName: a.withName,
          withPhone: a.withPhone,
          withEmail: a.withEmail,
          appointmentType: a.appointmentType,
          status: a.status,
          assignedToName: a.assignedToName,
          studentName: a.student ? `${a.student.firstName} ${a.student.lastName}` : null,
          reminderSent: a.reminderSent,
          createdAt: a.createdAt.toISOString(),
        })),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      })
    }

    return NextResponse.json({ ok: false, error: `Sous-module "${sub}" inconnu.` }, { status: 400 })
  } catch (err) {
    console.error('[api/secretariat/communications] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (!hasRole(user, ['SECRETARY', 'DIRECTION', 'ADMIN', 'DIRECTOR', 'SCHOOL_ADMIN', 'SYSTEM_ADMIN', 'ADMISSIONS_OFFICER'])) {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
    }

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const body = await req.json()
    const { action } = body

    // Créer un message
    if (action === 'send-message') {
      const { recipientName, recipientPhone, recipientEmail, channel, subject, body: msgBody, category, studentId } = body
      if (!recipientName || !msgBody) return NextResponse.json({ ok: false, error: 'Destinataire et message requis.' }, { status: 400 })

      const msg = await db.communication.create({
        data: {
          schoolId,
          senderId: user.id,
          senderName: user.displayName,
          senderRole: 'SECRETARY',
          recipientName,
          recipientPhone: recipientPhone || null,
          recipientEmail: recipientEmail || null,
          channel: channel || 'APP',
          subject: subject || null,
          body: msgBody,
          category: category || 'GENERAL',
          studentId: studentId || null,
          status: 'NEW',
          deliveredAt: new Date(),
          deliveryStatus: 'SENT',
        },
      })

      return NextResponse.json({ ok: true, id: msg.id, message: 'Message envoyé' })
    }

    // Modifier le statut d'un message
    if (action === 'update-message') {
      const { messageId, status, assignedToName } = body
      if (!messageId) return NextResponse.json({ ok: false, error: 'messageId requis.' }, { status: 400 })

      await db.communication.update({
        where: { id: messageId },
        data: {
          status: status || undefined,
          assignedToName: assignedToName || undefined,
          assignedToId: assignedToName ? user.id : undefined,
        },
      })
      return NextResponse.json({ ok: true, message: 'Message mis à jour' })
    }

    // Enregistrer un appel
    if (action === 'log-call') {
      const { callerName, callerPhone, direction, contactedName, contactedPhone, subject, notes, durationMinutes, outcome, studentId, followUpRequired, followUpDate } = body
      if (!callerName) return NextResponse.json({ ok: false, error: 'callerName requis.' }, { status: 400 })

      const call = await db.callLog.create({
        data: {
          schoolId,
          callerName,
          callerPhone: callerPhone || null,
          direction: direction || 'INCOMING',
          contactedName: contactedName || null,
          contactedPhone: contactedPhone || null,
          subject: subject || null,
          notes: notes || null,
          durationMinutes: durationMinutes || null,
          outcome: outcome || null,
          studentId: studentId || null,
          followUpRequired: followUpRequired || false,
          followUpDate: followUpDate ? new Date(followUpDate) : null,
          handledById: user.id,
          handledByName: user.displayName,
        },
      })
      return NextResponse.json({ ok: true, id: call.id, message: 'Appel enregistré' })
    }

    // Enregistrer un visiteur (entrée)
    if (action === 'check-in-visitor') {
      const { visitorName, visitorPhone, visitorIdNumber, visitorType, purpose, visitedName, studentId, badgeNumber } = body
      if (!visitorName || !purpose) return NextResponse.json({ ok: false, error: 'visitorName et purpose requis.' }, { status: 400 })

      const visit = await db.visitorLog.create({
        data: {
          schoolId,
          visitorName,
          visitorPhone: visitorPhone || null,
          visitorIdNumber: visitorIdNumber || null,
          visitorType: visitorType || 'PARENT',
          purpose,
          visitedName: visitedName || null,
          studentId: studentId || null,
          badgeNumber: badgeNumber || null,
          handledById: user.id,
          handledByName: user.displayName,
        },
      })
      return NextResponse.json({ ok: true, id: visit.id, message: 'Visiteur enregistré' })
    }

    // Sortie visiteur
    if (action === 'check-out-visitor') {
      const { visitorLogId } = body
      if (!visitorLogId) return NextResponse.json({ ok: false, error: 'visitorLogId requis.' }, { status: 400 })

      await db.visitorLog.update({
        where: { id: visitorLogId },
        data: { checkOutAt: new Date(), badgeReturned: true },
      })
      return NextResponse.json({ ok: true, message: 'Sortie enregistrée' })
    }

    // Créer un rendez-vous
    if (action === 'create-appointment') {
      const { title, description, date, durationMinutes, location, withName, withPhone, withEmail, studentId, appointmentType } = body
      if (!title || !date || !withName) return NextResponse.json({ ok: false, error: 'title, date et withName requis.' }, { status: 400 })

      const appt = await db.appointment.create({
        data: {
          schoolId,
          title,
          description: description || null,
          date: new Date(date),
          durationMinutes: durationMinutes || 30,
          location: location || null,
          withName,
          withPhone: withPhone || null,
          withEmail: withEmail || null,
          studentId: studentId || null,
          appointmentType: appointmentType || 'GENERAL',
          status: 'SCHEDULED',
          assignedToId: user.id,
          assignedToName: user.displayName,
          createdById: user.id,
          createdByName: user.displayName,
        },
      })
      return NextResponse.json({ ok: true, id: appt.id, message: 'Rendez-vous créé' })
    }

    // Modifier rendez-vous
    if (action === 'update-appointment') {
      const { appointmentId, status } = body
      if (!appointmentId) return NextResponse.json({ ok: false, error: 'appointmentId requis.' }, { status: 400 })

      await db.appointment.update({
        where: { id: appointmentId },
        data: { status: status || undefined },
      })
      return NextResponse.json({ ok: true, message: 'Rendez-vous mis à jour' })
    }

    return NextResponse.json({ ok: false, error: `Action "${action}" inconnue.` }, { status: 400 })
  } catch (err) {
    console.error('[api/secretariat/communications POST] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
