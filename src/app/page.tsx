// SmartShule — Page unique (login + dashboard selon connexion)
// ============================================================
// PAS DE REDIRECTION — tout se passe sur /
// Si non connecté → LoginForm
// Si connecté → Dashboard selon le rôle

import { getUserFromSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { getSchoolIdForUser } from '@/lib/school-context'
import {
  getParentDashboardData,
  getStudentDashboardData,
  getDirectionDashboardData,
  getNotificationsForUser,
  getFinanceDashboardData,
} from '@/lib/queries'
import { getAcademicSupervisionData } from '@/lib/academic-supervision-queries'
import { getTeacherPortalData } from '@/lib/teacher-portal-queries'
import { getAccountantPortalData } from '@/lib/accountant-portal-queries'
import { getServerPortalData } from '@/lib/server-portal-queries'
import { getProfileData } from '@/lib/profile-actions'
import { getSecretaryPortalData } from '@/lib/secretary-portal-queries'
import { LoginForm } from '@/modules/auth/login-form'
import { ParentDashboard } from '@/modules/parent/parent-dashboard'
import { StudentDashboard } from '@/modules/student/student-dashboard'
import { DirectionDashboard } from '@/modules/direction/direction-dashboard'
import { TeacherPortal } from '@/modules/teacher/teacher-portal'
import { AccountantPortal } from '@/modules/accountant/accountant-portal'
import { ServerPortal } from '@/modules/server/server-portal'
import { SecretaryPortal } from '@/modules/secretary/secretary-portal'
import { AdminSystemPortal } from '@/modules/admin-system/admin-system-portal'
import { PromoterPortal } from '@/modules/promoter/promoter-portal'
import { AuditorPortal } from '@/modules/auditor/auditor-portal'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function Home() {
  const user = await getUserFromSession()

  // Non connecté → page de connexion
  if (!user) {
    const school = await db.school.findFirst()
    return (
      <LoginForm
        schoolName={school?.name || 'SmartShule'}
        schoolSlogan={school?.slogan || undefined}
        schoolLogoUrl={school?.logoUrl || undefined}
        primaryColor={school?.primaryColor || undefined}
        secondaryColor={school?.secondaryColor || undefined}
      />
    )
  }

  // Connecté → dashboard selon le rôle
  try {
    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    const school = schoolId ? await db.school.findUnique({ where: { id: schoolId } }) : null
    const notifications = await getNotificationsForUser(user.id).catch(() => [])

    if (!school) {
      return <NoData user={user} />
    }

    const schoolData = {
      id: school.id,
      name: school.name,
      slogan: school.slogan,
      primaryColor: school.primaryColor,
      secondaryColor: school.secondaryColor,
      tertiaryColor: school.tertiaryColor,
    }

    // PARENT — vérifier le statut du compte
    if (user.role === 'PARENT') {
      // CANDIDAT_PARENT : accès limité (pas de portail parent)
      if (user.accountStatus === 'CANDIDAT_PARENT') {
        return <CandidateParentScreen user={user} />
      }
      // PARENT_SUSPENDU : accès bloqué
      if (user.accountStatus === 'PARENT_SUSPENDU') {
        return <NoData user={user} error="Votre compte parent est suspendu. Contactez le secrétariat." />
      }
      // PARENT_VERIFIE : portail parent complet
      const data = await getParentDashboardData(user.id).catch(() => null)
      if (!data) return <CandidateParentScreen user={user} />
      return <ParentDashboard user={user} school={schoolData} data={data} notifications={notifications} />
    }

    // STUDENT
    if (user.role === 'STUDENT') {
      const data = await getStudentDashboardData(user.id).catch(() => null)
      if (!data) return <NoData user={user} />
      return <StudentDashboard user={user} school={schoolData} data={data} notifications={notifications} />
    }

    // SYSTEM_ADMIN → Dashboard technique via portail interactif
    if (user.role === 'SYSTEM_ADMIN') {
      try {
        // Requêtes SÉQUENTIELLES (anti EMAXCONNSESSION — pool_size=1 sur Supabase)
        const totalSchools = await db.school.count()
        const totalUsers = await db.user.count()
        const activeUsers = await db.user.count({ where: { active: true } })
        const demoAccounts = await db.user.count({ where: { isDemoAccount: true } })
        const blockedUsers = await db.user.count({ where: { active: false } })
        const totalLicenses = await db.license.count().catch(() => 0)
        const activeLicenses = await db.license.count({ where: { status: 'ACTIVE' } }).catch(() => 0)
        const totalDevices = await db.syncDevice.count().catch(() => 0)
        const activeDevices = await db.syncDevice.count({ where: { status: 'ACTIVE' } }).catch(() => 0)
        const syncErrors = await db.syncError.count({ where: { resolvedAt: null } }).catch(() => 0)
        const auditToday = await db.auditLog.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
        const failedLogins = await db.auditLog.count({ where: { action: 'LOGIN_FAILED', createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })

        return (
          <AdminSystemPortal
            user={user}
            schoolName={schoolData.name}
            initialData={{
              totalSchools, activeSchools: totalSchools, totalUsers, activeUsers, demoAccounts, blockedUsers,
              totalLicenses, activeLicenses, expiringLicenses: 0,
              totalDevices, activeDevices, syncErrors, auditToday, failedLogins,
            }}
          />
        )
      } catch (err) {
        return <NoData user={user} error={(err as Error).message} />
      }
    }

    // PROMOTER → Portail stratégique interactif
    if (user.role === 'PROMOTER') {
      try {
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const startOfYear = new Date(now.getFullYear(), 0, 1)

        const [totalStudents, activeStudents, newStudentsThisMonth, totalEmployees, teachersCount,
          totalInvoicedAgg, totalCollectedAgg, totalUnpaidAgg, receiptsMonth, expensesMonth,
          expensesYear, pendingExpenses, overdueInvoices] = await Promise.all([
          db.student.count({ where: { schoolId: schoolData.id } }),
          db.student.count({ where: { schoolId: schoolData.id, status: 'ACTIVE' } }),
          db.student.count({ where: { schoolId: schoolData.id, createdAt: { gte: startOfMonth } } }),
          db.employee.count({ where: { schoolId: schoolData.id, status: 'ACTIVE' } }),
          db.employee.count({ where: { schoolId: schoolData.id, status: 'ACTIVE', globalRole: 'ENSEIGNANT' } }),
          db.invoice.aggregate({ where: { schoolId: schoolData.id, status: { not: 'CANCELLED' } }, _sum: { totalAmountCents: true } }),
          db.invoice.aggregate({ where: { schoolId: schoolData.id, status: { not: 'CANCELLED' } }, _sum: { paidAmountCents: true } }),
          db.invoice.aggregate({ where: { schoolId: schoolData.id, status: { in: ['UNPAID', 'PARTIALLY_PAID'] } }, _sum: { totalAmountCents: true, paidAmountCents: true } }),
          db.receipt.aggregate({ where: { schoolId: schoolData.id, issuedAt: { gte: startOfMonth } }, _sum: { amountCents: true } }),
          db.expense.aggregate({ where: { schoolId: schoolData.id, status: { in: ['APPROVED', 'PAID'] }, expenseDate: { gte: startOfMonth } }, _sum: { amountCents: true } }),
          db.expense.aggregate({ where: { schoolId: schoolData.id, status: { in: ['APPROVED', 'PAID'] }, expenseDate: { gte: startOfYear } }, _sum: { amountCents: true } }),
          db.expense.aggregate({ where: { schoolId: schoolData.id, status: 'PENDING' }, _sum: { amountCents: true }, _count: true }),
          db.invoice.count({ where: { schoolId: schoolData.id, status: { in: ['UNPAID', 'PARTIALLY_PAID'] }, dueDate: { lt: now } } }),
        ])

        const totalInvoiced = totalInvoicedAgg._sum.totalAmountCents || 0
        const totalCollected = totalCollectedAgg._sum.paidAmountCents || 0
        const totalUnpaid = (totalUnpaidAgg._sum.totalAmountCents || 0) - (totalUnpaidAgg._sum.paidAmountCents || 0)
        const collectionRate = totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 10000) / 100 : 0
        const expectedPayroll = totalEmployees * 250000
        const budgetAnnual = 500000000
        const budgetConsumed = expensesYear._sum.amountCents || 0
        const budgetPct = budgetAnnual > 0 ? Math.round((budgetConsumed / budgetAnnual) * 100) : 0

        const risks: Array<{ level: string; message: string }> = []
        if (totalUnpaid > 500000) risks.push({ level: 'CRITICAL', message: `Impayés élevés: ${Math.round(totalUnpaid / 100).toLocaleString('fr-FR')} FC` })
        if (overdueInvoices > 10) risks.push({ level: 'HIGH', message: `${overdueInvoices} factures échues` })
        if (budgetPct > 90) risks.push({ level: 'HIGH', message: `Budget consommé à ${budgetPct}%` })

        return (
          <PromoterPortal
            user={user}
            schoolName={schoolData.name}
            initialData={{
              totalStudents, activeStudents, newStudentsThisMonth,
              totalEmployees, teachersCount,
              totalInvoiced, totalCollected, totalUnpaid, collectionRate,
              receiptsMonth: receiptsMonth._sum.amountCents || 0,
              expensesMonth: expensesMonth._sum.amountCents || 0,
              expensesYear: budgetConsumed,
              pendingExpenses: {
                count: pendingExpenses._count || 0,
                amount: pendingExpenses._sum.amountCents || 0,
              },
              overdueInvoices,
              expectedPayroll,
              budgetAnnual, budgetConsumed, budgetPct,
              risks,
            }}
          />
        )
      } catch (err) {
        return <NoData user={user} error={(err as Error).message} />
      }
    }

    // AUDITOR → Portail lecture seule interactif
    if (user.role === 'AUDITOR') {
      try {
        const [activeStudents, totalStudents, totalEmployees, teachersCount,
          totalInvoicedAgg, totalCollectedAgg, totalUnpaidAgg] = await Promise.all([
          db.student.count({ where: { schoolId: schoolData.id, status: 'ACTIVE' } }),
          db.student.count({ where: { schoolId: schoolData.id } }),
          db.employee.count({ where: { schoolId: schoolData.id, status: 'ACTIVE' } }),
          db.employee.count({ where: { schoolId: schoolData.id, status: 'ACTIVE', globalRole: 'ENSEIGNANT' } }),
          db.invoice.aggregate({ where: { schoolId: schoolData.id, status: { not: 'CANCELLED' } }, _sum: { totalAmountCents: true } }),
          db.invoice.aggregate({ where: { schoolId: schoolData.id, status: { not: 'CANCELLED' } }, _sum: { paidAmountCents: true } }),
          db.invoice.aggregate({ where: { schoolId: schoolData.id, status: { in: ['UNPAID', 'PARTIALLY_PAID'] } }, _sum: { totalAmountCents: true, paidAmountCents: true } }),
        ])

        const totalInvoiced = totalInvoicedAgg._sum.totalAmountCents || 0
        const totalCollected = totalCollectedAgg._sum.paidAmountCents || 0
        const totalUnpaid = (totalUnpaidAgg._sum.totalAmountCents || 0) - (totalUnpaidAgg._sum.paidAmountCents || 0)
        const expectedPayroll = totalEmployees * 250000

        return (
          <AuditorPortal
            user={user}
            schoolName={schoolData.name}
            initialData={{
              activeStudents, totalStudents, totalEmployees, teachersCount,
              totalInvoiced, totalCollected, totalUnpaid, expectedPayroll,
            }}
          />
        )
      } catch (err) {
        return <NoData user={user} error={(err as Error).message} />
      }
    }

    // DIRECTION (DIRECTOR, SCHOOL_ADMIN)
    if (user.role === 'DIRECTION' || user.role === 'DIRECTOR' || user.role === 'SCHOOL_ADMIN') {
      const [data, financeData, supervisionData] = await Promise.all([
        getDirectionDashboardData(user.id, user.email || undefined).catch(() => null),
        getFinanceDashboardData(schoolData.id).catch(() => null),
        getAcademicSupervisionData(schoolData.id).catch(() => null),
      ])
      if (!data || !financeData || !supervisionData) return <NoData user={user} />
      return <DirectionDashboard user={user} school={schoolData} data={data} notifications={notifications} financeData={financeData} supervisionData={supervisionData} />
    }

    // TEACHER
    if (user.role === 'TEACHER') {
      const [data, profileData] = await Promise.all([
        getTeacherPortalData(user.id).catch(() => null),
        getProfileData(user.id).catch(() => null),
      ])
      if (!data) return <NoData user={user} />
      return <TeacherPortal user={user} schoolName={schoolData.name} data={data} profileData={profileData || undefined} />
    }

    // ACCOUNTANT (nouveau rôle CASHIER = ancien ACCOUNTANT aussi)
    if (user.role === 'ACCOUNTANT' || user.role === 'CASHIER') {
      const [data, profileData] = await Promise.all([
        getAccountantPortalData(user.id).catch(() => null),
        getProfileData(user.id).catch(() => null),
      ])
      if (!data) return <NoData user={user} />
      return <AccountantPortal user={user} schoolName={schoolData.name} data={data} profileData={profileData || undefined} />
    }

    // HR_MANAGER et PAYROLL_OFFICER → Dashboard RH dédié
    if (user.role === 'HR_MANAGER' || user.role === 'PAYROLL_OFFICER') {
      try {
        const now = new Date()
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

        const schoolId = schoolData.id
        const [totalEmployees, teachersCount, adminStaffCount, supportStaffCount,
          newEmployeesThisMonth, contractsExpiringSoon, employeesAbsentToday,
          lateArrivalsToday, pendingLeaveRequests, pendingOvertime, pendingPayrollVariables] = await Promise.all([
          db.employee.count({ where: { schoolId, status: 'ACTIVE' } }),
          db.employee.count({ where: { schoolId, status: 'ACTIVE', globalRole: 'ENSEIGNANT' } }),
          db.employee.count({ where: { schoolId, status: 'ACTIVE', globalRole: { in: ['ADMINISTRATIF', 'DIRECTION'] } } }),
          db.employee.count({ where: { schoolId, status: 'ACTIVE', globalRole: 'OUVRIER' } }),
          db.employee.count({ where: { schoolId, hireDate: { gte: startOfMonth } } }),
          db.employee.count({ where: { schoolId, status: 'ACTIVE', hireDate: { lte: new Date(now.getTime() - 335 * 24 * 60 * 60 * 1000) } } }),
          db.employeeAttendance.count({ where: { schoolId, date: { gte: today, lt: tomorrow }, status: 'ABSENT' } }).catch(() => 0),
          db.employeeAttendance.count({ where: { schoolId, date: { gte: today, lt: tomorrow }, status: 'LATE' } }).catch(() => 0),
          db.adminTask.count({ where: { schoolId, category: 'LEAVE', status: { in: ['PENDING', 'WAITING_DIRECTION'] } } }).catch(() => 0),
          db.adminTask.count({ where: { schoolId, category: 'OVERTIME', status: { in: ['PENDING', 'WAITING_DIRECTION'] } } }).catch(() => 0),
          db.payrollVariable.count({ where: { schoolId, status: 'DRAFT' } }).catch(() => 0),
        ])

        const expectedPayroll = totalEmployees * 250000

        return (
          <div className="min-h-screen bg-background p-6">
            <div className="max-w-6xl mx-auto space-y-6">
              <div>
                <h1 className="text-2xl font-bold">Ressources Humaines — Tableau de bord</h1>
                <p className="text-sm text-muted-foreground">{schoolData.name}</p>
              </div>
              <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                <AdminStatCard label="Personnel actif" value={totalEmployees} sub="total" />
                <AdminStatCard label="Enseignants" value={teachersCount} sub="pédagogique" />
                <AdminStatCard label="Administratif" value={adminStaffCount} sub="administration" />
                <AdminStatCard label="Soutien" value={supportStaffCount} sub="ouvriers" />
                <AdminStatCard label="Nouveaux (mois)" value={newEmployeesThisMonth} sub="embauchés" />
                <AdminStatCard label="Contrats expirant" value={contractsExpiringSoon} sub="bientôt" />
                <AdminStatCard label="Absents aujourd'hui" value={employeesAbsentToday} sub="personnel" />
                <AdminStatCard label="Retards aujourd'hui" value={lateArrivalsToday} sub="personnel" />
                <AdminStatCard label="Congés en attente" value={pendingLeaveRequests} sub="à valider" />
                <AdminStatCard label="Heures supp." value={pendingOvertime} sub="à valider" />
                <AdminStatCard label="Variables paie" value={pendingPayrollVariables} sub="à transmettre" />
                <AdminStatCard label="Masse salariale" value={Math.round(expectedPayroll / 100).toLocaleString('fr-FR')} sub="FC" />
              </div>
              <div className="p-4 bg-muted/30 rounded-lg border">
                <p className="text-xs text-muted-foreground">
                  Dashboard RH — gestion du personnel uniquement.
                  Le RH ne voit pas les impayés élèves, factures, encaissements, caisse, notes ou bulletins.
                </p>
              </div>
            </div>
          </div>
        )
      } catch (err) {
        return <NoData user={user} error={(err as Error).message} />
      }
    }

    // SECRETARY (Secrétariat) — nouveau rôle ADMISSIONS_OFFICER aussi
    if (user.role === 'SECRETARY' || user.role === 'ADMISSIONS_OFFICER') {
      const [data, profileData] = await Promise.all([
        getSecretaryPortalData(user.id, user.email || undefined).catch(() => null),
        getProfileData(user.id).catch(() => null),
      ])
      if (!data) return <NoData user={user} />
      return <SecretaryPortal user={user} schoolName={schoolData.name} data={data} profileData={profileData || undefined} />
    }

    // SERVER
    if (user.role === 'SERVER') {
      const [data, profileData] = await Promise.all([
        getServerPortalData(user.id).catch(() => null),
        getProfileData(user.id).catch(() => null),
      ])
      if (!data) return <NoData user={user} />
      return <ServerPortal user={user} schoolName={schoolData.name} data={data} profileData={profileData || undefined} />
    }

    return <NoData user={user} />
  } catch (err) {
    console.error('[home] Error:', err)
    return <NoData user={user} error={(err as Error).message} />
  }
}

function NoData({ user, error }: { user: { displayName: string; role: string; email: string }; error?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="text-6xl">🎓</div>
        <h1 className="text-2xl font-bold">Bienvenue, {user.displayName} !</h1>
        <p className="text-sm text-muted-foreground">
          Votre compte <strong>{user.role}</strong> est actif, mais une erreur est survenue lors du chargement.
        </p>
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg text-left">
            <p className="text-xs text-red-600 dark:text-red-400 font-mono break-all">{error}</p>
          </div>
        )}
        <form action="/api/auth/logout" method="POST">
          <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-md">
            Se déconnecter
          </button>
        </form>
      </div>
    </div>
  )
}

function CandidateParentScreen({ user }: { user: { displayName: string; role: string; email: string; phone?: string } }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-teal-50 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-2xl w-full bg-card rounded-2xl shadow-xl p-8 space-y-6">
        <div className="text-center">
          <div className="text-5xl mb-3">🔒</div>
          <h1 className="text-2xl font-bold">Bienvenue, {user.displayName} !</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Votre compte ne possède actuellement aucun enfant inscrit et validé dans notre établissement.
          </p>
        </div>

        <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Pour accéder au portail parent, vous devez soit demander le rattachement à un élève déjà inscrit,
            soit soumettre une demande d'inscription pour votre enfant.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Votre accès restera limité au suivi de vos demandes jusqu'à validation par le secrétariat ou la direction.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <a href="/preinscription/v2" className="block p-5 bg-primary/5 hover:bg-primary/10 rounded-xl border border-primary/20 transition-colors text-center">
            <div className="text-3xl mb-2">📝</div>
            <h3 className="font-semibold text-primary">Inscrire un nouvel enfant</h3>
            <p className="text-xs text-muted-foreground mt-1">Soumettez un dossier de préinscription</p>
          </a>

          <a href="/rattachement" className="block p-5 bg-teal-50 dark:bg-teal-950/30 hover:bg-teal-100 dark:hover:bg-teal-900/30 rounded-xl border border-teal-200 dark:border-teal-800 transition-colors text-center">
            <div className="text-3xl mb-2">🔗</div>
            <h3 className="font-semibold text-teal-700 dark:text-teal-300">Rattacher à un élève existant</h3>
            <p className="text-xs text-muted-foreground mt-1">Votre enfant est déjà dans l'école ? Demandez le rattachement</p>
          </a>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            📧 {user.email}
            {user.phone && ` · 📞 ${user.phone}`}
          </p>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="text-sm text-muted-foreground hover:text-foreground">
              Se déconnecter
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function AdminStatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="p-4 rounded-lg border bg-card">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}
