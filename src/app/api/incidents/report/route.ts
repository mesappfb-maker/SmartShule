// SmartShule — API Route : Signalement d'incident (offline-friendly)
// Étape 4 RDC
//
// Endpoint dédié (et non Server Action) pour permettre :
//   - Appels depuis le client sans revalidation de page
//   - Support offline complet (le client stocke en localStorage si fetch échoue)
//   - Idempotence via clientUUID

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'
import { checkIdempotencyKey, recordIdempotencyResult } from '@/lib/idempotency'

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    }

    const formData = await req.formData()
    const clientUUID = String(formData.get('clientUUID') || '')
    const classroomId = String(formData.get('classroomId') || '')
    const teacherId = String(formData.get('teacherId') || '')
    const studentId = String(formData.get('studentId') || '') || null
    const severity = String(formData.get('severity') || 'MEDIUM') as
      | 'LOW'
      | 'MEDIUM'
      | 'HIGH'
      | 'CRITICAL'
    const category = String(formData.get('category') || 'OTHER')
    const description = String(formData.get('description') || '')
    const agendaId = String(formData.get('agendaId') || '') || null

    if (!clientUUID || !classroomId || !description) {
      return NextResponse.json(
        { ok: false, error: 'UUID client, classe et description obligatoires.' },
        { status: 400 }
      )
    }

    // Vérifier l'employé lié
    const employee = await db.employee.findFirst({
      where: { id: teacherId },
      include: { school: true },
    })
    if (!employee || employee.schoolId !== employee.school?.id) {
      return NextResponse.json(
        { ok: false, error: 'Enseignant introuvable.' },
        { status: 404 }
      )
    }
    const schoolId = employee.schoolId!

    // Idempotence
    const idempotencyPayload = {
      classroomId,
      studentId,
      severity,
      category,
      description,
      agendaId,
    }
    const idempotent = await checkIdempotencyKey(user.id, clientUUID, idempotencyPayload)
    if (idempotent.exists && idempotent.payloadMatches) {
      const cached = (idempotent.cachedResult as { incidentId?: string }) || {}
      return NextResponse.json({
        ok: true,
        incidentId: cached.incidentId || '',
        clientUUID,
        directorNotified: true,
        cached: true,
      })
    }

    // Vérifier une dernière fois par clientUUID
    const existing = await db.classIncident.findUnique({
      where: { clientUUID },
    })
    if (existing) {
      return NextResponse.json({
        ok: true,
        incidentId: existing.id,
        clientUUID,
        directorNotified: !!existing.directorNotifiedAt,
        duplicate: true,
      })
    }

    // Créer l'incident + notifier les directeurs
    const incident = await db.classIncident.create({
      data: {
        schoolId,
        agendaId,
        teacherId,
        classroomId,
        studentId,
        severity,
        category,
        description,
        status: 'OPEN',
        clientUUID,
        syncStatus: 'SYNCED',
        syncedAt: new Date(),
        directorNotifiedAt: new Date(),
      },
    })

    // Notifier tous les directeurs
    const directors = await db.user.findMany({
      where: { role: 'DIRECTION', active: true },
      select: { id: true },
    })
    const classroom = await db.classroom.findUnique({ where: { id: classroomId } })
    const teacherName = `${employee.firstName} ${employee.lastName}`
    const severityEmoji =
      severity === 'CRITICAL' ? '🔴' : severity === 'HIGH' ? '🟠' : severity === 'MEDIUM' ? '🟡' : '🟢'
    const message = `Incident ${severityEmoji} ${severity} signalé par ${teacherName} en ${
      classroom?.name || '—'
    } : ${description.slice(0, 100)}${description.length > 100 ? '...' : ''}`

    if (directors.length > 0) {
      await db.notification.createMany({
        data: directors.map((d) => ({
          userId: d.id,
          type: severity === 'CRITICAL' || severity === 'HIGH' ? 'INCIDENT_CRITICAL' : 'INCIDENT_REPORT',
          title: `⚠️ Incident ${severity}`,
          message,
          read: false,
        })),
      })
    }

    // Idempotence
    await recordIdempotencyResult(
      user.id,
      clientUUID,
      idempotent.payloadHash,
      { incidentId: incident.id },
      200
    )

    // Audit
    const h = await headers()
    await logAudit({
      userId: user.id,
      userName: user.displayName,
      userRole: user.role,
      schoolId,
      action: 'CREATE',
      entityType: 'CLASS_INCIDENT',
      entityId: incident.id,
      description: `Incident ${severity} : ${description.slice(0, 80)}`,
      ipAddress: getClientIP(h),
    })

    return NextResponse.json({
      ok: true,
      incidentId: incident.id,
      clientUUID,
      directorNotified: true,
    })
  } catch (err) {
    console.error('[api/incidents/report] Error:', err)
    return NextResponse.json(
      { ok: false, error: (err as Error).message || 'Erreur inconnue.' },
      { status: 500 }
    )
  }
}
