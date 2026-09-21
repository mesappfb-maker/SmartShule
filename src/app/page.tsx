import { getUserFromSession } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  getParentDashboardData,
  getStudentDashboardData,
  getDirectionDashboardData,
  getNotificationsForUser,
  getSchoolForUser,
  getFinanceDashboardData,
} from '@/lib/queries'
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
    if (!data) return <NoData />
    return <ParentDashboard user={user} school={schoolData} data={data} notifications={notifications} />
  }

  // STUDENT
  if (user.role === 'STUDENT') {
    const data = await getStudentDashboardData(user.id)
    if (!data) return <NoData />
    return <StudentDashboard user={user} school={schoolData} data={data} notifications={notifications} />
  }

  // DIRECTION
  if (user.role === 'DIRECTION' || user.role === 'ADMIN') {
    const [data, financeData] = await Promise.all([
      getDirectionDashboardData(user.id),
      getFinanceDashboardData(schoolData.id),
    ])
    if (!data || !financeData) return <NoData />
    return <DirectionDashboard user={user} school={schoolData} data={data} notifications={notifications} financeData={financeData} />
  }

  // TEACHER (nouveau portail RDC)
  if (user.role === 'TEACHER') {
    const [data, profileData] = await Promise.all([
      getTeacherPortalData(user.id),
      getProfileData(user.id),
    ])
    if (!data) return <NoData />
    return <TeacherPortal user={user} schoolName={schoolData.name} data={data} profileData={profileData || undefined} />
  }

  // ACCOUNTANT (nouveau portail RDC)
  if (user.role === 'ACCOUNTANT') {
    const [data, profileData] = await Promise.all([
      getAccountantPortalData(user.id),
      getProfileData(user.id),
    ])
    if (!data) return <NoData />
    return <AccountantPortal user={user} schoolName={schoolData.name} data={data} profileData={profileData || undefined} />
  }

  // SERVER (nouveau portail PromoServeur)
  if (user.role === 'SERVER') {
    const [data, profileData] = await Promise.all([
      getServerPortalData(user.id),
      getProfileData(user.id),
    ])
    if (!data) return <NoData />
    return <ServerPortal user={user} schoolName={schoolData.name} data={data} profileData={profileData || undefined} />
  }

  // Rôle inconnu
  return <NoData />
}

function NoData() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <p className="text-sm text-muted-foreground">Aucune donnée disponible pour votre rôle.</p>
    </div>
  )
}
