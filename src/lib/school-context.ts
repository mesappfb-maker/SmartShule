// SmartShule — Helper partagé : récupère le schoolId de l'utilisateur connecté
// ============================================================
// Logique :
//   1. Cherche l'employé lié à l'email
//   2. Si pas d'employé, cherche via AuditLog (premier log de l'user)
//   3. Si rien, prend la première école de la base
//
// Ceci est nécessaire car :
//   - La Direction peut être connectée sans entrée Employee
//   - L'ADMIN n'a pas toujours d'employé lié
//   - On veut une récupération résiliente

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

  // 5. Fallback : première école de la base
  const school = await db.school.findFirst()
  return school?.id || null
}

/**
 * Récupère l'école complète (avec toutes ses infos) pour l'utilisateur connecté.
 */
export async function getSchoolForUser(userId: string, userEmail?: string) {
  const schoolId = await getSchoolIdForUser(userId, userEmail)
  if (!schoolId) return null
  return await db.school.findUnique({ where: { id: schoolId } })
}
