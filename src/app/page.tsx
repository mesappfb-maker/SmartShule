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

    // SYSTEM_ADMIN → Dashboard technique
    if (user.role === 'SYSTEM_ADMIN') {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/admin/dashboard`, {
          headers: { cookie: (await import('next/headers')).cookies().toString() },
        })
        const adminData = await res.json()
        return (
          <div className="min-h-screen bg-background p-6">
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold">Super Admin — Tableau de bord technique</h1>
                  <p className="text-sm text-muted-foreground">{schoolData.name}</p>
                </div>
              </div>
              {adminData.ok ? (
                <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  <AdminStatCard label="Écoles" value={adminData.stats.totalSchools} sub={`${adminData.stats.activeSchools} actives`} />
                  <AdminStatCard label="Licences" value={adminData.stats.totalLicenses} sub={`${adminData.stats.activeLicenses} actives`} />
                  <AdminStatCard label="Utilisateurs" value={adminData.stats.totalUsers} sub={`${adminData.stats.activeUsers} actifs`} />
                  <AdminStatCard label="Comptes démo" value={adminData.stats.demoAccounts} sub="isDemoAccount" />
                  <AdminStatCard label="Comptes bloqués" value={adminData.stats.blockedUsers} sub="désactivés" />
                  <AdminStatCard label="Échecs connexion (24h)" value={adminData.stats.failedLogins} sub="LOGIN_FAILED" />
                  <AdminStatCard label="Audit (24h)" value={adminData.stats.auditToday} sub="événements" />
                  <AdminStatCard label="Appareils sync" value={adminData.stats.totalDevices} sub={`${adminData.stats.activeDevices} actifs`} />
                  <AdminStatCard label="Erreurs sync" value={adminData.stats.syncErrors} sub="non résolues" />
                </div>
              ) : (
                <p className="text-muted-foreground">Erreur chargement dashboard technique</p>
              )}
              <div className="p-4 bg-muted/30 rounded-lg border">
                <p className="text-xs text-muted-foreground">
                  Dashboard technique SYSTEM_ADMIN — aucun KPI métier (élèves, factures, caisse, notes).
                  Ce rôle gère uniquement la configuration système, les licences, la sécurité et la synchronisation.
                </p>
              </div>
            </div>
          </div>
        )
      } catch {
        return <NoData user={user} error="Dashboard technique indisponible" />
      }
    }

    // PROMOTER → Dashboard stratégique
    if (user.role === 'PROMOTER') {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/promoter/dashboard`, {
          headers: { cookie: (await import('next/headers')).cookies().toString() },
        })
        const promoterData = await res.json()
        return (
          <div className="min-h-screen bg-background p-6">
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold">Promoteur — Vue stratégique</h1>
                  <p className="text-sm text-muted-foreground">{schoolData.name}</p>
                </div>
              </div>
              {promoterData.ok ? (
                <>
                  <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    <AdminStatCard label="Élèves actifs" value={promoterData.stats.activeStudents} sub={`${promoterData.stats.newStudentsThisMonth} nouveaux ce mois`} />
                    <AdminStatCard label="Total facturé" value={Math.round(promoterData.stats.totalInvoiced / 100).toLocaleString('fr-FR')} sub="FC" />
                    <AdminStatCard label="Total encaissé" value={Math.round(promoterData.stats.totalCollected / 100).toLocaleString('fr-FR')} sub="FC" />
                    <AdminStatCard label="Impayés" value={Math.round(promoterData.stats.totalUnpaid / 100).toLocaleString('fr-FR')} sub="FC" />
                    <AdminStatCard label="Taux recouvrement" value={promoterData.stats.collectionRate} sub="%" />
                    <AdminStatCard label="Employés" value={promoterData.stats.totalEmployees} sub={`${promoterData.stats.teachersCount} enseignants`} />
                    <AdminStatCard label="Masse salariale" value={Math.round(promoterData.stats.expectedPayroll / 100).toLocaleString('fr-FR')} sub="FC" />
                    <AdminStatCard label="Budget consommé" value={promoterData.stats.budgetPct} sub="%" />
                  </div>

                  {promoterData.stats.risks && promoterData.stats.risks.length > 0 && (
                    <div className="space-y-2">
                      <h2 className="text-lg font-semibold">Risques et alertes</h2>
                      {promoterData.stats.risks.map((risk: any, i: number) => (
                        <div key={i} className={`p-3 rounded-lg border ${
                          risk.level === 'CRITICAL' ? 'border-red-200 bg-red-50 text-red-700' :
                          risk.level === 'HIGH' ? 'border-orange-200 bg-orange-50 text-orange-700' :
                          'border-blue-200 bg-blue-50 text-blue-700'
                        }`}>
                          <span className="font-medium text-sm">{risk.level}</span>: <span className="text-sm">{risk.message}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {promoterData.stats.decisionsPending > 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm font-medium text-amber-700">
                        {promoterData.stats.decisionsPending} dépense(s) en attente de validation
                      </p>
                    </div>
                  )}

                  <div className="p-4 bg-muted/30 rounded-lg border">
                    <p className="text-xs text-muted-foreground">
                      Dashboard stratégique PROMOTEUR — données agrégées uniquement.
                      Le promoteur ne crée pas de factures, n'encaisse pas, ne modifie pas les notes.
                      Il valide les grandes décisions (budget, investissements, dépenses hors seuil).
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">Erreur chargement dashboard stratégique</p>
              )}
            </div>
          </div>
        )
      } catch {
        return <NoData user={user} error="Dashboard stratégique indisponible" />
      }
    }

    // AUDITOR → Dashboard lecture seule
    if (user.role === 'AUDITOR') {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/promoter/dashboard`, {
          headers: { cookie: (await import('next/headers')).cookies().toString() },
        })
        const auditData = await res.json()
        return (
          <div className="min-h-screen bg-background p-6">
            <div className="max-w-6xl mx-auto space-y-6">
              <div>
                <h1 className="text-2xl font-bold">Auditeur — Vue de contrôle</h1>
                <p className="text-sm text-muted-foreground">{schoolData.name}</p>
              </div>
              {auditData.ok ? (
                <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  <AdminStatCard label="Élèves actifs" value={auditData.stats.activeStudents} sub={`${auditData.stats.totalStudents} total`} />
                  <AdminStatCard label="Total facturé" value={Math.round(auditData.stats.totalInvoiced / 100).toLocaleString('fr-FR')} sub="FC" />
                  <AdminStatCard label="Total encaissé" value={Math.round(auditData.stats.totalCollected / 100).toLocaleString('fr-FR')} sub="FC" />
                  <AdminStatCard label="Impayés" value={Math.round(auditData.stats.totalUnpaid / 100).toLocaleString('fr-FR')} sub="FC" />
                  <AdminStatCard label="Employés" value={auditData.stats.totalEmployees} sub={`${auditData.stats.teachersCount} enseignants`} />
                  <AdminStatCard label="Masse salariale" value={Math.round(auditData.stats.expectedPayroll / 100).toLocaleString('fr-FR')} sub="FC" />
                </div>
              ) : (
                <p className="text-muted-foreground">Erreur chargement dashboard audit</p>
              )}
              <div className="p-4 bg-muted/30 rounded-lg border">
                <p className="text-xs text-muted-foreground">
                  Vue Auditeur — lecture seule. Aucune modification possible.
                  L'auditeur ne voit pas les données médicales, disciplinaires ou messages privés.
                </p>
              </div>
            </div>
          </div>
        )
      } catch {
        return <NoData user={user} error="Dashboard audit indisponible" />
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

    // HR_MANAGER et PAYROLL_OFFICER (utilisent dashboard accountant en attendant module RH dédié)
    if (user.role === 'HR_MANAGER' || user.role === 'PAYROLL_OFFICER') {
      const [data, profileData] = await Promise.all([
        getAccountantPortalData(user.id).catch(() => null),
        getProfileData(user.id).catch(() => null),
      ])
      if (!data) return <NoData user={user} />
      return <AccountantPortal user={user} schoolName={schoolData.name} data={data} profileData={profileData || undefined} />
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
