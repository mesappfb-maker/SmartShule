'use server'

// SmartShule — Server Actions pour le module Finance (Cycle 02, §3.11)
//
// Trois actions principales :
//   - createInvoiceAction : crée une facture + génère l'écriture comptable en double entrée
//   - recordPaymentAction : enregistre un encaissement + génère l'écriture + met à jour la facture
//   - cancelPaymentAction : annule un paiement validé via un avoir (écriture inverse)
//
// Toutes les actions :
//   - Vérifient l'utilisateur connecté et son rôle (DIRECTION ou ADMIN)
//   - Vérifient le périmètre de l'école
//   - Utilisent les helpers d'idempotence du Cycle 01
//   - Journalisent l'action dans auditLog
//   - Exécutent les mutations dans des transactions Prisma quand nécessaire

import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { logAudit, getClientIP } from '@/lib/audit'
import { checkIdempotencyKey, recordIdempotencyResult } from '@/lib/idempotency'
import {
  computeInvoice,
  generateInvoiceEntryDraft,
  generatePaymentEntryDraft,
  generateReversalEntryDraft,
  postJournalEntry,
  AccountingError,
  PAYMENT_METHOD_TO_TREASURY,
  type InvoiceLineInput,
  type JournalEntryDraft,
} from '@/lib/accounting'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

// ============================================================
// Helper : trouver l'école de l'utilisateur direction
// ============================================================

async function getDirectionSchoolId(userId: string): Promise<string | null> {
  const audit = await db.auditLog.findFirst({
    where: { userId, schoolId: { not: null } },
    select: { schoolId: true },
  })
  if (audit?.schoolId) return audit.schoolId
  const school = await db.school.findFirst()
  return school?.id || null
}

// ============================================================
// 1. createInvoiceAction — Créer une facture
// ============================================================

export async function createInvoiceAction(
  _prevState: unknown,
  formData: FormData
): Promise<
  | { ok: true; invoiceId: string; invoiceNumber: string; entryId: string }
  | { ok: false; error: string }
> {
  const user = await getUserFromSession()
  if (!user || (user.role !== 'DIRECTION' && user.role !== 'ADMIN')) {
    return { ok: false, error: 'Action réservée à la direction.' }
  }

  const schoolId = await getDirectionSchoolId(user.id)
  if (!schoolId) return { ok: false, error: 'École introuvable.' }

  // Idempotence (Cycle 01) — clé fournie par le client ou générée
  const idempotencyKey =
    String(formData.get('idempotencyKey') || '') || crypto.randomUUID()
  const payload = {
    action: 'createInvoice',
    studentId: String(formData.get('studentId') || ''),
    lines: formData.get('lines'),
    dueDate: String(formData.get('dueDate') || ''),
  }
  const idemCheck = await checkIdempotencyKey(user.id, idempotencyKey, payload)
  if (idemCheck.exists && idemCheck.payloadMatches && idemCheck.cachedResult) {
    return idemCheck.cachedResult as { ok: true; invoiceId: string; invoiceNumber: string; entryId: string }
  }
  if (idemCheck.exists && !idemCheck.payloadMatches) {
    return {
      ok: false,
      error:
        'Une commande avec la même clé d\'idempotence a déjà été reçue avec un payload différent. ' +
        'Utilisez une nouvelle clé ou reprenez le même payload.',
    }
  }

  // Parsing et validation
  const studentId = String(formData.get('studentId') || '')
  const dueDateStr = String(formData.get('dueDate') || '')
  const linesJson = String(formData.get('lines') || '[]')

  if (!studentId) return { ok: false, error: 'Élève obligatoire.' }
  if (!dueDateStr) return { ok: false, error: 'Date d\'échéance obligatoire.' }

  let linesInput: InvoiceLineInput[]
  try {
    linesInput = JSON.parse(linesJson)
  } catch {
    return { ok: false, error: 'Lignes de facture invalides (JSON malformé).' }
  }
  if (!Array.isArray(linesInput) || linesInput.length === 0) {
    return { ok: false, error: 'Au moins une ligne de facture est requise.' }
  }

  // Vérifier que l'élève existe et appartient à l'école
  const student = await db.student.findFirst({
    where: { id: studentId, schoolId },
  })
  if (!student) return { ok: false, error: 'Élève introuvable dans cette école.' }

  // Calculer la facture
  let computed
  try {
    computed = computeInvoice(linesInput)
  } catch (e) {
    return { ok: false, error: `Erreur de calcul : ${(e as Error).message}` }
  }

  // Trouver le compte client (411001 = Clients académiques par défaut)
  const customerAccount = await db.chartOfAccount.findUnique({
    where: { schoolId_accountNumber: { schoolId, accountNumber: '411001' } },
  })
  if (!customerAccount) {
    return { ok: false, error: 'Compte client 411001 introuvable dans le plan comptable.' }
  }

  // Transaction : créer facture + lignes + écriture comptable
  try {
    // Générer le numéro de facture
    const invoiceCount = await db.invoice.count({ where: { schoolId } })
    const invoiceNumber = `FAC-2025-${String(invoiceCount + 1).padStart(4, '0')}`

    const result = await db.$transaction(async (tx) => {
      // 1. Créer la facture
      const invoice = await tx.invoice.create({
        data: {
          schoolId,
          studentId,
          invoiceNumber,
          issueDate: new Date(),
          dueDate: new Date(dueDateStr),
          status: 'UNPAID',
          totalAmount: computed.totalTTCCents / 100,
          paidAmount: 0,
          currency: 'CDF',
          totalAmountCents: computed.totalTTCCents,
          paidAmountCents: 0,
          lines: {
            create: computed.lines.map((line) => ({
              description: line.description,
              quantity: line.quantityCents / 100,
              unitPrice: line.unitPriceCents / 100,
              discount: line.discountRateCents / 100,
              taxRate: line.taxRateCents / 100,
              total: line.totalAmountCents / 100,
              quantityCents: line.quantityCents,
              unitPriceCents: line.unitPriceCents,
              discountCents: line.discountRateCents,
              taxRateCents: line.taxRateCents,
              grossAmountCents: line.grossAmountCents,
              discountAmountCents: line.discountAmountCents,
              netAmountCents: line.netAmountCents,
              taxAmountCents: line.taxAmountCents,
              totalAmountCents: line.totalAmountCents,
              productAccountNumber: line.productAccountNumber,
              taxAccountNumber: line.taxAccountNumber,
              feeDefinitionId: line.feeDefinitionId || null,
            })),
          },
        },
        include: { lines: true },
      })

      // 2. Générer et poster l'écriture comptable
      const entryDraft = generateInvoiceEntryDraft(
        computed,
        '411001',
        invoice.id,
        new Date()
      )
      const entry = await postJournalEntry(schoolId, entryDraft, user.id, tx)

      // 3. Lier l'écriture à la facture
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { accountingEntryId: entry.id },
      })

      return { invoice, entry }
    })

    // Audit
    const h = await headers()
    const ipAddress = getClientIP(h)
    await logAudit({
      userId: user.id,
      userName: user.displayName,
      userRole: user.role,
      schoolId,
      action: 'CREATE_INVOICE',
      entityType: 'INVOICE',
      entityId: result.invoice.id,
      description: `Création de la facture ${result.invoice.invoiceNumber} pour ${student.firstName} ${student.lastName} — montant TTC ${(computed.totalTTCCents / 100).toFixed(2)}`,
      ipAddress,
      metadata: {
        invoiceNumber: result.invoice.invoiceNumber,
        totalCents: computed.totalTTCCents,
        entryNumber: result.entry.entryNumber,
      },
    })

    // Enregistrer le résultat pour idempotence
    const response = {
      ok: true as const,
      invoiceId: result.invoice.id,
      invoiceNumber: result.invoice.invoiceNumber,
      entryId: result.entry.id,
    }
    await recordIdempotencyResult(user.id, idempotencyKey, idemCheck.payloadHash, response, 201)

    revalidatePath('/')
    return response
  } catch (e) {
    if (e instanceof AccountingError) {
      return { ok: false, error: `Erreur comptable (${e.code}) : ${e.message}` }
    }
    console.error('createInvoiceAction error:', e)
    return { ok: false, error: 'Erreur lors de la création de la facture.' }
  }
}

// ============================================================
// 2. recordPaymentAction — Enregistrer un encaissement
// ============================================================

export async function recordPaymentAction(
  _prevState: unknown,
  formData: FormData
): Promise<
  | { ok: true; paymentId: string; receiptNumber: string; entryId: string; invoiceStatus: string }
  | { ok: false; error: string }
> {
  const user = await getUserFromSession()
  if (!user || (user.role !== 'DIRECTION' && user.role !== 'ADMIN')) {
    return { ok: false, error: 'Action réservée à la direction.' }
  }

  const invoiceId = String(formData.get('invoiceId') || '')
  const amountStr = String(formData.get('amount') || '0')
  const method = String(formData.get('method') || 'CASH')
  const payerName = String(formData.get('payerName') || '')

  if (!invoiceId) return { ok: false, error: 'Facture obligatoire.' }
  if (!amountStr || parseFloat(amountStr) <= 0) {
    return { ok: false, error: 'Le montant doit être positif.' }
  }
  if (!['CASH', 'BANK', 'MOBILE_MONEY', 'CARD'].includes(method)) {
    return { ok: false, error: 'Méthode de paiement invalide.' }
  }

  // Idempotence
  const idempotencyKey = String(formData.get('idempotencyKey') || '') || crypto.randomUUID()
  const payload = { action: 'recordPayment', invoiceId, amount: amountStr, method }
  const idemCheck = await checkIdempotencyKey(user.id, idempotencyKey, payload)
  if (idemCheck.exists && idemCheck.payloadMatches && idemCheck.cachedResult) {
    return idemCheck.cachedResult as any
  }
  if (idemCheck.exists && !idemCheck.payloadMatches) {
    return { ok: false, error: 'Conflit d\'idempotence : payload divergent.' }
  }

  // Vérifier la facture
  const schoolId = await getDirectionSchoolId(user.id)
  if (!schoolId) return { ok: false, error: 'École introuvable.' }

  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, schoolId },
    include: { lines: true, payments: true },
  })
  if (!invoice) return { ok: false, error: 'Facture introuvable.' }
  if (invoice.status === 'CANCELLED') {
    return { ok: false, error: 'Impossible d\'encaisser sur une facture annulée.' }
  }
  if (invoice.status === 'PAID') {
    return { ok: false, error: 'Cette facture est déjà entièrement payée.' }
  }

  // Calculer le montant en centimes
  const amountCents = Math.round(parseFloat(amountStr) * 100)
  const remainingCents = invoice.totalAmountCents - invoice.paidAmountCents
  if (amountCents > remainingCents) {
    return {
      ok: false,
      error: `Le montant encaissé (${(amountCents / 100).toFixed(2)}) dépasse le solde restant dû (${(remainingCents / 100).toFixed(2)}).`,
    }
  }

  // Résoudre le compte de trésorerie selon la méthode
  const treasuryAccountNumber = PAYMENT_METHOD_TO_TREASURY[method]
  const treasuryAccount = await db.chartOfAccount.findUnique({
    where: { schoolId_accountNumber: { schoolId, accountNumber: treasuryAccountNumber } },
  })
  if (!treasuryAccount) {
    return { ok: false, error: `Compte de trésorerie ${treasuryAccountNumber} introuvable.` }
  }
  const customerAccount = await db.chartOfAccount.findUnique({
    where: { schoolId_accountNumber: { schoolId, accountNumber: '411001' } },
  })
  if (!customerAccount) {
    return { ok: false, error: 'Compte client 411001 introuvable.' }
  }

  try {
    const result = await db.$transaction(async (tx) => {
      // 1. Créer le paiement
      const receiptCount = await db.payment.count({ where: { schoolId } })
      const receiptNumber = `REC-2025-${String(receiptCount + 1).padStart(4, '0')}`

      const payment = await tx.payment.create({
        data: {
          schoolId,
          invoiceId: invoice.id,
          receiptNumber,
          amount: amountCents / 100,
          method,
          payerName: payerName || undefined,
          status: 'CONFIRMED',
          paidAt: new Date(),
          amountCents,
        },
      })

      // 2. Générer l'écriture comptable
      const entryDraft = generatePaymentEntryDraft(
        amountCents,
        treasuryAccountNumber,
        '411001',
        payment.id,
        method,
        new Date()
      )
      const entry = await postJournalEntry(schoolId, entryDraft, user.id, tx)

      // 3. Lier l'écriture au paiement
      await tx.payment.update({
        where: { id: payment.id },
        data: { accountingEntryId: entry.id },
      })

      // 4. Mettre à jour la facture (paidAmount + status)
      const newPaidCents = invoice.paidAmountCents + amountCents
      const newStatus =
        newPaidCents >= invoice.totalAmountCents ? 'PAID' : 'PARTIALLY_PAID'

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: newPaidCents / 100,
          paidAmountCents: newPaidCents,
          status: newStatus,
        },
      })

      return { payment, entry, newStatus }
    })

    // Audit
    const h = await headers()
    await logAudit({
      userId: user.id,
      userName: user.displayName,
      userRole: user.role,
      schoolId,
      action: 'PAYMENT_CONFIRMED',
      entityType: 'PAYMENT',
      entityId: result.payment.id,
      description: `Encaissement ${result.payment.receiptNumber} de ${(amountCents / 100).toFixed(2)} sur facture ${invoice.invoiceNumber} (${method})`,
      ipAddress: getClientIP(h),
      metadata: {
        receiptNumber: result.payment.receiptNumber,
        amountCents,
        method,
        invoiceNumber: invoice.invoiceNumber,
        entryNumber: result.entry.entryNumber,
      },
    })

    const response = {
      ok: true as const,
      paymentId: result.payment.id,
      receiptNumber: result.payment.receiptNumber,
      entryId: result.entry.id,
      invoiceStatus: result.newStatus,
    }
    await recordIdempotencyResult(user.id, idempotencyKey, idemCheck.payloadHash, response, 201)
    revalidatePath('/')
    return response
  } catch (e) {
    if (e instanceof AccountingError) {
      return { ok: false, error: `Erreur comptable (${e.code}) : ${e.message}` }
    }
    console.error('recordPaymentAction error:', e)
    return { ok: false, error: 'Erreur lors de l\'encaissement.' }
  }
}

// ============================================================
// 3. cancelPaymentAction — Annuler un paiement (via avoir)
// ============================================================

export async function cancelPaymentAction(
  _prevState: unknown,
  formData: FormData
): Promise<
  | { ok: true; creditNotePaymentId: string; reversalEntryId: string }
  | { ok: false; error: string }
> {
  const user = await getUserFromSession()
  if (!user || (user.role !== 'DIRECTION' && user.role !== 'ADMIN')) {
    return { ok: false, error: 'Action réservée à la direction.' }
  }

  const paymentId = String(formData.get('paymentId') || '')
  const reason = String(formData.get('reason') || '').trim()

  if (!paymentId) return { ok: false, error: 'Paiement obligatoire.' }
  if (!reason || reason.length < 5) {
    return { ok: false, error: 'Un motif d\'annulation d\'au moins 5 caractères est obligatoire.' }
  }

  const schoolId = await getDirectionSchoolId(user.id)
  if (!schoolId) return { ok: false, error: 'École introuvable.' }

  // Récupérer le paiement original
  const originalPayment = await db.payment.findFirst({
    where: { id: paymentId, schoolId },
    include: { invoice: true },
  })
  if (!originalPayment) return { ok: false, error: 'Paiement introuvable.' }
  if (originalPayment.status === 'CANCELLED') {
    return { ok: false, error: 'Ce paiement est déjà annulé.' }
  }
  if (!originalPayment.accountingEntryId) {
    return { ok: false, error: 'Le paiement n\'a pas d\'écriture comptable à inverser.' }
  }

  // Idempotence
  const idempotencyKey = String(formData.get('idempotencyKey') || '') || crypto.randomUUID()
  const payload = { action: 'cancelPayment', paymentId, reason }
  const idemCheck = await checkIdempotencyKey(user.id, idempotencyKey, payload)
  if (idemCheck.exists && idemCheck.payloadMatches && idemCheck.cachedResult) {
    return idemCheck.cachedResult as any
  }
  if (idemCheck.exists && !idemCheck.payloadMatches) {
    return { ok: false, error: 'Conflit d\'idempotence : payload divergent.' }
  }

  try {
    // Récupérer l'écriture originale AVANT d'ouvrir la transaction
    // (pour éviter les conflits de contexte dans generateReversalEntryDraft)
    const originalEntry = await db.journalEntry.findUnique({
      where: { id: originalPayment.accountingEntryId },
      include: { lines: { include: { account: true } }, journal: true },
    })
    if (!originalEntry) {
      return { ok: false, error: 'Écriture comptable originale introuvable.' }
    }

    const result = await db.$transaction(async (tx) => {
      // 1. Marquer le paiement original comme annulé
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
      })

      // 2. Créer un "paiement négatif" (avoir) lié au paiement original
      const creditNoteCount = await db.payment.count({
        where: { schoolId, reversesPaymentId: { not: null } },
      })
      const creditNoteNumber = `AVOIR-2025-${String(creditNoteCount + 1).padStart(4, '0')}`

      const creditNote = await tx.payment.create({
        data: {
          schoolId,
          invoiceId: originalPayment.invoiceId,
          receiptNumber: creditNoteNumber,
          amount: -originalPayment.amountCents / 100, // négatif
          method: originalPayment.method,
          payerName: originalPayment.payerName,
          status: 'CONFIRMED',
          paidAt: new Date(),
          amountCents: -originalPayment.amountCents,
          reversesPaymentId: paymentId,
        },
      })

      // 3. Générer le brouillon d'écriture d'inversion (sans DB, à partir de l'entry récupérée)
      const reversedLines: Array<{
        accountNumber: string
        side: 'DEBIT' | 'CREDIT'
        amountCents: number
        description?: string
        analyticalActivity?: string
        analyticalPeriod?: string
        analyticalDirection?: string
      }> = originalEntry.lines.map((line) => ({
        accountNumber: line.account.accountNumber,
        side: line.debit > 0 ? 'CREDIT' : 'DEBIT',
        amountCents: line.debit > 0 ? line.debit : line.credit,
        description: line.description || undefined,
        analyticalActivity: line.analyticalActivity || undefined,
        analyticalPeriod: line.analyticalPeriod || undefined,
        analyticalDirection: line.analyticalDirection || undefined,
      }))

      const reversalDraft: JournalEntryDraft = {
        journalCode: originalEntry.journal.code,
        entryDate: new Date(),
        description: `Avoir/Inversion — ${reason}`,
        referenceType: 'CREDIT_NOTE',
        referenceId: creditNote.id,
        lines: reversedLines,
        reversalOfId: originalEntry.id,
      }

      // 4. Poster l'écriture d'inversion dans la même transaction
      const reversalEntry = await postJournalEntry(schoolId, reversalDraft, user.id, tx)

      // 5. Lier l'écriture au paiement d'avoir
      await tx.payment.update({
        where: { id: creditNote.id },
        data: { accountingEntryId: reversalEntry.id },
      })

      // 6. Mettre à jour la facture (réduire le paidAmount)
      const invoice = originalPayment.invoice
      const newPaidCents = Math.max(0, invoice.paidAmountCents - originalPayment.amountCents)
      const newStatus =
        newPaidCents === 0 ? 'UNPAID' :
        newPaidCents >= invoice.totalAmountCents ? 'PAID' : 'PARTIALLY_PAID'

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: newPaidCents / 100,
          paidAmountCents: newPaidCents,
          status: newStatus,
        },
      })

      return { creditNote, reversalEntry, newStatus }
    })

    // Audit
    const h = await headers()
    await logAudit({
      userId: user.id,
      userName: user.displayName,
      userRole: user.role,
      schoolId,
      action: 'PAYMENT_CANCELLED',
      entityType: 'PAYMENT',
      entityId: paymentId,
      description: `Annulation du paiement ${originalPayment.receiptNumber} — motif : ${reason}. Avoir ${result.creditNote.receiptNumber} généré.`,
      ipAddress: getClientIP(h),
      metadata: {
        originalReceipt: originalPayment.receiptNumber,
        creditNoteReceipt: result.creditNote.receiptNumber,
        amountCents: originalPayment.amountCents,
        reversalEntryNumber: result.reversalEntry.entryNumber,
        reason,
      },
    })

    const response = {
      ok: true as const,
      creditNotePaymentId: result.creditNote.id,
      reversalEntryId: result.reversalEntry.id,
    }
    await recordIdempotencyResult(user.id, idempotencyKey, idemCheck.payloadHash, response, 201)
    revalidatePath('/')
    return response
  } catch (e) {
    if (e instanceof AccountingError) {
      return { ok: false, error: `Erreur comptable (${e.code}) : ${e.message}` }
    }
    console.error('cancelPaymentAction error:', e)
    return { ok: false, error: 'Erreur lors de l\'annulation du paiement.' }
  }
}
