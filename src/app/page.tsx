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

    // DIRECTION
    if (user.role === 'DIRECTION' || user.role === 'ADMIN') {
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

    // ACCOUNTANT
    if (user.role === 'ACCOUNTANT') {
      const [data, profileData] = await Promise.all([
        getAccountantPortalData(user.id).catch(() => null),
        getProfileData(user.id).catch(() => null),
      ])
      if (!data) return <NoData user={user} />
      return <AccountantPortal user={user} schoolName={schoolData.name} data={data} profileData={profileData || undefined} />
    }

    // SECRETARY (Secrétariat)
    if (user.role === 'SECRETARY') {
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
          <a href="/preinscription" className="block p-5 bg-primary/5 hover:bg-primary/10 rounded-xl border border-primary/20 transition-colors text-center">
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
