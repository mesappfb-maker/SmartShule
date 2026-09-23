'use client'

import * as React from 'react'
import { AppShell, NavSection } from '@/components/ss/app-shell'
import { PageHeader } from '@/components/ss/page-header'
import { StatCard } from '@/components/ss/stat-card'
import { StatusBadge } from '@/components/ss/status-badge'
import { EmptyState } from '@/components/ss/empty-state'
import { LoadingSkeleton } from '@/components/ss/loading-states'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useActionState } from 'react'
import { toast } from 'sonner'
import {
  Home, Users, Bell, MessageSquare, FileText, CreditCard,
  GraduationCap, Calendar, BookOpen, ClipboardList, ChevronRight,
  Plus, Send, CheckCircle2, Clock, AlertCircle, BookOpenCheck,
  TrendingUp, Mail, ArrowLeft, Hash, Loader2,
} from 'lucide-react'
import {
  createParentRequestAction, addRequestMessageAction, logoutAction,
  markNotificationReadAction,
} from '@/lib/actions'
import {
  REQUEST_CATEGORIES, REQUEST_PRIORITIES, REQUEST_STATUSES,
  INVOICE_STATUSES, PAYMENT_METHODS, ATTENDANCE_STATUSES, RELATIONSHIP_LABELS,
} from '@/lib/constants'
import { formatCurrency, formatDate, formatDateTime, formatRelative, initials } from '@/lib/format'

type DashboardData = NonNullable<Awaited<ReturnType<typeof import('@/lib/queries').getParentDashboardData>>>
type Child = DashboardData['children'][number]
type Notification = Awaited<ReturnType<typeof import('@/lib/queries').getNotificationsForUser>>[number]

export function ParentDashboard({
  user, school, data, notifications,
}: {
  user: { displayName: string; role: string; email: string }
  school: { name: string; slogan: string | null }
  data: DashboardData
  notifications: Notification[]
}) {
  const [view, setView] = React.useState('dashboard')
  const [selectedChildId, setSelectedChildId] = React.useState<string | null>(null)
  const [selectedRequestId, setSelectedRequestId] = React.useState<string | null>(null)
  const [notificationsOpen, setNotificationsOpen] = React.useState(false)

  const unreadCount = notifications.filter((n) => !n.read).length
  const openRequests = data.parentRequests.filter(
    (r) => r.status !== 'CLOSED' && r.status !== 'ARCHIVED'
  ).length

  const sections: NavSection[] = [
    {
      id: 'main',
      label: 'Espace parent',
      items: [
        { key: 'dashboard', label: 'Tableau de bord', icon: <Home className="h-4 w-4" /> },
        { key: 'children', label: 'Mes enfants', icon: <Users className="h-4 w-4" />, badge: data.children.length },
        { key: 'requests', label: 'Mes demandes', icon: <MessageSquare className="h-4 w-4" />, badge: openRequests },
        { key: 'announcements', label: 'Annonces', icon: <Bell className="h-4 w-4" /> },
        { key: 'notifications', label: 'Notifications', icon: <Mail className="h-4 w-4" />, badge: unreadCount },
      ],
    },
  ]

  const handleNavigate = (key: string) => {
    setView(key)
    setSelectedChildId(null)
    setSelectedRequestId(null)
  }

  return (
    <AppShell
      user={user}
      schoolName={school.name}
      unreadNotifications={unreadCount}
      sections={sections}
      activeView={view}
      onNavigate={handleNavigate}
      onLogout={logoutAction}
      onOpenNotifications={() => { setView('notifications'); setNotificationsOpen(true) }}
      onOpenSearch={() => toast.info('Recherche globale disponible prochainement.')}
      sidebarFooter={
        <div className="space-y-1">
          <p>{school.name}</p>
          <p className="text-[10px]">Année scolaire 2025-2026</p>
        </div>
      }
    >
      {view === 'dashboard' && (
        <ParentHomeView data={data} onSelectChild={(id) => { setView('child'); setSelectedChildId(id) }} onCreateRequest={() => setView('requests')} />
      )}
      {view === 'children' && (
        <ChildrenListView data={data} onSelectChild={(id) => { setView('child'); setSelectedChildId(id) }} />
      )}
      {view === 'child' && selectedChildId && (
        <ChildDetailView
          child={data.children.find((c) => c.id === selectedChildId)!}
          onBack={() => { setView('children'); setSelectedChildId(null) }}
        />
      )}
      {view === 'requests' && (
        <RequestsView data={data} selectedRequestId={selectedRequestId} onSelectRequest={setSelectedRequestId} />
      )}
      {view === 'announcements' && <AnnouncementsView data={data} />}
      {view === 'notifications' && (
        <NotificationsView notifications={notifications} />
      )}
    </AppShell>
  )
}

// ============================================================
// Home dashboard
// ============================================================

function ParentHomeView({
  data, onSelectChild, onCreateRequest,
}: {
  data: DashboardData
  onSelectChild: (id: string) => void
  onCreateRequest: () => void
}) {
  const totalUnpaid = data.children.reduce(
    (sum, c) => sum + c.invoices.filter((i) => i.status !== 'PAID' && i.status !== 'CANCELLED')
      .reduce((s, i) => s + (i.totalAmount - i.paidAmount), 0),
    0
  )
  const totalUpcomingAssignments = data.children.reduce(
    (sum, c) => sum + c.upcomingAssignments.length, 0
  )
  const recentAbsences = data.children.reduce(
    (sum, c) => sum + c.attendances.filter((a) => a.status === 'ABSENT' && !a.justified).length, 0
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Bonjour, ${data.guardian.firstName} 👋`}
        description="Voici un aperçu de la situation de vos enfants."
        breadcrumbs={[{ label: 'Tableau de bord' }]}
        actions={
          <Button onClick={onCreateRequest}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle demande
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Enfants"
          value={data.children.length}
          icon={<Users className="h-5 w-5" />}
          tone="primary"
        />
        <StatCard
          label="Demandes en cours"
          value={data.parentRequests.filter((r) => r.status !== 'CLOSED' && r.status !== 'ARCHIVED').length}
          icon={<MessageSquare className="h-5 w-5" />}
          tone="info"
        />
        <StatCard
          label="Devoirs à venir"
          value={totalUpcomingAssignments}
          icon={<ClipboardList className="h-5 w-5" />}
          tone="tertiary"
        />
        <StatCard
          label="Solde dû"
          value={formatCurrency(totalUnpaid, 'CDF')}
          icon={<CreditCard className="h-5 w-5" />}
          tone={totalUnpaid > 0 ? 'danger' : 'success'}
        />
      </div>

      {recentAbsences > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                {recentAbsences} absence(s) non justifiée(s)
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                Pensez à régulariser la situation en fournissant un justificatif via une demande.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Mes enfants</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.children.map((child) => (
              <ChildRow key={child.id} child={child} onClick={() => onSelectChild(child.id)} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dernières annonces</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.announcements.slice(0, 3).map((a) => (
              <div key={a.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <StatusBadge variant={a.priority === 'URGENT' ? 'danger' : a.priority === 'HIGH' ? 'warning' : 'primary'}>
                    {a.title}
                  </StatusBadge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatRelative(a.publishedAt || a.createdAt)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Demandes récentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.parentRequests.slice(0, 4).map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 p-3 rounded-md border border-border hover:bg-muted/30 transition-colors">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{r.subject}</p>
                <p className="text-xs text-muted-foreground">
                  {r.requestNumber} · {REQUEST_CATEGORIES[r.category]}
                </p>
              </div>
              <StatusBadge variant={REQUEST_STATUSES[r.status]?.tone}>
                {REQUEST_STATUSES[r.status]?.label}
              </StatusBadge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function ChildRow({ child, onClick }: { child: Child; onClick: () => void }) {
  const lastGrade = child.grades[0]
  const average = child.grades.length > 0
    ? child.grades.reduce((s, g) => s + (g.score / g.maxScore) * 20, 0) / child.grades.length
    : null
  const unpaid = child.invoices.filter((i) => i.status !== 'PAID' && i.status !== 'CANCELLED')
    .reduce((s, i) => s + (i.totalAmount - i.paidAmount), 0)

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-md border border-border hover:bg-muted/30 hover:ss-shadow-card-hover transition-all text-left"
    >
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarFallback className="bg-primary/10 text-primary text-sm">
          {initials(`${child.firstName} ${child.lastName}`)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{child.firstName} {child.lastName}</p>
        <p className="text-xs text-muted-foreground">
          {child.enrollments[0]?.classroom.name} · {child.enrollments[0]?.classroom.directorate.name}
        </p>
      </div>
      <div className="hidden sm:flex items-center gap-4 text-xs">
        <div className="text-center">
          <p className="text-muted-foreground">Moyenne</p>
          <p className="font-semibold">{average ? average.toFixed(2) : '—'}/20</p>
        </div>
        <div className="text-center">
          <p className="text-muted-foreground">Solde dû</p>
          <p className={unpaid > 0 ? 'font-semibold text-red-600 dark:text-red-400' : 'font-semibold text-emerald-600 dark:text-emerald-400'}>
            {unpaid > 0 ? formatCurrency(unpaid, 'CDF') : 'À jour'}
          </p>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  )
}

// ============================================================
// Children list view
// ============================================================

function ChildrenListView({ data, onSelectChild }: { data: DashboardData; onSelectChild: (id: string) => void }) {
  return (
    <div className="space-y-6">
      <PageHeader title="Mes enfants" description="Sélectionnez un enfant pour consulter son dossier." breadcrumbs={[{ label: 'Espace parent' }, { label: 'Mes enfants' }]} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.children.map((child) => (
          <Card key={child.id} className="ss-shadow-card hover:ss-shadow-card-hover transition-shadow cursor-pointer" >
            <CardContent className="p-5" >
              <button onClick={() => onSelectChild(child.id)} className="w-full text-left space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary">{initials(`${child.firstName} ${child.lastName}`)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{child.firstName} {child.lastName}</p>
                    <p className="text-xs text-muted-foreground">{child.matricule}</p>
                  </div>
                </div>
                <Separator />
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Classe</span><span>{child.enrollments[0]?.classroom.name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Direction</span><span>{child.enrollments[0]?.classroom.directorate.name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Notes</span><span>{child.grades.length} publiées</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Bulletins</span><span>{child.reportCards.length}</span></div>
                </div>
              </button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// Child detail
// ============================================================

function ChildDetailView({ child, onBack }: { child: Child; onBack: () => void }) {
  const [tab, setTab] = React.useState('overview')
  return (
    <div className="space-y-6">
      <PageHeader
        title={`${child.firstName} ${child.lastName}`}
        description={`${child.matricule} · ${child.enrollments[0]?.classroom.name} · ${child.enrollments[0]?.classroom.directorate.name}`}
        breadcrumbs={[
          { label: 'Espace parent' },
          { label: 'Mes enfants', onClick: onBack },
          { label: `${child.firstName} ${child.lastName}` },
        ]}
        actions={<Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" />Retour</Button>}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="grades">Notes</TabsTrigger>
          <TabsTrigger value="attendance">Présences</TabsTrigger>
          <TabsTrigger value="report-cards">Bulletins</TabsTrigger>
          <TabsTrigger value="fees">Frais</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Moyenne actuelle" value={child.grades.length > 0 ? (child.grades.reduce((s, g) => s + (g.score / g.maxScore) * 20, 0) / child.grades.length).toFixed(2) + '/20' : '—'} icon={<TrendingUp className="h-5 w-5" />} tone="primary" />
            <StatCard label="Présence" value={`${child.attendances.filter(a => a.status === 'PRESENT').length}/${child.attendances.length}`} icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
            <StatCard label="Dernier bulletin" value={child.reportCards[0]?.period || '—'} hint={child.reportCards[0] ? `Moyenne ${child.reportCards[0].average}/20` : undefined} icon={<FileText className="h-5 w-5" />} tone="tertiary" />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Dernières notes</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {child.grades.slice(0, 5).map((g) => (
                <div key={g.id} className="flex items-center justify-between text-sm border-b border-border last:border-0 pb-2 last:pb-0">
                  <div>
                    <p className="font-medium">{g.subject.name} — {g.title}</p>
                    <p className="text-xs text-muted-foreground">{formatRelative(g.publishedAt || g.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{g.score.toFixed(1)}<span className="text-muted-foreground text-xs">/{g.maxScore}</span></p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grades">
          <Card>
            <CardHeader><CardTitle className="text-base">Notes publiées</CardTitle></CardHeader>
            <CardContent>
              {child.grades.length === 0 ? (
                <EmptyState icon={<BookOpen className="h-5 w-5" />} title="Aucune note publiée" description="Les notes apparaîtront ici dès qu'elles seront publiées par l'enseignant." />
              ) : (
                <div className="space-y-3">
                  {child.grades.map((g) => (
                    <div key={g.id} className="flex items-start justify-between gap-3 p-3 rounded-md border border-border">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{g.subject.name} — {g.title}</p>
                        <p className="text-xs text-muted-foreground">Publié {formatDate(g.publishedAt || g.createdAt)}</p>
                        {g.teacherComment && <p className="text-xs italic">« {g.teacherComment} »</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold">{g.score.toFixed(1)}<span className="text-muted-foreground text-sm">/{g.maxScore}</span></p>
                        <StatusBadge variant={g.score / g.maxScore >= 0.8 ? 'success' : g.score / g.maxScore >= 0.5 ? 'warning' : 'danger'}>
                          {((g.score / g.maxScore) * 20).toFixed(1)}/20
                        </StatusBadge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          <Card>
            <CardHeader><CardTitle className="text-base">Présences récentes</CardTitle></CardHeader>
            <CardContent>
              {child.attendances.length === 0 ? (
                <EmptyState title="Aucune présence enregistrée" />
              ) : (
                <div className="space-y-2">
                  {child.attendances.map((a) => (
                    <div key={a.id} className="flex items-center justify-between text-sm p-2 rounded-md hover:bg-muted/30">
                      <div>
                        <p className="font-medium">{formatDate(a.date)}</p>
                        <p className="text-xs text-muted-foreground">{a.justification || 'Pas de justification'}</p>
                      </div>
                      <StatusBadge variant={ATTENDANCE_STATUSES[a.status]?.tone}>
                        {ATTENDANCE_STATUSES[a.status]?.label}
                      </StatusBadge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="report-cards">
          <Card>
            <CardHeader><CardTitle className="text-base">Bulletins</CardTitle></CardHeader>
            <CardContent>
              {child.reportCards.length === 0 ? (
                <EmptyState icon={<FileText className="h-5 w-5" />} title="Aucun bulletin publié" description="Les bulletins trimestriels apparaîtront ici dès leur publication." />
              ) : (
                <div className="space-y-3">
                  {child.reportCards.map((rc) => (
                    <div key={rc.id} className="p-4 rounded-md border border-border ss-shadow-card">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold">Bulletin {rc.period} — 2025-2026</p>
                          <p className="text-xs text-muted-foreground">Publié {formatDate(rc.publishedAt || rc.createdAt)}</p>
                        </div>
                        <StatusBadge variant={rc.status === 'PUBLISHED' ? 'success' : 'default'}>
                          {rc.status === 'PUBLISHED' ? 'Publié' : 'Brouillon'}
                        </StatusBadge>
                      </div>
                      <Separator className="my-3" />
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Moyenne générale</p>
                          <p className="text-lg font-semibold">{rc.average?.toFixed(2) || '—'}<span className="text-xs text-muted-foreground">/20</span></p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Rang</p>
                          <p className="text-lg font-semibold">{rc.rank || '—'}<span className="text-xs text-muted-foreground">e</span></p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Statut</p>
                          <p className="text-sm font-medium">{rc.status}</p>
                        </div>
                      </div>
                      {rc.appreciation && (
                        <div className="mt-3 p-3 bg-muted/40 rounded-md">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Appréciation du conseil de classe</p>
                          <p className="text-sm italic">{rc.appreciation}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fees">
          <Card>
            <CardHeader><CardTitle className="text-base">Frais académiques</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {child.invoices.length === 0 ? (
                <EmptyState icon={<CreditCard className="h-5 w-5" />} title="Aucune facture" />
              ) : (
                child.invoices.map((inv) => (
                  <div key={inv.id} className="p-3 rounded-md border border-border">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold">{inv.invoiceNumber}</p>
                        <p className="text-xs text-muted-foreground">Émise le {formatDate(inv.issueDate)} · Échéance {formatDate(inv.dueDate || inv.issueDate)}</p>
                      </div>
                      <StatusBadge variant={INVOICE_STATUSES[inv.status]?.tone}>{INVOICE_STATUSES[inv.status]?.label}</StatusBadge>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <p className="text-muted-foreground">Total : <span className="font-medium text-foreground">{formatCurrency(inv.totalAmount, inv.currency)}</span></p>
                        <p className="text-muted-foreground">Payé : <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(inv.paidAmount, inv.currency)}</span></p>
                      </div>
                      {inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Reste à payer</p>
                          <p className="font-semibold text-red-600 dark:text-red-400">{formatCurrency(inv.totalAmount - inv.paidAmount, inv.currency)}</p>
                        </div>
                      )}
                    </div>
                    {inv.payments.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-border">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Paiements</p>
                        {inv.payments.map((p) => (
                          <div key={p.id} className="flex items-center justify-between text-xs py-1">
                            <span>{p.receiptNumber} · {PAYMENT_METHODS[p.method] || p.method} · {formatDate(p.paidAt)}</span>
                            <span className="font-medium">{formatCurrency(p.amount, inv.currency)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================================
// Requests (parent)
// ============================================================

function RequestsView({ data, selectedRequestId, onSelectRequest }: {
  data: DashboardData
  selectedRequestId: string | null
  onSelectRequest: (id: string | null) => void
}) {
  const [showCreate, setShowCreate] = React.useState(false)
  const selectedRequest = data.parentRequests.find((r) => r.id === selectedRequestId)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes demandes"
        description="Communiquez avec la direction via des demandes institutionnelles."
        breadcrumbs={[{ label: 'Espace parent' }, { label: 'Mes demandes' }]}
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle demande
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base">Demandes ({data.parentRequests.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
            {data.parentRequests.length === 0 ? (
              <EmptyState title="Aucune demande" description="Créez votre première demande à la direction." />
            ) : (
              data.parentRequests.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onSelectRequest(r.id)}
                  className={`w-full text-left p-3 rounded-md border transition-colors ${
                    selectedRequestId === r.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-medium truncate flex-1">{r.subject}</p>
                    <StatusBadge variant={REQUEST_STATUSES[r.status]?.tone}>
                      {REQUEST_STATUSES[r.status]?.label}
                    </StatusBadge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {r.requestNumber} · {REQUEST_CATEGORIES[r.category]}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatRelative(r.updatedAt)}
                  </p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          {selectedRequest ? (
            <RequestDetail request={selectedRequest} />
          ) : (
            <CardContent className="py-12">
              <EmptyState
                icon={<MessageSquare className="h-5 w-5" />}
                title="Sélectionnez une demande"
                description="Consultez le détail d'une demande ou créez-en une nouvelle."
              />
            </CardContent>
          )}
        </Card>
      </div>

      <CreateRequestDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        childList={data.children}
        guardianId={data.guardian.id}
      />
    </div>
  )
}

function RequestDetail({ request }: { request: DashboardData['parentRequests'][number] }) {
  const [messages, setMessages] = React.useState(request.messages || [])
  const [state, formAction, isPending] = useActionState(addRequestMessageAction, null)

  React.useEffect(() => {
    if (state?.ok) {
      // re-fetch handled by revalidatePath
    } else if (state && !state.ok) {
      toast.error(state.error)
    }
  }, [state])

  return (
    <>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{request.subject}</CardTitle>
            <CardDescription>
              {request.requestNumber} · {REQUEST_CATEGORIES[request.category]} · Créée {formatRelative(request.createdAt)}
            </CardDescription>
          </div>
          <StatusBadge variant={REQUEST_STATUSES[request.status]?.tone}>
            {REQUEST_STATUSES[request.status]?.label}
          </StatusBadge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {(request.messages || []).map((m) => (
            <div key={m.id} className={`flex gap-3 ${m.authorRole === 'PARENT' ? 'justify-end' : ''}`}>
              {m.authorRole !== 'PARENT' && (
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-secondary/10 text-secondary text-xs">
                    {initials(m.authorName)}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className={`max-w-[80%] ${m.authorRole === 'PARENT' ? 'items-end' : ''}`}>
                <div className={`rounded-lg p-3 text-sm ${
                  m.authorRole === 'PARENT' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                } ${m.isInternal ? 'border-2 border-dashed border-amber-400' : ''}`}>
                  {m.isInternal && <p className="text-[10px] uppercase font-semibold mb-1 opacity-80">Note interne</p>}
                  <p>{m.content}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {m.authorName} · {formatDateTime(m.createdAt)}
                </p>
              </div>
              {m.authorRole === 'PARENT' && (
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {initials(m.authorName)}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
        </div>

        {request.status !== 'CLOSED' && request.status !== 'ARCHIVED' && (
          <form action={formAction} className="space-y-2 pt-2 border-t border-border">
            <input type="hidden" name="requestId" value={request.id} />
            <Label htmlFor={`msg-${request.id}`}>Votre réponse</Label>
            <Textarea
              id={`msg-${request.id}`}
              name="content"
              placeholder="Saisissez votre message…"
              rows={3}
              required
            />
            <Button type="submit" disabled={isPending} size="sm">
              {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Envoyer
            </Button>
          </form>
        )}
      </CardContent>
    </>
  )
}

function CreateRequestDialog({
  open, onOpenChange, childList, guardianId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  childList: Child[]
  guardianId: string
}) {
  const [state, formAction, isPending] = useActionState(createParentRequestAction, null)

  React.useEffect(() => {
    if (state?.ok) {
      toast.success('Demande créée avec succès.')
      onOpenChange(false)
    } else if (state && !state.ok) {
      toast.error(state.error)
    }
  }, [state, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nouvelle demande à la direction</DialogTitle>
          <DialogDescription>
            Votre message sera transmis à la direction. Une réponse officielle vous sera apportée.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="studentId">Élève concernné</Label>
            <Select name="studentId">
              <SelectTrigger><SelectValue placeholder="Sélectionnez un enfant (optionnel)" /></SelectTrigger>
              <SelectContent>
                {childList.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="category">Catégorie</Label>
              <Select name="category" required defaultValue="AUTRE">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(REQUEST_CATEGORIES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priorité</Label>
              <Select name="priority" defaultValue="NORMAL">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(REQUEST_PRIORITIES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Sujet</Label>
            <Input id="subject" name="subject" placeholder="Résumé de votre demande" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Message</Label>
            <Textarea id="content" name="content" rows={5} placeholder="Décrivez votre demande…" required />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Envoyer la demande
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Announcements view
// ============================================================

function AnnouncementsView({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-6">
      <PageHeader title="Annonces" description="Communications officielles de la direction." breadcrumbs={[{ label: 'Espace parent' }, { label: 'Annonces' }]} />
      <div className="space-y-3">
        {data.announcements.length === 0 ? (
          <EmptyState icon={<Bell className="h-5 w-5" />} title="Aucune annonce" />
        ) : (
          data.announcements.map((a) => (
            <Card key={a.id} className="ss-shadow-card">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <StatusBadge variant={a.priority === 'URGENT' ? 'danger' : a.priority === 'HIGH' ? 'warning' : 'primary'}>
                      {a.priority === 'URGENT' ? 'Urgent' : a.priority === 'HIGH' ? 'Important' : 'Info'}
                    </StatusBadge>
                    {a.targetType === 'CLASSROOM' && (
                      <StatusBadge variant="outline">Classe</StatusBadge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{formatRelative(a.publishedAt || a.createdAt)}</span>
                </div>
                <h3 className="font-semibold text-base">{a.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{a.content}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

// ============================================================
// Notifications view
// ============================================================

function NotificationsView({ notifications }: { notifications: Notification[] }) {
  const [state, formAction] = useActionState(markNotificationReadAction, null)
  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={`${unreadCount} non lue(s) sur ${notifications.length} notification(s)`}
        breadcrumbs={[{ label: 'Espace parent' }, { label: 'Notifications' }]}
        actions={
          unreadCount > 0 ? (
            <form action={formAction}>
              <input type="hidden" name="markAll" value="true" />
              <Button type="submit" variant="outline" size="sm">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Tout marquer comme lu
              </Button>
            </form>
          ) : null
        }
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
                    <p className="text-xs text-muted-foreground mt-1">{formatRelative(n.createdAt)} · {formatDateTime(n.createdAt)}</p>
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
