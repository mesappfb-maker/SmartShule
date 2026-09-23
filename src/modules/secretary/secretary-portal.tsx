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
      { key: 'enrollment', label: 'Inscriptions', icon: <Plus className="h-4 w-4" /> },
      { key: 'classes', label: 'Listes de classes', icon: <Users className="h-4 w-4" /> },
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
      {view === 'dashboard' && (
        <div className="space-y-6">
          <PageHeader title={`Bonjour, ${data.secretary?.name || user.displayName} 👋`} breadcrumbs={[{ label: 'Accueil' }]} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Élèves actifs" value={data.stats.activeStudents} icon={<Users className="h-5 w-5" />} tone="primary" />
            <StatCard label="Classes" value={data.stats.totalClasses} icon={<ClipboardList className="h-5 w-5" />} tone="info" />
            <StatCard label="Parents" value={data.stats.totalGuardians} icon={<UserCheck className="h-5 w-5" />} tone="success" />
            <StatCard label="Demandes en attente" value={data.stats.pendingParentRequests} icon={<FileText className="h-5 w-5" />} tone={data.stats.pendingParentRequests > 0 ? 'danger' : 'success'} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">📋 Inscriptions récentes (30 jours)</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {data.recentEnrollments.length === 0 ? <EmptyState title="Aucune inscription récente" /> : (
                  data.recentEnrollments.map((e, i) => (
                    <div key={i} className="flex items-center justify-between text-sm p-2 rounded-md border border-border">
                      <div>
                        <p className="font-medium">{e.studentName}</p>
                        <p className="text-xs text-muted-foreground">{e.matricule} · {e.classroomName}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatRelative(e.enrolledAt)}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">📊 Répartition par classe</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {data.classrooms.length === 0 ? <EmptyState title="Aucune classe" /> : (
                  data.classrooms.map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-sm p-2 rounded-md border border-border">
                      <div>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.directorateName}{c.optionName && ` · ${c.optionName}`}</p>
                      </div>
                      <Badge variant="outline">{c.enrolledCount}/{c.capacity}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      {view === 'enrollment' && <EnrollmentManager schoolId="" />}
      {view === 'classes' && (
        <div className="space-y-6">
          <PageHeader title="Listes de classes" breadcrumbs={[{ label: 'Secrétariat' }, { label: 'Classes' }]} />
          <Card>
            <CardContent className="p-0">
              {data.classrooms.length === 0 ? <EmptyState icon={<Users className="h-5 w-5" />} title="Aucune classe" /> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 border-b">
                      <tr>
                        <th className="text-left p-2">Classe</th>
                        <th className="text-left p-2">Direction</th>
                        <th className="text-left p-2">Section</th>
                        <th className="text-left p-2">Option</th>
                        <th className="text-center p-2">Effectif</th>
                        <th className="text-center p-2">Capacité</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.classrooms.map((c) => (
                        <tr key={c.id} className="border-b hover:bg-muted/20">
                          <td className="p-2 font-medium">{c.name}</td>
                          <td className="p-2">{c.directorateName}</td>
                          <td className="p-2">{c.sectionName || '—'}</td>
                          <td className="p-2">{c.optionName || '—'}</td>
                          <td className="p-2 text-center"><Badge variant="outline">{c.enrolledCount}</Badge></td>
                          <td className="p-2 text-center text-muted-foreground">{c.capacity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
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
