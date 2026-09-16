'use client'

import * as React from 'react'
import { AppShell, NavSection } from '@/components/ss/app-shell'
import { PageHeader } from '@/components/ss/page-header'
import { StatCard } from '@/components/ss/stat-card'
import { StatusBadge } from '@/components/ss/status-badge'
import { EmptyState } from '@/components/ss/empty-state'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useActionState } from 'react'
import { toast } from 'sonner'
import {
  Home, BookOpen, ClipboardList, BarChart3, FileText, Bell, Mail,
  Upload, CheckCircle2, Clock, ChevronRight, Send, Loader2,
} from 'lucide-react'
import {
  submitAssignmentAction, logoutAction, markNotificationReadAction,
} from '@/lib/actions'
import { ATTENDANCE_STATUSES } from '@/lib/constants'
import { formatDate, formatDateTime, formatRelative, initials } from '@/lib/format'

type StudentData = NonNullable<Awaited<ReturnType<typeof import('@/lib/queries').getStudentDashboardData>>>
type Notification = Awaited<ReturnType<typeof import('@/lib/queries').getNotificationsForUser>>[number]

export function StudentDashboard({
  user, school, data, notifications,
}: {
  user: { displayName: string; role: string; email: string }
  school: { name: string; slogan: string | null }
  data: StudentData
  notifications: Notification[]
}) {
  const [view, setView] = React.useState('dashboard')

  const unreadCount = notifications.filter((n) => !n.read).length
  const openAssignments = data.assignments.filter(
    (a) => !a.submissions.some((s) => s.status === 'SUBMITTED' || s.status === 'GRADED')
  ).length

  const sections: NavSection[] = [
    {
      id: 'main',
      label: 'Espace élève',
      items: [
        { key: 'dashboard', label: 'Accueil', icon: <Home className="h-4 w-4" /> },
        { key: 'courses', label: 'Mes cours', icon: <BookOpen className="h-4 w-4" /> },
        { key: 'assignments', label: 'Devoirs', icon: <ClipboardList className="h-4 w-4" />, badge: openAssignments },
        { key: 'grades', label: 'Mes notes', icon: <BarChart3 className="h-4 w-4" /> },
        { key: 'report-cards', label: 'Bulletins', icon: <FileText className="h-4 w-4" /> },
        { key: 'announcements', label: 'Annonces', icon: <Bell className="h-4 w-4" /> },
        { key: 'notifications', label: 'Notifications', icon: <Mail className="h-4 w-4" />, badge: unreadCount },
      ],
    },
  ]

  return (
    <AppShell
      user={user}
      schoolName={school.name}
      unreadNotifications={unreadCount}
      sections={sections}
      activeView={view}
      onNavigate={setView}
      onLogout={logoutAction}
      onOpenNotifications={() => setView('notifications')}
      onOpenSearch={() => toast.info('Recherche globale à venir.')}
      sidebarFooter={
        <div className="space-y-1">
          <p>{school.name}</p>
          <p className="text-[10px]">Classe : {data.classroom.name}</p>
        </div>
      }
    >
      {view === 'dashboard' && <StudentHomeView data={data} onNavigate={setView} />}
      {view === 'courses' && <CoursesView data={data} />}
      {view === 'assignments' && <AssignmentsView data={data} />}
      {view === 'grades' && <GradesView data={data} />}
      {view === 'report-cards' && <ReportCardsView data={data} />}
      {view === 'announcements' && <StudentAnnouncementsView data={data} />}
      {view === 'notifications' && <StudentNotificationsView notifications={notifications} />}
    </AppShell>
  )
}

function StudentHomeView({ data, onNavigate }: { data: StudentData; onNavigate: (v: string) => void }) {
  const average = data.grades.length > 0
    ? data.grades.reduce((s, g) => s + (g.score / g.maxScore) * 20, 0) / data.grades.length
    : null
  const presentCount = data.attendances.filter((a) => a.status === 'PRESENT').length
  const upcomingAssignments = data.assignments.filter(
    (a) => !a.submissions.some((s) => s.status === 'SUBMITTED' || s.status === 'GRADED')
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Bonjour, ${data.student.firstName} 👋`}
        description={`${data.classroom.name} · ${data.classroom.directorate.name} · Année 2025-2026`}
        breadcrumbs={[{ label: 'Accueil' }]}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Moyenne générale"
          value={average ? `${average.toFixed(2)}/20` : '—'}
          icon={<BarChart3 className="h-5 w-5" />}
          tone="primary"
          hint={`${data.grades.length} notes publiées`}
        />
        <StatCard
          label="Présence"
          value={`${presentCount}/${data.attendances.length}`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="Devoirs à rendre"
          value={upcomingAssignments.length}
          icon={<ClipboardList className="h-5 w-5" />}
          tone="tertiary"
        />
        <StatCard
          label="Cours actifs"
          value={data.courses.length}
          icon={<BookOpen className="h-5 w-5" />}
          tone="info"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Prochains devoirs</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('assignments')}>
              Voir tout <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingAssignments.length === 0 ? (
              <EmptyState title="Aucun devoir en attente" />
            ) : (
              upcomingAssignments.slice(0, 4).map((a) => {
                const overdue = new Date(a.dueDate) < new Date()
                return (
                  <div key={a.id} className="p-3 rounded-md border border-border">
                    <p className="text-sm font-medium">{a.title}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-muted-foreground">{a.subject?.name || '—'}</p>
                      <StatusBadge variant={overdue ? 'danger' : 'warning'}>
                        <Clock className="h-3 w-3 mr-1" />
                        {formatDate(a.dueDate)}
                      </StatusBadge>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Dernières notes</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('grades')}>
              Voir tout <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.grades.length === 0 ? (
              <EmptyState title="Aucune note" />
            ) : (
              data.grades.slice(0, 4).map((g) => (
                <div key={g.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{g.subject.name} — {g.title}</p>
                    <p className="text-xs text-muted-foreground">{formatRelative(g.publishedAt || g.createdAt)}</p>
                  </div>
                  <p className="font-semibold">{g.score.toFixed(1)}<span className="text-xs text-muted-foreground">/{g.maxScore}</span></p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Dernières annonces</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.announcements.slice(0, 3).map((a) => (
            <div key={a.id} className="p-3 rounded-md bg-muted/30">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{a.title}</p>
                <span className="text-xs text-muted-foreground">{formatRelative(a.publishedAt || a.createdAt)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.content}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function CoursesView({ data }: { data: StudentData }) {
  return (
    <div className="space-y-6">
      <PageHeader title="Mes cours" description={`Classe de ${data.classroom.name}`} breadcrumbs={[{ label: 'Espace élève' }, { label: 'Mes cours' }]} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.courses.map((c) => (
          <Card key={c.id} className="ss-shadow-card hover:ss-shadow-card-hover transition-shadow">
            <CardContent className="p-5 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <BookOpen className="h-4 w-4" />
                </div>
                <p className="text-xs text-muted-foreground">{c.subject.name}</p>
              </div>
              <p className="font-semibold text-sm leading-snug">{c.title}</p>
              {c.description && <p className="text-xs text-muted-foreground line-clamp-3">{c.description}</p>}
              <Separator />
              <p className="text-xs text-muted-foreground">Publié {formatRelative(c.publishedAt || c.createdAt)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function AssignmentsView({ data }: { data: StudentData }) {
  const [submitFor, setSubmitFor] = React.useState<string | null>(null)
  const selected = data.assignments.find((a) => a.id === submitFor)

  return (
    <div className="space-y-6">
      <PageHeader title="Mes devoirs" description="Consultez et déposez vos devoirs en ligne." breadcrumbs={[{ label: 'Espace élève' }, { label: 'Devoirs' }]} />
      <div className="space-y-3">
        {data.assignments.length === 0 ? (
          <EmptyState icon={<ClipboardList className="h-5 w-5" />} title="Aucun devoir publié" />
        ) : (
          data.assignments.map((a) => {
            const submission = a.submissions[0]
            const isOverdue = new Date(a.dueDate) < new Date() && !submission
            const submitted = !!submission
            return (
              <Card key={a.id} className="ss-shadow-card">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold">{a.title}</p>
                        <StatusBadge variant={submitted ? 'success' : isOverdue ? 'danger' : 'warning'}>
                          {submitted ? 'Remis' : isOverdue ? 'En retard' : 'À rendre'}
                        </StatusBadge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {a.subject?.name || '—'} · À rendre le {formatDate(a.dueDate)} {a.maxScore ? `· sur ${a.maxScore}` : ''}
                      </p>
                      {a.description && <p className="text-sm text-muted-foreground line-clamp-2">{a.description}</p>}
                      {submission && (
                        <div className="mt-3 p-2 bg-muted/40 rounded-md text-xs">
                          <p className="font-medium">Votre remise ({formatDateTime(submission.submittedAt)})</p>
                          {submission.content && <p className="mt-1 text-muted-foreground">{submission.content}</p>}
                          {submission.fileName && <p className="mt-1 text-muted-foreground">📎 {submission.fileName}</p>}
                        </div>
                      )}
                    </div>
                    <Button
                      variant={submitted ? 'outline' : 'default'}
                      size="sm"
                      onClick={() => setSubmitFor(a.id)}
                    >
                      {submitted ? 'Modifier' : 'Déposer'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      <SubmitAssignmentDialog
        open={!!submitFor}
        onOpenChange={(o) => !o && setSubmitFor(null)}
        assignment={selected || null}
        studentId={data.student.id}
      />
    </div>
  )
}

function SubmitAssignmentDialog({
  open, onOpenChange, assignment, studentId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  assignment: StudentData['assignments'][number] | null
  studentId: string
}) {
  const [state, formAction, isPending] = useActionState(submitAssignmentAction, null)
  const existingSubmission = assignment?.submissions[0]

  React.useEffect(() => {
    if (state?.ok) {
      toast.success('Devoir déposé avec succès.')
      onOpenChange(false)
    } else if (state && !state.ok) {
      toast.error(state.error)
    }
  }, [state, onOpenChange])

  if (!assignment) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Déposer : {assignment.title}</DialogTitle>
          <DialogDescription>
            {assignment.subject?.name} · À rendre le {formatDate(assignment.dueDate)}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="assignmentId" value={assignment.id} />
          {existingSubmission && (
            <Alert variant="info" className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200 text-sm">
              Vous avez déjà déposé ce devoir le {formatDateTime(existingSubmission.submittedAt)}. Un nouveau dépôt remplacera la version précédente.
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="content">Votre réponse</Label>
            <Textarea
              id="content"
              name="content"
              rows={6}
              defaultValue={existingSubmission?.content}
              placeholder="Saisissez votre réponse ou collez votre texte…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fileName">Fichier joint (optionnel)</Label>
            <Input id="fileName" name="fileName" placeholder="ex: devoir_fractions.pdf" defaultValue={existingSubmission?.fileName || ''} />
            <p className="text-xs text-muted-foreground">
              Indiquez le nom du fichier que vous avez transmis par ailleurs (pièce jointe simulée pour la démo).
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Déposer le devoir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Re-use Alert
function Alert({ variant = 'default', className, children }: { variant?: string; className?: string; children: React.ReactNode }) {
  return <div className={`rounded-md border p-3 ${className || ''}`}>{children}</div>
}

function GradesView({ data }: { data: StudentData }) {
  const subjectsMap = new Map<string, { subject: string; grades: typeof data.grades }>()
  for (const g of data.grades) {
    const subjName = g.subject.name
    if (!subjectsMap.has(subjName)) {
      subjectsMap.set(subjName, { subject: subjName, grades: [] })
    }
    subjectsMap.get(subjName)!.grades.push(g)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Mes notes" description={`${data.grades.length} note(s) publiée(s)`} breadcrumbs={[{ label: 'Espace élève' }, { label: 'Mes notes' }]} />
      <div className="space-y-3">
        {subjectsMap.size === 0 ? (
          <EmptyState icon={<BarChart3 className="h-5 w-5" />} title="Aucune note publiée" />
        ) : (
          Array.from(subjectsMap.values()).map(({ subject, grades }) => {
            const avg = grades.reduce((s, g) => s + (g.score / g.maxScore) * 20, 0) / grades.length
            return (
              <Card key={subject} className="ss-shadow-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{subject}</CardTitle>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Moyenne</p>
                      <p className="text-xl font-semibold">{avg.toFixed(2)}<span className="text-xs text-muted-foreground">/20</span></p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-1">
                  {grades.map((g) => (
                    <div key={g.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0 text-sm">
                      <div>
                        <p className="font-medium">{g.title}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(g.publishedAt || g.createdAt)}</p>
                        {g.teacherComment && <p className="text-xs italic mt-0.5">« {g.teacherComment} »</p>}
                      </div>
                      <p className="font-semibold">{g.score.toFixed(1)}<span className="text-xs text-muted-foreground">/{g.maxScore}</span></p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}

function ReportCardsView({ data }: { data: StudentData }) {
  return (
    <div className="space-y-6">
      <PageHeader title="Mes bulletins" breadcrumbs={[{ label: 'Espace élève' }, { label: 'Mes bulletins' }]} />
      {data.reportCards.length === 0 ? (
        <EmptyState icon={<FileText className="h-5 w-5" />} title="Aucun bulletin publié" description="Les bulletins trimestriels apparaîtront ici." />
      ) : (
        <div className="space-y-3">
          {data.reportCards.map((rc) => (
            <Card key={rc.id} className="ss-shadow-card">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>Bulletin {rc.period} — 2025-2026</CardTitle>
                    <CardDescription>Publié le {formatDate(rc.publishedAt || rc.createdAt)}</CardDescription>
                  </div>
                  <StatusBadge variant="success">Publié</StatusBadge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-muted/30 rounded-md">
                    <p className="text-xs text-muted-foreground">Moyenne générale</p>
                    <p className="text-2xl font-semibold">{rc.average?.toFixed(2) || '—'}<span className="text-sm text-muted-foreground">/20</span></p>
                  </div>
                  <div className="text-center p-3 bg-muted/30 rounded-md">
                    <p className="text-xs text-muted-foreground">Rang</p>
                    <p className="text-2xl font-semibold">{rc.rank || '—'}<span className="text-sm text-muted-foreground">e</span></p>
                  </div>
                  <div className="text-center p-3 bg-muted/30 rounded-md">
                    <p className="text-xs text-muted-foreground">Mention</p>
                    <p className="text-sm font-medium mt-1">
                      {(rc.average || 0) >= 16 ? 'Très bien' : (rc.average || 0) >= 14 ? 'Bien' : (rc.average || 0) >= 12 ? 'Assez bien' : 'Passable'}
                    </p>
                  </div>
                </div>
                {rc.appreciation && (
                  <div className="mt-4 p-3 bg-muted/40 rounded-md">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Appréciation</p>
                    <p className="text-sm italic">{rc.appreciation}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function StudentAnnouncementsView({ data }: { data: StudentData }) {
  return (
    <div className="space-y-6">
      <PageHeader title="Annonces" breadcrumbs={[{ label: 'Espace élève' }, { label: 'Annonces' }]} />
      <div className="space-y-3">
        {data.announcements.length === 0 ? (
          <EmptyState icon={<Bell className="h-5 w-5" />} title="Aucune annonce" />
        ) : (
          data.announcements.map((a) => (
            <Card key={a.id} className="ss-shadow-card">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <StatusBadge variant={a.priority === 'URGENT' ? 'danger' : a.priority === 'HIGH' ? 'warning' : 'primary'}>
                    {a.priority === 'URGENT' ? 'Urgent' : a.priority === 'HIGH' ? 'Important' : 'Info'}
                  </StatusBadge>
                  <span className="text-xs text-muted-foreground">{formatRelative(a.publishedAt || a.createdAt)}</span>
                </div>
                <h3 className="font-semibold">{a.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{a.content}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

function StudentNotificationsView({ notifications }: { notifications: Notification[] }) {
  const [state, formAction] = useActionState(markNotificationReadAction, null)
  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={`${unreadCount} non lue(s) sur ${notifications.length}`}
        breadcrumbs={[{ label: 'Espace élève' }, { label: 'Notifications' }]}
        actions={unreadCount > 0 ? (
          <form action={formAction}>
            <input type="hidden" name="markAll" value="true" />
            <Button type="submit" variant="outline" size="sm">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Tout marquer comme lu
            </Button>
          </form>
        ) : null}
      />
      <Card>
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <EmptyState icon={<Bell className="h-5 w-5" />} title="Aucune notification" />
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map((n) => (
                <li key={n.id} className={`p-4 flex items-start gap-3 ${!n.read ? 'bg-primary/5' : ''}`}>
                  <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${!n.read ? 'bg-primary' : 'bg-transparent'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatRelative(n.createdAt)}</p>
                  </div>
                  {!n.read && (
                    <form action={formAction}>
                      <input type="hidden" name="notificationId" value={n.id} />
                      <Button type="submit" size="sm" variant="ghost">Marquer lu</Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
