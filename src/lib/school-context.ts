// SmartShule — Helper partagé : récupère le schoolId de l'utilisateur connecté
// ============================================================
// RÈGLE MULTI-ÉCOLES : school_id est OBLIGATOIRE dans toutes les requêtes.
// Une requête sans school_id doit être refusée (403).
// Une requête avec school_id différent du tenant connecté doit être refusée.
// Aucun fallback vers "première école" en production — isolation stricte.
//
// Logique de résolution :
//   1. Cherche l'employé lié à l'email
//   2. Si pas d'employé, cherche par Student.userId
//   3. Si pas, cherche par Guardian.userId
//   4. Si pas, cherche via AuditLog (premier log de l'user)
//   5. En DÉVELOPPEMENT seulement : fallback première école (pour démo)

import { db } from '@/lib/db'

export async function getSchoolIdForUser(userId: string, userEmail?: string): Promise<string | null> {
  // 1. Chercher par employé lié à l'email
  if (userEmail) {
    const employee = await db.employee.findFirst({
      where: { email: userEmail },
      select: { schoolId: true },
    })
    if (employee?.schoolId) return employee.schoolId
  }

  // 2. Chercher par student lié à userId
  const student = await db.student.findFirst({
    where: { userId },
    select: { schoolId: true },
  })
  if (student?.schoolId) return student.schoolId

  // 3. Chercher par guardian lié à userId
  const guardian = await db.guardian.findFirst({
    where: { userId },
    select: { schoolId: true },
  })
  if (guardian?.schoolId) return guardian.schoolId

  // 4. Chercher via AuditLog (premier log de cet user)
  const auditLog = await db.auditLog.findFirst({
    where: { userId, schoolId: { not: null } },
    select: { schoolId: true },
    orderBy: { createdAt: 'desc' },
  })
  if (auditLog?.schoolId) return auditLog.schoolId

  // 5. Fallback UNIQUEMENT en développement/démo
  // En production : refuser l'accès (return null → 403)
  if (process.env.NODE_ENV === 'production') {
    return null // Isolation stricte — pas de fallback en production
  }

  // Développement/démo : première école de la base
  const school = await db.school.findFirst()
  return school?.id || null
}

/**
 * Vérifie qu'un utilisateur a accès à une école spécifique.
 * Utilisé pour empêcher l'accès cross-tenant.
 */
export async function assertSchoolAccess(userId: string, requestedSchoolId: string, userEmail?: string): Promise<boolean> {
  const userSchoolId = await getSchoolIdForUser(userId, userEmail)
  if (!userSchoolId) return false
  return userSchoolId === requestedSchoolId
}

/**
 * Récupère l'école complète (avec toutes ses infos) pour l'utilisateur connecté.
 */
export async function getSchoolForUser(userId: string, userEmail?: string) {
  const schoolId = await getSchoolIdForUser(userId, userEmail)
  if (!schoolId) return null
  return await db.school.findUnique({ where: { id: schoolId } })
}
