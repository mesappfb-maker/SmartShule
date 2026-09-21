'use client'

import * as React from 'react'
import { AppShell, NavSection } from '@/components/ss/app-shell'
import { PageHeader } from '@/components/ss/page-header'
import { StatCard } from '@/components/ss/stat-card'
import { StatusBadge } from '@/components/ss/status-badge'
import { EmptyState } from '@/components/ss/empty-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Home, Calendar, BookOpen, ClipboardList, Bell, Users,
  AlertTriangle, Clock, FileText, Mail, User,
} from 'lucide-react'
import { logoutAction } from '@/lib/actions'
import { formatRelative, formatDate, initials } from '@/lib/format'
import { toast } from 'sonner'
import { ProfilePage, type ProfileData } from '@/modules/shared/profile-page'

type TeacherData = NonNullable<Awaited<ReturnType<typeof import('@/lib/teacher-portal-queries').getTeacherPortalData>>>

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

export function TeacherPortal({
  user, schoolName, data, profileData,
}: {
  user: { displayName: string; role: string; email: string }
  schoolName: string
  data: TeacherData
  profileData?: ProfileData
}) {
  const [view, setView] = React.useState('dashboard')
  const unreadCount = data.unreadCount
  const alertCount = data.financialAlerts.length

  const sections: NavSection[] = [{
    id: 'main', label: 'Portail Prof',
    items: [
      { key: 'dashboard', label: 'Accueil', icon: <Home className="h-4 w-4" /> },
      { key: 'schedule', label: 'Emploi du temps', icon: <Calendar className="h-4 w-4" /> },
      { key: 'attendance', label: 'Présences', icon: <ClipboardList className="h-4 w-4" />, badge: alertCount },
      { key: 'grades', label: 'Notes brouillon', icon: <BookOpen className="h-4 w-4" />, badge: data.draftGrades.length },
      { key: 'logbook', label: 'Cahier de textes', icon: <FileText className="h-4 w-4" /> },
      { key: 'announcements', label: 'Annonces', icon: <Bell className="h-4 w-4" /> },
      { key: 'notifications', label: 'Notifications', icon: <Mail className="h-4 w-4" />, badge: unreadCount },
      { key: 'profile', label: 'Mon profil', icon: <User className="h-4 w-4" /> },
    ],
  }]

  return (
    <AppShell
      user={user} schoolName={schoolName} unreadNotifications={unreadCount}
      sections={sections} activeView={view} onNavigate={setView}
      onLogout={logoutAction}
      onOpenNotifications={() => setView('notifications')}
      onOpenSearch={() => toast.info('Recherche à venir')}
      sidebarFooter={<div><p>{schoolName}</p><p className="text-[10px]">{data.teacher.isMultiDirectorate ? 'Multi-directions' : 'Enseignant'}</p></div>}
    >
      {view === 'dashboard' && (
        <div className="space-y-6">
          <PageHeader title={`Bonjour, ${data.teacher.name} 👋`} breadcrumbs={[{ label: 'Accueil' }]} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Classes" value={data.assignments.length} icon={<Users className="h-5 w-5" />} tone="primary" />
            <StatCard label="Cours aujourd'hui" value={data.todaySchedule.length} icon={<Calendar className="h-5 w-5" />} tone="info" />
            <StatCard label="Brouillons" value={data.draftGrades.length} icon={<BookOpen className="h-5 w-5" />} tone="tertiary" />
            <StatCard label="Alertes" value={alertCount} icon={<AlertTriangle className="h-5 w-5" />} tone={alertCount > 0 ? 'danger' : 'success'} />
          </div>
          {data.financialAlerts.length > 0 && (
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Élèves en litige de frais</p>
                </div>
                {data.financialAlerts.slice(0, 5).map((a) => (
                  <div key={a.studentId} className="flex items-center justify-between text-sm py-1">
                    <span>⚠️ {a.studentName} ({a.classroomName})</span>
                    <StatusBadge variant="danger">{a.status}</StatusBadge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Cours d'aujourd'hui</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {data.todaySchedule.length === 0 ? <EmptyState icon={<Calendar className="h-5 w-5" />} title="Aucun cours" /> : (
                  data.todaySchedule.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 p-2 rounded-md border border-border">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1"><p className="text-sm font-medium">{s.subjectName} — {s.classroomName}</p><p className="text-xs text-muted-foreground">{s.startTime}-{s.endTime}{s.room && ` · ${s.room}`}</p></div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Affectations</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {data.assignments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-sm p-2 hover:bg-muted/30 rounded-md">
                    <div><p className="font-medium">{a.subjectName}</p><p className="text-xs text-muted-foreground">{a.classroomName} · {a.directorateName}</p></div>
                    {a.optionName && <StatusBadge variant="info">{a.optionName}</StatusBadge>}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      {view === 'schedule' && (
        <div className="space-y-6">
          <PageHeader title="Emploi du temps" breadcrumbs={[{ label: 'Portail Prof' }, { label: 'Emploi du temps' }]} />
          <Card><CardContent className="p-0">
            {data.schedule.length === 0 ? <EmptyState icon={<Calendar className="h-5 w-5" />} title="Aucun horaire" /> : (
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead className="border-b bg-muted/30"><tr><th className="p-2 text-left">Jour</th><th className="p-2 text-left">Heure</th><th className="p-2 text-left">Classe</th><th className="p-2 text-left">Matière</th><th className="p-2 text-left">Salle</th></tr></thead>
                <tbody>{data.schedule.map((s) => (<tr key={s.id} className="border-b hover:bg-muted/20"><td className="p-2 font-medium">{DAYS[s.dayOfWeek]}</td><td className="p-2">{s.startTime}-{s.endTime}</td><td className="p-2">{s.classroomName}</td><td className="p-2">{s.subjectName}</td><td className="p-2">{s.room || '—'}</td></tr>))}</tbody>
              </table></div>
            )}
          </CardContent></Card>
        </div>
      )}
      {view === 'attendance' && (
        <div className="space-y-6">
          <PageHeader title="Présences" description="⚠️ Les élèves en litige de frais sont marqués d'une icône discrète" breadcrumbs={[{ label: 'Portail Prof' }, { label: 'Présences' }]} />
          <Card><CardContent className="space-y-2">
            {data.studentsForAttendance.length === 0 ? <EmptyState title="Aucun élève" /> : (
              data.studentsForAttendance.slice(0, 50).map((s) => (
                <div key={s.id} className="flex items-center gap-3 p-2 rounded-md border border-border">
                  {s.financialStatus !== 'REGULAR' && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                  <Avatar className="h-8 w-8"><AvatarFallback className="bg-primary/10 text-primary text-xs">{initials(s.name)}</AvatarFallback></Avatar>
                  <div className="flex-1"><p className="text-sm font-medium">{s.name}</p><p className="text-xs text-muted-foreground">{s.matricule} · {s.classroomName}</p></div>
                  <StatusBadge variant={s.financialStatus === 'REGULAR' ? 'success' : 'warning'}>{s.financialStatus === 'REGULAR' ? 'OK' : s.financialStatus}</StatusBadge>
                </div>
              ))
            )}
          </CardContent></Card>
        </div>
      )}
      {view === 'grades' && (
        <div className="space-y-6">
          <PageHeader title="Notes (brouillon)" breadcrumbs={[{ label: 'Portail Prof' }, { label: 'Notes' }]} />
          <Card><CardContent className="space-y-2">
            {data.draftGrades.length === 0 ? <EmptyState icon={<BookOpen className="h-5 w-5" />} title="Aucune note en brouillon" /> : (
              data.draftGrades.map((g) => (
                <div key={g.id} className="flex items-center justify-between p-3 rounded-md border border-border">
                  <div><p className="text-sm font-medium">{g.title}</p><p className="text-xs text-muted-foreground">{g.studentName} · {g.subjectName}</p></div>
                  <div className="text-right"><p className="font-semibold">{g.score}/{g.maxScore}</p><StatusBadge variant="warning">Brouillon</StatusBadge></div>
                </div>
              ))
            )}
          </CardContent></Card>
        </div>
      )}
      {view === 'logbook' && (
        <div className="space-y-6">
          <PageHeader title="Cahier de textes" breadcrumbs={[{ label: 'Portail Prof' }, { label: 'Cahier de textes' }]} />
          <div className="space-y-3">
            {data.recentLogbook.length === 0 ? <EmptyState icon={<FileText className="h-5 w-5" />} title="Aucune séance" /> : (
              data.recentLogbook.map((l) => (
                <Card key={l.id}><CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2"><p className="text-sm font-medium">{l.classroomName}</p><span className="text-xs text-muted-foreground">{formatDate(l.date)}</span></div>
                  <p className="text-sm text-muted-foreground">{l.content}</p>
                  {l.homework && <div className="mt-2 p-2 bg-muted/40 rounded-md"><p className="text-xs font-medium">À faire :</p><p className="text-sm">{l.homework}</p></div>}
                </CardContent></Card>
              ))
            )}
          </div>
        </div>
      )}
      {view === 'announcements' && (
        <div className="space-y-6">
          <PageHeader title="Annonces" breadcrumbs={[{ label: 'Portail Prof' }, { label: 'Annonces' }]} />
          <div className="space-y-3">
            {data.announcements.length === 0 ? <EmptyState icon={<Bell className="h-5 w-5" />} title="Aucune annonce" /> : (
              data.announcements.map((a) => (
                <Card key={a.id}><CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1"><StatusBadge variant={a.priority === 'URGENT' ? 'danger' : 'primary'}>{a.priority}</StatusBadge><span className="text-xs text-muted-foreground">{formatRelative(a.publishedAt || new Date())}</span></div>
                  <h3 className="font-semibold">{a.title}</h3><p className="mt-1 text-sm text-muted-foreground">{a.content}</p>
                </CardContent></Card>
              ))
            )}
          </div>
        </div>
      )}
      {view === 'notifications' && (
        <div className="space-y-6">
          <PageHeader title="Notifications" breadcrumbs={[{ label: 'Portail Prof' }, { label: 'Notifications' }]} />
          <Card><CardContent className="p-0">
            {data.notifications.length === 0 ? <EmptyState icon={<Mail className="h-5 w-5" />} title="Aucune notification" /> : (
              <ul className="divide-y divide-border">
                {data.notifications.map((n) => (
                  <li key={n.id} className={`p-4 flex items-start gap-3 ${!n.read ? 'bg-primary/5' : ''}`}>
                    <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${!n.read ? 'bg-primary' : 'bg-transparent'}`} />
                    <div className="flex-1"><p className="text-sm font-medium">{n.title}</p><p className="text-xs text-muted-foreground mt-0.5">{n.message}</p><p className="text-xs text-muted-foreground mt-1">{formatRelative(n.createdAt)}</p></div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent></Card>
        </div>
      )}
      {view === 'profile' && profileData && <ProfilePage data={profileData} onBack={() => setView('dashboard')} />}
    </AppShell>
  )
}
