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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useActionState } from 'react'
import { toast } from 'sonner'
import {
  Home, Bell, MessageSquare, FileText, ShieldCheck, Palette,
  Users, TrendingUp, CreditCard, Plus, Send, Loader2, Archive,
  CheckCircle2, Clock, Eye, Hash, Calculator,
} from 'lucide-react'
import {
  createAnnouncementAction, archiveAnnouncementAction, assignRequestAction,
  addRequestMessageAction, logoutAction, markNotificationReadAction,
  updateBrandingAction,
} from '@/lib/actions'
import {
  REQUEST_CATEGORIES, REQUEST_PRIORITIES, REQUEST_STATUSES,
  INVOICE_STATUSES, PAYMENT_METHODS, ANNOUNCEMENT_PRIORITIES,
} from '@/lib/constants'
import { formatCurrency, formatDate, formatDateTime, formatRelative, initials } from '@/lib/format'
import { FinanceView } from './finance-view'
import { AcademicSupervision } from './academic-supervision'
import { DirectionAuditView } from './direction-audit-view'

type DirectionData = NonNullable<Awaited<ReturnType<typeof import('@/lib/queries').getDirectionDashboardData>>>
type FinanceData = NonNullable<Awaited<ReturnType<typeof import('@/lib/queries').getFinanceDashboardData>>>
type SupervisionData = NonNullable<Awaited<ReturnType<typeof import('@/lib/academic-supervision-queries').getAcademicSupervisionData>>>
type Notification = Awaited<ReturnType<typeof import('@/lib/queries').getNotificationsForUser>>[number]

export function DirectionDashboard({
  user, school, data, notifications, financeData, supervisionData,
}: {
  user: { displayName: string; role: string; email: string }
  school: { name: string; slogan: string | null; primaryColor: string; secondaryColor: string; tertiaryColor: string; id: string }
  data: DirectionData
  notifications: Notification[]
  financeData: FinanceData
  supervisionData: SupervisionData
}) {
  const [view, setView] = React.useState('dashboard')
  const unreadCount = notifications.filter((n) => !n.read).length
  const openRequests = data.kpis.openRequests

  const sections: NavSection[] = [
    {
      id: 'main',
      label: 'Pilotage',
      items: [
        { key: 'dashboard', label: 'Tableau de bord', icon: <Home className="h-4 w-4" /> },
        { key: 'supervision', label: 'Gestion de l\'école', icon: <Eye className="h-4 w-4" /> },
      ],
    },
    {
      id: 'time',
      label: 'Gestion du temps',
      items: [
        { key: 'requests', label: 'Demandes', icon: <MessageSquare className="h-4 w-4" />, badge: openRequests },
        { key: 'announcements', label: 'Annonces', icon: <Bell className="h-4 w-4" /> },
        { key: 'teacher-audit', label: 'Audit Prof & Temps réel', icon: <ShieldCheck className="h-4 w-4" /> },
      ],
    },
    {
      id: 'finance',
      label: 'Facturation & Comptabilité',
      items: [
        { key: 'finance', label: 'Finance & Compta', icon: <Calculator className="h-4 w-4" /> },
        { key: 'invoices', label: 'Factures', icon: <CreditCard className="h-4 w-4" /> },
      ],
    },
    {
      id: 'admin',
      label: 'Administration',
      items: [
        { key: 'audit', label: 'Journal d\'audit', icon: <ShieldCheck className="h-4 w-4" /> },
        { key: 'branding', label: 'Identité visuelle', icon: <Palette className="h-4 w-4" /> },
        { key: 'notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" />, badge: unreadCount },
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
          <p className="text-[10px]">Direction · Année 2025-2026</p>
        </div>
      }
    >
      {view === 'dashboard' && <DirectionHomeView data={data} onNavigate={setView} />}
      {view === 'announcements' && <AnnouncementsManager data={data} />}
      {view === 'requests' && <RequestsManager data={data} />}
      {view === 'finance' && <FinanceView data={financeData} schoolId={school.id} />}
      {view === 'supervision' && <AcademicSupervision data={supervisionData} />}
      {view === 'invoices' && <InvoicesView data={data} />}
      {view === 'audit' && <AuditLogView data={data} />}
      {view === 'branding' && <BrandingView school={school} />}
      {view === 'teacher-audit' && <DirectionTeacherAuditWrapper />}
      {view === 'notifications' && <DirectionNotificationsView notifications={notifications} />}
    </AppShell>
  )
}

// ============================================================
// Home
// ============================================================

function DirectionHomeView({ data, onNavigate }: { data: DirectionData; onNavigate: (v: string) => void }) {
  const k = data.kpis
  return (
    <div className="space-y-6">
      <PageHeader
        title="Tableau de bord direction"
        description="Vue d'ensemble de l'établissement."
        breadcrumbs={[{ label: 'Tableau de bord' }]}
        actions={
          <Button onClick={() => onNavigate('announcements')}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle annonce
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Élèves actifs" value={k.studentsCount} icon={<Users className="h-5 w-5" />} tone="primary" />
        <StatCard label="Familles" value={k.guardiansCount} icon={<Users className="h-5 w-5" />} tone="info" />
        <StatCard label="Demandes en cours" value={k.openRequests} icon={<MessageSquare className="h-5 w-5" />} tone={k.openRequests > 0 ? 'warning' : 'success'} />
        <StatCard label="Annonces" value={k.announcementsCount} icon={<Bell className="h-5 w-5" />} tone="tertiary" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
        <StatCard label="Montant encaissé" value={formatCurrency(k.collectedAmount, 'CDF')} icon={<TrendingUp className="h-5 w-5" />} tone="success" />
        <StatCard label="Solde impayé" value={formatCurrency(k.unpaidAmount, 'CDF')} icon={<CreditCard className="h-5 w-5" />} tone={k.unpaidAmount > 0 ? 'danger' : 'success'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Demandes récentes</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('requests')}>
              Voir tout
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.parentRequests.slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted/30">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.subject}</p>
                  <p className="text-xs text-muted-foreground">{r.requestNumber} · {r.guardian.firstName} {r.guardian.lastName} · {formatRelative(r.updatedAt)}</p>
                </div>
                <StatusBadge variant={REQUEST_STATUSES[r.status]?.tone}>
                  {REQUEST_STATUSES[r.status]?.label}
                </StatusBadge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Dernières annonces</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('announcements')}>
              Voir tout
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.announcements.slice(0, 5).map((a) => (
              <div key={a.id} className="p-2 rounded-md hover:bg-muted/30">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium truncate flex-1">{a.title}</p>
                  <StatusBadge variant={a.status === 'ARCHIVED' ? 'default' : 'success'}>
                    {a.status === 'ARCHIVED' ? 'Archivée' : 'Publiée'}
                  </StatusBadge>
                </div>
                <p className="text-xs text-muted-foreground">{formatRelative(a.publishedAt || a.createdAt)} · {a.targetType === 'ALL' ? 'Tous' : 'Classe'}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Derniers paiements encaissés</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.payments.slice(0, 5).map((p) => (
            <div key={p.id} className="flex items-center justify-between text-sm">
              <div>
                <p className="font-medium">{p.receiptNumber} · {p.invoice.student.firstName} {p.invoice.student.lastName}</p>
                <p className="text-xs text-muted-foreground">{PAYMENT_METHODS[p.method]} · {formatDate(p.paidAt)}</p>
              </div>
              <p className="font-semibold text-emerald-600 dark:text-emerald-400">+{formatCurrency(p.amount, 'CDF')}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// Annonces manager
// ============================================================

function AnnouncementsManager({ data }: { data: DirectionData }) {
  const [showCreate, setShowCreate] = React.useState(false)
  const [archiveState, archiveAction] = useActionState(archiveAnnouncementAction, null)

  React.useEffect(() => {
    if (archiveState && !archiveState.ok) toast.error(archiveState.error)
    if (archiveState?.ok) toast.success('Annonce archivée.')
  }, [archiveState])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion des annonces"
        description={`${data.announcements.length} annonce(s)`}
        breadcrumbs={[{ label: 'Espace direction' }, { label: 'Annonces' }]}
        actions={<Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" />Nouvelle annonce</Button>}
      />

      <div className="space-y-3">
        {data.announcements.map((a) => (
          <Card key={a.id} className="ss-shadow-card">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="font-semibold">{a.title}</p>
                    <StatusBadge variant={ANNOUNCEMENT_PRIORITIES[a.priority]?.tone}>{ANNOUNCEMENT_PRIORITIES[a.priority]?.label}</StatusBadge>
                    <StatusBadge variant={a.status === 'ARCHIVED' ? 'default' : 'success'}>
                      {a.status === 'ARCHIVED' ? 'Archivée' : 'Publiée'}
                    </StatusBadge>
                    {a.targetType === 'CLASSROOM' && a.classroom && (
                      <StatusBadge variant="outline">{a.classroom.name}</StatusBadge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{a.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Publié {formatRelative(a.publishedAt || a.createdAt)} · Cible : {a.targetType === 'ALL' ? 'Tout l\'établissement' : a.classroom?.name}
                  </p>
                </div>
                {a.status !== 'ARCHIVED' && (
                  <form action={archiveAction}>
                    <input type="hidden" name="announcementId" value={a.id} />
                    <Button type="submit" size="sm" variant="outline">
                      <Archive className="h-4 w-4 mr-1" />
                      Archiver
                    </Button>
                  </form>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <CreateAnnouncementDialog open={showCreate} onOpenChange={setShowCreate} schoolId={data.school.id} />
    </div>
  )
}

function CreateAnnouncementDialog({
  open, onOpenChange, schoolId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  schoolId: string
}) {
  const [state, formAction, isPending] = useActionState(createAnnouncementAction, null)

  React.useEffect(() => {
    if (state?.ok) {
      toast.success('Annonce publiée.')
      onOpenChange(false)
    } else if (state && !state.ok) {
      toast.error(state.error)
    }
  }, [state, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Nouvelle annonce</DialogTitle>
          <DialogDescription>
            L'annonce sera publiée immédiatement et notifiera les destinataires concernés.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="schoolId" value={schoolId} />

          <div className="space-y-2">
            <Label htmlFor="title">Titre</Label>
            <Input id="title" name="title" required placeholder="Ex: Échéance des frais de scolarité" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Contenu</Label>
            <Textarea id="content" name="content" rows={5} required placeholder="Saisissez le contenu de l'annonce…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="priority">Priorité</Label>
              <Select name="priority" defaultValue="NORMAL">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ANNOUNCEMENT_PRIORITIES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetType">Destinataires</Label>
              <Select name="targetType" defaultValue="ALL">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tout l'établissement</SelectItem>
                  <SelectItem value="DIRECTION">Direction uniquement</SelectItem>
                  <SelectItem value="CLASSROOM">Classe spécifique</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Publier
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Requests manager (direction)
// ============================================================

function RequestsManager({ data }: { data: DirectionData }) {
  const [selectedRequestId, setSelectedRequestId] = React.useState<string | null>(null)
  const selected = data.parentRequests.find((r) => r.id === selectedRequestId)

  return (
    <div className="space-y-6">
      <PageHeader title="Demandes parentales" description={`${data.parentRequests.length} demande(s) — ${data.kpis.openRequests} en cours`} breadcrumbs={[{ label: 'Espace direction' }, { label: 'Demandes' }]} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base">Toutes les demandes</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-[700px] overflow-y-auto">
            {data.parentRequests.length === 0 ? (
              <EmptyState title="Aucune demande" />
            ) : (
              data.parentRequests.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRequestId(r.id)}
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
                    {r.guardian.firstName} {r.guardian.lastName} · {formatRelative(r.updatedAt)}
                  </p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          {selected ? (
            <DirectionRequestDetail request={selected} />
          ) : (
            <CardContent className="py-12">
              <EmptyState icon={<MessageSquare className="h-5 w-5" />} title="Sélectionnez une demande" description="Cliquez sur une demande dans la liste pour consulter le fil de discussion et y répondre." />
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  )
}

function DirectionRequestDetail({ request }: { request: DirectionData['parentRequests'][number] }) {
  const [state, formAction, isPending] = useActionState(addRequestMessageAction, null)
  const [assignState, assignAction] = useActionState(assignRequestAction, null)
  const [internalMode, setInternalMode] = React.useState(false)

  React.useEffect(() => {
    if (state && !state.ok) toast.error(state.error)
    if (state?.ok) { toast.success('Réponse envoyée.'); setInternalMode(false) }
  }, [state])

  React.useEffect(() => {
    if (assignState && !assignState.ok) toast.error(assignState.error)
    if (assignState?.ok) toast.success('Statut mis à jour.')
  }, [assignState])

  return (
    <>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{request.subject}</CardTitle>
            <CardDescription>
              {request.requestNumber} · {REQUEST_CATEGORIES[request.category]} · {request.guardian.firstName} {request.guardian.lastName}
              {request.student && ` · Élève : ${request.student.firstName} ${request.student.lastName}`}
            </CardDescription>
          </div>
          <StatusBadge variant={REQUEST_STATUSES[request.status]?.tone}>
            {REQUEST_STATUSES[request.status]?.label}
          </StatusBadge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {request.status !== 'CLOSED' && (
            <>
              <form action={assignAction}>
                <input type="hidden" name="requestId" value={request.id} />
                <input type="hidden" name="status" value="IN_PROGRESS" />
                <Button type="submit" size="sm" variant="outline" disabled={request.status === 'IN_PROGRESS'}>
                  <Clock className="h-3 w-3 mr-1" />
                  Marquer en cours
                </Button>
              </form>
              <form action={assignAction}>
                <input type="hidden" name="requestId" value={request.id} />
                <input type="hidden" name="status" value="ANSWERED" />
                <Button type="submit" size="sm" variant="outline">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Marquer répondue
                </Button>
              </form>
              <form action={assignAction}>
                <input type="hidden" name="requestId" value={request.id} />
                <input type="hidden" name="status" value="CLOSED" />
                <Button type="submit" size="sm" variant="outline">
                  Clôturer
                </Button>
              </form>
            </>
          )}
        </div>

        <div className="space-y-3">
          {request.messages.map((m) => (
            <div key={m.id} className={`flex gap-3 ${m.authorRole === 'DIRECTION' ? 'justify-end' : ''}`}>
              {m.authorRole !== 'DIRECTION' && (
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {initials(m.authorName)}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className={`max-w-[80%] ${m.authorRole === 'DIRECTION' ? 'items-end' : ''}`}>
                <div className={`rounded-lg p-3 text-sm ${
                  m.authorRole === 'DIRECTION' ? 'bg-secondary text-secondary-foreground' : 'bg-muted'
                } ${m.isInternal ? 'border-2 border-dashed border-amber-400' : ''}`}>
                  {m.isInternal && <p className="text-[10px] uppercase font-semibold mb-1 opacity-80">Note interne (invisible au parent)</p>}
                  <p>{m.content}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {m.authorName} · {formatDateTime(m.createdAt)}
                </p>
              </div>
              {m.authorRole === 'DIRECTION' && (
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-secondary/10 text-secondary text-xs">
                    {initials(m.authorName)}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
        </div>

        {request.status !== 'CLOSED' && (
          <form action={formAction} className="space-y-2 pt-2 border-t border-border">
            <input type="hidden" name="requestId" value={request.id} />
            <input type="hidden" name="isInternal" value={internalMode ? 'true' : 'false'} />
            <div className="flex items-center justify-between">
              <Label htmlFor={`reply-${request.id}`}>Votre réponse</Label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={internalMode}
                  onChange={(e) => setInternalMode(e.target.checked)}
                  className="rounded border-border"
                />
                Note interne (invisible au parent)
              </label>
            </div>
            <Textarea
              id={`reply-${request.id}`}
              name="content"
              placeholder="Saisissez votre réponse…"
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

// ============================================================
// Invoices
// ============================================================

function InvoicesView({ data }: { data: DirectionData }) {
  const totalCollected = data.payments.reduce((s, p) => s + p.amount, 0)
  const totalUnpaid = data.invoices.filter((i) => i.status !== 'PAID' && i.status !== 'CANCELLED')
    .reduce((s, i) => s + (i.totalAmount - i.paidAmount), 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Factures et paiements"
        description={`${data.invoices.length} facture(s) · ${data.payments.length} paiement(s)`}
        breadcrumbs={[{ label: 'Espace direction' }, { label: 'Factures' }]}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total encaissé" value={formatCurrency(totalCollected, 'CDF')} icon={<TrendingUp className="h-5 w-5" />} tone="success" />
        <StatCard label="Total impayé" value={formatCurrency(totalUnpaid, 'CDF')} icon={<CreditCard className="h-5 w-5" />} tone={totalUnpaid > 0 ? 'danger' : 'success'} />
        <StatCard label="Factures" value={data.invoices.length} icon={<FileText className="h-5 w-5" />} tone="info" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Dernières factures</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.invoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between gap-3 p-3 rounded-md border border-border">
              <div className="min-w-0">
                <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                <p className="text-xs text-muted-foreground">
                  {inv.student?.firstName} {inv.student?.lastName} · Émise le {formatDate(inv.issueDate)} · Échéance {formatDate(inv.dueDate || inv.issueDate)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold">{formatCurrency(inv.totalAmount, inv.currency)}</p>
                <StatusBadge variant={INVOICE_STATUSES[inv.status]?.tone}>
                  {INVOICE_STATUSES[inv.status]?.label}
                </StatusBadge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// Audit log
// ============================================================

function AuditLogView({ data }: { data: DirectionData }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Journal d'audit"
        description={`${data.auditLogs.length} entrée(s) · Lecture seule`}
        breadcrumbs={[{ label: 'Espace direction' }, { label: 'Journal d\'audit' }]}
      />
      <Card>
        <CardContent className="p-0">
          {data.auditLogs.length === 0 ? (
            <EmptyState icon={<ShieldCheck className="h-5 w-5" />} title="Aucune entrée d'audit" />
          ) : (
            <ul className="divide-y divide-border">
              {data.auditLogs.map((log) => (
                <li key={log.id} className="p-4 flex items-start gap-3">
                  <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground text-xs shrink-0">
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{log.action}</p>
                      <span className="text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{log.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {log.userName || 'Système'} · {log.userRole || '—'} {log.entityType && `· ${log.entityType}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// Branding
// ============================================================

function BrandingView({ school }: { school: { id: string; name: string; slogan: string | null; primaryColor: string; secondaryColor: string; tertiaryColor: string } }) {
  const [state, formAction, isPending] = useActionState(updateBrandingAction, null)
  const [primary, setPrimary] = React.useState(school.primaryColor)
  const [secondary, setSecondary] = React.useState(school.secondaryColor)
  const [tertiary, setTertiary] = React.useState(school.tertiaryColor)
  const [name, setName] = React.useState(school.name)
  const [slogan, setSlogan] = React.useState(school.slogan || '')

  React.useEffect(() => {
    if (state && !state.ok) toast.error(state.error)
    if (state?.ok) toast.success('Branding mis à jour. Les couleurs seront appliquées après rechargement.')
  }, [state])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Identité visuelle"
        description="Personnalisez le branding de l'établissement (logo, couleurs, slogan)."
        breadcrumbs={[{ label: 'Espace direction' }, { label: 'Identité visuelle' }]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Configuration</CardTitle></CardHeader>
          <CardContent>
            <form action={formAction} className="space-y-4">
              <input type="hidden" name="schoolId" value={school.id} />
              <input type="hidden" name="primaryColor" value={primary} />
              <input type="hidden" name="secondaryColor" value={secondary} />
              <input type="hidden" name="tertiaryColor" value={tertiary} />

              <div className="space-y-2">
                <Label htmlFor="schoolName">Nom de l'établissement</Label>
                <Input id="schoolName" name="schoolName" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slogan">Slogan</Label>
                <Textarea id="slogan" name="slogan" value={slogan} onChange={(e) => setSlogan(e.target.value)} rows={2} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <ColorField label="Couleur primaire" value={primary} onChange={setPrimary} name="primaryColorDisplay" />
                <ColorField label="Couleur secondaire" value={secondary} onChange={setSecondary} name="secondaryColorDisplay" />
                <ColorField label="Couleur tertiaire" value={tertiary} onChange={setTertiary} name="tertiaryColorDisplay" />
              </div>

              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Palette className="h-4 w-4 mr-2" />}
                Publier le branding
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Aperçu</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Preview banner */}
              <div
                className="rounded-lg p-6 text-white"
                style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
              >
                <p className="text-lg font-semibold">{name}</p>
                <p className="text-sm opacity-90">{slogan || 'Slogan de l\'établissement'}</p>
              </div>

              {/* Preview buttons */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Boutons</p>
                <div className="flex flex-wrap gap-2">
                  <Button style={{ backgroundColor: primary, borderColor: primary }}>Primaire</Button>
                  <Button style={{ backgroundColor: secondary, borderColor: secondary }}>Secondaire</Button>
                  <Button style={{ backgroundColor: tertiary, borderColor: tertiary }}>Accent</Button>
                </div>
              </div>

              {/* Preview cards */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Cartes d'indicateurs</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-md border border-border p-3">
                    <div className="h-8 w-8 rounded-md mb-2" style={{ backgroundColor: primary + '20', color: primary }}>
                      <div className="h-full w-full flex items-center justify-center text-xs font-bold">P</div>
                    </div>
                    <p className="text-xs text-muted-foreground">Primaire</p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <div className="h-8 w-8 rounded-md mb-2" style={{ backgroundColor: secondary + '20', color: secondary }}>
                      <div className="h-full w-full flex items-center justify-center text-xs font-bold">S</div>
                    </div>
                    <p className="text-xs text-muted-foreground">Secondaire</p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <div className="h-8 w-8 rounded-md mb-2" style={{ backgroundColor: tertiary + '20', color: tertiary }}>
                      <div className="h-full w-full flex items-center justify-center text-xs font-bold">T</div>
                    </div>
                    <p className="text-xs text-muted-foreground">Tertiaire</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ColorField({ label, value, onChange, name }: { label: string; value: string; onChange: (v: string) => void; name: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-8 rounded border border-border cursor-pointer"
          aria-label={label}
        />
        <Input
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-xs"
        />
      </div>
    </div>
  )
}

// ============================================================
// Notifications (direction)
// ============================================================

function DirectionNotificationsView({ notifications }: { notifications: Notification[] }) {
  const [state, formAction] = useActionState(markNotificationReadAction, null)
  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={`${unreadCount} non lue(s) sur ${notifications.length}`}
        breadcrumbs={[{ label: 'Espace direction' }, { label: 'Notifications' }]}
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

// ============================================================
// Wrapper : Audit Prof & Temps réel (fetch côté client)
// ============================================================

function DirectionTeacherAuditWrapper() {
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const loadData = React.useCallback(async () => {
    try {
      const response = await fetch('/api/direction/audit-data', { cache: 'no-store' })
      const result = await response.json()
      if (result.ok) {
        // Reconvertir les dates ISO en Date
        setData({
          ...result,
          lessonLogs: result.lessonLogs.map((l: any) => ({ ...l, sessionDate: new Date(l.sessionDate), auditedAt: l.auditedAt ? new Date(l.auditedAt) : null })),
          liveClasses: result.liveClasses.map((c: any) => ({ ...c, startDateTime: new Date(c.startDateTime), endDateTime: new Date(c.endDateTime), signatureAt: c.signatureAt ? new Date(c.signatureAt) : null, directorNotifiedAt: c.directorNotifiedAt ? new Date(c.directorNotifiedAt) : null })),
          incidents: result.incidents.map((i: any) => ({ ...i, createdAt: new Date(i.createdAt) })),
          emargementsToday: result.emargementsToday.map((e: any) => ({ ...e, signatureAt: new Date(e.signatureAt), startDateTime: new Date(e.startDateTime), endDateTime: new Date(e.endDateTime) })),
          stats: { ...result.stats, timestamp: new Date(result.stats.timestamp) },
        })
        setError(null)
      } else {
        setError(result.error || 'Erreur inconnue')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadData()
    // Auto-refresh toutes les 30 secondes pour la vue temps réel
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [loadData])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-3 text-sm text-muted-foreground">Chargement des données temps réel...</p>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-red-600">⚠️ Erreur : {error}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={loadData}>Réessayer</Button>
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Prof & Temps réel"
        description="Surveillez en temps réel l'activité des enseignants, consultez le cahier de textes et traitez les incidents signalés."
        breadcrumbs={[{ label: 'Direction' }, { label: 'Audit Prof' }]}
      />
      <DirectionAuditView
        lessonLogs={data.lessonLogs}
        liveClasses={data.liveClasses}
        incidents={data.incidents}
        emargementsToday={data.emargementsToday}
        stats={data.stats}
        teachers={data.teachers}
        subjects={data.subjects}
      />
    </div>
  )
}
