'use server'

// SmartShule — Server Actions : Lignes de Frais & Encaissements (Comptable)
// Séparation des pouvoirs : Directeur crée les lignes, Comptable encaisse.

import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { logAudit, getClientIP } from '@/lib/audit'
import { checkIdempotencyKey, recordIdempotencyResult } from '@/lib/idempotency'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { toCents } from '@/lib/money'

// ============================================================
// Helper : vérifier l'école
// ============================================================

async function getSchoolId(userId: string): Promise<string | null> {
  const audit = await db.auditLog.findFirst({
    where: { userId, schoolId: { not: null } },
    select: { schoolId: true },
  })
  if (audit?.schoolId) return audit.schoolId
  const school = await db.school.findFirst()
  return school?.id || null
}

// ============================================================
// 1. createInvoiceLineAction (DIRECTEUR uniquement)
// ============================================================

export async function createInvoiceLineAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ ok: true; lineId: string } | { ok: false; error: string }> {
  const user = await getUserFromSession()
  if (!user || (user.role !== 'DIRECTION' && user.role !== 'ADMIN')) {
    return { ok: false, error: 'Seul le Directeur peut créer des lignes de frais.' }
  }

  const name = String(formData.get('name') || '').trim()
  const code = String(formData.get('code') || '').trim().toUpperCase()
  const amount = String(formData.get('amount') || '0')
  const directorateId = String(formData.get('directorateId') || '') || undefined
  const isMandatory = formData.get('isMandatory') === 'true'
  const period = String(formData.get('period') || '') || undefined

  if (!name || !code || !amount) {
    return { ok: false, error: 'Libellé, code et montant obligatoires.' }
  }

  const amountCents = toCents(amount)
  if (amountCents <= 0) {
    return { ok: false, error: 'Le montant doit être positif.' }
  }

  const schoolId = await getSchoolId(user.id)
  if (!schoolId) return { ok: false, error: 'École introuvable.' }

  // Vérifier l'unicité du code
  const existing = await db.invoiceLineConfig.findFirst({
    where: { schoolId, code },
  })
  if (existing) {
    return { ok: false, error: `Le code "${code}" existe déjà.` }
  }

  try {
    const line = await db.invoiceLineConfig.create({
      data: {
        schoolId,
        name,
        code,
        amountCents,
        currency: 'CDF',
        isMandatory,
        isRecurring: false,
        period,
        directorateId,
        status: 'ACTIVE',
        createdById: user.id,
      },
    })

    const h = await headers()
    await logAudit({
      userId: user.id, userName: user.displayName, userRole: user.role,
      schoolId, action: 'CREATE_INVOICE_LINE', entityType: 'INVOICE_LINE_CONFIG',
      entityId: line.id,
      description: `Ligne de frais créée : ${name} (${code}) — ${amount} CDF`,
      ipAddress: getClientIP(h),
    })

    revalidatePath('/')
    return { ok: true, lineId: line.id }
  } catch (e) {
    return { ok: false, error: 'Erreur lors de la création de la ligne de frais.' }
  }
}

// ============================================================
// 2. recordEncashmentAction (COMPTABLE uniquement)
// ============================================================

export async function recordEncashmentAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ ok: true; receiptNumber: string; encashmentId: string } | { ok: false; error: string }> {
  const user = await getUserFromSession()
  if (!user || (user.role !== 'ACCOUNTANT' && user.role !== 'DIRECTION' && user.role !== 'ADMIN')) {
    return { ok: false, error: 'Seul le Comptable peut encaisser.' }
  }

  const invoiceLineConfigId = String(formData.get('invoiceLineConfigId') || '')
  const studentId = String(formData.get('studentId') || '') || undefined
  const amount = String(formData.get('amount') || '0')
  const paymentMethod = String(formData.get('paymentMethod') || 'CASH')
  const payerName = String(formData.get('payerName') || '') || undefined
  const period = String(formData.get('period') || '') || undefined
  const idempotencyKey = String(formData.get('idempotencyKey') || '') || crypto.randomUUID()

  if (!invoiceLineConfigId || !amount) {
    return { ok: false, error: 'Ligne de frais et montant obligatoires.' }
  }

  const amountCents = toCents(amount)
  if (amountCents <= 0) {
    return { ok: false, error: 'Le montant doit être positif.' }
  }

  const schoolId = await getSchoolId(user.id)
  if (!schoolId) return { ok: false, error: 'École introuvable.' }

  // Idempotence — anti-doublon
  const payload = { action: 'encashment', invoiceLineConfigId, studentId, amountCents, paymentMethod }
  const idemCheck = await checkIdempotencyKey(user.id, idempotencyKey, payload)
  if (idemCheck.exists && idemCheck.payloadMatches && idemCheck.cachedResult) {
    return idemCheck.cachedResult as any
  }
  if (idemCheck.exists && !idemCheck.payloadMatches) {
    return { ok: false, error: 'Conflit d\'idempotence : payload divergent.' }
  }

  // Vérifier que la ligne de frais existe
  const line = await db.invoiceLineConfig.findFirst({
    where: { id: invoiceLineConfigId, schoolId, status: 'ACTIVE' },
  })
  if (!line) {
    return { ok: false, error: 'Ligne de frais introuvable ou inactive.' }
  }

  try {
    // Générer le numéro de reçu
    const count = await db.encashment.count({ where: { schoolId } })
    const receiptNumber = `REC-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`

    const encashment = await db.encashment.create({
      data: {
        schoolId,
        receiptNumber,
        invoiceLineConfigId,
        studentId,
        amountCents,
        currency: 'CDF',
        paymentMethod,
        payerName,
        period,
        status: 'CONFIRMED',
        encashedById: user.id,
        directorNotifiedAt: new Date(), // Notification instantanée
      },
    })

    // Si l'élève était bloqué, le débloquer
    if (studentId) {
      await db.studentFinancialStatus.updateMany({
        where: { schoolId, studentId, status: { in: ['LITIGATION', 'BLOCKED'] } },
        data: { status: 'REGULAR', reason: null, updatedAt: new Date() },
      })
    }

    // Audit
    const h = await headers()
    await logAudit({
      userId: user.id, userName: user.displayName, userRole: user.role,
      schoolId, action: 'ENCASHMENT_CONFIRMED', entityType: 'ENCASHMENT',
      entityId: encashment.id,
      description: `Encaissement ${receiptNumber} — ${amount} CDF (${paymentMethod})`,
      ipAddress: getClientIP(h),
      metadata: { receiptNumber, amountCents, paymentMethod, lineCode: line.code },
    })

    const response = {
      ok: true as const,
      receiptNumber,
      encashmentId: encashment.id,
    }
    await recordIdempotencyResult(user.id, idempotencyKey, idemCheck.payloadHash, response, 201)

    revalidatePath('/')
    return response
  } catch (e) {
    return { ok: false, error: 'Erreur lors de l\'encaissement.' }
  }
}

// ============================================================
// 3. blockStudentFinanciallyAction (DIRECTEUR ou COMPTABLE)
// ============================================================

export async function blockStudentFinanciallyAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getUserFromSession()
  if (!user || (user.role !== 'DIRECTION' && user.role !== 'ACCOUNTANT' && user.role !== 'ADMIN')) {
    return { ok: false, error: 'Action non autorisée.' }
  }

  const studentId = String(formData.get('studentId') || '')
  const reason = String(formData.get('reason') || '').trim()

  if (!studentId || !reason) {
    return { ok: false, error: 'Élève et motif obligatoires.' }
  }

  const schoolId = await getSchoolId(user.id)
  if (!schoolId) return { ok: false, error: 'École introuvable.' }

  try {
    await db.studentFinancialStatus.upsert({
      where: { schoolId_studentId: { schoolId, studentId } },
      create: {
        schoolId,
        studentId,
        status: 'BLOCKED',
        reason,
        blockedAt: new Date(),
        updatedById: user.id,
      },
      update: {
        status: 'BLOCKED',
        reason,
        blockedAt: new Date(),
        updatedById: user.id,
      },
    })

    const h = await headers()
    await logAudit({
      userId: user.id, userName: user.displayName, userRole: user.role,
      schoolId, action: 'BLOCK_STUDENT_FINANCIAL', entityType: 'STUDENT',
      entityId: studentId,
      description: `Élève bloqué financièrement : ${reason}`,
      ipAddress: getClientIP(h),
    })

    revalidatePath('/')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: 'Erreur lors du blocage.' }
  }
}
