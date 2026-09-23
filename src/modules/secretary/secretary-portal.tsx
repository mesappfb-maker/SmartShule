'use client'

// SmartShule — Portail Secrétariat
// ============================================================
// Le secrétariat gère :
//   - Vue d'ensemble (stats)
//   - Inscriptions élèves (lien vers enrollment)
//   - Listes de classes
//   - Demandes parents
//   - Rendez-vous / Réceptions
//   - Annuaire contacts

import * as React from 'react'
import { AppShell, NavSection } from '@/components/ss/app-shell'
import { PageHeader } from '@/components/ss/page-header'
import { StatCard } from '@/components/ss/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ss/empty-state'
import {
  Home, Users, FileText, User, Plus, TrendingUp, ClipboardList, UserCheck,
} from 'lucide-react'
import { logoutAction } from '@/lib/actions'
import { formatRelative } from '@/lib/format'
import { toast } from 'sonner'
import { ProfilePage, type ProfileData } from '@/modules/shared/profile-page'
import { EnrollmentManager } from '@/modules/direction/enrollment-manager'
import { StudentsList } from './students-list'
import { ClassListsDynamic } from './class-lists-dynamic'
import { AdmissionsManager } from './admissions-manager'
import { AdmissionsManagerV2 } from './admissions-manager-v2'
import { SecretaryDashboardV2 } from './secretary-dashboard-v2'

type SecretaryData = NonNullable<Awaited<ReturnType<typeof import('@/lib/secretary-portal-queries').getSecretaryPortalData>>>

export function SecretaryPortal({
  user, schoolName, data, profileData,
}: {
  user: { displayName: string; role: string; email: string }
  schoolName: string
  data: SecretaryData
  profileData?: ProfileData
}) {
  const [view, setView] = React.useState('dashboard')
  const pendingRequests = data.stats.pendingParentRequests

  const sections: NavSection[] = [{
    id: 'main', label: 'Portail Secrétariat',
    items: [
      { key: 'dashboard', label: 'Tableau de bord', icon: <Home className="h-4 w-4" /> },
      { key: 'admissions', label: 'Admissions V2', icon: <FileText className="h-4 w-4" /> },
      { key: 'students', label: 'Liste des élèves', icon: <Users className="h-4 w-4" /> },
      { key: 'enrollment', label: 'Inscriptions', icon: <Plus className="h-4 w-4" /> },
      { key: 'classes', label: 'Listes de classes', icon: <ClipboardList className="h-4 w-4" /> },
      { key: 'recent', label: 'Inscriptions récentes', icon: <TrendingUp className="h-4 w-4" /> },
      { key: 'profile', label: 'Mon profil', icon: <User className="h-4 w-4" /> },
    ],
  }]

  return (
    <AppShell
      user={user} schoolName={schoolName} unreadNotifications={pendingRequests}
      sections={sections} activeView={view} onNavigate={setView}
      onLogout={logoutAction}
      onOpenNotifications={() => toast.info(`${pendingRequests} demande(s) en attente`)}
      onOpenSearch={() => toast.info('Recherche à venir')}
      sidebarFooter={<div><p>{schoolName}</p><p className="text-[10px]">Secrétariat</p></div>}
    >
      {view === 'dashboard' && <SecretaryDashboardV2 onNavigate={setView} />}
      {view === 'admissions' && <AdmissionsManagerV2 />}
      {view === 'students' && <StudentsList />}
      {view === 'enrollment' && <EnrollmentManager schoolId="" />}
      {view === 'classes' && <ClassListsDynamic />}
      {view === 'recent' && (
        <div className="space-y-6">
          <PageHeader title="Inscriptions récentes" breadcrumbs={[{ label: 'Secrétariat' }, { label: 'Inscriptions récentes' }]} />
          <Card>
            <CardContent className="space-y-2">
              {data.recentEnrollments.length === 0 ? <EmptyState icon={<TrendingUp className="h-5 w-5" />} title="Aucune inscription récente" /> : (
                data.recentEnrollments.map((e, i) => (
                  <div key={i} className="flex items-center justify-between text-sm p-3 rounded-md border border-border">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{e.studentName}</p>
                        <p className="text-xs text-muted-foreground">{e.matricule} · {e.classroomName}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatRelative(e.enrolledAt)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
      {view === 'profile' && profileData && <ProfilePage data={profileData} onBack={() => setView('dashboard')} />}
    </AppShell>
  )
}
