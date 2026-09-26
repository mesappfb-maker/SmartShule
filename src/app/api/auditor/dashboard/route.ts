// SmartShule — API Dashboard Auditeur (AUDITOR) — lecture seule
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { hasRole } from '@/lib/rbac'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (!hasRole(user, ['AUDITOR'])) {
      return NextResponse.json({ ok: false, error: 'Dashboard réservé à l\'Auditeur.' }, { status: 403 })
    }

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const view = searchParams.get('view') || 'overview'

    if (view === 'students') {
      const [total, active, inactive, graduated] = await Promise.all([
        db.student.count({ where: { schoolId } }),
        db.student.count({ where: { schoolId, status: 'ACTIVE' } }),
        db.student.count({ where: { schoolId, status: 'INACTIVE' } }),
        db.student.count({ where: { schoolId, status: 'GRADUATED' } }).catch(() => 0),
      ])
      return NextResponse.json({ ok: true, stats: { total, active, inactive, graduated } })
    }

    if (view === 'finances') {
      const [invoicedAgg, collectedAgg, unpaidAgg, overdue] = await Promise.all([
        db.invoice.aggregate({ where: { schoolId, status: { not: 'CANCELLED' } }, _sum: { totalAmountCents: true } }),
        db.invoice.aggregate({ where: { schoolId, status: { not: 'CANCELLED' } }, _sum: { paidAmountCents: true } }),
        db.invoice.aggregate({ where: { schoolId, status: { in: ['UNPAID', 'PARTIALLY_PAID'] } }, _sum: { totalAmountCents: true, paidAmountCents: true } }),
        db.invoice.count({ where: { schoolId, status: { in: ['UNPAID', 'PARTIALLY_PAID'] }, dueDate: { lt: new Date() } } }),
      ])
      const invoiced = invoicedAgg._sum.totalAmountCents || 0
      const collected = collectedAgg._sum.paidAmountCents || 0
      const unpaid = (unpaidAgg._sum.totalAmountCents || 0) - (unpaidAgg._sum.paidAmountCents || 0)
      return NextResponse.json({ ok: true, stats: { invoiced, collected, unpaid, overdue } })
    }

    if (view === 'hr') {
      const [total, teachers, admin, support] = await Promise.all([
        db.employee.count({ where: { schoolId, status: 'ACTIVE' } }),
        db.employee.count({ where: { schoolId, status: 'ACTIVE', globalRole: 'ENSEIGNANT' } }),
        db.employee.count({ where: { schoolId, status: 'ACTIVE', globalRole: { in: ['ADMINISTRATIF', 'DIRECTION'] } } }),
        db.employee.count({ where: { schoolId, status: 'ACTIVE', globalRole: 'OUVRIER' } }),
      ])
      return NextResponse.json({ ok: true, stats: { total, teachers, admin, support } })
    }

    if (view === 'documents') {
      const total = await db.documentVersion.count({ where: { schoolId } }).catch(() => 0)
      const thisMonth = await db.documentVersion.count({
        where: { schoolId, createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
      }).catch(() => 0)
      // Pas de champ documentType dans le schéma — on groupe par certificateId présent/absent
      const withCert = await db.documentVersion.count({ where: { schoolId, certificateId: { not: null } } }).catch(() => 0)
      const withoutCert = await db.documentVersion.count({ where: { schoolId, certificateId: null } }).catch(() => 0)
      const byType = [
        { type: 'CERTIFICATES', count: withCert },
        { type: 'STANDALONE', count: withoutCert },
      ]
      return NextResponse.json({ ok: true, stats: { total, thisMonth, byType } })
    }

    return NextResponse.json({ ok: false, error: 'Vue inconnue.' }, { status: 400 })
  } catch (err) {
    console.error('[auditor/dashboard] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
