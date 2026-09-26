'use client'

// SmartShule — Portail Promoteur (PROMOTER)
// =====================================================
// Portail interactif : Vue stratégique, Croissance, Admissions,
// Recettes, Dépenses, Impayés, Budget, Alertes, Décisions, Rapports.
// Données agrégées uniquement, pas de détails individuels.

import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/ss/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  LayoutDashboard, TrendingUp, UserPlus, DollarSign, Wallet,
  AlertCircle, Target, AlertTriangle, FileText, LogOut, RefreshCw,
  ArrowUpRight, ArrowDownRight, Calendar,
} from 'lucide-react'

type View =
  | 'overview' | 'growth' | 'admissions' | 'revenue' | 'expenses'
  | 'unpaid' | 'budget' | 'alerts' | 'decisions' | 'reports-monthly' | 'reports-annual'

interface NavItem {
  id: View
  label: string
  icon: typeof LayoutDashboard
  group: 'Stratégie' | 'Finance' | 'Risques' | 'Rapports'
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Vue stratégique', icon: LayoutDashboard, group: 'Stratégie' },
  { id: 'growth', label: 'Croissance', icon: TrendingUp, group: 'Stratégie' },
  { id: 'admissions', label: 'Admissions', icon: UserPlus, group: 'Stratégie' },
  { id: 'revenue', label: 'Recettes', icon: DollarSign, group: 'Finance' },
  { id: 'expenses', label: 'Dépenses', icon: Wallet, group: 'Finance' },
  { id: 'unpaid', label: 'Impayés', icon: AlertCircle, group: 'Finance' },
  { id: 'budget', label: 'Budget', icon: Target, group: 'Finance' },
  { id: 'alerts', label: 'Alertes', icon: AlertTriangle, group: 'Risques' },
  { id: 'decisions', label: 'Décisions', icon: FileText, group: 'Risques' },
  { id: 'reports-monthly', label: 'Mensuel', icon: Calendar, group: 'Rapports' },
  { id: 'reports-annual', label: 'Annuel', icon: Calendar, group: 'Rapports' },
]

interface PromoterPortalProps {
  user: { displayName: string; role: string; email: string }
  schoolName: string
  initialData: PromoterData
}

export interface PromoterData {
  totalStudents: number
  activeStudents: number
  newStudentsThisMonth: number
  totalEmployees: number
  teachersCount: number
  totalInvoiced: number
  totalCollected: number
  totalUnpaid: number
  collectionRate: number
  receiptsMonth: number
  expensesMonth: number
  expensesYear: number
  pendingExpenses: { count: number; amount: number }
  overdueInvoices: number
  expectedPayroll: number
  budgetAnnual: number
  budgetConsumed: number
  budgetPct: number
  risks: Array<{ level: string; message: string }>
}

export function PromoterPortal({ user, schoolName, initialData }: PromoterPortalProps) {
  const [view, setView] = useState<View>('overview')
  const [collapsed, setCollapsed] = useState(false)
  const groups: NavItem['group'][] = ['Stratégie', 'Finance', 'Risques', 'Rapports']

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className={`${collapsed ? 'w-16' : 'w-64'} border-r border-border bg-muted/30 flex-col hidden md:flex shrink-0 transition-all`}>
        <div className="p-4 border-b border-border flex items-center justify-between">
          {!collapsed && (
            <div>
              <p className="font-semibold text-sm">SmartShule</p>
              <p className="text-xs text-muted-foreground">Promoteur</p>
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
  initialData: PromoterData
  onNavigate: (v: View) => void
}) {
  switch (view) {
    case 'overview': return <OverviewView data={initialData} schoolName={schoolName} onNavigate={onNavigate} />
    case 'growth': return <GrowthView />
    case 'admissions': return <AdmissionsView />
    case 'revenue': return <RevenueView />
    case 'expenses': return <ExpensesView />
    case 'unpaid': return <UnpaidView />
    case 'budget': return <BudgetView data={initialData} />
    case 'alerts': return <AlertsView data={initialData} />
    case 'decisions': return <DecisionsView />
    case 'reports-monthly': return <ReportsView period="monthly" />
    case 'reports-annual': return <ReportsView period="annual" />
  }
}

function OverviewView({
  data, schoolName, onNavigate,
}: {
  data: PromoterData
  schoolName: string
  onNavigate: (v: View) => void
}) {
  return (
    <>
      <PageHeader
        title="Promoteur — Vue stratégique"
        breadcrumbs={[{ label: 'SmartShule' }, { label: 'Promoteur' }, { label: 'Vue stratégique' }]}
        actions={<span className="text-xs text-muted-foreground">{schoolName}</span>}
      />
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Élèves actifs" value={data.activeStudents} sub={`${data.newStudentsThisMonth} nouveaux ce mois`} icon={TrendingUp} onClick={() => onNavigate('growth')} />
        <StatCard label="Total facturé" value={formatFC(data.totalInvoiced)} sub="FC" icon={ArrowUpRight} onClick={() => onNavigate('revenue')} />
        <StatCard label="Total encaissé" value={formatFC(data.totalCollected)} sub="FC" icon={DollarSign} onClick={() => onNavigate('revenue')} />
        <StatCard label="Impayés" value={formatFC(data.totalUnpaid)} sub="FC" icon={ArrowDownRight} onClick={() => onNavigate('unpaid')} />
        <StatCard label="Taux recouvrement" value={`${data.collectionRate}`} sub="%" icon={Target} onClick={() => onNavigate('revenue')} />
        <StatCard label="Employés" value={data.totalEmployees} sub={`${data.teachersCount} enseignants`} icon={Wallet} />
        <StatCard label="Masse salariale" value={formatFC(data.expectedPayroll)} sub="FC" icon={Wallet} />
        <StatCard label="Budget consommé" value={`${data.budgetPct}`} sub="%" icon={Target} onClick={() => onNavigate('budget')} />
      </div>

      {data.risks.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Risques et alertes</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.risks.map((risk, i) => (
              <div key={i} className={`p-3 rounded-lg border flex items-start gap-2 ${
                risk.level === 'CRITICAL' ? 'border-red-200 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300' :
                risk.level === 'HIGH' ? 'border-orange-200 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300' :
                'border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300'
              }`}>
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-sm">{risk.level}</span>: <span className="text-sm">{risk.message}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            Dashboard stratégique PROMOTEUR — données agrégées uniquement. Le promoteur ne crée pas de factures, n'encaisse pas, ne modifie pas les notes. Il valide les grandes décisions (budget, investissements, dépenses hors seuil).
          </p>
        </CardContent>
      </Card>
    </>
  )
}

function GrowthView() {
  const { data, loading, error } = useFetch<{ monthly: Array<{ month: string; total: number; new: number }> }>(`/api/promoter/dashboard?view=growth`)
  return (
    <>
      <PageHeader title="Croissance des effectifs" breadcrumbs={[{ label: 'SmartShule' }, { label: 'Promoteur' }, { label: 'Croissance' }]} />
      <Card>
        <CardHeader><CardTitle className="text-base">Évolution mensuelle</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-64 w-full" /> : error ? <ErrorBox error={error} /> : (
            <SimpleBarChart data={(data?.monthly ?? []).map(m => ({ label: m.month, value: m.total }))} />
          )}
        </CardContent>
      </Card>
    </>
  )
}

function AdmissionsView() {
  const { data, loading, error } = useFetch<{ stats: { submitted: number; approved: number; rejected: number; pending: number } }>(`/api/promoter/dashboard?view=admissions`)
  return (
    <>
      <PageHeader title="Admissions" breadcrumbs={[{ label: 'SmartShule' }, { label: 'Promoteur' }, { label: 'Admissions' }]} />
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <StatCard label="Soumises" value={data?.stats.submitted ?? 0} icon={UserPlus} />
        <StatCard label="Approuvées" value={data?.stats.approved ?? 0} icon={ArrowUpRight} />
        <StatCard label="Rejetées" value={data?.stats.rejected ?? 0} icon={ArrowDownRight} />
        <StatCard label="En attente" value={data?.stats.pending ?? 0} icon={AlertCircle} />
      </div>
      {loading && <Skeleton className="h-32 w-full" />}
      {error && <ErrorBox error={error} />}
    </>
  )
}

function RevenueView() {
  const { data, loading, error } = useFetch<{ monthly: Array<{ month: string; invoiced: number; collected: number }> }>(`/api/promoter/dashboard?view=revenue`)
  return (
    <>
      <PageHeader title="Recettes" breadcrumbs={[{ label: 'SmartShule' }, { label: 'Promoteur' }, { label: 'Recettes' }]} />
      <Card>
        <CardHeader><CardTitle className="text-base">Facturé vs Encaissé (mensuel)</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-64 w-full" /> : error ? <ErrorBox error={error} /> : (
            <SimpleBarChart data={(data?.monthly ?? []).map(m => ({ label: m.month, value: Math.round(m.collected / 100) }))} />
          )}
        </CardContent>
      </Card>
    </>
  )
}

function ExpensesView() {
  const { data, loading, error } = useFetch<{ monthly: Array<{ month: string; amount: number }> }>(`/api/promoter/dashboard?view=expenses`)
  return (
    <>
      <PageHeader title="Dépenses" breadcrumbs={[{ label: 'SmartShule' }, { label: 'Promoteur' }, { label: 'Dépenses' }]} />
      <Card>
        <CardHeader><CardTitle className="text-base">Dépenses mensuelles</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-64 w-full" /> : error ? <ErrorBox error={error} /> : (
            <SimpleBarChart data={(data?.monthly ?? []).map(m => ({ label: m.month, value: Math.round(m.amount / 100) }))} />
          )}
        </CardContent>
      </Card>
    </>
  )
}

function UnpaidView() {
  const { data, loading, error } = useFetch<{ invoices: Array<{ id: string; studentName: string; amount: number; dueDate: string; status: string }> }>(`/api/promoter/dashboard?view=unpaid`)
  return (
    <>
      <PageHeader title="Impayés" breadcrumbs={[{ label: 'SmartShule' }, { label: 'Promoteur' }, { label: 'Impayés' }]} />
      <Card>
        <CardHeader><CardTitle className="text-base">Factures impayées</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-64 w-full" /> : error ? <ErrorBox error={error} /> : (
            <div className="space-y-2">
              {(data?.invoices ?? []).map(inv => (
                <div key={inv.id} className="p-3 border rounded-md flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{inv.studentName}</p>
                    <p className="text-xs text-muted-foreground">Échéance : {new Date(inv.dueDate).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={inv.status === 'UNPAID' ? 'destructive' : 'secondary'}>{inv.status}</Badge>
                    <span className="font-bold">{formatFC(inv.amount)} FC</span>
                  </div>
                </div>
              ))}
              {(data?.invoices ?? []).length === 0 && (
                <div className="py-8 text-center text-muted-foreground">Aucun impayé. 🎉</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function BudgetView({ data }: { data: PromoterData }) {
  return (
    <>
      <PageHeader title="Budget annuel" breadcrumbs={[{ label: 'SmartShule' }, { label: 'Promoteur' }, { label: 'Budget' }]} />
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <StatCard label="Budget annuel" value={formatFC(data.budgetAnnual)} sub="FC" icon={Target} />
        <StatCard label="Consommé" value={formatFC(data.budgetConsumed)} sub="FC" icon={Wallet} />
        <StatCard label="Disponible" value={formatFC(data.budgetAnnual - data.budgetConsumed)} sub="FC" icon={DollarSign} />
        <StatCard label="% consommé" value={`${data.budgetPct}`} sub="%" icon={TrendingUp} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Progression du budget</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Consommation</span>
              <span className="font-medium">{data.budgetPct}%</span>
            </div>
            <div className="h-4 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  data.budgetPct > 90 ? 'bg-red-500' : data.budgetPct > 75 ? 'bg-orange-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(data.budgetPct, 100)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

function AlertsView({ data }: { data: PromoterData }) {
  return (
    <>
      <PageHeader title="Alertes et risques" breadcrumbs={[{ label: 'SmartShule' }, { label: 'Promoteur' }, { label: 'Alertes' }]} />
      {data.risks.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Aucune alerte active. 🎉</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {data.risks.map((risk, i) => (
            <Card key={i} className={
              risk.level === 'CRITICAL' ? 'border-red-300 bg-red-50 dark:bg-red-950/30' :
              risk.level === 'HIGH' ? 'border-orange-300 bg-orange-50 dark:bg-orange-950/30' : ''
            }>
              <CardContent className="p-4 flex items-start gap-3">
                <AlertTriangle className={`h-5 w-5 shrink-0 ${
                  risk.level === 'CRITICAL' ? 'text-red-600' : risk.level === 'HIGH' ? 'text-orange-600' : 'text-blue-600'
                }`} />
                <div>
                  <Badge variant={risk.level === 'CRITICAL' ? 'destructive' : 'secondary'} className="mb-1">{risk.level}</Badge>
                  <p className="text-sm">{risk.message}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}

function DecisionsView() {
  const { data, loading, error, reload } = useFetch<{ decisions: Array<{ id: string; title: string; requestedBy: string; amount: number; status: string; createdAt: string }> }>(`/api/promoter/dashboard?view=decisions`)
  return (
    <>
      <PageHeader
        title="Décisions en attente"
        breadcrumbs={[{ label: 'SmartShule' }, { label: 'Promoteur' }, { label: 'Décisions' }]}
        actions={<Button variant="outline" size="sm" onClick={reload}><RefreshCw className="h-4 w-4 mr-2" /> Actualiser</Button>}
      />
      <Card>
        <CardHeader><CardTitle className="text-base">{data?.decisions.length ?? 0} décision(s) en attente</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-64 w-full" /> : error ? <ErrorBox error={error} /> : (
            <div className="space-y-2">
              {(data?.decisions ?? []).map(d => (
                <div key={d.id} className="p-3 border rounded-md flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{d.title}</p>
                    <p className="text-xs text-muted-foreground">Demandé par {d.requestedBy} · {new Date(d.createdAt).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={d.status === 'PENDING' ? 'secondary' : d.status === 'APPROVED' ? 'default' : 'destructive'}>{d.status}</Badge>
                    {d.amount > 0 && <span className="font-bold">{formatFC(d.amount)} FC</span>}
                  </div>
                </div>
              ))}
              {(data?.decisions ?? []).length === 0 && (
                <div className="py-8 text-center text-muted-foreground">Aucune décision en attente.</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function ReportsView({ period }: { period: 'monthly' | 'annual' }) {
  return (
    <>
      <PageHeader
        title={period === 'monthly' ? 'Rapport mensuel' : 'Rapport annuel'}
        breadcrumbs={[{ label: 'SmartShule' }, { label: 'Promoteur' }, { label: period === 'monthly' ? 'Mensuel' : 'Annuel' }]}
        actions={<Button variant="outline" size="sm"><FileText className="h-4 w-4 mr-2" /> Télécharger PDF</Button>}
      />
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Rapport {period === 'monthly' ? 'mensuel' : 'annuel'} en cours de génération.</p>
          <p className="text-xs mt-2">Ce module sera disponible prochainement.</p>
        </CardContent>
      </Card>
    </>
  )
}

// =====================================================
// Hooks & utilitaires
// =====================================================

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
  return Math.round(cents / 100).toLocaleString('fr-FR')
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
        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
        <p className="text-sm font-medium text-red-700 dark:text-red-300">Erreur de chargement</p>
      </div>
      <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-mono">{error}</p>
    </div>
  )
}

function SimpleBarChart({ data }: { data: Array<{ label: string; value: number }> }) {
  if (data.length === 0) return <div className="py-8 text-center text-muted-foreground">Aucune donnée</div>
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-20 text-xs text-muted-foreground truncate">{d.label}</div>
          <div className="flex-1 h-6 bg-muted rounded overflow-hidden relative">
            <div className="h-full bg-primary transition-all" style={{ width: `${(d.value / max) * 100}%` }} />
            <span className="absolute inset-0 flex items-center justify-end pr-2 text-xs font-medium">{d.value.toLocaleString('fr-FR')}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
