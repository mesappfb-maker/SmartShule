import { getUserFromSession } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  getParentDashboardData,
  getStudentDashboardData,
  getDirectionDashboardData,
  getNotificationsForUser,
  getSchoolForUser,
} from '@/lib/queries'
import { LoginForm } from '@/modules/auth/login-form'
import { ParentDashboard } from '@/modules/parent/parent-dashboard'
import { StudentDashboard } from '@/modules/student/student-dashboard'
import { DirectionDashboard } from '@/modules/direction/direction-dashboard'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const user = await getUserFromSession()
  if (!user) {
    // Afficher l'écran de connexion
    const school = await db.school.findFirst()
    return (
      <LoginForm
        schoolName={school?.name || 'SmartShule'}
        schoolSlogan={school?.slogan || undefined}
      />
    )
  }

  // Récupérer les données selon le rôle
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

  if (user.role === 'PARENT') {
    const data = await getParentDashboardData(user.id)
    if (!data) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">Aucun dossier parent trouvé pour ce compte.</p>
            <p className="text-xs text-muted-foreground">Contactez l'administration.</p>
          </div>
        </div>
      )
    }
    return <ParentDashboard user={user} school={schoolData} data={data} notifications={notifications} />
  }

  if (user.role === 'STUDENT') {
    const data = await getStudentDashboardData(user.id)
    if (!data) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">Aucun dossier élève trouvé pour ce compte.</p>
          </div>
        </div>
      )
    }
    return <StudentDashboard user={user} school={schoolData} data={data} notifications={notifications} />
  }

  if (user.role === 'DIRECTION' || user.role === 'ADMIN') {
    const data = await getDirectionDashboardData(user.id)
    if (!data) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <p className="text-sm text-muted-foreground">Aucune donnée disponible.</p>
        </div>
      )
    }
    return <DirectionDashboard user={user} school={schoolData} data={data} notifications={notifications} />
  }

  // Rôle inconnu
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <p className="text-sm text-muted-foreground">Rôle non reconnu : {user.role}</p>
    </div>
  )
}
