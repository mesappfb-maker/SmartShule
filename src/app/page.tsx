import { getUserFromSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { logoutAction } from '@/lib/actions'
import {
  getParentDashboardData,
  getStudentDashboardData,
  getDirectionDashboardData,
  getNotificationsForUser,
  getSchoolForUser,
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

export default async function Home() {
  const user = await getUserFromSession()
  if (!user) {
    const school = await db.school.findFirst()
    return (
      <LoginForm
        schoolName={school?.name || 'SmartShule'}
        schoolSlogan={school?.slogan || undefined}
      />
    )
  }

  const [school, notifications] = await Promise.all([
    getSchoolForUser(user.id),
    getNotificationsForUser(user.id),
  ])

  if (!school) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Aucune école associée à votre compte.</p>
        </div>
      </div>
    )
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
    const data = await getParentDashboardData(user.id)
    if (!data) return <NoData user={user} />
    return <ParentDashboard user={user} school={schoolData} data={data} notifications={notifications} />
  }

  // STUDENT
  if (user.role === 'STUDENT') {
    const data = await getStudentDashboardData(user.id)
    if (!data) return <NoData user={user} />
    return <StudentDashboard user={user} school={schoolData} data={data} notifications={notifications} />
  }

  // DIRECTION
  if (user.role === 'DIRECTION' || user.role === 'ADMIN') {
    const [data, financeData, supervisionData] = await Promise.all([
      getDirectionDashboardData(user.id),
      getFinanceDashboardData(schoolData.id),
      getAcademicSupervisionData(schoolData.id),
    ])
    if (!data || !financeData || !supervisionData) return <NoData user={user} />
    return <DirectionDashboard user={user} school={schoolData} data={data} notifications={notifications} financeData={financeData} supervisionData={supervisionData} />
  }

  // TEACHER (nouveau portail RDC)
  if (user.role === 'TEACHER') {
    const [data, profileData] = await Promise.all([
      getTeacherPortalData(user.id),
      getProfileData(user.id),
    ])
    if (!data) return <NoData user={user} />
    return <TeacherPortal user={user} schoolName={schoolData.name} data={data} profileData={profileData || undefined} />
  }

  // ACCOUNTANT (nouveau portail RDC)
  if (user.role === 'ACCOUNTANT') {
    const [data, profileData] = await Promise.all([
      getAccountantPortalData(user.id),
      getProfileData(user.id),
    ])
    if (!data) return <NoData user={user} />
    return <AccountantPortal user={user} schoolName={schoolData.name} data={data} profileData={profileData || undefined} />
  }

  // SERVER (nouveau portail PromoServeur)
  if (user.role === 'SERVER') {
    const [data, profileData] = await Promise.all([
      getServerPortalData(user.id),
      getProfileData(user.id),
    ])
    if (!data) return <NoData user={user} />
    return <ServerPortal user={user} schoolName={schoolData.name} data={data} profileData={profileData || undefined} />
  }

  // Rôle inconnu
  return <NoData user={user} />
}

function NoData({ user }: { user?: { displayName: string; role: string; email: string } }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="text-6xl">🎓</div>
        <h1 className="text-2xl font-bold">
          Bienvenue{user?.displayName ? `, ${user.displayName}` : ''} !
        </h1>
        <p className="text-sm text-muted-foreground">
          Votre compte <strong>{user?.role || 'utilisateur'}</strong> est actif, mais aucune donnée n&apos;est encore associée à votre profil.
        </p>

        {user?.role === 'PARENT' && (
          <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-left space-y-2">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">👨‍👩‍👧‍👦 Compte Parent</p>
            <p className="text-xs text-muted-foreground">
              Pour voir les informations de votre enfant, vous devez être associé à son profil.
              Contactez la Direction de l&apos;école ou le Secrétariat avec votre matricule parent et celui de votre enfant.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Vous pouvez aussi vous inscrire via le lien <strong>Créer un compte</strong> sur la page de connexion si l&apos;inscription self-service est activée.
            </p>
          </div>
        )}

        {user?.role === 'TEACHER' && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-left space-y-2">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">👨‍🏫 Compte Enseignant</p>
            <p className="text-xs text-muted-foreground">
              Votre compte n&apos;est pas encore rattaché à un employé. Contactez la Direction pour qu&apos;elle vous inscrive dans le système.
            </p>
          </div>
        )}

        {user?.role === 'STUDENT' && (
          <div className="p-4 bg-cyan-50 dark:bg-cyan-950/30 rounded-lg text-left space-y-2">
            <p className="text-sm font-medium text-cyan-700 dark:text-cyan-300">🎓 Compte Élève</p>
            <p className="text-xs text-muted-foreground">
              Votre compte n&apos;est pas encore rattaché à un dossier élève. Contactez le Secrétariat pour finaliser votre inscription.
            </p>
          </div>
        )}

        <form action={async () => { 'use server'; await logoutAction() }} className="pt-4">
          <button
            type="submit"
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Se déconnecter
          </button>
        </form>
      </div>
    </div>
  )
}
