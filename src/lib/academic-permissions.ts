// SmartShule — Permissions académiques granulaires
// ============================================================
// Définit les permissions par ressource et par action.
// Vérification côté serveur obligatoire.
import { hasRole } from '@/lib/rbac'

export type AcademicPermission =
  | 'ACADEMIC.SUBJECT.VIEW'
  | 'ACADEMIC.SUBJECT.CREATE'
  | 'ACADEMIC.SUBJECT.UPDATE_BASIC'
  | 'ACADEMIC.SUBJECT.UPDATE_GRADING_RULES'
  | 'ACADEMIC.SUBJECT.DEACTIVATE'
  | 'ACADEMIC.SUBJECT.REACTIVATE'
  | 'ACADEMIC.SUBJECT.ARCHIVE'
  | 'ACADEMIC.SUBJECT.DELETE_UNUSED'
  | 'ACADEMIC.SUBJECT.VIEW_DEPENDENCIES'
  | 'ACADEMIC.SUBJECT.VIEW_AUDIT'
  | 'ACADEMIC.CLASS_SUBJECT.CREATE'
  | 'ACADEMIC.CLASS_SUBJECT.UPDATE'
  | 'ACADEMIC.CLASS_SUBJECT.ASSIGN_TEACHER'
  | 'ACADEMIC.CLASS_SUBJECT.ASSIGN_ROOM'
  | 'ACADEMIC.CLASS_SUBJECT.CONFIGURE_WEIGHT'
  | 'ACADEMIC.CLASS_SUBJECT.CONFIGURE_GRADING_SCALE'
  | 'ACADEMIC.CLASS_SUBJECT.SUSPEND'
  | 'ACADEMIC.CLASS_SUBJECT.ARCHIVE'
  | 'ACADEMIC.SCHEDULE.CREATE_DRAFT'
  | 'ACADEMIC.SCHEDULE.PUBLISH'
  | 'ACADEMIC.SCHEDULE.CANCEL'
  | 'ACADEMIC.SCHEDULE.ARCHIVE'
  | 'ACADEMIC.GRADE.ENTER_OWN'
  | 'ACADEMIC.GRADE.REQUEST_CORRECTION'
  | 'ACADEMIC.GRADE.APPROVE_CORRECTION'

// Matrice permissions par rôle
const PERMISSION_MATRIX: Record<string, AcademicPermission[]> = {
  DIRECTOR: [
    'ACADEMIC.SUBJECT.VIEW', 'ACADEMIC.SUBJECT.CREATE', 'ACADEMIC.SUBJECT.UPDATE_BASIC',
    'ACADEMIC.SUBJECT.UPDATE_GRADING_RULES', 'ACADEMIC.SUBJECT.DEACTIVATE',
    'ACADEMIC.SUBJECT.REACTIVATE', 'ACADEMIC.SUBJECT.ARCHIVE', 'ACADEMIC.SUBJECT.DELETE_UNUSED',
    'ACADEMIC.SUBJECT.VIEW_DEPENDENCIES', 'ACADEMIC.SUBJECT.VIEW_AUDIT',
    'ACADEMIC.CLASS_SUBJECT.CREATE', 'ACADEMIC.CLASS_SUBJECT.UPDATE',
    'ACADEMIC.CLASS_SUBJECT.ASSIGN_TEACHER', 'ACADEMIC.CLASS_SUBJECT.ASSIGN_ROOM',
    'ACADEMIC.CLASS_SUBJECT.CONFIGURE_WEIGHT', 'ACADEMIC.CLASS_SUBJECT.CONFIGURE_GRADING_SCALE',
    'ACADEMIC.CLASS_SUBJECT.SUSPEND', 'ACADEMIC.CLASS_SUBJECT.ARCHIVE',
    'ACADEMIC.SCHEDULE.CREATE_DRAFT', 'ACADEMIC.SCHEDULE.PUBLISH',
    'ACADEMIC.SCHEDULE.CANCEL', 'ACADEMIC.SCHEDULE.ARCHIVE',
    'ACADEMIC.GRADE.APPROVE_CORRECTION',
  ],
  SCHOOL_ADMIN: [
    'ACADEMIC.SUBJECT.VIEW', 'ACADEMIC.SUBJECT.CREATE', 'ACADEMIC.SUBJECT.UPDATE_BASIC',
    'ACADEMIC.SUBJECT.DEACTIVATE', 'ACADEMIC.SUBJECT.REACTIVATE', 'ACADEMIC.SUBJECT.ARCHIVE',
    'ACADEMIC.SUBJECT.VIEW_DEPENDENCIES',
    'ACADEMIC.CLASS_SUBJECT.CREATE', 'ACADEMIC.CLASS_SUBJECT.UPDATE',
    'ACADEMIC.SCHEDULE.CREATE_DRAFT',
  ],
  SECRETARY: [
    'ACADEMIC.SUBJECT.VIEW', 'ACADEMIC.SUBJECT.VIEW_DEPENDENCIES',
  ],
  TEACHER: [
    'ACADEMIC.SUBJECT.VIEW', 'ACADEMIC.GRADE.ENTER_OWN', 'ACADEMIC.GRADE.REQUEST_CORRECTION',
  ],
  PROMOTER: [
    'ACADEMIC.SUBJECT.VIEW',
  ],
  HR_MANAGER: [
    'ACADEMIC.SUBJECT.VIEW', // lecture charge horaire agrégée
  ],
  AUDITOR: [
    'ACADEMIC.SUBJECT.VIEW', 'ACADEMIC.SUBJECT.VIEW_AUDIT',
  ],
  PARENT: [],
  STUDENT: [],
  ACCOUNTANT: [],
  CASHIER: [],
  PAYROLL_OFFICER: [
    'ACADEMIC.SUBJECT.VIEW',
  ],
  SYSTEM_ADMIN: [], // Technique uniquement, pas métier académique
}

export function hasAcademicPermission(userRole: string, permission: AcademicPermission): boolean {
  const user = { role: userRole }

  // Vérifier le rôle direct
  const perms = PERMISSION_MATRIX[userRole]
  if (perms && perms.includes(permission)) return true

  // Vérifier les équivalences (DIRECTION = DIRECTOR, ADMIN = SCHOOL_ADMIN)
  if (hasRole(user, ['DIRECTOR']) && PERMISSION_MATRIX['DIRECTOR']?.includes(permission)) return true
  if (hasRole(user, ['SCHOOL_ADMIN']) && PERMISSION_MATRIX['SCHOOL_ADMIN']?.includes(permission)) return true
  if (hasRole(user, ['SECRETARY']) && PERMISSION_MATRIX['SECRETARY']?.includes(permission)) return true
  if (hasRole(user, ['TEACHER']) && PERMISSION_MATRIX['TEACHER']?.includes(permission)) return true

  return false
}

export function getAcademicPermissions(userRole: string): AcademicPermission[] {
  const user = { role: userRole }
  if (hasRole(user, ['DIRECTOR'])) return PERMISSION_MATRIX['DIRECTOR'] || []
  if (hasRole(user, ['SCHOOL_ADMIN'])) return PERMISSION_MATRIX['SCHOOL_ADMIN'] || []
  if (hasRole(user, ['SECRETARY'])) return PERMISSION_MATRIX['SECRETARY'] || []
  if (hasRole(user, ['TEACHER'])) return PERMISSION_MATRIX['TEACHER'] || []
  if (hasRole(user, ['PROMOTER'])) return PERMISSION_MATRIX['PROMOTER'] || []
  if (hasRole(user, ['AUDITOR'])) return PERMISSION_MATRIX['AUDITOR'] || []
  if (hasRole(user, ['HR_MANAGER'])) return PERMISSION_MATRIX['HR_MANAGER'] || []
  return PERMISSION_MATRIX[userRole] || []
}

// Vérifier si une suppression physique est autorisée
export function canDeleteSubject(userRole: string, hasDependencies: boolean): { ok: boolean; reason?: string } {
  if (!hasAcademicPermission(userRole, 'ACADEMIC.SUBJECT.DELETE_UNUSED')) {
    return { ok: false, reason: 'Permission de suppression non accordée pour ce rôle.' }
  }
  if (hasDependencies) {
    return { ok: false, reason: 'Suppression impossible : la matière a des dépendances (notes, horaires, bulletins). Utilisez la désactivation ou l\'archivage.' }
  }
  return { ok: true }
}

// Vérifier si une modification de coefficient est autorisée après publication
export function canModifyGradingRules(userRole: string, hasPublishedGrades: boolean): { ok: boolean; reason?: string; requiresWorkflow?: boolean } {
  if (!hasAcademicPermission(userRole, 'ACADEMIC.SUBJECT.UPDATE_GRADING_RULES')) {
    return { ok: false, reason: 'Permission de modifier les règles de notation non accordée.' }
  }
  if (hasPublishedGrades) {
    return {
      ok: false,
      reason: 'Des notes sont déjà publiées. La modification du coefficient/barème nécessite un workflow de correction validé par la direction.',
      requiresWorkflow: true,
    }
  }
  return { ok: true }
}
