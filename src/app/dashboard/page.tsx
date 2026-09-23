// SmartShule — Dashboard router (redirige selon le rôle après login)
// ============================================================

import { getUserFromSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { getSchoolIdForUser } from '@/lib/school-context'
import { redirect } from 'next/navigation'
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
import { ParentDashboard } from '@/modules/parent/parent-dashboard'
import { StudentDashboard } from '@/modules/student/student-dashboard'
import { DirectionDashboard } from '@/modules/direction/direction-dashboard'
import { TeacherPortal } from '@/modules/teacher/teacher-portal'
import { AccountantPortal } from '@/modules/accountant/accountant-portal'
import { ServerPortal } from '@/modules/server/server-portal'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const user = await getUserFromSession()
  if (!user) {
    redirect('/')
  }

  // Utiliser le helper robuste qui cherche par Employee.email, Guardian, Student, AuditLog, puis fallback
  const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
  const school = schoolId ? await db.school.findUnique({ where: { id: schoolId } }) : null
  const notifications = await getNotificationsForUser(user.id)

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
      getDirectionDashboardData(user.id, user.email || undefined),
      getFinanceDashboardData(schoolData.id),
      getAcademicSupervisionData(schoolData.id),
    ])
    if (!data || !financeData || !supervisionData) return <NoData user={user} />
    return <DirectionDashboard user={user} school={schoolData} data={data} notifications={notifications} financeData={financeData} supervisionData={supervisionData} />
  }

  // TEACHER
  if (user.role === 'TEACHER') {
    const [data, profileData] = await Promise.all([
      getTeacherPortalData(user.id),
      getProfileData(user.id),
    ])
    if (!data) return <NoData user={user} />
    return <TeacherPortal user={user} schoolName={schoolData.name} data={data} profileData={profileData || undefined} />
  }

  // ACCOUNTANT
  if (user.role === 'ACCOUNTANT') {
    const [data, profileData] = await Promise.all([
      getAccountantPortalData(user.id),
      getProfileData(user.id),
    ])
    if (!data) return <NoData user={user} />
    return <AccountantPortal user={user} schoolName={schoolData.name} data={data} profileData={profileData || undefined} />
  }

  // SERVER (Admin technique)
  if (user.role === 'SERVER') {
    const [data, profileData] = await Promise.all([
      getServerPortalData(user.id),
      getProfileData(user.id),
    ])
    if (!data) return <NoData user={user} />
    return <ServerPortal user={user} schoolName={schoolData.name} data={data} profileData={profileData || undefined} />
  }

  return <NoData user={user} />
}

function NoData({ user }: { user: { displayName: string; role: string; email: string } }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="text-6xl">🎓</div>
        <h1 className="text-2xl font-bold">Bienvenue, {user.displayName} !</h1>
        <p className="text-sm text-muted-foreground">
          Votre compte <strong>{user.role}</strong> est actif, mais aucune donnée n'est encore associée à votre profil.
        </p>
        <a href="/login" className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-md">
          Se déconnecter
        </a>
      </div>
    </div>
  )
}
