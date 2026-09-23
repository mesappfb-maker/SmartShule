// SmartShule — Helper d'audit
// Journalisation immuable des actions sensibles.

import { db } from './db'

export type AuditAction =
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'READ'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'PUBLISH'
  | 'ARCHIVE'
  | 'REPLY_REQUEST'
  | 'CREATE_REQUEST'
  | 'CLOSE_REQUEST'
  | 'ASSIGN_REQUEST'
  | 'SUBMIT_ASSIGNMENT'
  | 'GRADE_PUBLISHED'
  | 'READ_REPORT_CARD'
  | 'PAYMENT_INITIATED'
  | 'PAYMENT_CONFIRMED'
  | 'EXPORT'
  | 'BRANDING_UPDATE'

export type EntityType =
  | 'USER'
  | 'STUDENT'
  | 'GUARDIAN'
  | 'INVOICE'
  | 'PAYMENT'
  | 'ANNOUNCEMENT'
  | 'PARENT_REQUEST'
  | 'REPORT_CARD'
  | 'GRADE'
  | 'SUBMISSION'
  | 'BRANDING'
  | 'SESSION'
  | 'OTHER'

export async function logAudit(opts: {
  userId?: string
  userName?: string
  userRole?: string
  schoolId?: string
  action: AuditAction | string
  entityType: EntityType | string
  entityId?: string
  description: string
  ipAddress?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: opts.userId,
        userName: opts.userName,
        userRole: opts.userRole,
        schoolId: opts.schoolId,
        action: opts.action,
        entityType: opts.entityType,
        entityId: opts.entityId,
        description: opts.description,
        ipAddress: opts.ipAddress,
        metadata: opts.metadata ? JSON.stringify(opts.metadata) : null,
      },
    })
  } catch (err) {
    // L'audit ne doit jamais casser le flux principal
    console.error('[audit] Erreur de journalisation:', err)
  }
}

// Helper pour récupérer l'IP depuis les headers
export function getClientIP(headers: Headers): string | undefined {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    undefined
  )
}
