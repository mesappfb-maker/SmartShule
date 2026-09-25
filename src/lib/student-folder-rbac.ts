// SmartShule — RBAC du Dossier Élève (cœur central du système)
// ============================================================
// Définit les permissions par section et par rôle.
// Une section peut être : VISIBLE / MASQUÉE / RÉSUMÉ_SEULEMENT.
//
// Le dossier élève a 9 sections :
//   1. IDENTITE_STATUT
//   2. ACADEMIQUE
//   3. VIE_SCOLAIRE
//   4. FINANCIER
//   5. DOCUMENTS
//   6. COMMUNICATIONS
//   7. SANTE_URGENCE
//   8. TRANSFERTS_SORTIES
//   9. AUDIT
//
// Pour chaque section, on définit :
//   - read : true / false / 'OWN_CHILD' (parent ne voit que son enfant)
//   - write : true / false
//   - fields : champs autorisés (filtrage granulaire)
//   - maskSensitive : champs à masquer

import { hasRole } from '@/lib/rbac'

export type StudentSection =
  | 'IDENTITE_STATUT'
  | 'ACADEMIQUE'
  | 'VIE_SCOLAIRE'
  | 'FINANCIER'
  | 'DOCUMENTS'
  | 'COMMUNICATIONS'
  | 'SANTE_URGENCE'
  | 'TRANSFERTS_SORTIES'
  | 'AUDIT'

export interface SectionPermission {
  read: boolean | 'OWN_CHILD'
  write: boolean
  maskSensitive?: string[] // champs à masquer/anonymiser
  summaryOnly?: boolean // ne montrer qu'un résumé, pas les détails
}

export interface StudentFolderPermissions {
  sections: Record<StudentSection, SectionPermission>
  canExport: boolean
  canPrint: boolean
  canSeeAuditTrail: boolean
  isParent: boolean // si le user est le parent de cet élève
  isStudent: boolean // si le user EST cet élève
  isTeacherOfStudent: boolean // si l'enseignant enseigne à cet élève
}

// ============================================================
// Vérifier si un user est parent de l'élève
// ============================================================

export async function isParentOfStudent(userId: string, studentId: string): Promise<boolean> {
  const { db } = await import('@/lib/db')
  const link = await db.guardianStudentLink.findFirst({
    where: {
      studentId,
      guardian: { userId },
    },
  })
  return !!link
}

// ============================================================
// Vérifier si le user est l'élève lui-même
// ============================================================

export async function isStudentSelf(userId: string, studentId: string): Promise<boolean> {
  const { db } = await import('@/lib/db')
  const student = await db.student.findFirst({
    where: { id: studentId, userId },
  })
  return !!student
}

// ============================================================
// Vérifier si l'enseignant enseigne à cet élève
// ============================================================

export async function isTeacherOfStudent(userId: string, studentId: string): Promise<boolean> {
  const { db } = await import('@/lib/db')
  // Récupérer l'employé lié au user (par userId si disponible, sinon par email)
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } })
  if (!user?.email) return false

  const employee = await db.employee.findFirst({
    where: { email: user.email },
  })
  if (!employee) return false

  // Vérifier si l'enseignant a un cours dans une classe de l'élève
  const enrollment = await db.enrollment.findFirst({
    where: { studentId, status: 'ACTIVE' },
    select: { classroomId: true },
  })
  if (!enrollment?.classroomId) return false

  const assignment = await db.teacherAssignment.findFirst({
    where: { employeeId: employee.id, classroomId: enrollment.classroomId },
  })
  return !!assignment
}

// ============================================================
// Définir les permissions par rôle
// ============================================================

export function getStudentFolderPermissions(
  userRole: string,
  isParent: boolean,
  isStudent: boolean,
  isTeacherOfStudent: boolean
): StudentFolderPermissions {
  // Créer un objet user simulé pour hasRole
  const user = { role: userRole }

  // ADMIN système : tout accès
  if (hasRole(user, ['ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN'])) {
    return {
      sections: {
        IDENTITE_STATUT: { read: true, write: true },
        ACADEMIQUE: { read: true, write: true },
        VIE_SCOLAIRE: { read: true, write: true },
        FINANCIER: { read: true, write: true },
        DOCUMENTS: { read: true, write: true },
        COMMUNICATIONS: { read: true, write: true },
        SANTE_URGENCE: { read: true, write: true },
        TRANSFERTS_SORTIES: { read: true, write: true },
        AUDIT: { read: true, write: false },
      },
      canExport: true,
      canPrint: true,
      canSeeAuditTrail: true,
      isParent: false,
      isStudent: false,
      isTeacherOfStudent: false,
    }
  }

  // DIRECTOR : tout accès sauf écriture audit
  if (hasRole(user, ['DIRECTION', 'DIRECTOR'])) {
    return {
      sections: {
        IDENTITE_STATUT: { read: true, write: true },
        ACADEMIQUE: { read: true, write: true },
        VIE_SCOLAIRE: { read: true, write: true },
        FINANCIER: { read: true, write: true },
        DOCUMENTS: { read: true, write: true },
        COMMUNICATIONS: { read: true, write: true },
        SANTE_URGENCE: { read: true, write: true },
        TRANSFERTS_SORTIES: { read: true, write: true },
        AUDIT: { read: true, write: false },
      },
      canExport: true,
      canPrint: true,
      canSeeAuditTrail: true,
      isParent: false,
      isStudent: false,
      isTeacherOfStudent: false,
    }
  }

  // SECRETARY : accès administratif complet sauf santé sensible
  if (hasRole(user, ['SECRETARY', 'ADMISSIONS_OFFICER'])) {
    return {
      sections: {
        IDENTITE_STATUT: { read: true, write: true },
        ACADEMIQUE: { read: true, write: true, summaryOnly: false },
        VIE_SCOLAIRE: { read: true, write: true },
        FINANCIER: { read: true, write: false, summaryOnly: true }, // statut administratif nécessaire seulement
        DOCUMENTS: { read: true, write: true },
        COMMUNICATIONS: { read: true, write: true },
        SANTE_URGENCE: { read: true, write: false, summaryOnly: true, maskSensitive: ['groupeSanguin', 'allergies', 'maladies', 'traitements'] },
        TRANSFERTS_SORTIES: { read: true, write: true },
        AUDIT: { read: true, write: false },
      },
      canExport: true,
      canPrint: true,
      canSeeAuditTrail: false,
      isParent: false,
      isStudent: false,
      isTeacherOfStudent: false,
    }
  }

  // ACCOUNTANT : accès financier complet, pas de notes/santé
  if (hasRole(user, ['ACCOUNTANT'])) {
    return {
      sections: {
        IDENTITE_STATUT: { read: true, write: false, maskSensitive: ['phone', 'email'] },
        ACADEMIQUE: { read: false, write: false },
        VIE_SCOLAIRE: { read: false, write: false },
        FINANCIER: { read: true, write: true },
        DOCUMENTS: { read: true, write: true }, // documents financiers
        COMMUNICATIONS: { read: true, write: true, summaryOnly: true }, // comms financières
        SANTE_URGENCE: { read: false, write: false },
        TRANSFERTS_SORTIES: { read: true, write: false, summaryOnly: true },
        AUDIT: { read: true, write: false },
      },
      canExport: true,
      canPrint: true,
      canSeeAuditTrail: false,
      isParent: false,
      isStudent: false,
      isTeacherOfStudent: false,
    }
  }

  // CASHIER : encaissements et reçus uniquement
  if (hasRole(user, ['CASHIER'])) {
    return {
      sections: {
        IDENTITE_STATUT: { read: true, write: false, maskSensitive: ['phone', 'email', 'address'] },
        ACADEMIQUE: { read: false, write: false },
        VIE_SCOLAIRE: { read: false, write: false },
        FINANCIER: { read: true, write: true }, // encaissements et reçus
        DOCUMENTS: { read: true, write: false, summaryOnly: true }, // reçus seulement
        COMMUNICATIONS: { read: false, write: false },
        SANTE_URGENCE: { read: false, write: false },
        TRANSFERTS_SORTIES: { read: false, write: false },
        AUDIT: { read: false, write: false },
      },
      canExport: true,
      canPrint: true,
      canSeeAuditTrail: false,
      isParent: false,
      isStudent: false,
      isTeacherOfStudent: false,
    }
  }

  // HR_MANAGER : pas d'accès dossier élève
  if (hasRole(user, ['HR_MANAGER', 'PAYROLL_OFFICER'])) {
    return {
      sections: {
        IDENTITE_STATUT: { read: false, write: false },
        ACADEMIQUE: { read: false, write: false },
        VIE_SCOLAIRE: { read: false, write: false },
        FINANCIER: { read: false, write: false },
        DOCUMENTS: { read: false, write: false },
        COMMUNICATIONS: { read: false, write: false },
        SANTE_URGENCE: { read: false, write: false },
        TRANSFERTS_SORTIES: { read: false, write: false },
        AUDIT: { read: false, write: false },
      },
      canExport: false,
      canPrint: false,
      canSeeAuditTrail: false,
      isParent: false,
      isStudent: false,
      isTeacherOfStudent: false,
    }
  }

  // TEACHER : accès pédagogique limité à ses classes
  if (hasRole(user, ['TEACHER'])) {
    const teacherAccess = isTeacherOfStudent
    return {
      sections: {
        IDENTITE_STATUT: { read: teacherAccess, write: false, maskSensitive: ['phone', 'email', 'address'] },
        ACADEMIQUE: { read: teacherAccess, write: teacherAccess }, // notes, présences de ses matières
        VIE_SCOLAIRE: { read: teacherAccess, write: teacherAccess, summaryOnly: true },
        FINANCIER: { read: false, write: false }, // JAMAIS de détails financiers individuels
        DOCUMENTS: { read: teacherAccess, write: false, summaryOnly: true }, // documents pédagogiques
        COMMUNICATIONS: { read: teacherAccess, write: teacherAccess },
        SANTE_URGENCE: { read: false, write: false }, // jamais de santé sensible
        TRANSFERTS_SORTIES: { read: false, write: false },
        AUDIT: { read: false, write: false },
      },
      canExport: false,
      canPrint: true,
      canSeeAuditTrail: false,
      isParent: false,
      isStudent: false,
      isTeacherOfStudent,
    }
  }

  // PARENT : lecture seule sur son enfant lié
  if (hasRole(user, ['PARENT']) && isParent) {
    return {
      sections: {
        IDENTITE_STATUT: { read: true, write: false },
        ACADEMIQUE: { read: true, write: false }, // notes, bulletins, présences
        VIE_SCOLAIRE: { read: true, write: false, summaryOnly: true },
        FINANCIER: { read: true, write: false }, // ses factures et reçus
        DOCUMENTS: { read: true, write: false }, // documents de son enfant
        COMMUNICATIONS: { read: true, write: true }, // peut envoyer messages
        SANTE_URGENCE: { read: true, write: true }, // peut modifier santé
        TRANSFERTS_SORTIES: { read: true, write: false },
        AUDIT: { read: false, write: false },
      },
      canExport: true,
      canPrint: true,
      canSeeAuditTrail: false,
      isParent: true,
      isStudent: false,
      isTeacherOfStudent: false,
    }
  }

  // STUDENT : lecture seule sur ses propres données
  if (hasRole(user, ['STUDENT']) && isStudent) {
    return {
      sections: {
        IDENTITE_STATUT: { read: true, write: false },
        ACADEMIQUE: { read: true, write: false }, // ses notes, bulletins
        VIE_SCOLAIRE: { read: true, write: false, summaryOnly: true },
        FINANCIER: { read: false, write: false }, // pas d'accès financier global
        DOCUMENTS: { read: true, write: false }, // ses documents
        COMMUNICATIONS: { read: true, write: true },
        SANTE_URGENCE: { read: true, write: false, summaryOnly: true },
        TRANSFERTS_SORTIES: { read: false, write: false },
        AUDIT: { read: false, write: false },
      },
      canExport: false,
      canPrint: true,
      canSeeAuditTrail: false,
      isParent: false,
      isStudent: true,
      isTeacherOfStudent: false,
    }
  }

  // AUDITOR : lecture seule audit + données autorisées
  if (hasRole(user, ['AUDITOR'])) {
    return {
      sections: {
        IDENTITE_STATUT: { read: true, write: false, maskSensitive: ['phone', 'email', 'address'] },
        ACADEMIQUE: { read: true, write: false },
        VIE_SCOLAIRE: { read: true, write: false },
        FINANCIER: { read: true, write: false },
        DOCUMENTS: { read: true, write: false },
        COMMUNICATIONS: { read: true, write: false },
        SANTE_URGENCE: { read: false, write: false }, // jamais de santé sans autorisation spéciale
        TRANSFERTS_SORTIES: { read: true, write: false },
        AUDIT: { read: true, write: false },
      },
      canExport: true,
      canPrint: true,
      canSeeAuditTrail: true,
      isParent: false,
      isStudent: false,
      isTeacherOfStudent: false,
    }
  }

  // PROMOTER : lecture stratégique
  if (hasRole(user, ['PROMOTER'])) {
    return {
      sections: {
        IDENTITE_STATUT: { read: true, write: false, summaryOnly: true },
        ACADEMIQUE: { read: true, write: false, summaryOnly: true },
        VIE_SCOLAIRE: { read: false, write: false },
        FINANCIER: { read: true, write: false },
        DOCUMENTS: { read: false, write: false },
        COMMUNICATIONS: { read: false, write: false },
        SANTE_URGENCE: { read: false, write: false },
        TRANSFERTS_SORTIES: { read: true, write: false, summaryOnly: true },
        AUDIT: { read: true, write: false },
      },
      canExport: true,
      canPrint: false,
      canSeeAuditTrail: true,
      isParent: false,
      isStudent: false,
      isTeacherOfStudent: false,
    }
  }

  // Par défaut : refus total
  return {
    sections: {
      IDENTITE_STATUT: { read: false, write: false },
      ACADEMIQUE: { read: false, write: false },
      VIE_SCOLAIRE: { read: false, write: false },
      FINANCIER: { read: false, write: false },
      DOCUMENTS: { read: false, write: false },
      COMMUNICATIONS: { read: false, write: false },
      SANTE_URGENCE: { read: false, write: false },
      TRANSFERTS_SORTIES: { read: false, write: false },
      AUDIT: { read: false, write: false },
    },
    canExport: false,
    canPrint: false,
    canSeeAuditTrail: false,
    isParent: false,
    isStudent: false,
    isTeacherOfStudent: false,
  }
}

// ============================================================
// Masquer les champs sensibles
// ============================================================

export function maskSensitiveFields(data: any, fieldsToMask: string[]): any {
  if (!data || !fieldsToMask.length) return data
  const masked = { ...data }
  for (const field of fieldsToMask) {
    if (masked[field] !== undefined) {
      masked[field] = '***'
    }
  }
  return masked
}
