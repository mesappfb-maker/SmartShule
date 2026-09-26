'use client'

// SmartShule — Portail Auditeur (AUDITOR)
// =====================================================
// Portail interactif en lecture seule : Vue de contrôle,
// Journal audit, Connexions, Accès refusés, Données (élèves,
// finances, personnel, documents).

import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/ss/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  LayoutDashboard, ScrollText, LogIn, ShieldX, Users, DollarSign,
  Wallet, FileText, LogOut, RefreshCw, Search, Lock, Eye,
} from 'lucide-react'

type View =
  | 'overview' | 'audit-log' | 'logins' | 'access-denied'
  | 'students' | 'finances' | 'hr' | 'documents'

interface NavItem {
  id: View
  label: string
  icon: typeof LayoutDashboard
  group: 'Audit' | 'Données'
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Vue de contrôle', icon: LayoutDashboard, group: 'Audit' },
  { id: 'audit-log', label: 'Journal audit', icon: ScrollText, group: 'Audit' },
  { id: 'logins', label: 'Connexions', icon: LogIn, group: 'Audit' },
  { id: 'access-denied', label: 'Accès refusés', icon: ShieldX, group: 'Audit' },
  { id: 'students', label: 'Élèves', icon: Users, group: 'Données' },
  { id: 'finances', label: 'Finances', icon: DollarSign, group: 'Données' },
  { id: 'hr', label: 'Personnel', icon: Wallet, group: 'Données' },
  { id: 'documents', label: 'Documents', icon: FileText, group: 'Données' },
]

interface AuditorPortalProps {
  user: { displayName: string; role: string; email: string }
  schoolName: string
  initialData: AuditorData
}

export interface AuditorData {
  activeStudents: number
  totalStudents: number
  totalEmployees: number
  teachersCount: number
  totalInvoiced: number
  totalCollected: number
  totalUnpaid: number
  expectedPayroll: number
}

export function AuditorPortal({ user, schoolName, initialData }: AuditorPortalProps) {
  const [view, setView] = useState<View>('overview')
  const [collapsed, setCollapsed] = useState(false)
  const groups: NavItem['group'][] = ['Audit', 'Données']

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className={`${collapsed ? 'w-16' : 'w-64'} border-r border-border bg-muted/30 flex-col hidden md:flex shrink-0 transition-all`}>
        <div className="p-4 border-b border-border flex items-center justify-between">
          {!collapsed && (
            <div>
              <p className="font-semibold text-sm">SmartShule</p>
              <p className="text-xs text-muted-foreground">Auditeur</p>
            </div>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCollapsed(!collapsed)}>
            <LayoutDashboard className="h-4 w-4" />
          </Button>
        </div>
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {groups.map(group => (
            <div key={group}>
              {!collapsed && <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase">{group}</div>}
              {NAV_ITEMS.filter(i => i.group === group).map(item => {
                const Icon = item.icon
                const isActive = view === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => setView(item.id)}
                    title={item.label}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                      isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
              <LogOut className="h-3 w-3" />
              {!collapsed && <span>Se déconnecter</span>}
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          <PortalContent view={view} schoolName={schoolName} initialData={initialData} onNavigate={setView} />
        </div>
      </div>
    </div>
  )
}

function PortalContent({
  view, schoolName, initialData, onNavigate,
}: {
  view: View
  schoolName: string
  initialData: AuditorData
  onNavigate: (v: View) => void
}) {
  switch (view) {
    case 'overview': return <OverviewView data={initialData} schoolName={schoolName} onNavigate={onNavigate} />
    case 'audit-log': return <AuditLogView />
    case 'logins': return <LoginsView />
    case 'access-denied': return <AccessDeniedView />
    case 'students': return <StudentsView />
    case 'finances': return <FinancesView />
    case 'hr': return <HrView />
    case 'documents': return <DocumentsView />
  }
}

function OverviewView({
  data, schoolName, onNavigate,
}: {
  data: AuditorData
  schoolName: string
  onNavigate: (v: View) => void
}) {
  return (
    <>
      <PageHeader
        title="Auditeur — Vue de contrôle"
        breadcrumbs={[{ label: 'SmartShule' }, { label: 'Auditeur' }, { label: 'Vue de contrôle' }]}
        actions={<span className="text-xs text-muted-foreground">{schoolName}</span>}
      />
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Élèves actifs" value={data.activeStudents} sub={`${data.totalStudents} total`} icon={Users} onClick={() => onNavigate('students')} />
        <StatCard label="Total facturé" value={formatFC(data.totalInvoiced)} sub="FC" icon={DollarSign} onClick={() => onNavigate('finances')} />
        <StatCard label="Total encaissé" value={formatFC(data.totalCollected)} sub="FC" icon={DollarSign} onClick={() => onNavigate('finances')} />
        <StatCard label="Impayés" value={formatFC(data.totalUnpaid)} sub="FC" icon={DollarSign} onClick={() => onNavigate('finances')} />
        <StatCard label="Employés" value={data.totalEmployees} sub={`${data.teachersCount} enseignants`} icon={Wallet} onClick={() => onNavigate('hr')} />
        <StatCard label="Masse salariale" value={formatFC(data.expectedPayroll)} sub="FC" icon={Wallet} />
      </div>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <Lock className="h-3 w-3 inline mr-1" />
            Vue Auditeur — lecture seule. Aucune modification possible. L'auditeur ne voit pas les données médicales, disciplinaires ou messages privés.
          </p>
        </CardContent>
      </Card>
    </>
  )
}

function AuditLogView() {
  const { data, loading, error, reload } = useFetch<{ logs: AuditRow[]; total: number }>('/api/admin/audit?limit=200')
  const [search, setSearch] = useState('')
  const logs = data?.logs ?? []
  const filtered = logs.filter(l =>
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    (l.userName || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <PageHeader
        title="Journal d'audit"
        breadcrumbs={[{ label: 'SmartShule' }, { label: 'Auditeur' }, { label: 'Journal audit' }]}
        actions={<Button variant="outline" size="sm" onClick={reload}><RefreshCw className="h-4 w-4 mr-2" /> Actualiser</Button>}
      />
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{data?.total ?? 0} événement(s)</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-64 w-full" /> : error ? <ErrorBox error={error} /> : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-2">
                {filtered.map(log => (
                  <div key={log.id} className="flex items-start gap-3 p-3 rounded-md border">
                    <Badge variant={getActionVariant(log.action)} className="font-mono text-xs">{log.action}</Badge>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{log.userName || 'Anonyme'}</span>
                        {log.target && <span className="text-muted-foreground">→ {log.target}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(log.createdAt).toLocaleString('fr-FR')}
                        {log.ip && <span className="ml-2 font-mono">{log.ip}</span>}
                      </div>
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && <div className="py-8 text-center text-muted-foreground">Aucun événement.</div>}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function LoginsView() {
  const { data, loading, error, reload } = useFetch<{ logs: AuditRow[] }>('/api/admin/audit?limit=200&action=LOGIN_SUCCESS')
  // Note: l'API ne filtre pas par action exacte — on filtre côté client
  const logs = (data?.logs ?? []).filter(l => l.action === 'LOGIN_SUCCESS' || l.action === 'LOGIN' || l.action === 'LOGIN_FAILED' || l.action === 'LOGOUT')

  return (
    <>
      <PageHeader
        title="Connexions récentes"
        breadcrumbs={[{ label: 'SmartShule' }, { label: 'Auditeur' }, { label: 'Connexions' }]}
        actions={<Button variant="outline" size="sm" onClick={reload}><RefreshCw className="h-4 w-4 mr-2" /> Actualiser</Button>}
      />
      <Card>
        <CardHeader><CardTitle className="text-base">{logs.length} événement(s) de connexion</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-64 w-full" /> : error ? <ErrorBox error={error} /> : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {logs.map(log => (
                  <div key={log.id} className="p-3 border rounded-md flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{log.userName || 'Inconnu'}</p>
                      <p className="text-xs text-muted-foreground">{log.ip || 'IP inconnue'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={log.action === 'LOGIN_FAILED' ? 'destructive' : 'secondary'}>{log.action}</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString('fr-FR')}</span>
                    </div>
                  </div>
                ))}
                {logs.length === 0 && <div className="py-8 text-center text-muted-foreground">Aucune connexion.</div>}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function AccessDeniedView() {
  const { data, loading, error, reload } = useFetch<{ logs: AuditRow[] }>('/api/admin/audit?limit=200')
  const logs = (data?.logs ?? []).filter(l => l.action.includes('DENIED') || l.action.includes('FORBIDDEN') || l.action.includes('UNAUTHORIZED'))

  return (
    <>
      <PageHeader
        title="Accès refusés"
        breadcrumbs={[{ label: 'SmartShule' }, { label: 'Auditeur' }, { label: 'Accès refusés' }]}
        actions={<Button variant="outline" size="sm" onClick={reload}><RefreshCw className="h-4 w-4 mr-2" /> Actualiser</Button>}
      />
      <Card>
        <CardHeader><CardTitle className="text-base">{logs.length} accès refusé(s)</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-64 w-full" /> : error ? <ErrorBox error={error} /> : (
            <div className="space-y-2">
              {logs.map(log => (
                <div key={log.id} className="p-3 border rounded-md flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{log.userName || 'Inconnu'}</p>
                    <p className="text-xs text-muted-foreground">{log.target}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">{log.action}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString('fr-FR')}</span>
                  </div>
                </div>
              ))}
              {logs.length === 0 && <div className="py-8 text-center text-muted-foreground">Aucun accès refusé enregistré. 🎉</div>}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function StudentsView() {
  const { data, loading, error, reload } = useFetch<{ stats: { total: number; active: number; inactive: number; graduated: number } }>('/api/auditor/dashboard?view=students')
  return (
    <>
      <PageHeader
        title="Données élèves (lecture seule)"
        breadcrumbs={[{ label: 'SmartShule' }, { label: 'Auditeur' }, { label: 'Élèves' }]}
        actions={<Button variant="outline" size="sm" onClick={reload}><RefreshCw className="h-4 w-4 mr-2" /> Actualiser</Button>}
      />
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <StatCard label="Total" value={data?.stats.total ?? 0} icon={Users} />
        <StatCard label="Actifs" value={data?.stats.active ?? 0} icon={Eye} />
        <StatCard label="Inactifs" value={data?.stats.inactive ?? 0} icon={Users} />
        <StatCard label="Diplômés" value={data?.stats.graduated ?? 0} icon={Users} />
      </div>
      {loading && <Skeleton className="h-32 w-full" />}
      {error && <ErrorBox error={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <Lock className="h-3 w-3 inline mr-1" />
            Données agrégées uniquement — pas de détails individuels médicaux, disciplinaires ou messages privés.
          </p>
        </CardContent>
      </Card>
    </>
  )
}

function FinancesView() {
  const { data, loading, error, reload } = useFetch<{ stats: { invoiced: number; collected: number; unpaid: number; overdue: number } }>('/api/auditor/dashboard?view=finances')
  return (
    <>
      <PageHeader
        title="Finances (lecture seule)"
        breadcrumbs={[{ label: 'SmartShule' }, { label: 'Auditeur' }, { label: 'Finances' }]}
        actions={<Button variant="outline" size="sm" onClick={reload}><RefreshCw className="h-4 w-4 mr-2" /> Actualiser</Button>}
      />
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <StatCard label="Total facturé" value={formatFC(data?.stats.invoiced ?? 0)} sub="FC" icon={DollarSign} />
        <StatCard label="Encaissé" value={formatFC(data?.stats.collected ?? 0)} sub="FC" icon={DollarSign} />
        <StatCard label="Impayés" value={formatFC(data?.stats.unpaid ?? 0)} sub="FC" icon={DollarSign} />
        <StatCard label="Échus" value={data?.stats.overdue ?? 0} sub="factures" icon={DollarSign} />
      </div>
      {loading && <Skeleton className="h-32 w-full" />}
      {error && <ErrorBox error={error} />}
    </>
  )
}

function HrView() {
  const { data, loading, error, reload } = useFetch<{ stats: { total: number; teachers: number; admin: number; support: number } }>('/api/auditor/dashboard?view=hr')
  return (
    <>
      <PageHeader
        title="Personnel (lecture seule)"
        breadcrumbs={[{ label: 'SmartShule' }, { label: 'Auditeur' }, { label: 'Personnel' }]}
        actions={<Button variant="outline" size="sm" onClick={reload}><RefreshCw className="h-4 w-4 mr-2" /> Actualiser</Button>}
      />
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <StatCard label="Total personnel" value={data?.stats.total ?? 0} icon={Wallet} />
        <StatCard label="Enseignants" value={data?.stats.teachers ?? 0} icon={Wallet} />
        <StatCard label="Administratif" value={data?.stats.admin ?? 0} icon={Wallet} />
        <StatCard label="Soutien" value={data?.stats.support ?? 0} icon={Wallet} />
      </div>
      {loading && <Skeleton className="h-32 w-full" />}
      {error && <ErrorBox error={error} />}
    </>
  )
}

function DocumentsView() {
  const { data, loading, error, reload } = useFetch<{ stats: { total: number; thisMonth: number; byType: Array<{ type: string; count: number }> } }>('/api/auditor/dashboard?view=documents')
  return (
    <>
      <PageHeader
        title="Documents (lecture seule)"
        breadcrumbs={[{ label: 'SmartShule' }, { label: 'Auditeur' }, { label: 'Documents' }]}
        actions={<Button variant="outline" size="sm" onClick={reload}><RefreshCw className="h-4 w-4 mr-2" /> Actualiser</Button>}
      />
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
        <StatCard label="Total documents" value={data?.stats.total ?? 0} icon={FileText} />
        <StatCard label="Ce mois" value={data?.stats.thisMonth ?? 0} icon={FileText} />
        <StatCard label="Types" value={(data?.stats.byType ?? []).length} icon={FileText} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Documents par type</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-32 w-full" /> : error ? <ErrorBox error={error} /> : (
            <div className="space-y-2">
              {(data?.stats.byType ?? []).map(t => (
                <div key={t.type} className="flex items-center justify-between p-2 border rounded">
                  <span className="font-mono text-xs">{t.type}</span>
                  <Badge>{t.count}</Badge>
                </div>
              ))}
              {(data?.stats.byType ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">Aucun document.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

// =====================================================
// Types & utilitaires
// =====================================================

interface AuditRow {
  id: string
  action: string
  userName: string | null
  target: string | null
  ip: string | null
  details: unknown
  createdAt: string
}

function getActionVariant(action: string): 'default' | 'destructive' | 'secondary' | 'outline' {
  if (action.includes('FAILED') || action.includes('DENIED') || action.includes('DELETE')) return 'destructive'
  if (action.includes('CREATE') || action.includes('UPDATE')) return 'default'
  if (action.includes('LOGIN') || action.includes('LOGOUT')) return 'secondary'
  return 'outline'
}

function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(url)
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Erreur API')
      setData(json.data ?? json)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [url])

  useEffect(() => { reload() }, [reload])
  return { data, loading, error, reload }
}

function formatFC(cents: number): string {
  return Math.round((cents || 0) / 100).toLocaleString('fr-FR')
}

function StatCard({
  label, value, sub, icon: Icon, onClick,
}: {
  label: string
  value: number | string
  sub?: string
  icon?: typeof LayoutDashboard
  onClick?: () => void
}) {
  return (
    <div onClick={onClick} className={`p-4 rounded-lg border bg-card ${onClick ? 'cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
      </div>
    </div>
  )
}

function ErrorBox({ error }: { error: string }) {
  return (
    <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-md border border-red-200 dark:border-red-800">
      <div className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4 text-red-600 dark:text-red-400" />
        <p className="text-sm font-medium text-red-700 dark:text-red-300">Erreur de chargement</p>
      </div>
      <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-mono">{error}</p>
    </div>
  )
}
