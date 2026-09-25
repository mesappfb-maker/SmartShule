// SmartShule — Dashboard RH (Ressources Humaines)
// ============================================================
// KPI RH uniquement : personnel, contrats, présences, congés, paie RH.
// AUCUN accès aux finances élèves, factures, encaissements, caisse.
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
    if (!hasRole(user, ['HR_MANAGER', 'PAYROLL_OFFICER', 'DIRECTOR', 'SCHOOL_ADMIN'])) {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé. Module réservé RH/Direction.' }, { status: 403 })
    }
    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const now = new Date()
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    // ============================================================
    // KPI RH — Personnel uniquement (PAS de finances élèves)
    // ============================================================
    const [
      totalEmployees,
      teachersCount,
      adminStaffCount,
      supportStaffCount,
      newEmployeesThisMonth,
      contractsExpiringSoon,
      employeesAbsentToday,
      lateArrivalsToday,
      pendingLeaveRequests,
      approvedLeavesToday,
      pendingOvertime,
      pendingPayrollVariables,
      expiringDocuments,
    ] = await Promise.all([
      // Personnel actif total
      db.employee.count({ where: { schoolId, status: 'ACTIVE' } }),
      // Enseignants
      db.employee.count({ where: { schoolId, status: 'ACTIVE', globalRole: 'ENSEIGNANT' } }),
      // Personnel administratif
      db.employee.count({ where: { schoolId, status: 'ACTIVE', globalRole: { in: ['ADMINISTRATIF', 'DIRECTION'] } } }),
      // Personnel de soutien
      db.employee.count({ where: { schoolId, status: 'ACTIVE', globalRole: 'OUVRIER' } }),
      // Nouveaux employés ce mois
      db.employee.count({ where: { schoolId, hireDate: { gte: startOfMonth } } }),
      // Contrats expirant dans 30 jours (approximation: hireDate + 1 an)
      db.employee.count({
        where: {
          schoolId, status: 'ACTIVE',
          hireDate: { lte: new Date(now.getTime() - 335 * 24 * 60 * 60 * 1000) },
        },
      }),
      // Employés absents aujourd'hui (EmployeeAttendance)
      db.employeeAttendance.count({
        where: { schoolId, date: { gte: today, lt: tomorrow }, status: 'ABSENT' },
      }).catch(() => 0),
      // Retards aujourd'hui
      db.employeeAttendance.count({
        where: { schoolId, date: { gte: today, lt: tomorrow }, status: 'LATE' },
      }).catch(() => 0),
      // Demandes de congé en attente (AdminTask avec category LEAVE)
      db.adminTask.count({
        where: { schoolId, category: 'LEAVE', status: { in: ['PENDING', 'WAITING_DIRECTION', 'WAITING_PARENT'] } },
      }).catch(() => 0),
      // Congés approuvés aujourd'hui
      db.adminTask.count({
        where: { schoolId, category: 'LEAVE', status: 'DONE' },
      }).catch(() => 0),
      // Heures supplémentaires en attente
      db.adminTask.count({
        where: { schoolId, category: 'OVERTIME', status: { in: ['PENDING', 'WAITING_DIRECTION'] } },
      }).catch(() => 0),
      // Variables de paie à transmettre
      db.payrollVariable.count({
        where: { schoolId, status: 'DRAFT' },
      }).catch(() => 0),
      // Documents RH expirants (approximation)
      db.employee.count({
        where: {
          schoolId, status: 'ACTIVE',
          hireDate: { lte: new Date(now.getTime() - 350 * 24 * 60 * 60 * 1000) },
        },
      }),
    ])

    // Alertes RH
    const alerts: Array<{ level: 'CRITICAL' | 'HIGH' | 'MEDIUM'; message: string }> = []
    if (contractsExpiringSoon > 0) alerts.push({ level: 'HIGH', message: `${contractsExpiringSoon} contrat(s) expirant bientôt` })
    if (employeesAbsentToday > 0) alerts.push({ level: 'MEDIUM', message: `${employeesAbsentToday} employé(s) absent(s) aujourd'hui` })
    if (pendingLeaveRequests > 0) alerts.push({ level: 'MEDIUM', message: `${pendingLeaveRequests} demande(s) de congé en attente` })
    if (pendingPayrollVariables > 0) alerts.push({ level: 'HIGH', message: `${pendingPayrollVariables} variable(s) de paie à transmettre` })
    if (expiringDocuments > 0) alerts.push({ level: 'MEDIUM', message: `${expiringDocuments} document(s) RH expirant` })

    return NextResponse.json({
      ok: true,
      stats: {
        // Personnel
        totalEmployees,
        teachersCount,
        adminStaffCount,
        supportStaffCount,
        newEmployeesThisMonth,
        contractsExpiringSoon,
        // Présences
        employeesAbsentToday,
        lateArrivalsToday,
        // Congés
        pendingLeaveRequests,
        approvedLeavesToday,
        // Paie RH
        pendingOvertime,
        pendingPayrollVariables,
        // Documents
        expiringDocuments,
        // Alertes
        alerts,
        // Masse salariale (RH gère le contrat, pas le calcul)
        expectedPayroll: totalEmployees * 250000, // estimation
      },
      // Explicitement AUCUNE donnée financière élèves
      _note: 'Dashboard RH — aucune donnée financière élèves (factures, encaissements, caisse, impayés)',
    })
  } catch (err) {
    console.error('[api/hr/dashboard] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
