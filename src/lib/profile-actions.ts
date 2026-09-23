'use server'

// SmartShule — Server Actions : Profil utilisateur
// Permet à chaque rôle de modifier son profil et son mot de passe.
// Sécurité : vérification du mot de passe actuel, audit, RBAC.

import { db } from '@/lib/db'
import { getUserFromSession, hashPassword, verifyPassword } from '@/lib/auth'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

// ============================================================
// 1. updateProfileAction
// ============================================================

export async function updateProfileAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getUserFromSession()
  if (!user) return { ok: false, error: 'Session expirée.' }

  const displayName = String(formData.get('displayName') || '').trim()
  const email = String(formData.get('email') || '').trim().toLowerCase()

  if (!displayName || displayName.length < 2) {
    return { ok: false, error: 'Le nom doit faire au moins 2 caractères.' }
  }
  if (!email || !email.includes('@')) {
    return { ok: false, error: 'Email invalide.' }
  }

  // Vérifier que l'email n'est pas déjà utilisé par un autre utilisateur
  const existing = await db.user.findUnique({ where: { email } })
  if (existing && existing.id !== user.id) {
    return { ok: false, error: 'Cet email est déjà utilisé.' }
  }

  try {
    await db.user.update({
      where: { id: user.id },
      data: { displayName, email },
    })

    const h = await headers()
    await logAudit({
      userId: user.id,
      userName: user.displayName,
      userRole: user.role,
      action: 'UPDATE_PROFILE',
      entityType: 'USER',
      entityId: user.id,
      description: `Profil mis à jour : ${displayName} (${email})`,
      ipAddress: getClientIP(h),
    })

    revalidatePath('/')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: 'Erreur lors de la mise à jour du profil.' }
  }
}

// ============================================================
// 2. changePasswordAction
// ============================================================

export async function changePasswordAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getUserFromSession()
  if (!user) return { ok: false, error: 'Session expirée.' }

  const currentPassword = String(formData.get('currentPassword') || '')
  const newPassword = String(formData.get('newPassword') || '')
  const confirmPassword = String(formData.get('confirmPassword') || '')

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { ok: false, error: 'Tous les champs sont obligatoires.' }
  }
  if (newPassword.length < 8) {
    return { ok: false, error: 'Le nouveau mot de passe doit faire au moins 8 caractères.' }
  }
  if (newPassword !== confirmPassword) {
    return { ok: false, error: 'Les nouveaux mots de passe ne correspondent pas.' }
  }

  // Récupérer le hash actuel
  const dbUser = await db.user.findUnique({ where: { id: user.id } })
  if (!dbUser) return { ok: false, error: 'Utilisateur introuvable.' }

  // Vérifier le mot de passe actuel
  const valid = await verifyPassword(currentPassword, dbUser.passwordHash)
  if (!valid) {
    const h = await headers()
    await logAudit({
      userId: user.id,
      userName: user.displayName,
      userRole: user.role,
      action: 'PASSWORD_CHANGE_FAILED',
      entityType: 'USER',
      entityId: user.id,
      description: 'Tentative de changement de mot de passe échouée (mauvais mot de passe actuel)',
      ipAddress: getClientIP(h),
    })
    return { ok: false, error: 'Le mot de passe actuel est incorrect.' }
  }

  // Hasher le nouveau
  const newHash = await hashPassword(newPassword)

  try {
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    })

    const h = await headers()
    await logAudit({
      userId: user.id,
      userName: user.displayName,
      userRole: user.role,
      action: 'CHANGE_PASSWORD',
      entityType: 'USER',
      entityId: user.id,
      description: 'Mot de passe changé avec succès',
      ipAddress: getClientIP(h),
    })

    revalidatePath('/')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: 'Erreur lors du changement de mot de passe.' }
  }
}

// ============================================================
// 3. getProfileData (query helper)
// ============================================================

export async function getProfileData(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      active: true,
      lastLoginAt: true,
      createdAt: true,
    },
  })

  if (!user) return null

  // Récupérer les infos liées au rôle
  let roleData: {
    type: string
    name?: string
    phone?: string | null
    address?: string | null
    profession?: string | null
    function?: string | null
    matricule?: string | null
  } | null = null

  if (user.role === 'PARENT') {
    const guardian = await db.guardian.findFirst({
      where: { userId: user.id },
      select: { firstName: true, lastName: true, phone: true, email: true, address: true, profession: true },
    })
    if (guardian) {
      roleData = {
        type: 'Parent',
        name: `${guardian.firstName} ${guardian.lastName}`,
        phone: guardian.phone,
        address: guardian.address,
        profession: guardian.profession,
      }
    }
  } else if (user.role === 'STUDENT') {
    const student = await db.student.findFirst({
      where: { userId: user.id },
      select: { firstName: true, lastName: true, matricule: true },
    })
    if (student) {
      roleData = {
        type: 'Élève',
        name: `${student.firstName} ${student.lastName}`,
        matricule: student.matricule,
      }
    }
  } else if (user.role === 'DIRECTION' || user.role === 'TEACHER' || user.role === 'ACCOUNTANT' || user.role === 'SERVER') {
    const employee = await db.employee.findFirst({
      where: { email: user.email },
      select: { firstName: true, lastName: true, phone: true, function: true, globalRole: true },
    })
    if (employee) {
      roleData = {
        type: user.role === 'DIRECTION' ? 'Direction' : user.role === 'TEACHER' ? 'Enseignant' : user.role === 'ACCOUNTANT' ? 'Comptable' : 'Serveur',
        name: `${employee.firstName} ${employee.lastName}`,
        phone: employee.phone,
        function: employee.function,
      }
    }
  }

  // Audit récent
  const recentAudits = await db.auditLog.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, action: true, description: true, createdAt: true },
  })

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      active: user.active,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    },
    roleData,
    recentAudits,
  }
}
