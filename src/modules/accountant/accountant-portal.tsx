'use client'

import * as React from 'react'
import { AppShell, NavSection } from '@/components/ss/app-shell'
import { PageHeader } from '@/components/ss/page-header'
import { StatCard } from '@/components/ss/stat-card'
import { StatusBadge } from '@/components/ss/status-badge'
import { EmptyState } from '@/components/ss/empty-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Home, Receipt, FileText, AlertTriangle, TrendingUp, Wallet,
  Bell, Mail, Users, CheckCircle2,
} from 'lucide-react'
import { logoutAction } from '@/lib/actions'
import { formatCents, formatDate, formatRelative } from '@/lib/format'
import { toast } from 'sonner'

type AccountantData = NonNullable<Awaited<ReturnType<typeof import('@/lib/accountant-portal-queries').getAccountantPortalData>>>

export function AccountantPortal({
  user, schoolName, data,
}: {
  user: { displayName: string; role: string; email: string }
  schoolName: string
  data: AccountantData
}) {
  const [view, setView] = React.useState('dashboard')
  const [tab, setTab] = React.useState('encashments')

  const sections: NavSection[] = [{
    id: 'main', label: 'Portail Comptable',
    items: [
      { key: 'dashboard', label: 'Tableau de bord', icon: <Home className="h-4 w-4" /> },
      { key: 'encash', label: 'Encaissements', icon: <Receipt className="h-4 w-4" /> },
      { key: 'lines', label: 'Lignes de frais', icon: <FileText className="h-4 w-4" /> },
      { key: 'alerts', label: 'Élèves en litige', icon: <AlertTriangle className="h-4 w-4" />, badge: data.pendingStudents.length },
      { key: 'notifications', label: 'Notifications', icon: <Mail className="h-4 w-4" /> },
    ],
  }]

  return (
    <AppShell
      user={user} schoolName={schoolName} unreadNotifications={0}
      sections={sections} activeView={view} onNavigate={setView}
      onLogout={logoutAction}
      onOpenNotifications={() => setView('notifications')}
      onOpenSearch={() => toast.info('Recherche à venir')}
      sidebarFooter={<div><p>{schoolName}</p><p className="text-[10px]">Comptable</p></div>}
    >
      {view === 'dashboard' && (
        <div className="space-y-6">
          <PageHeader title="Tableau de bord comptable" breadcrumbs={[{ label: 'Comptable' }]} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total encaissé" value={formatCents(data.stats.totalCollectedCents, 'CDF')} icon={<TrendingUp className="h-5 w-5" />} tone="success" />
            <StatCard label="Encaissements" value={data.stats.totalEncashments} icon={<Receipt className="h-5 w-5" />} tone="primary" />
            <StatCard label="Lignes de frais" value={data.invoiceLineConfigs.length} icon={<FileText className="h-5 w-5" />} tone="info" />
            <StatCard label="En litige" value={data.stats.pendingCount} icon={<AlertTriangle className="h-5 w-5" />} tone={data.stats.pendingCount > 0 ? 'danger' : 'success'} />
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Derniers encaissements</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {data.recentEncashments.length === 0 ? <EmptyState title="Aucun encaissement" /> : (
                data.recentEncashments.slice(0, 10).map((e) => (
                  <div key={e.id} className="flex items-center justify-between text-sm p-2 rounded-md border border-border">
                    <div><p className="font-medium">{e.receiptNumber}</p><p className="text-xs text-muted-foreground">{e.lineName} · {e.studentName}</p></div>
                    <div className="text-right"><p className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCents(e.amountCents, 'CDF')}</p><p className="text-xs text-muted-foreground">{formatDate(e.encashedAt)}</p></div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
      {view === 'encash' && (
        <div className="space-y-6">
          <PageHeader title="Encaissements" description="Validez un encaissement contre une ligne de frais existante" breadcrumbs={[{ label: 'Comptable' }, { label: 'Encaissements' }]} />
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList><TabsTrigger value="encashments">Historique</TabsTrigger><TabsTrigger value="new">Nouvel encaissement</TabsTrigger></TabsList>
            <TabsContent value="encashments">
              <Card><CardContent className="space-y-2">
                {data.recentEncashments.length === 0 ? <EmptyState title="Aucun encaissement" /> : (
                  data.recentEncashments.map((e) => (
                    <div key={e.id} className="flex items-center justify-between p-3 rounded-md border border-border">
                      <div><p className="text-sm font-medium">{e.receiptNumber}</p><p className="text-xs text-muted-foreground">{e.lineName} · {e.studentName} · {e.paymentMethod}</p></div>
                      <div className="text-right"><p className="font-semibold">{formatCents(e.amountCents, 'CDF')}</p><StatusBadge variant={e.status === 'CONFIRMED' ? 'success' : 'danger'}>{e.status}</StatusBadge></div>
                    </div>
                  ))
                )}
              </CardContent></Card>
            </TabsContent>
            <TabsContent value="new">
              <Card><CardContent>
                <form className="space-y-4">
                  <div className="space-y-2"><Label>Ligne de frais</Label><Select name="invoiceLineConfigId"><SelectTrigger><SelectValue placeholder="Sélectionner une ligne" /></SelectTrigger><SelectContent>{data.invoiceLineConfigs.map((l) => (<SelectItem key={l.id} value={l.id}>{l.name} — {formatCents(l.amountCents, 'CDF')}</SelectItem>))}</SelectContent></Select></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label htmlFor="amount">Montant (CDF)</Label><Input id="amount" name="amount" type="number" placeholder="50000" /></div>
                    <div className="space-y-2"><Label>Méthode</Label><Select name="method" defaultValue="CASH"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CASH">Espèces</SelectItem><SelectItem value="BANK">Banque</SelectItem><SelectItem value="MOBILE_MONEY">Mobile Money</SelectItem></SelectContent></Select></div>
                  </div>
                  <div className="space-y-2"><Label htmlFor="payerName">Nom du payeur</Label><Input id="payerName" name="payerName" placeholder="Jean Mbumba" /></div>
                  <Button type="submit"><Receipt className="h-4 w-4 mr-2" />Valider l'encaissement</Button>
                </form>
              </CardContent></Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
      {view === 'lines' && (
        <div className="space-y-6">
          <PageHeader title="Lignes de frais" description="Configurées par le Directeur. Le comptable ne peut qu'encaisser." breadcrumbs={[{ label: 'Comptable' }, { label: 'Lignes de frais' }]} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.invoiceLineConfigs.map((l) => (
              <Card key={l.id}><CardContent className="p-4">
                <div className="flex items-center justify-between mb-2"><StatusBadge variant={l.isMandatory ? 'danger' : 'default'}>{l.isMandatory ? 'Obligatoire' : 'Optionnel'}</StatusBadge><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{l.code}</code></div>
                <p className="font-semibold">{l.name}</p>
                <p className="text-2xl font-bold text-primary mt-1">{formatCents(l.amountCents, 'CDF')}</p>
                <p className="text-xs text-muted-foreground mt-1">{l.directorateName}{l.period && ` · ${l.period}`}</p>
              </CardContent></Card>
            ))}
          </div>
        </div>
      )}
      {view === 'alerts' && (
        <div className="space-y-6">
          <PageHeader title="Élèves en litige de paiement" description="Statut bloqué — alerte automatique envoyée aux professeurs" breadcrumbs={[{ label: 'Comptable' }, { label: 'Litiges' }]} />
          <Card><CardContent className="space-y-2">
            {data.pendingStudents.length === 0 ? <EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title="Aucun litige" description="Tous les élèves sont à jour" /> : (
              data.pendingStudents.map((p) => (
                <div key={p.studentId} className="flex items-center justify-between p-3 rounded-md border border-border">
                  <div><p className="text-sm font-medium">{p.studentName}</p><p className="text-xs text-muted-foreground">{p.classroomName} · {p.directorateName}</p></div>
                  <div className="text-right"><StatusBadge variant="danger">{p.status}</StatusBadge><p className="text-xs text-muted-foreground mt-1">{p.reason}</p></div>
                </div>
              ))
            )}
          </CardContent></Card>
        </div>
      )}
      {view === 'notifications' && <div className="space-y-6"><PageHeader title="Notifications" breadcrumbs={[{ label: 'Comptable' }, { label: 'Notifications' }]} /><Card><CardContent className="py-12"><EmptyState icon={<Mail className="h-5 w-5" />} title="Aucune notification" /></CardContent></Card></div>}
    </AppShell>
  )
}
