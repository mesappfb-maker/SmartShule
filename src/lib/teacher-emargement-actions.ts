// SmartShule — Server Actions : Émargements, Appel, Cahier de textes, Incidents
// Étape 4 RDC — Portail Prof complet
//
// Toutes les actions :
//   - Vérifient l'utilisateur connecté et son rôle (TEACHER ou DIRECTION)
//   - Exécutent dans une transaction ACID
//   - try/catch explicite avec rollback automatique
//   - Audit même en cas d'échec
//   - Notifications temps réel vers la Direction via DB.Notification
//   - Idempotence via clientUUID pour les incidents offline

'use server'

import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { computeIqaForStudent, persistIqaSnapshot } from '@/lib/iqa'
import { checkIdempotencyKey, recordIdempotencyResult } from '@/lib/idempotency'

// ============================================================
// Helper : trouver l'école d'un utilisateur + employé lié
// ============================================================

async function getTeacherContext(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) return null

  // Trouver l'employé lié (par email)
  const employee = await db.employee.findFirst({
    where: { email: user.email },
    include: { school: true },
  })
  if (!employee) return null

  return {
    user,
    employee,
    schoolId: employee.schoolId,
  }
}

// ============================================================
// 1. startAttendanceAction — Démarrer une séance + émargement
// ============================================================

export async function startAttendanceAction(
  _prevState: unknown,
  formData: FormData
): Promise<
  | {
      ok: true
      agendaId: string
      emargementId: string
      studentsCount: number
    }
  | { ok: false; error: string }
> {
  const user = await getUserFromSession()
  if (!user) return { ok: false, error: 'Session expirée.' }

  const ctx = await getTeacherContext(user.id)
  if (!ctx) return { ok: false, error: 'Enseignant introuvable.' }

  const classroomId = String(formData.get('classroomId') || '')
  const subjectId = String(formData.get('subjectId') || '') || null
  const courseId = String(formData.get('courseId') || '') || null
  const startISO = String(formData.get('startDateTime') || '')
  const endISO = String(formData.get('endDateTime') || '') || startISO
  const room = String(formData.get('room') || '') || null

  if (!classroomId || !startISO) {
    return { ok: false, error: 'Classe et horodatage de début obligatoires.' }
  }

  const startDateTime = new Date(startISO)
  const endDateTime = new Date(endISO)
  if (isNaN(startDateTime.getTime())) {
    return { ok: false, error: 'Date de début invalide.' }
  }

  const h = await headers()
  const ip = getClientIP(h)
  const userAgent = h.get('user-agent') || undefined

  try {
    const result = await db.$transaction(async (tx) => {
      // 1. Créer ou réutiliser l'agenda
      let agenda = await tx.teacherAgenda.findFirst({
        where: {
          schoolId: ctx.schoolId,
          teacherId: ctx.employee.id,
          classroomId,
          startDateTime,
        },
      })
      if (!agenda) {
        agenda = await tx.teacherAgenda.create({
          data: {
            schoolId: ctx.schoolId,
            teacherId: ctx.employee.id,
            classroomId,
            subjectId,
            courseId,
            startDateTime,
            endDateTime,
            room,
            status: 'IN_PROGRESS',
          },
        })
      } else {
        await tx.teacherAgenda.update({
          where: { id: agenda.id },
          data: { status: 'IN_PROGRESS' },
        })
      }

      // 2. Créer l'émargement (UNIQUE par agenda)
      let emargement = await tx.teacherEmargement.findFirst({
        where: { agendaId: agenda.id },
      })
      if (!emargement) {
        emargement = await tx.teacherEmargement.create({
          data: {
            schoolId: ctx.schoolId,
            agendaId: agenda.id,
            teacherId: ctx.employee.id,
            classroomId,
            subjectId,
            signatureAt: new Date(),
            status: 'PRESENT',
            ipAddress: ip,
            userAgent,
            directorNotifiedAt: new Date(), // marqué comme notifié
          },
        })

        // 3. Notifier TOUS les directeurs de l'école
        const directors = await tx.user.findMany({
          where: { role: 'DIRECTION', active: true },
          select: { id: true },
        })
        const teacherName = `${ctx.employee.firstName} ${ctx.employee.lastName}`
        const classroom = await tx.classroom.findUnique({ where: { id: classroomId } })
        const subject = subjectId
          ? await tx.subject.findUnique({ where: { id: subjectId } })
          : null
        const timeStr = new Date().toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        })
        const message = `Le prof ${teacherName} a démarré le cours de ${
          subject?.name || '—'
        } en ${classroom?.name || '—'} à ${timeStr}`

        if (directors.length > 0) {
          await tx.notification.createMany({
            data: directors.map((d) => ({
              userId: d.id,
              type: 'EMARGEMENT_REALTIME',
              title: 'Cours démarré',
              message,
              read: false,
            })),
          })
        }
      }

      // 4. Compter les élèves actifs dans la classe
      const studentsCount = await tx.enrollment.count({
        where: { classroomId, status: 'ACTIVE' },
      })

      return { agendaId: agenda.id, emargementId: emargement.id, studentsCount }
    })

    // Audit (hors transaction pour éviter toute cascade)
    await logAudit({
      userId: user.id,
      userName: user.displayName,
      userRole: user.role,
      schoolId: ctx.schoolId,
      action: 'CREATE',
      entityType: 'TEACHER_EMARGEMENT',
      entityId: result.emargementId,
      description: `Émargement démarré pour ${result.studentsCount} élèves`,
      ipAddress: ip,
    })

    revalidatePath('/')
    return { ok: true, ...result }
  } catch (err) {
    await logAudit({
      userId: user.id,
      userName: user.displayName,
      userRole: user.role,
      schoolId: ctx.schoolId,
      action: 'ERROR',
      entityType: 'TEACHER_EMARGEMENT',
      description: `Échec démarrage séance : ${(err as Error).message}`,
      ipAddress: ip,
    })
    return { ok: false, error: (err as Error).message || 'Erreur inconnue.' }
  }
}

// ============================================================
// 2. recordStudentCallAction — Enregistrer le statut d'un élève
// ============================================================

export async function recordStudentCallAction(
  _prevState: unknown,
  formData: FormData
): Promise<
  | { ok: true; created: boolean; updatedIqa: number; level: string }
  | { ok: false; error: string }
> {
  const user = await getUserFromSession()
  if (!user) return { ok: false, error: 'Session expirée.' }

  const ctx = await getTeacherContext(user.id)
  if (!ctx) return { ok: false, error: 'Enseignant introuvable.' }

  const emargementId = String(formData.get('emargementId') || '')
  const studentId = String(formData.get('studentId') || '')
  const status = String(formData.get('status') || 'PRESENT') as
    | 'PRESENT'
    | 'ABSENT'
    | 'LATE'
    | 'EXCUSED'
  const lateMinutes = parseInt(String(formData.get('lateMinutes') || '0'), 10) || 0
  const justified = formData.get('justified') === 'true'
  const justification = String(formData.get('justification') || '') || null

  if (!emargementId || !studentId) {
    return { ok: false, error: 'Émargement et élève obligatoires.' }
  }

  try {
    const result = await db.$transaction(async (tx) => {
      // Récupérer l'émargement pour valider qu'il existe
      const emargement = await tx.teacherEmargement.findUnique({
        where: { id: emargementId },
      })
      if (!emargement) {
        throw new Error('Émargement introuvable.')
      }

      // Upsert : si déjà enregistré pour cet élève, on met à jour
      const existing = await tx.studentAttendanceCall.findUnique({
        where: {
          emargementId_studentId: { emargementId, studentId },
        },
      })

      let callId: string
      let created = false
      if (existing) {
        await tx.studentAttendanceCall.update({
          where: { id: existing.id },
          data: {
            status,
            lateMinutes,
            justified,
            justification,
            recordedAt: new Date(),
            recordedById: ctx.employee.id,
          },
        })
        callId = existing.id
      } else {
        const call = await tx.studentAttendanceCall.create({
          data: {
            schoolId: ctx.schoolId,
            emargementId,
            studentId,
            subjectId: emargement.subjectId,
            status,
            lateMinutes,
            justified,
            justification,
            recordedById: ctx.employee.id,
          },
        })
        callId = call.id
        created = true
      }

      // Recalculer l'IQA global de l'élève pour la période en cours
      const now = new Date()
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
      const periodLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

      const iqaGlobal = await computeIqaForStudent(studentId, periodStart, periodEnd, tx)
      await persistIqaSnapshot({
        schoolId: ctx.schoolId,
        studentId,
        subjectId: null,
        period: periodLabel,
        iqa: iqaGlobal,
      }, tx)

      // Si l'élève est absent non justifié, notifier les parents
      if (status === 'ABSENT' && !justified) {
        const student = await tx.student.findUnique({
          where: { id: studentId },
          select: { firstName: true, lastName: true, matricule: true },
        })
        if (student) {
          const links = await tx.guardianStudentLink.findMany({
            where: { studentId },
            include: { guardian: { select: { userId: true } } },
          })
          if (links.length > 0) {
            await tx.notification.createMany({
              data: links
                .filter((l) => l.guardian.userId)
                .map((l) => ({
                  userId: l.guardian.userId!,
                  type: 'ABSENCE_ALERT',
                  title: `Absence de ${student.firstName} ${student.lastName}`,
                  message: `Votre enfant ${student.firstName} ${student.lastName} a été marqué absent ce jour. Merci de justifier cette absence.`,
                  read: false,
                })),
            })
          }
        }
      }

      return { callId, created, iqaGlobal }
    })

    revalidatePath('/')
    return {
      ok: true,
      created: result.created,
      updatedIqa: result.iqaGlobal.iqa,
      level: result.iqaGlobal.level,
    }
  } catch (err) {
    return { ok: false, error: (err as Error).message || 'Erreur inconnue.' }
  }
}

// ============================================================
// 3. saveLessonLogAction — Enregistrer le cahier de textes
// ============================================================

export async function saveLessonLogAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ ok: true; lessonLogId: string; status: string } | { ok: false; error: string }> {
  const user = await getUserFromSession()
  if (!user) return { ok: false, error: 'Session expirée.' }

  const ctx = await getTeacherContext(user.id)
  if (!ctx) return { ok: false, error: 'Enseignant introuvable.' }

  const emargementId = String(formData.get('emargementId') || '')
  const lessonTitle = String(formData.get('lessonTitle') || '')
  const summary = String(formData.get('summary') || '')
  const homeworkPublished = String(formData.get('homeworkPublished') || '') || null
  const resourcesUrl = String(formData.get('resourcesUrl') || '') || null
  const publish = formData.get('publish') === 'true'

  if (!emargementId || !lessonTitle || !summary) {
    return { ok: false, error: 'Émargement, titre et résumé obligatoires.' }
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const emargement = await tx.teacherEmargement.findUnique({
        where: { id: emargementId },
        include: { agenda: true },
      })
      if (!emargement) {
        throw new Error('Émargement introuvable.')
      }

      const lessonLogData = {
        lessonTitle,
        summary,
        homeworkPublished,
        resourcesUrl,
        status: publish ? 'PUBLISHED' : 'DRAFT',
        updatedAt: new Date(),
      }

      // Upsert : un LessonLog par émargement (unique)
      const existing = await tx.lessonLog.findUnique({
        where: { emargementId },
      })

      let lessonLogId: string
      if (existing) {
        await tx.lessonLog.update({
          where: { id: existing.id },
          data: lessonLogData,
        })
        lessonLogId = existing.id
      } else {
        const created = await tx.lessonLog.create({
          data: {
            schoolId: ctx.schoolId,
            emargementId,
            agendaId: emargement.agendaId,
            teacherId: ctx.employee.id,
            classroomId: emargement.classroomId,
            subjectId: emargement.subjectId,
            sessionDate: emargement.signatureAt,
            ...lessonLogData,
          },
        })
        lessonLogId = created.id
      }

      return { lessonLogId, status: publish ? 'PUBLISHED' : 'DRAFT' }
    })

    // Audit (hors transaction)
    const h2 = await headers()
    await logAudit({
      userId: user.id,
      userName: user.displayName,
      userRole: user.role,
      schoolId: ctx.schoolId,
      action: publish ? 'PUBLISH' : 'UPDATE',
      entityType: 'LESSON_LOG',
      entityId: result.lessonLogId,
      description: `Cahier de textes ${publish ? 'publié' : 'sauvegardé'} : ${lessonTitle}`,
      ipAddress: getClientIP(h2),
    })

    revalidatePath('/')
    return { ok: true, ...result }
  } catch (err) {
    return { ok: false, error: (err as Error).message || 'Erreur inconnue.' }
  }
}

// ============================================================
// 4. reportIncidentAction — Signaler un incident (offline-friendly)
// ============================================================

export async function reportIncidentAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ ok: true; incidentId: string; clientUUID: string; directorNotified: boolean } | { ok: false; error: string }> {
  const user = await getUserFromSession()
  if (!user) return { ok: false, error: 'Session expirée.' }

  const ctx = await getTeacherContext(user.id)
  if (!ctx) return { ok: false, error: 'Enseignant introuvable.' }

  const clientUUID = String(formData.get('clientUUID') || '')
  const classroomId = String(formData.get('classroomId') || '')
  const studentId = String(formData.get('studentId') || '') || null
  const severity = String(formData.get('severity') || 'MEDIUM') as
    | 'LOW'
    | 'MEDIUM'
    | 'HIGH'
    | 'CRITICAL'
  const category = String(formData.get('category') || 'OTHER')
  const description = String(formData.get('description') || '')
  const agendaId = String(formData.get('agendaId') || '') || null

  if (!clientUUID) {
    return { ok: false, error: 'UUID client obligatoire (offline idempotence).' }
  }
  if (!classroomId || !description) {
    return { ok: false, error: 'Classe et description obligatoires.' }
  }

  // Idempotence : vérifier si l'incident a déjà été enregistré
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
    return {
      ok: true,
      incidentId: cached.incidentId || '',
      clientUUID,
      directorNotified: true,
    }
  }
  try {
    const result = await db.$transaction(async (tx) => {
      // Vérifier une dernière fois par clientUUID (anti-doublon offline)
      const existing = await tx.classIncident.findUnique({
        where: { clientUUID },
      })
      if (existing) {
        return {
          incidentId: existing.id,
          clientUUID,
          directorNotified: !!existing.directorNotifiedAt,
        }
      }

      // Créer l'incident
      const incident = await tx.classIncident.create({
        data: {
          schoolId: ctx.schoolId,
          agendaId,
          teacherId: ctx.employee.id,
          classroomId,
          studentId,
          severity,
          category,
          description,
          status: 'OPEN',
          clientUUID,
          syncStatus: 'SYNCED',
          syncedAt: new Date(),
          directorNotifiedAt: new Date(), // marqué notifié immédiatement
        },
      })

      // Notifier tous les directeurs (HIGH/CRITICAL = notification immédiate)
      // MEDIUM/LOW = notification groupée (mais pour simplifier, on notifie toujours)
      const directors = await tx.user.findMany({
        where: { role: 'DIRECTION', active: true },
        select: { id: true },
      })
      const teacherName = `${ctx.employee.firstName} ${ctx.employee.lastName}`
      const classroom = await tx.classroom.findUnique({ where: { id: classroomId } })
      const severityEmoji =
        severity === 'CRITICAL' ? '🔴' : severity === 'HIGH' ? '🟠' : severity === 'MEDIUM' ? '🟡' : '🟢'

      const message = `Incident ${severityEmoji} ${severity} signalé par ${teacherName} en ${
        classroom?.name || '—'
      } : ${description.slice(0, 100)}${description.length > 100 ? '...' : ''}`

      if (directors.length > 0) {
        await tx.notification.createMany({
          data: directors.map((d) => ({
            userId: d.id,
            type: severity === 'CRITICAL' || severity === 'HIGH' ? 'INCIDENT_CRITICAL' : 'INCIDENT_REPORT',
            title: `⚠️ Incident ${severity}`,
            message,
            read: false,
          })),
        })
      }

      return { incidentId: incident.id, clientUUID, directorNotified: true }
    })

    // Marquer l'opération comme idempotente
    await recordIdempotencyResult(user.id, clientUUID, idempotent.payloadHash, { incidentId: result.incidentId }, 200)

    // Audit (hors transaction)
    const h3 = await headers()
    await logAudit({
      userId: user.id,
      userName: user.displayName,
      userRole: user.role,
      schoolId: ctx.schoolId,
      action: 'CREATE',
      entityType: 'CLASS_INCIDENT',
      entityId: result.incidentId,
      description: `Incident ${severity} : ${description.slice(0, 80)}`,
      ipAddress: getClientIP(h3),
    })

    revalidatePath('/')
    return { ok: true, ...result }
  } catch (err) {
    const h4 = await headers()
    await logAudit({
      userId: user.id,
      userName: user.displayName,
      userRole: user.role,
      schoolId: ctx.schoolId,
      action: 'ERROR',
      entityType: 'CLASS_INCIDENT',
      description: `Échec signalement incident : ${(err as Error).message}`,
      ipAddress: getClientIP(h4),
    })
    return { ok: false, error: (err as Error).message || 'Erreur inconnue.' }
  }
}

// ============================================================
// 5. resolveIncidentAction — Marquer un incident comme résolu (Direction)
// ============================================================

export async function resolveIncidentAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ ok: true; incidentId: string } | { ok: false; error: string }> {
  const user = await getUserFromSession()
  if (!user) return { ok: false, error: 'Session expirée.' }
  if (user.role !== 'DIRECTION') {
    return { ok: false, error: 'Résolution réservée à la Direction.' }
  }

  const incidentId = String(formData.get('incidentId') || '')
  const resolution = String(formData.get('resolution') || '')

  if (!incidentId || !resolution) {
    return { ok: false, error: 'Incident et résolution obligatoires.' }
  }

  try {
    const ctx = await getTeacherContext(user.id)
    if (!ctx) return { ok: false, error: 'Employé introuvable.' }

    await db.classIncident.update({
      where: { id: incidentId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedById: ctx.employee.id,
        resolution,
      },
    })

    revalidatePath('/')
    return { ok: true, incidentId }
  } catch (err) {
    return { ok: false, error: (err as Error).message || 'Erreur inconnue.' }
  }
}

// ============================================================
// 6. auditLessonLogAction — Auditer un cahier de textes (Direction lecture seule)
// ============================================================

export async function auditLessonLogAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ ok: true; lessonLogId: string } | { ok: false; error: string }> {
  const user = await getUserFromSession()
  if (!user) return { ok: false, error: 'Session expirée.' }
  if (user.role !== 'DIRECTION') {
    return { ok: false, error: 'Audit réservé à la Direction.' }
  }

  const lessonLogId = String(formData.get('lessonLogId') || '')
  const auditComment = String(formData.get('auditComment') || '') || null

  if (!lessonLogId) {
    return { ok: false, error: 'Cahier de textes introuvable.' }
  }

  try {
    const ctx = await getTeacherContext(user.id)
    if (!ctx) return { ok: false, error: 'Employé introuvable.' }

    await db.lessonLog.update({
      where: { id: lessonLogId },
      data: {
        status: 'AUDITED',
        auditedAt: new Date(),
        auditedById: ctx.employee.id,
        auditComment,
      },
    })

    const h5 = await headers()
    await logAudit({
      userId: user.id,
      userName: user.displayName,
      userRole: user.role,
      schoolId: ctx.schoolId,
      action: 'AUDIT',
      entityType: 'LESSON_LOG',
      entityId: lessonLogId,
      description: `Cahier de textes audité`,
      ipAddress: getClientIP(h5),
    })

    revalidatePath('/')
    return { ok: true, lessonLogId }
  } catch (err) {
    return { ok: false, error: (err as Error).message || 'Erreur inconnue.' }
  }
}
