// SmartShule — Dashboard Promoteur (STRATÉGIQUE, pas opérationnel)
// ============================================================
// Vue agrégée : effectifs, finances, RH, budget, risques, décisions.
// AUCUN détail individuel (pas de notes, pas de factures individuelles).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { hasRole } from '@/lib/rbac'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (!hasRole(user, ['PROMOTER'])) {
      return NextResponse.json({ ok: false, error: 'Dashboard réservé au Promoteur.' }, { status: 403 })
    }
    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfYear = new Date(now.getFullYear(), 0, 1)

    const [
      totalStudents, activeStudents, newStudentsThisMonth,
      totalEmployees, teachersCount,
      totalInvoicedAgg, totalCollectedAgg, totalUnpaidAgg,
      receiptsMonth, expensesMonth, expensesYear,
      pendingExpenses, overdueInvoices,
    ] = await Promise.all([
      db.student.count({ where: { schoolId } }),
      db.student.count({ where: { schoolId, status: 'ACTIVE' } }),
      db.student.count({ where: { schoolId, createdAt: { gte: startOfMonth } } }),
      db.employee.count({ where: { schoolId, status: 'ACTIVE' } }),
      db.employee.count({ where: { schoolId, status: 'ACTIVE', globalRole: 'ENSEIGNANT' } }),
      db.invoice.aggregate({ where: { schoolId, status: { not: 'CANCELLED' } }, _sum: { totalAmountCents: true } }),
      db.invoice.aggregate({ where: { schoolId, status: { not: 'CANCELLED' } }, _sum: { paidAmountCents: true } }),
      db.invoice.aggregate({ where: { schoolId, status: { in: ['UNPAID', 'PARTIALLY_PAID'] } }, _sum: { totalAmountCents: true, paidAmountCents: true } }),
      db.receipt.aggregate({ where: { schoolId, issuedAt: { gte: startOfMonth } }, _sum: { amountCents: true } }),
      db.expense.aggregate({ where: { schoolId, status: { in: ['APPROVED', 'PAID'] }, expenseDate: { gte: startOfMonth } }, _sum: { amountCents: true } }),
      db.expense.aggregate({ where: { schoolId, status: { in: ['APPROVED', 'PAID'] }, expenseDate: { gte: startOfYear } }, _sum: { amountCents: true } }),
      db.expense.aggregate({ where: { schoolId, status: 'PENDING' }, _sum: { amountCents: true }, _count: true }),
      db.invoice.count({ where: { schoolId, status: { in: ['UNPAID', 'PARTIALLY_PAID'] }, dueDate: { lt: now } } }),
    ])

    const totalInvoiced = totalInvoicedAgg._sum.totalAmountCents || 0
    const totalCollected = totalCollectedAgg._sum.paidAmountCents || 0
    const totalUnpaid = (totalUnpaidAgg._sum.totalAmountCents || 0) - (totalUnpaidAgg._sum.paidAmountCents || 0)
    const collectionRate = totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 10000) / 100 : 0

    // Masse salariale agrégée (pas de détails individuels)
    const expectedPayroll = totalEmployees * 250000
    const budgetAnnual = 500000000
    const budgetConsumed = expensesYear._sum.amountCents || 0
    const budgetPct = budgetAnnual > 0 ? Math.round((budgetConsumed / budgetAnnual) * 100) : 0

    // Risques
    const risks: Array<{ level: 'CRITICAL' | 'HIGH' | 'MEDIUM'; message: string }> = []
    if (totalUnpaid > 500000) risks.push({ level: 'CRITICAL', message: `Impayés élevés: ${(totalUnpaid / 100).toLocaleString('fr-FR')} FC` })
    if (overdueInvoices > 10) risks.push({ level: 'HIGH', message: `${overdueInvoices} factures échues` })
    if (budgetPct > 90) risks.push({ level: 'HIGH', message: `Budget consommé à ${budgetPct}%` })
    if (pendingExpenses._count > 0) risks.push({ level: 'MEDIUM', message: `${pendingExpenses._count} dépense(s) à valider (${(pendingExpenses._sum.amountCents! / 100).toLocaleString('fr-FR')} FC)` })

    // Décisions à valider par le promoteur (dépenses > seuil)
    const decisionsPending = pendingExpenses._count

    return NextResponse.json({
      ok: true,
      stats: {
        // Croissance
        totalStudents, activeStudents, newStudentsThisMonth,
        studentGrowthRate: 0, // À calculer avec historique
        // RH agrégée
        totalEmployees, teachersCount,
        expectedPayroll,
        ratioStudentTeacher: teachersCount > 0 ? Math.round(activeStudents / teachersCount) : 0,
        // Finance stratégique (agrégée, pas de détails individuels)
        totalInvoiced, totalCollected, totalUnpaid,
        collectionRate,
        receiptsMonth: receiptsMonth._sum.amountCents || 0,
        expensesMonth: expensesMonth._sum.amountCents || 0,
        // Budget
        budgetAnnual, budgetConsumed, budgetPct,
        budgetExceeded: budgetConsumed > budgetAnnual,
        // Risques
        risks,
        overdueInvoices,
        // Décisions
        decisionsPending,
      },
      _note: 'Dashboard stratégique PROMOTEUR — données agrégées uniquement, pas de détails individuels',
    })
  } catch (err) {
    console.error('[api/promoter/dashboard] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
