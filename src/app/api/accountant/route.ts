// SmartShule — API Comptable unifiée
// ============================================================
// Rôles stricts (RBAC) :
//   - SECRETARY : peut générer les dettes (à l'inscription) mais JAMAIS encaisser
//   - ACCOUNTANT : peut encaisser + émettre reçus + annuler (via avoir)
//   - DIRECTION : peut consulter les rapports (jamais encaisser)
//   - ADMIN (Promoteur) : tout peut + valider dépenses + clôturer périodes
//
// Actions dispatch :
//   - generate-debts : génère les dettes pour une classe + période
//   - list-debts : liste des dettes (avec filtres solvabilité)
//   - collect-payment : encaisse un paiement + émet reçu sécurisé
//   - cancel-receipt : annule un reçu (via avoir)
//   - list-receipts : liste des reçus
//   - apply-scholarship : applique une bourse à un élève
//   - create-scholarship : crée une bourse
//   - list-scholarships
//   - create-expense : enregistre une dépense
//   - approve-expense : valide une dépense (Promoteur only)
//   - list-expenses
//   - get-stats : statistiques comptables
//   - get-student-debts : dettes d'un élève spécifique

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'
import { getSchoolIdForUser } from '@/lib/school-context'
import { hasRole } from '@/lib/rbac'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

// ============================================================
// Helpers
// ============================================================

function generateReceiptNumber(year: number, sequence: number): string {
  return `REC-${year}-${String(sequence).padStart(6, '0')}`
}

function generateSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

function generateQRData(receipt: {
  receiptNumber: string
  amountCents: number
  currency: string
  studentId: string
  issuedAt: Date
  signature: string
}): string {
  return JSON.stringify({
    n: receipt.receiptNumber,
    a: receipt.amountCents,
    c: receipt.currency,
    s: receipt.studentId,
    d: receipt.issuedAt.toISOString(),
    v: receipt.signature.substring(0, 16),
  })
}

async function getAccountantEmployee(userId: string, email: string) {
  // Trouver l'employé lié au comptable
  const employee = await db.employee.findFirst({
    where: { email },
    select: { id: true, schoolId: true, firstName: true, lastName: true },
  })
  if (employee) return employee
  // Fallback : créer un employé virtuel
  return { id: 'system', schoolId: '', firstName: 'System', lastName: 'Accountant' }
}

// ============================================================
// POST : Actions dispatch
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    }

    const body = await req.json()
    const { action } = body

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) {
      return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })
    }

    const h = await headers()
    const ip = getClientIP(h)

    switch (action) {
      // ============================================================
      // 1. GÉNÉRER LES DETTES pour une classe + période
      // ============================================================
      case 'generate-debts': {
        if (user.role !== 'SECRETARY' && !hasRole(user, ['DIRECTION', 'ADMIN'])) {
          return NextResponse.json({ ok: false, error: 'Réservé au Secrétariat/Direction.' }, { status: 403 })
        }
        const { classroomId, academicYearId, directorateId } = body
        if (!classroomId || !academicYearId) {
          return NextResponse.json({ ok: false, error: 'Classe et année académique obligatoires.' }, { status: 400 })
        }

        // Récupérer les élèves actifs de la classe
        const enrollments = await db.enrollment.findMany({
          where: { classroomId, academicYearId, status: 'ACTIVE' },
          include: { classroom: true },
        })

        if (enrollments.length === 0) {
          return NextResponse.json({ ok: false, error: 'Aucun élève actif dans cette classe.' }, { status: 404 })
        }

        // Récupérer les lignes de frais applicables
        const feeLines = await db.invoiceLineConfig.findMany({
          where: {
            schoolId,
            status: 'ACTIVE',
            OR: [
              { directorateId: null },
              ...(directorateId ? [{ directorateId }] : []),
            ],
          },
        })

        if (feeLines.length === 0) {
          return NextResponse.json({ ok: false, error: 'Aucune ligne de frais configurée. Allez dans Configuration école → Frais.' }, { status: 404 })
        }

        // Pour chaque inscription + ligne de frais, créer une dette (si pas déjà)
        let createdCount = 0
        let skippedCount = 0
        for (const enrollment of enrollments) {
          for (const feeLine of feeLines) {
            const period = feeLine.period || 'GLOBAL'
            const existing = await db.studentDebt.findUnique({
              where: {
                enrollmentId_invoiceLineConfigId_period: {
                  enrollmentId: enrollment.id,
                  invoiceLineConfigId: feeLine.id,
                  period,
                },
              },
            })
            if (existing) {
              skippedCount++
              continue
            }
            await db.studentDebt.create({
              data: {
                schoolId,
                studentId: enrollment.studentId,
                enrollmentId: enrollment.id,
                invoiceLineConfigId: feeLine.id,
                directorateId: enrollment.classroom.directorateId,
                classroomId,
                academicYearId,
                amountDueCents: feeLine.amountCents,
                currency: feeLine.currency,
                period,
                status: 'OPEN',
                generatedById: user.id,
              },
            })
            createdCount++
          }
        }

        await logAudit({
          userId: user.id, userName: user.displayName, userRole: user.role, schoolId,
          action: 'CREATE', entityType: 'OTHER',
          description: `Dettes générées : ${createdCount} créées, ${skippedCount} ignorées pour classe ${classroomId}`,
          ipAddress: ip,
        })

        return NextResponse.json({
          ok: true,
          created: createdCount,
          skipped: skippedCount,
          message: `${createdCount} dette(s) créée(s), ${skippedCount} déjà existante(s)`,
        })
      }

      // ============================================================
      // 2. ENCAISSER UN PAIEMENT + ÉMETTRE REÇU SÉCURISÉ
      // ============================================================
      case 'collect-payment': {
        if (!hasRole(user, ['ACCOUNTANT', 'ADMIN'])) {
          return NextResponse.json({ ok: false, error: 'Réservé au Comptable.' }, { status: 403 })
        }
        const {
          studentDebtId,
          studentId,
          amountCents,
          currency,
          paymentMethod,
          paymentProvider,
          transactionReference,
          payerName,
          payerPhone,
        } = body

        if (!studentId || !amountCents || !paymentMethod) {
          return NextResponse.json({ ok: false, error: 'Élève, montant et moyen de paiement obligatoires.' }, { status: 400 })
        }

        const accountant = await getAccountantEmployee(user.id, user.email || '')
        if (!accountant.id || accountant.id === 'system') {
          return NextResponse.json({ ok: false, error: 'Comptable non trouvé dans les employés.' }, { status: 404 })
        }

        // Vérifier montant positif
        if (amountCents <= 0) {
          return NextResponse.json({ ok: false, error: 'Le montant doit être positif.' }, { status: 400 })
        }

        // Transaction atomique
        const result = await db.$transaction(async (tx) => {
          // 1. Récupérer le dernier numéro de reçu de l'année
          const year = new Date().getFullYear()
          const lastReceipt = await tx.receipt.findFirst({
            where: { schoolId, receiptNumber: { startsWith: `REC-${year}-` } },
            orderBy: { receiptNumber: 'desc' },
          })
          let sequence = 1
          if (lastReceipt) {
            const match = lastReceipt.receiptNumber.match(/REC-\d{4}-(\d{6})/)
            if (match) sequence = parseInt(match[1], 10) + 1
          }
          const receiptNumber = generateReceiptNumber(year, sequence)

          // 2. Créer le reçu
          const issuedAt = new Date()
          const signaturePayload = `${receiptNumber}|${studentId}|${amountCents}|${currency}|${issuedAt.toISOString()}`
          const secret = process.env.NEXTAUTH_SECRET || 'fallback-secret'
          const signature = generateSignature(signaturePayload, secret)
          const qrCodeData = generateQRData({
            receiptNumber, amountCents, currency, studentId, issuedAt, signature,
          })

          const receipt = await tx.receipt.create({
            data: {
              schoolId,
              receiptNumber,
              receiptType: 'PAYMENT',
              studentDebtId: studentDebtId || null,
              studentId,
              amountCents,
              currency: currency || 'CDF',
              paymentMethod,
              paymentProvider: paymentProvider || null,
              transactionReference: transactionReference || null,
              payerName: payerName || null,
              payerPhone: payerPhone || null,
              qrCodeData,
              signature,
              accountantId: accountant.id,
              accountantUserId: user.id,
              issuedAt,
            },
          })

          // 3. Si une dette est liée, mettre à jour le montant payé
          if (studentDebtId) {
            const debt = await tx.studentDebt.findUnique({ where: { id: studentDebtId } })
            if (debt) {
              const newPaid = debt.amountPaidCents + amountCents
              const newStatus = newPaid >= debt.amountDueCents ? 'PAID' : 'PARTIALLY_PAID'
              await tx.studentDebt.update({
                where: { id: studentDebtId },
                data: {
                  amountPaidCents: newPaid,
                  status: newStatus,
                  lastPaymentAt: issuedAt,
                  closedAt: newStatus === 'PAID' ? issuedAt : null,
                },
              })
            }
          }

          // 4. Si Mobile Money, créer l'entrée MobileMoneyPayment
          if (paymentMethod === 'MOBILE_MONEY' && paymentProvider) {
            await tx.mobileMoneyPayment.create({
              data: {
                schoolId,
                receiptId: receipt.id,
                provider: paymentProvider,
                payerPhoneNumber: payerPhone || '',
                payerName: payerName || null,
                amountCents,
                currency: currency || 'CDF',
                status: 'SUCCESS',
                confirmedAt: issuedAt,
              },
            })
          }

          return { receiptId: receipt.id, receiptNumber }
        })

        await logAudit({
          userId: user.id, userName: user.displayName, userRole: user.role, schoolId,
          action: 'CREATE', entityType: 'OTHER', entityId: result.receiptId,
          description: `Reçu ${result.receiptNumber} émis : ${amountCents / 100} ${currency} (${paymentMethod})`,
          ipAddress: ip,
        })

        return NextResponse.json({
          ok: true,
          receiptId: result.receiptId,
          receiptNumber: result.receiptNumber,
          message: `Paiement encaissé. Reçu ${result.receiptNumber} émis.`,
        })
      }

      // ============================================================
      // 3. ANNULER UN REÇU (via avoir)
      // ============================================================
      case 'cancel-receipt': {
        if (!hasRole(user, ['ACCOUNTANT', 'ADMIN'])) {
          return NextResponse.json({ ok: false, error: 'Réservé au Comptable.' }, { status: 403 })
        }
        const { receiptId, cancellationReason } = body
        if (!receiptId || !cancellationReason) {
          return NextResponse.json({ ok: false, error: 'ID reçu et motif obligatoires.' }, { status: 400 })
        }

        const receipt = await db.receipt.findUnique({ where: { id: receiptId } })
        if (!receipt) {
          return NextResponse.json({ ok: false, error: 'Reçu introuvable.' }, { status: 404 })
        }
        if (receipt.cancelledAt) {
          return NextResponse.json({ ok: false, error: 'Reçu déjà annulé.' }, { status: 400 })
        }

        await db.$transaction(async (tx) => {
          // Annuler le reçu
          await tx.receipt.update({
            where: { id: receiptId },
            data: {
              cancelledAt: new Date(),
              cancelledByUserId: user.id,
              cancellationReason,
            },
          })

          // Créer un avoir lié
          const year = new Date().getFullYear()
          const lastAvoir = await tx.receipt.findFirst({
            where: { schoolId, receiptType: 'CREDIT_NOTE', receiptNumber: { startsWith: `AVOIR-${year}-` } },
            orderBy: { receiptNumber: 'desc' },
          })
          let seq = 1
          if (lastAvoir) {
            const match = lastAvoir.receiptNumber.match(/AVOIR-\d{4}-(\d{6})/)
            if (match) seq = parseInt(match[1], 10) + 1
          }
          const avoirNumber = `AVOIR-${year}-${String(seq).padStart(6, '0')}`
          const issuedAt = new Date()
          const signaturePayload = `${avoirNumber}|${receipt.studentId}|${-receipt.amountCents}|${receipt.currency}|${issuedAt.toISOString()}`
          const secret = process.env.NEXTAUTH_SECRET || 'fallback-secret'
          const signature = generateSignature(signaturePayload, secret)
          const qrCodeData = generateQRData({
            receiptNumber: avoirNumber, amountCents: -receipt.amountCents, currency: receipt.currency,
            studentId: receipt.studentId, issuedAt, signature,
          })

          await tx.receipt.create({
            data: {
              schoolId: receipt.schoolId,
              receiptNumber: avoirNumber,
              receiptType: 'CREDIT_NOTE',
              studentDebtId: receipt.studentDebtId,
              studentId: receipt.studentId,
              amountCents: -receipt.amountCents,
              currency: receipt.currency,
              paymentMethod: receipt.paymentMethod,
              paymentProvider: receipt.paymentProvider,
              transactionReference: `ANNULATION-${receipt.receiptNumber}`,
              payerName: receipt.payerName,
              payerPhone: receipt.payerPhone,
              qrCodeData,
              signature,
              accountantId: receipt.accountantId,
              accountantUserId: user.id,
              issuedAt,
              cancellationReason,
            },
          })

          // Rembourser la dette
          if (receipt.studentDebtId) {
            const debt = await tx.studentDebt.findUnique({ where: { id: receipt.studentDebtId } })
            if (debt) {
              const newPaid = Math.max(0, debt.amountPaidCents - receipt.amountCents)
              const newStatus = newPaid === 0 ? 'OPEN' : (newPaid >= debt.amountDueCents ? 'PAID' : 'PARTIALLY_PAID')
              await tx.studentDebt.update({
                where: { id: receipt.studentDebtId },
                data: {
                  amountPaidCents: newPaid,
                  status: newStatus,
                  amountCancelledCents: debt.amountCancelledCents + receipt.amountCents,
                  closedAt: newStatus === 'PAID' ? new Date() : null,
                },
              })
            }
          }
        })

        await logAudit({
          userId: user.id, userName: user.displayName, userRole: user.role, schoolId,
          action: 'CREATE', entityType: 'OTHER', entityId: receiptId,
          description: `Reçu ${receipt.receiptNumber} ANNULÉ. Motif: ${cancellationReason}`,
          ipAddress: ip,
        })

        return NextResponse.json({ ok: true, message: `Reçu ${receipt.receiptNumber} annulé. Avoir créé.` })
      }

      // ============================================================
      // 4. CRÉER UNE BOURSE
      // ============================================================
      case 'create-scholarship': {
        if (!hasRole(user, ['DIRECTION', 'ADMIN'])) {
          return NextResponse.json({ ok: false, error: 'Réservé à la Direction.' }, { status: 403 })
        }
        const { name, code, description, reductionPercent, appliesToDirectorate, appliesToCategory } = body
        if (!name || !code || reductionPercent === undefined) {
          return NextResponse.json({ ok: false, error: 'Nom, code et pourcentage obligatoires.' }, { status: 400 })
        }
        if (reductionPercent < 0 || reductionPercent > 100) {
          return NextResponse.json({ ok: false, error: 'Pourcentage doit être entre 0 et 100.' }, { status: 400 })
        }
        const scholarship = await db.scholarship.create({
          data: {
            schoolId,
            name, code, description: description || null,
            reductionPercent,
            appliesToDirectorate: appliesToDirectorate || null,
            appliesToCategory: appliesToCategory || 'ALL',
            status: 'ACTIVE',
            createdById: user.id,
          },
        })
        await logAudit({
          userId: user.id, userName: user.displayName, userRole: user.role, schoolId,
          action: 'CREATE', entityType: 'OTHER', entityId: scholarship.id,
          description: `Bourse créée : ${name} (-${reductionPercent}%)`,
          ipAddress: ip,
        })
        return NextResponse.json({ ok: true, id: scholarship.id, message: `Bourse "${name}" créée` })
      }

      // ============================================================
      // 5. APPLIQUER UNE BOURSE À UN ÉLÈVE
      // ============================================================
      case 'apply-scholarship': {
        if (user.role !== 'DIRECTION' && !hasRole(user, ['ACCOUNTANT', 'ADMIN'])) {
          return NextResponse.json({ ok: false, error: 'Réservé à la Direction/Comptable.' }, { status: 403 })
        }
        const { studentDebtId, scholarshipId } = body
        if (!studentDebtId || !scholarshipId) {
          return NextResponse.json({ ok: false, error: 'Dette et bourse obligatoires.' }, { status: 400 })
        }
        const debt = await db.studentDebt.findUnique({ where: { id: studentDebtId } })
        const scholarship = await db.scholarship.findUnique({ where: { id: scholarshipId } })
        if (!debt || !scholarship) {
          return NextResponse.json({ ok: false, error: 'Dette ou bourse introuvable.' }, { status: 404 })
        }
        const reductionAmount = Math.round((debt.amountDueCents * scholarship.reductionPercent) / 100)
        await db.studentDebt.update({
          where: { id: studentDebtId },
          data: {
            scholarshipId,
            reductionPercent: scholarship.reductionPercent,
            reductionAmountCents: reductionAmount,
          },
        })
        return NextResponse.json({
          ok: true,
          reduction: reductionAmount / 100,
          newBalance: (debt.amountDueCents - reductionAmount - debt.amountPaidCents) / 100,
          message: `Bourse ${scholarship.code} appliquée. Réduction : ${scholarship.reductionPercent}%`,
        })
      }

      // ============================================================
      // 6. CRÉER UNE DÉPENSE
      // ============================================================
      case 'create-expense': {
        if (!hasRole(user, ['DIRECTION', 'ADMIN'])) {
          return NextResponse.json({ ok: false, error: 'Réservé à la Direction.' }, { status: 403 })
        }
        const { category, description, amountCents, currency, paymentMethod, supplierName, supplierInvoice, directorateId, expenseDate } = body
        if (!category || !description || !amountCents) {
          return NextResponse.json({ ok: false, error: 'Catégorie, description et montant obligatoires.' }, { status: 400 })
        }

        const year = new Date().getFullYear()
        const lastExpense = await db.expense.findFirst({
          where: { schoolId, expenseNumber: { startsWith: `DEP-${year}-` } },
          orderBy: { expenseNumber: 'desc' },
        })
        let seq = 1
        if (lastExpense) {
          const match = lastExpense.expenseNumber.match(/DEP-\d{4}-(\d{6})/)
          if (match) seq = parseInt(match[1], 10) + 1
        }
        const expenseNumber = `DEP-${year}-${String(seq).padStart(6, '0')}`

        const expense = await db.expense.create({
          data: {
            schoolId,
            directorateId: directorateId || null,
            expenseNumber,
            category,
            description,
            supplierName: supplierName || null,
            supplierInvoice: supplierInvoice || null,
            amountCents,
            currency: currency || 'CDF',
            paymentMethod: paymentMethod || 'CASH',
            expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
            status: 'PENDING',
            requestedById: user.id,
            requestedByName: user.displayName,
          },
        })
        await logAudit({
          userId: user.id, userName: user.displayName, userRole: user.role, schoolId,
          action: 'CREATE', entityType: 'OTHER', entityId: expense.id,
          description: `Dépense ${expenseNumber} créée : ${description} (${amountCents / 100} ${currency || 'CDF'})`,
          ipAddress: ip,
        })
        return NextResponse.json({ ok: true, id: expense.id, expenseNumber, message: `Dépense ${expenseNumber} enregistrée` })
      }

      // ============================================================
      // 7. VALIDER UNE DÉPENSE (Promoteur only)
      // ============================================================
      case 'approve-expense': {
        if (user.role !== 'ADMIN') {
          return NextResponse.json({ ok: false, error: 'Réservé au Promoteur.' }, { status: 403 })
        }
        const { expenseId, approved } = body
        if (!expenseId) {
          return NextResponse.json({ ok: false, error: 'ID dépense obligatoire.' }, { status: 400 })
        }
        const expense = await db.expense.findUnique({ where: { id: expenseId } })
        if (!expense) return NextResponse.json({ ok: false, error: 'Dépense introuvable.' }, { status: 404 })
        if (expense.status !== 'PENDING') {
          return NextResponse.json({ ok: false, error: `Dépense déjà traitée (${expense.status}).` }, { status: 400 })
        }
        await db.expense.update({
          where: { id: expenseId },
          data: approved ? {
            status: 'APPROVED',
            approvedById: user.id,
            approvedByName: user.displayName,
            approvedAt: new Date(),
          } : {
            status: 'REJECTED',
            approvedById: user.id,
            approvedByName: user.displayName,
            approvedAt: new Date(),
            rejectionReason: body.reason || 'Rejetée par le Promoteur',
          },
        })
        await logAudit({
          userId: user.id, userName: user.displayName, userRole: user.role, schoolId,
          action: approved ? 'APPROVE' : 'REJECT', entityType: 'OTHER', entityId: expenseId,
          description: `Dépense ${expense.expenseNumber} ${approved ? 'APPROUVÉE' : 'REJETÉE'}`,
          ipAddress: ip,
        })
        return NextResponse.json({ ok: true, message: `Dépense ${approved ? 'approuvée' : 'rejetée'}` })
      }

      default:
        return NextResponse.json({ ok: false, error: `Action "${action}" inconnue.` }, { status: 400 })
    }
  } catch (err) {
    console.error('[api/accountant] Error:', err)
    return NextResponse.json(
      { ok: false, error: (err as Error).message || 'Erreur inconnue.' },
      { status: 500 }
    )
  }
}

// ============================================================
// GET : Liste des dettes/reçus/dépenses/bourses
// ============================================================

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    }
    if (!hasRole(user, ['ACCOUNTANT', 'DIRECTION', 'ADMIN', 'SECRETARY'])) {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
    }

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) {
      return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })
    }

    const url = new URL(req.url)
    const resource = url.searchParams.get('resource') || 'debts'
    const directorateId = url.searchParams.get('directorateId')
    const status = url.searchParams.get('status')
    const minDebt = url.searchParams.get('minDebt') // Filtre solvabilité
    const academicYearId = url.searchParams.get('academicYearId')

    switch (resource) {
      case 'debts': {
        const where: any = { schoolId }
        if (directorateId) where.directorateId = directorateId
        if (status) where.status = status
        if (academicYearId) where.academicYearId = academicYearId

        const debts = await db.studentDebt.findMany({
          where,
          include: {
            student: { select: { id: true, firstName: true, lastName: true, matricule: true } },
            enrollment: { include: { classroom: { include: { directorate: true } } } },
            invoiceLineConfig: true,
            directorate: true,
          },
          orderBy: [{ student: { firstName: 'asc' } }, { createdAt: 'desc' }],
          take: 500,
        })

        // Calculer les soldes + appliquer filtre minDebt
        let result = debts.map((d) => {
          const effectiveDue = d.amountDueCents - d.reductionAmountCents
          const balance = effectiveDue - d.amountPaidCents
          return {
            id: d.id,
            studentId: d.studentId,
            studentName: `${d.student.firstName} ${d.student.lastName}`,
            matricule: d.student.matricule,
            classroomName: d.enrollment.classroom.name,
            directorateName: d.enrollment.classroom.directorate.name,
            feeName: d.invoiceLineConfig.name,
            feeCode: d.invoiceLineConfig.code,
            period: d.period,
            amountDue: d.amountDueCents / 100,
            amountPaid: d.amountPaidCents / 100,
            reduction: d.reductionAmountCents / 100,
            balance: balance / 100,
            currency: d.currency,
            status: d.status,
            lastPaymentAt: d.lastPaymentAt,
          }
        })

        if (minDebt) {
          const minCents = Math.round(parseFloat(minDebt) * 100)
          result = result.filter((r) => r.balance * 100 >= minCents)
        }

        // Stats
        const totalDue = result.reduce((sum, d) => sum + d.amountDue * 100, 0) / 100
        const totalPaid = result.reduce((sum, d) => sum + d.amountPaid * 100, 0) / 100
        const totalBalance = result.reduce((sum, d) => sum + d.balance * 100, 0) / 100
        const collectionRate = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0

        return NextResponse.json({
          ok: true,
          debts: result,
          stats: {
            totalStudents: new Set(result.map((r) => r.studentId)).size,
            totalDebts: result.length,
            totalDue,
            totalPaid,
            totalBalance,
            collectionRate: Math.round(collectionRate * 100) / 100,
            paid: result.filter((r) => r.status === 'PAID').length,
            partiallyPaid: result.filter((r) => r.status === 'PARTIALLY_PAID').length,
            open: result.filter((r) => r.status === 'OPEN').length,
          },
        })
      }

      case 'receipts': {
        const where: any = { schoolId, receiptType: 'PAYMENT' }
        if (directorateId) where.directorateId = directorateId

        const receipts = await db.receipt.findMany({
          where,
          include: {
            student: { select: { id: true, firstName: true, lastName: true, matricule: true } },
            accountant: { select: { firstName: true, lastName: true } },
          },
          orderBy: { issuedAt: 'desc' },
          take: 200,
        })

        return NextResponse.json({
          ok: true,
          receipts: receipts.map((r) => ({
            id: r.id,
            receiptNumber: r.receiptNumber,
            studentName: `${r.student.firstName} ${r.student.lastName}`,
            matricule: r.student.matricule,
            amount: r.amountCents / 100,
            currency: r.currency,
            paymentMethod: r.paymentMethod,
            paymentProvider: r.paymentProvider,
            payerName: r.payerName,
            cancelled: !!r.cancelledAt,
            cancellationReason: r.cancellationReason,
            issuedAt: r.issuedAt,
            accountantName: `${r.accountant.firstName} ${r.accountant.lastName}`,
            qrCodeData: r.qrCodeData,
          })),
        })
      }

      case 'scholarships': {
        const scholarships = await db.scholarship.findMany({
          where: { schoolId, status: 'ACTIVE' },
          orderBy: { reductionPercent: 'desc' },
        })
        return NextResponse.json({ ok: true, scholarships })
      }

      case 'expenses': {
        const expenses = await db.expense.findMany({
          where: { schoolId, ...(directorateId ? { directorateId } : {}) },
          include: { directorate: true },
          orderBy: { createdAt: 'desc' },
          take: 200,
        })
        return NextResponse.json({
          ok: true,
          expenses: expenses.map((e) => ({
            id: e.id,
            expenseNumber: e.expenseNumber,
            category: e.category,
            description: e.description,
            supplierName: e.supplierName,
            amount: e.amountCents / 100,
            currency: e.currency,
            paymentMethod: e.paymentMethod,
            status: e.status,
            requestedByName: e.requestedByName,
            approvedByName: e.approvedByName,
            rejectionReason: e.rejectionReason,
            expenseDate: e.expenseDate,
            createdAt: e.createdAt,
          })),
        })
      }

      case 'stats': {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

        const [todayReceipts, monthReceipts, totalDebts, pendingExpenses] = await Promise.all([
          db.receipt.aggregate({ where: { schoolId, issuedAt: { gte: today }, cancelledAt: null, receiptType: 'PAYMENT' }, _sum: { amountCents: true } }),
          db.receipt.aggregate({ where: { schoolId, issuedAt: { gte: monthStart }, cancelledAt: null, receiptType: 'PAYMENT' }, _sum: { amountCents: true } }),
          db.studentDebt.aggregate({ where: { schoolId, status: { in: ['OPEN', 'PARTIALLY_PAID'] } }, _sum: { amountDueCents: true, amountPaidCents: true, reductionAmountCents: true } }),
          db.expense.count({ where: { schoolId, status: 'PENDING' } }),
        ])

        const totalDue = (totalDebts._sum.amountDueCents || 0) - (totalDebts._sum.reductionAmountCents || 0)
        const totalPaid = totalDebts._sum.amountPaidCents || 0
        const totalBalance = totalDue - totalPaid

        return NextResponse.json({
          ok: true,
          stats: {
            collectedToday: (todayReceipts._sum.amountCents || 0) / 100,
            collectedThisMonth: (monthReceipts._sum.amountCents || 0) / 100,
            totalOutstandingDebt: totalBalance / 100,
            collectionRate: totalDue > 0 ? Math.round((totalPaid / totalDue) * 10000) / 100 : 100,
            pendingExpenses,
            currency: 'CDF',
          },
        })
      }

      default:
        return NextResponse.json({ ok: false, error: `Resource "${resource}" inconnue.` }, { status: 400 })
    }
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
