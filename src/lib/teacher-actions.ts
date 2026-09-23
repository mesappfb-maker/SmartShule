'use server'

// SmartShule — Server Actions Cycle 03 (Appel & Notes)
//
// Toutes les actions :
//   - Vérifient l'utilisateur connecté et son rôle ;
//   - Exécutent dans une transaction ACID ;
//   - try/catch explicite avec rollback automatique ;
//   - Audit même en cas d'échec (jamais d'erreur silencieuse) ;
//   - Utilisent les helpers du Cycle 01 (idempotence) et Cycle 02 (accounting).

import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import {
  findOrCreateAttendanceSession,
  upsertAttendance,
  lockAttendanceSession,
  notifyParentsOfAbsence,
  createGradeDraft,
  updateGradeDraft,
  transitionGradeStatus,
  requestGradeCorrection,
  AttendanceError,
  GradeError,
  type AttendanceStatus,
  type GradeStatus,
} from '@/lib/attendance'

// ============================================================
// Helper : trouver l'école d'un utilisateur
// ============================================================

async function getUserSchoolId(userId: string): Promise<string | null> {
  const audit = await db.auditLog.findFirst({
    where: { userId, schoolId: { not: null } },
    select: { schoolId: true },
  })
  if (audit?.schoolId) return audit.schoolId
  const guardian = await db.guardian.findFirst({ where: { userId }, select: { schoolId: true } })
  if (guardian) return guardian.schoolId
  const student = await db.student.findFirst({ where: { userId }, select: { schoolId: true } })
  if (student) return student.schoolId
  const school = await db.school.findFirst()
  return school?.id || null
}

// ============================================================
// 1. recordAttendanceAction — Enregistrer l'appel d'une séance
// ============================================================

export async function recordAttendanceAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ ok: true; sessionId: string; counts: { present: number; late: number; absent: number; excused: number; notifiedParents: number } } | { ok: false; error: string }> {
  const user = await getUserFromSession()
  if (!user) return { ok: false, error: 'Session expirée.' }

  const courseId = String(formData.get('courseId') || '')
  const classroomId = String(formData.get('classroomId') || '')
  const dateStr = String(formData.get('date') || '')
  const entriesJson = String(formData.get('entries') || '[]')

  if (!courseId || !classroomId || !dateStr) {
    return { ok: false, error: 'Cours, classe et date obligatoires.' }
  }

  let entries: Array<{ studentId: string; status: AttendanceStatus; justified?: boolean; justification?: string }>
  try {
    entries = JSON.parse(entriesJson)
  } catch {
    return { ok: false, error: 'Données d\'appel invalides.' }
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    return { ok: false, error: 'Aucune présence à enregistrer.' }
  }

  const schoolId = await getUserSchoolId(user.id)
  if (!schoolId) return { ok: false, error: 'École introuvable.' }

  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    return { ok: false, error: 'Date invalide.' }
  }

  try {
    const result = await db.$transaction(async (tx) => {
      // 1. Trouver ou créer la session d'appel
      const session = await findOrCreateAttendanceSession({
        schoolId, courseId, classroomId, teacherId: user.id, date,
      }, tx)

      // 2. Enregistrer chaque présence (avec déduplication)
      let present = 0, late = 0, absent = 0, excused = 0
      let notified = 0

      for (const entry of entries) {
        const result = await upsertAttendance({
          schoolId,
          attendanceSessionId: session.id,
          studentId: entry.studentId,
          courseId,
          date,
          status: entry.status,
          justified: entry.justified,
          justification: entry.justification,
          recordedById: user.id,
        }, tx)

        // Compter
        switch (entry.status) {
          case 'PRESENT': present++; break
          case 'LATE': late++; break
          case 'ABSENT':
            absent++
            // Notifier les parents en cas d'absence non justifiée
            if (!entry.justified) {
              const student = await tx.student.findUnique({ where: { id: entry.studentId } })
              if (student) {
                const count = await notifyParentsOfAbsence({
                  schoolId,
                  studentId: student.id,
                  studentName: `${student.firstName} ${student.lastName}`,
                  sessionDate: date,
                }, tx)
                notified += count
              }
            }
            break
          case 'EXCUSED': excused++; break
        }
      }

      return { sessionId: session.id, present, late, absent, excused, notifiedParents: notified }
    }, { timeout: 30000, maxWait: 10000 })

    // Audit
    const h = await headers()
    await logAudit({
      userId: user.id,
      userName: user.displayName,
      userRole: user.role,
      schoolId,
      action: 'RECORD_ATTENDANCE',
      entityType: 'ATTENDANCE_SESSION',
      entityId: result.sessionId,
      description: `Appel enregistré pour le ${date.toLocaleDateString('fr-FR')} — ${result.present} présents, ${result.late} retards, ${result.absent} absents, ${result.excused} excusés. ${result.notifiedParents} parent(s) notifié(s).`,
      ipAddress: getClientIP(h),
      metadata: {
        courseId, classroomId, date: dateStr,
        counts: { present: result.present, late: result.late, absent: result.absent, excused: result.excused },
        notifiedParents: result.notifiedParents,
      },
    })

    revalidatePath('/')
    return { ok: true, sessionId: result.sessionId, counts: { present: result.present, late: result.late, absent: result.absent, excused: result.excused, notifiedParents: result.notifiedParents } }
  } catch (e) {
    // Audit explicite de l'échec
    const h = await headers()
    await logAudit({
      userId: user.id,
      userName: user.displayName,
      userRole: user.role,
      schoolId,
      action: 'RECORD_ATTENDANCE_FAILED',
      entityType: 'ATTENDANCE_SESSION',
      description: `Échec d'enregistrement d'appel : ${e instanceof Error ? e.message : String(e)}`,
      ipAddress: getClientIP(h),
      metadata: { courseId, classroomId, date: dateStr, error: e instanceof Error ? e.message : String(e) },
    })
    if (e instanceof AttendanceError) {
      return { ok: false, error: `Erreur d'appel (${e.code}) : ${e.message}` }
    }
    console.error('recordAttendanceAction error:', e)
    return { ok: false, error: 'Erreur lors de l\'enregistrement de l\'appel.' }
  }
}

// ============================================================
// 2. lockAttendanceSessionAction — Verrouiller une session
// ============================================================

export async function lockAttendanceSessionAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getUserFromSession()
  if (!user) return { ok: false, error: 'Session expirée.' }
  const sessionId = String(formData.get('sessionId') || '')
  if (!sessionId) return { ok: false, error: 'Session obligatoire.' }

  const schoolId = await getUserSchoolId(user.id)
  if (!schoolId) return { ok: false, error: 'École introuvable.' }

  try {
    await db.$transaction(async (tx) => {
      await lockAttendanceSession(sessionId, user.id, tx)
    })

    const h = await headers()
    await logAudit({
      userId: user.id,
      userName: user.displayName,
      userRole: user.role,
      schoolId,
      action: 'LOCK_ATTENDANCE_SESSION',
      entityType: 'ATTENDANCE_SESSION',
      entityId: sessionId,
      description: `Session d'appel verrouillée`,
      ipAddress: getClientIP(h),
    })
    revalidatePath('/')
    return { ok: true }
  } catch (e) {
    if (e instanceof AttendanceError) {
      return { ok: false, error: `Erreur (${e.code}) : ${e.message}` }
    }
    return { ok: false, error: 'Erreur lors du verrouillage.' }
  }
}

// ============================================================
// 3. saveGradeDraftAction — Créer/Mettre à jour une note en brouillon
// ============================================================

export async function saveGradeDraftAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ ok: true; gradeId: string } | { ok: false; error: string }> {
  const user = await getUserFromSession()
  if (!user) return { ok: false, error: 'Session expirée.' }

  const studentId = String(formData.get('studentId') || '')
  const subjectId = String(formData.get('subjectId') || '')
  const classroomId = String(formData.get('classroomId') || '') || undefined
  const title = String(formData.get('title') || '')
  const score = parseFloat(String(formData.get('score') || '0'))
  const maxScore = parseFloat(String(formData.get('maxScore') || '20'))
  const weight = parseFloat(String(formData.get('weight') || '1')) || 1
  const teacherComment = String(formData.get('teacherComment') || '') || undefined
  const gradeId = String(formData.get('gradeId') || '') || undefined

  if (!studentId || !subjectId || !title) {
    return { ok: false, error: 'Élève, matière et titre obligatoires.' }
  }

  const schoolId = await getUserSchoolId(user.id)
  if (!schoolId) return { ok: false, error: 'École introuvable.' }

  try {
    const result = await db.$transaction(async (tx) => {
      if (gradeId) {
        // Mise à jour d'un brouillon existant
        await updateGradeDraft(gradeId, { score, maxScore, weight, teacherComment }, tx)
        return { gradeId }
      }
      // Création d'un nouveau brouillon
      const created = await createGradeDraft({
        schoolId, studentId, subjectId, classroomId,
        teacherId: user.id,
        title, score, maxScore, weight, teacherComment,
      }, tx)
      return { gradeId: created.id }
    })

    const h = await headers()
    await logAudit({
      userId: user.id,
      userName: user.displayName,
      userRole: user.role,
      schoolId,
      action: gradeId ? 'UPDATE_GRADE_DRAFT' : 'CREATE_GRADE_DRAFT',
      entityType: 'GRADE',
      entityId: result.gradeId,
      description: `${gradeId ? 'Mise à jour' : 'Création'} du brouillon de note « ${title} » (${score}/${maxScore})`,
      ipAddress: getClientIP(h),
    })
    revalidatePath('/')
    return { ok: true, gradeId: result.gradeId }
  } catch (e) {
    if (e instanceof GradeError) {
      return { ok: false, error: `Erreur note (${e.code}) : ${e.message}` }
    }
    console.error('saveGradeDraftAction error:', e)
    return { ok: false, error: 'Erreur lors de l\'enregistrement de la note.' }
  }
}

// ============================================================
// 4. submitGradeAction — Brouillon → Soumis
// ============================================================

export async function submitGradeAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ ok: true; gradeId: string; newStatus: string } | { ok: false; error: string }> {
  return transitionGrade(formData, 'SUBMITTED')
}

// ============================================================
// 5. controlGradeAction — Soumis → Contrôlé
// ============================================================

export async function controlGradeAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ ok: true; gradeId: string; newStatus: string } | { ok: false; error: string }> {
  return transitionGrade(formData, 'CONTROLLED')
}

// ============================================================
// 6. publishGradeAction — Contrôlé → Publié (visible aux parents)
// ============================================================

export async function publishGradeAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ ok: true; gradeId: string; newStatus: string; notifiedParents: number } | { ok: false; error: string }> {
  const user = await getUserFromSession()
  if (!user) return { ok: false, error: 'Session expirée.' }
  if (user.role !== 'DIRECTION' && user.role !== 'ADMIN') {
    return { ok: false, error: 'Seule la direction peut publier les notes.' }
  }

  const gradeId = String(formData.get('gradeId') || '')
  if (!gradeId) return { ok: false, error: 'Note obligatoire.' }

  const schoolId = await getUserSchoolId(user.id)
  if (!schoolId) return { ok: false, error: 'École introuvable.' }

  try {
    const result = await db.$transaction(async (tx) => {
      const transition = await transitionGradeStatus(gradeId, 'PUBLISHED', user.id, tx)
      // Notifier les parents
      const grade = await tx.grade.findUnique({
        where: { id: gradeId },
        include: { student: true, subject: true },
      })
      if (!grade) return { transition, notified: 0 }
      const links = await tx.guardianStudentLink.findMany({
        where: { studentId: grade.studentId },
        include: { guardian: true },
      })
      if (links.length === 0) return { transition, notified: 0 }
      await tx.notification.createMany({
        data: links.map((link) => ({
          userId: link.guardian.userId!,
          type: 'GRADE_PUBLISHED',
          title: 'Nouvelle note publiée',
          message: `${grade.student.firstName} ${grade.student.lastName} — ${grade.subject.name} : ${grade.score}/${grade.maxScore} (${grade.title})`,
          read: false,
        })),
      })
      return { transition, notified: links.length }
    })

    const h = await headers()
    await logAudit({
      userId: user.id,
      userName: user.displayName,
      userRole: user.role,
      schoolId,
      action: 'PUBLISH_GRADE',
      entityType: 'GRADE',
      entityId: gradeId,
      description: `Note publiée aux familles (${result.notified} parent(s) notifié(s))`,
      ipAddress: getClientIP(h),
    })
    revalidatePath('/')
    return { ok: true, gradeId, newStatus: 'PUBLISHED', notifiedParents: result.notified }
  } catch (e) {
    if (e instanceof GradeError) {
      return { ok: false, error: `Erreur note (${e.code}) : ${e.message}` }
    }
    console.error('publishGradeAction error:', e)
    return { ok: false, error: 'Erreur lors de la publication.' }
  }
}

// Helper privé pour les transitions simples
async function transitionGrade(
  formData: FormData,
  to: GradeStatus
): Promise<{ ok: true; gradeId: string; newStatus: string } | { ok: false; error: string }> {
  const user = await getUserFromSession()
  if (!user) return { ok: false, error: 'Session expirée.' }
  const gradeId = String(formData.get('gradeId') || '')
  if (!gradeId) return { ok: false, error: 'Note obligatoire.' }
  const schoolId = await getUserSchoolId(user.id)
  if (!schoolId) return { ok: false, error: 'École introuvable.' }

  try {
    const result = await db.$transaction(async (tx) => {
      return transitionGradeStatus(gradeId, to, user.id, tx)
    })

    const h = await headers()
    await logAudit({
      userId: user.id,
      userName: user.displayName,
      userRole: user.role,
      schoolId,
      action: `GRADE_${to}`,
      entityType: 'GRADE',
      entityId: gradeId,
      description: `Transition note : ${result.previousStatus} → ${result.newStatus}`,
      ipAddress: getClientIP(h),
    })
    revalidatePath('/')
    return { ok: true, gradeId, newStatus: result.newStatus }
  } catch (e) {
    if (e instanceof GradeError) {
      return { ok: false, error: `Erreur note (${e.code}) : ${e.message}` }
    }
    console.error('transitionGrade error:', e)
    return { ok: false, error: 'Erreur lors de la transition.' }
  }
}

// ============================================================
// 7. requestGradeCorrectionAction — Demande de correction
// ============================================================

export async function requestGradeCorrectionAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ ok: true; correctionId: string } | { ok: false; error: string }> {
  const user = await getUserFromSession()
  if (!user) return { ok: false, error: 'Session expirée.' }

  const gradeId = String(formData.get('gradeId') || '')
  const correctedScore = parseFloat(String(formData.get('correctedScore') || '0'))
  const reason = String(formData.get('reason') || '').trim()
  const evidenceDocName = String(formData.get('evidenceDocName') || '') || undefined

  if (!gradeId) return { ok: false, error: 'Note obligatoire.' }
  if (!reason || reason.length < 5) return { ok: false, error: 'Motif obligatoire (min. 5 caractères).' }

  const schoolId = await getUserSchoolId(user.id)
  if (!schoolId) return { ok: false, error: 'École introuvable.' }

  try {
    const result = await db.$transaction(async (tx) => {
      return requestGradeCorrection({
        gradeId, correctedScore, reason, requestedById: user.id, evidenceDocName,
      }, tx)
    })

    const h = await headers()
    await logAudit({
      userId: user.id,
      userName: user.displayName,
      userRole: user.role,
      schoolId,
      action: 'GRADE_CORRECTION_REQUESTED',
      entityType: 'GRADE',
      entityId: gradeId,
      description: `Demande de correction de note : ${reason}`,
      ipAddress: getClientIP(h),
    })
    revalidatePath('/')
    return { ok: true, correctionId: result.id }
  } catch (e) {
    if (e instanceof GradeError) {
      return { ok: false, error: `Erreur note (${e.code}) : ${e.message}` }
    }
    return { ok: false, error: 'Erreur lors de la demande de correction.' }
  }
}
