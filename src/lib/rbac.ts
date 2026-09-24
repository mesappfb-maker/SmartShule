// SmartShule — Helper RBAC pour compatibilité anciens/nouveaux rôles
// ============================================================
// Les anciens rôles (DIRECTION, ADMIN) et nouveaux rôles (DIRECTOR,
// SCHOOL_ADMIN, SYSTEM_ADMIN) doivent tous être acceptés.
// Ce helper centralise la logique de vérification.

// Mapping anciens → nouveaux rôles équivalents
const ROLE_EQUIVALENTS: Record<string, string[]> = {
  DIRECTION: ['DIRECTION', 'DIRECTOR'],
  ADMIN: ['ADMIN', 'SCHOOL_ADMIN', 'SYSTEM_ADMIN'],
  SECRETARY: ['SECRETARY', 'ADMISSIONS_OFFICER'],
  ACCOUNTANT: ['ACCOUNTANT', 'CASHIER'],
  HR: ['HR_MANAGER', 'PAYROLL_OFFICER'],
}

/**
 * Vérifie si l'utilisateur a l'un des rôles autorisés.
 * Accepte à la fois les anciens et nouveaux noms de rôles.
 *
 * Exemple :
 *   hasRole(user, ['SECRETARY', 'DIRECTION', 'ADMIN'])
 *   → true si user.role === 'DIRECTOR' (équivalent de DIRECTION)
 */
export function hasRole(user: { role: string }, allowedRoles: string[]): boolean {
  // ADMIN système a toujours accès
  if (user.role === 'SYSTEM_ADMIN' || user.role === 'ADMIN') return true

  // Vérifier le rôle direct
  if (allowedRoles.includes(user.role)) return true

  // Vérifier les équivalences
  for (const allowed of allowedRoles) {
    const equivalents = ROLE_EQUIVALENTS[allowed]
    if (equivalents && equivalents.includes(user.role)) return true
  }

  return false
}

/**
 * Vérifie si l'utilisateur est directeur (ancien ou nouveau rôle)
 */
export function isDirector(user: { role: string }): boolean {
  return hasRole(user, ['DIRECTION', 'DIRECTOR'])
}

/**
 * Vérifie si l'utilisateur est administrateur (ancien ou nouveau rôle)
 */
export function isAdmin(user: { role: string }): boolean {
  return hasRole(user, ['ADMIN', 'SCHOOL_ADMIN', 'SYSTEM_ADMIN'])
}

/**
 * Vérifie si l'utilisateur est secrétaire ou agent d'admission
 */
export function isSecretary(user: { role: string }): boolean {
  return hasRole(user, ['SECRETARY', 'ADMISSIONS_OFFICER'])
}

/**
 * Vérifie si l'utilisateur est comptable ou caissier
 */
export function isFinance(user: { role: string }): boolean {
  return hasRole(user, ['ACCOUNTANT', 'CASHIER'])
}

/**
 * Vérifie si l'utilisateur est RH ou paie
 */
export function isHR(user: { role: string }): boolean {
  return hasRole(user, ['HR_MANAGER', 'PAYROLL_OFFICER'])
}
