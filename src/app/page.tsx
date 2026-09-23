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
import { LoginForm } from '@/modules/auth/login-form'
import { ParentDashboard } from '@/modules/parent/parent-dashboard'
import { StudentDashboard } from '@/modules/student/student-dashboard'
import { DirectionDashboard } from '@/modules/direction/direction-dashboard'
import { TeacherPortal } from '@/modules/teacher/teacher-portal'
import { AccountantPortal } from '@/modules/accountant/accountant-portal'
import { ServerPortal } from '@/modules/server/server-portal'

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

    // PARENT
    if (user.role === 'PARENT') {
      const data = await getParentDashboardData(user.id).catch(() => null)
      if (!data) return <NoData user={user} />
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
