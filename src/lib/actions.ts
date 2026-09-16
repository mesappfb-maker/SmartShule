'use server'

// SmartShule — Server Actions centralisées
// Toutes les mutations passent par ici. Chaque action :
// 1. vérifie l'utilisateur connecté
// 2. vérifie le périmètre de données
// 3. exécute la mutation dans une transaction si sensible
// 4. journalise l'audit
// 5. publie les notifications si nécessaire

import { db } from '@/lib/db'
import {
  getUserFromSession,
  verifyPassword,
  createSession,
  revokeSession,
  setSessionCookie,
  clearSessionCookie,
} from '@/lib/auth'
import { logAudit, getClientIP } from '@/lib/audit'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

// ============================================================
// AUTH
// ============================================================

export async function loginAction(
  _prevState: unknown,
  formData: FormData
): Promise<
  { ok: true; role: string; displayName: string } | { ok: false; error: string }
> {
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const password = String(formData.get('password') || '')

  if (!email || !password) {
    return { ok: false, error: 'Veuillez saisir votre email et votre mot de passe.' }
  }

  const user = await db.user.findUnique({ where: { email } })
  if (!user) {
    return { ok: false, error: 'Email ou mot de passe incorrect.' }
  }

  if (!user.active) {
    return { ok: false, error: 'Votre compte est désactivé. Contactez l\'administration.' }
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    await logAudit({
      userId: user.id,
      userName: user.displayName,
      userRole: user.role,
      action: 'LOGIN_FAILED',
      entityType: 'USER',
      entityId: user.id,
      description: `Tentative de connexion échouée pour ${email}`,
    })
    return { ok: false, error: 'Email ou mot de passe incorrect.' }
  }

  const h = await headers()
  const ipAddress = getClientIP(h)
  const userAgent = h.get('user-agent') || undefined

  const { token, expiresAt } = await createSession({
    userId: user.id,
    ipAddress,
    userAgent,
  })
  await setSessionCookie(token, expiresAt)

  await logAudit({
    userId: user.id,
    userName: user.displayName,
    userRole: user.role,
    action: 'LOGIN',
    entityType: 'SESSION',
    description: `Connexion réussie`,
    ipAddress,
    metadata: { userAgent },
  })

  revalidatePath('/')
  return { ok: true, role: user.role, displayName: user.displayName }
}

export async function logoutAction(): Promise<{ ok: true }> {
  const user = await getUserFromSession()
  if (user) {
    // Trouver la session active et la révoquer
    const h = await headers()
    const cookieHeader = h.get('cookie') || ''
    const tokenMatch = cookieHeader.match(/ss_session=([^;]+)/)
    const token = tokenMatch?.[1]
    if (token) {
      await revokeSession(token)
    }

    await logAudit({
      userId: user.id,
      userName: user.displayName,
      userRole: user.role,
      action: 'LOGOUT',
      entityType: 'SESSION',
      description: 'Déconnexion',
    })
  }
  await clearSessionCookie()
  revalidatePath('/')
  return { ok: true }
}

// ============================================================
// PARENT — Créer une demande
// ============================================================

export async function createParentRequestAction(
  _prevState: unknown,
  formData: FormData
): Promise<
  { ok: true; requestId: string } | { ok: false; error: string }
> {
  const user = await getUserFromSession()
  if (!user || user.role !== 'PARENT') {
    return { ok: false, error: 'Action réservée aux parents.' }
  }

  const guardian = await db.guardian.findFirst({ where: { userId: user.id } })
  if (!guardian) {
    return { ok: false, error: 'Aucun dossier parent trouvé pour ce compte.' }
  }

  const studentId = String(formData.get('studentId') || '')
  const category = String(formData.get('category') || '')
  const priority = String(formData.get('priority') || 'NORMAL')
  const subject = String(formData.get('subject') || '').trim()
  const content = String(formData.get('content') || '').trim()

  if (!category || !subject || !content) {
    return { ok: false, error: 'Tous les champs sont obligatoires.' }
  }

  // Vérifier le périmètre si studentId fourni
  if (studentId) {
    const canAccess = await db.guardianStudentLink.findFirst({
      where: { guardianId: guardian.id, studentId },
    })
    if (!canAccess) {
      return { ok: false, error: 'Vous n\'êtes pas autorisé à créer une demande pour cet élève.' }
    }
  }

  const requestNumber = `REQ-${new Date().getFullYear()}-${String(
    await db.parentRequest.count({ where: { schoolId: guardian.schoolId } }) + 1
  ).padStart(4, '0')}`

  const request = await db.parentRequest.create({
    data: {
      schoolId: guardian.schoolId,
      requestNumber,
      guardianId: guardian.id,
      studentId: studentId || null,
      category,
      priority,
      subject,
      status: 'NEW',
      messages: {
        create: {
          authorId: user.id,
          authorName: user.displayName,
          authorRole: 'PARENT',
          content,
        },
      },
    },
    include: { messages: true },
  })

  // Notifier la direction
  const directionUsers = await db.user.findMany({
    where: { role: 'DIRECTION', active: true },
  })
  await db.notification.createMany({
    data: directionUsers.map((u) => ({
      userId: u.id,
      type: 'REQUEST_REPLY',
      title: 'Nouvelle demande parentale',
      message: `${user.displayName} a créé la demande ${requestNumber} : ${subject}`,
      link: `request:${request.id}`,
    })),
  })

  await logAudit({
    userId: user.id,
    userName: user.displayName,
    userRole: user.role,
    schoolId: guardian.schoolId,
    action: 'CREATE_REQUEST',
    entityType: 'PARENT_REQUEST',
    entityId: request.id,
    description: `Création de la demande ${requestNumber} (${category})`,
  })

  revalidatePath('/')
  return { ok: true, requestId: request.id }
}

// ============================================================
// PARENT — Ajouter un message à une demande
// ============================================================

export async function addRequestMessageAction(
  _prevState: unknown,
  formData: FormData
): Promise<
  { ok: true; messageId: string } | { ok: false; error: string }
> {
  const user = await getUserFromSession()
  if (!user) return { ok: false, error: 'Session expirée.' }

  const requestId = String(formData.get('requestId') || '')
  const content = String(formData.get('content') || '').trim()
  const isInternalStr = String(formData.get('isInternal') || 'false')
  const isInternal = isInternalStr === 'true'

  if (!content) {
    return { ok: false, error: 'Le message ne peut pas être vide.' }
  }

  const request = await db.parentRequest.findUnique({
    where: { id: requestId },
    include: { guardian: true },
  })
  if (!request) return { ok: false, error: 'Demande introuvable.' }

  // Vérifier le périmètre
  if (user.role === 'PARENT') {
    if (request.guardian.userId !== user.id) {
      return { ok: false, error: 'Accès non autorisé à cette demande.' }
    }
    if (isInternal) {
      return { ok: false, error: 'Les parents ne peuvent pas poster de notes internes.' }
    }
  } else if (user.role !== 'DIRECTION' && user.role !== 'ADMIN') {
    return { ok: false, error: 'Action non autorisée.' }
  }

  const message = await db.requestMessage.create({
    data: {
      requestId: request.id,
      authorId: user.id,
      authorName: user.displayName,
      authorRole: user.role === 'PARENT' ? 'PARENT' : 'DIRECTION',
      content,
      isInternal: isInternal && user.role !== 'PARENT',
    },
  })

  // Mettre à jour le statut de la demande
  const newStatus = user.role === 'PARENT' ? 'WAITING' : 'ANSWERED'
  await db.parentRequest.update({
    where: { id: request.id },
    data: { status: newStatus, updatedAt: new Date() },
  })

  // Notifier l'autre partie
  const notifyUserId =
    user.role === 'PARENT' ? null : request.guardian.userId
  if (notifyUserId) {
    await db.notification.create({
      data: {
        userId: notifyUserId,
        type: 'REQUEST_REPLY',
        title: 'Réponse de la direction',
        message: `Nouveau message sur votre demande ${request.requestNumber}`,
        link: `request:${request.id}`,
      },
    })
  }

  await logAudit({
    userId: user.id,
    userName: user.displayName,
    userRole: user.role,
    schoolId: request.schoolId,
    action: 'REPLY_REQUEST',
    entityType: 'PARENT_REQUEST',
    entityId: request.id,
    description: `Réponse à la demande ${request.requestNumber}`,
  })

  revalidatePath('/')
  return { ok: true, messageId: message.id }
}

// ============================================================
// DIRECTION — Assigner une demande
// ============================================================

export async function assignRequestAction(
  _prevState: unknown,
  formData: FormData
): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const user = await getUserFromSession()
  if (!user || (user.role !== 'DIRECTION' && user.role !== 'ADMIN')) {
    return { ok: false, error: 'Action réservée à la direction.' }
  }
  const requestId = String(formData.get('requestId') || '')
  const status = String(formData.get('status') || 'IN_PROGRESS') as
    | 'IN_PROGRESS'
    | 'WAITING'
    | 'ANSWERED'
    | 'CLOSED'

  const request = await db.parentRequest.findUnique({ where: { id: requestId } })
  if (!request) return { ok: false, error: 'Demande introuvable.' }

  await db.parentRequest.update({
    where: { id: requestId },
    data: {
      status,
      assignedToId: user.id,
      updatedAt: new Date(),
      closedAt: status === 'CLOSED' ? new Date() : null,
    },
  })

  await logAudit({
    userId: user.id,
    userName: user.displayName,
    userRole: user.role,
    schoolId: request.schoolId,
    action: 'ASSIGN_REQUEST',
    entityType: 'PARENT_REQUEST',
    entityId: request.id,
    description: `Mise à jour du statut de la demande ${request.requestNumber} → ${status}`,
  })

  revalidatePath('/')
  return { ok: true }
}

// ============================================================
// ÉLÈVE — Déposer un devoir
// ============================================================

export async function submitAssignmentAction(
  _prevState: unknown,
  formData: FormData
): Promise<
  { ok: true; submissionId: string } | { ok: false; error: string }
> {
  const user = await getUserFromSession()
  if (!user || user.role !== 'STUDENT') {
    return { ok: false, error: 'Action réservée aux élèves.' }
  }

  const assignmentId = String(formData.get('assignmentId') || '')
  const content = String(formData.get('content') || '').trim()
  const fileName = String(formData.get('fileName') || '').trim()
  const fileSizeStr = String(formData.get('fileSize') || '0')
  const fileSize = parseInt(fileSizeStr, 10) || 0

  if (!content && !fileName) {
    return { ok: false, error: 'Vous devez saisir un texte ou joindre un fichier.' }
  }

  const student = await db.student.findFirst({ where: { userId: user.id } })
  if (!student) return { ok: false, error: 'Dossier élève introuvable.' }

  const assignment = await db.assignment.findUnique({
    where: { id: assignmentId },
    include: { classroom: { include: { enrollments: true } } },
  })
  if (!assignment) return { ok: false, error: 'Devoir introuvable.' }

  // Vérifier que l'élève est bien dans la classe
  const isEnrolled = assignment.classroom.enrollments.some(
    (e) => e.studentId === student.id && e.status === 'ACTIVE'
  )
  if (!isEnrolled) {
    return { ok: false, error: 'Vous n\'êtes pas inscrit dans la classe correspondante.' }
  }

  // Upsert : si une remise existe déjà, on crée une nouvelle version
  const existing = await db.submission.findUnique({
    where: {
      assignmentId_studentId: {
        assignmentId: assignment.id,
        studentId: student.id,
      },
    },
  })

  let submission
  if (existing) {
    submission = await db.submission.update({
      where: { id: existing.id },
      data: {
        content,
        fileName: fileName || existing.fileName,
        fileSize: fileSize || existing.fileSize,
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    })
  } else {
    submission = await db.submission.create({
      data: {
        assignmentId: assignment.id,
        studentId: student.id,
        content,
        fileName: fileName || null,
        fileSize: fileSize || null,
        status: 'SUBMITTED',
      },
    })
  }

  await logAudit({
    userId: user.id,
    userName: user.displayName,
    userRole: user.role,
    schoolId: student.schoolId,
    action: 'SUBMIT_ASSIGNMENT',
    entityType: 'SUBMISSION',
    entityId: submission.id,
    description: `Remise du devoir « ${assignment.title} »`,
  })

  revalidatePath('/')
  return { ok: true, submissionId: submission.id }
}

// ============================================================
// DIRECTION — Publier une annonce
// ============================================================

export async function createAnnouncementAction(
  _prevState: unknown,
  formData: FormData
): Promise<
  { ok: true; announcementId: string } | { ok: false; error: string }
> {
  const user = await getUserFromSession()
  if (!user || (user.role !== 'DIRECTION' && user.role !== 'ADMIN')) {
    return { ok: false, error: 'Action réservée à la direction.' }
  }

  const title = String(formData.get('title') || '').trim()
  const content = String(formData.get('content') || '').trim()
  const priority = String(formData.get('priority') || 'NORMAL')
  const targetType = String(formData.get('targetType') || 'ALL')
  const classroomId = String(formData.get('classroomId') || '') || null

  if (!title || !content) {
    return { ok: false, error: 'Le titre et le contenu sont obligatoires.' }
  }

  // Trouver l'école
  const audit = await db.auditLog.findFirst({
    where: { userId: user.id, schoolId: { not: null } },
    select: { schoolId: true },
  })
  const schoolId = audit?.schoolId ?? (await db.school.findFirst())?.id
  if (!schoolId) return { ok: false, error: 'École introuvable.' }

  const announcement = await db.announcement.create({
    data: {
      schoolId,
      classroomId: targetType === 'CLASSROOM' ? classroomId : null,
      title,
      content,
      targetType,
      priority,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      authorId: user.id,
    },
  })

  // Notifier les destinataires
  const targetUsers =
    targetType === 'ALL'
      ? await db.user.findMany({ where: { active: true } })
      : await db.user.findMany({
          where: {
            student: {
              enrollments: {
                some: { classroomId: classroomId || undefined, status: 'ACTIVE' },
              },
            },
            active: true,
          },
        })

  if (targetUsers.length > 0) {
    await db.notification.createMany({
      data: targetUsers.map((u) => ({
        userId: u.id,
        type: 'ANNOUNCEMENT',
        title: `Nouvelle annonce : ${title}`,
        message: content.slice(0, 120) + (content.length > 120 ? '…' : ''),
        link: `announcement:${announcement.id}`,
      })),
    })
  }

  await logAudit({
    userId: user.id,
    userName: user.displayName,
    userRole: user.role,
    schoolId,
    action: 'PUBLISH_ANNOUNCEMENT',
    entityType: 'ANNOUNCEMENT',
    entityId: announcement.id,
    description: `Publication de l'annonce « ${title} »`,
  })

  revalidatePath('/')
  return { ok: true, announcementId: announcement.id }
}

// ============================================================
// DIRECTION — Archiver une annonce
// ============================================================

export async function archiveAnnouncementAction(
  _prevState: unknown,
  formData: FormData
): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const user = await getUserFromSession()
  if (!user || (user.role !== 'DIRECTION' && user.role !== 'ADMIN')) {
    return { ok: false, error: 'Action réservée à la direction.' }
  }

  const announcementId = String(formData.get('announcementId') || '')
  await db.announcement.update({
    where: { id: announcementId },
    data: { status: 'ARCHIVED' },
  })

  await logAudit({
    userId: user.id,
    userName: user.displayName,
    userRole: user.role,
    action: 'ARCHIVE',
    entityType: 'ANNOUNCEMENT',
    entityId: announcementId,
    description: 'Archivage d\'une annonce',
  })

  revalidatePath('/')
  return { ok: true }
}

// ============================================================
// NOTIFICATIONS — Marquer comme lu
// ============================================================

export async function markNotificationReadAction(
  _prevState: unknown,
  formData: FormData
): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const user = await getUserFromSession()
  if (!user) return { ok: false, error: 'Session expirée.' }

  const notificationId = String(formData.get('notificationId') || '')
  const markAll = String(formData.get('markAll') || 'false') === 'true'

  if (markAll) {
    await db.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    })
  } else {
    await db.notification.updateMany({
      where: { id: notificationId, userId: user.id },
      data: { read: true },
    })
  }

  revalidatePath('/')
  return { ok: true }
}

// ============================================================
// DIRECTION — Mise à jour du branding
// ============================================================

export async function updateBrandingAction(
  _prevState: unknown,
  formData: FormData
): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const user = await getUserFromSession()
  if (!user || (user.role !== 'DIRECTION' && user.role !== 'ADMIN')) {
    return { ok: false, error: 'Action réservée à la direction.' }
  }

  const schoolId = String(formData.get('schoolId') || '')
  const primaryColor = String(formData.get('primaryColor') || '#2563EB')
  const secondaryColor = String(formData.get('secondaryColor') || '#0F766E')
  const tertiaryColor = String(formData.get('tertiaryColor') || '#F59E0B')
  const schoolName = String(formData.get('schoolName') || '').trim()
  const slogan = String(formData.get('slogan') || '').trim()
  const logoUrl = String(formData.get('logoUrl') || '').trim() || null

  // Validation des couleurs hex
  const hexRegex = /^#[0-9a-fA-F]{6}$/
  if (!hexRegex.test(primaryColor) || !hexRegex.test(secondaryColor) || !hexRegex.test(tertiaryColor)) {
    return { ok: false, error: 'Les couleurs doivent être au format hexadécimal #RRGGBB.' }
  }

  // Compter la version actuelle
  const latest = await db.branding.findFirst({
    where: { schoolId },
    orderBy: { version: 'desc' },
  })
  const newVersion = (latest?.version ?? 0) + 1

  // Archiver l'ancien branding publié
  await db.branding.updateMany({
    where: { schoolId, status: 'PUBLISHED' },
    data: { status: 'DRAFT' },
  })

  // Créer la nouvelle version publiée
  await db.branding.create({
    data: {
      schoolId,
      version: newVersion,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      primaryColor,
      secondaryColor,
      tertiaryColor,
      schoolName,
      slogan,
      logoUrl,
    },
  })

  // Mettre à jour l'école
  await db.school.update({
    where: { id: schoolId },
    data: {
      name: schoolName || undefined,
      slogan: slogan || undefined,
      primaryColor,
      secondaryColor,
      tertiaryColor,
    },
  })

  await logAudit({
    userId: user.id,
    userName: user.displayName,
    userRole: user.role,
    schoolId,
    action: 'BRANDING_UPDATE',
    entityType: 'BRANDING',
    description: `Mise à jour du branding (v${newVersion})`,
  })

  revalidatePath('/')
  return { ok: true }
}
