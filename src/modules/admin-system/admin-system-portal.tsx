'use client'

// SmartShule — Portail Super Admin (SYSTEM_ADMIN)
// =====================================================
// Portail interactif multi-vues : Tableau de bord, Écoles, Licences,
// Utilisateurs, Appareils, Audit, Échecs connexion, Synchronisation,
// Sauvegardes, Sécurité, Maintenance, Paramètres.
// Toutes les vues sont fonctionnelles et alimentées par les API /api/admin/*.

import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/ss/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  LayoutDashboard, Building2, KeyRound, Users, Smartphone, ShieldCheck,
  ScrollText, AlertTriangle, RefreshCw, DatabaseBackup, Lock, Wrench,
  Settings, LogOut, Search, Download, RefreshCcw, Power, CheckCircle2,
  XCircle, Clock, Server, Activity, Eye,
} from 'lucide-react'

type View =
  | 'dashboard' | 'schools' | 'licenses' | 'users' | 'devices'
  | 'audit' | 'failed-logins' | 'sync' | 'backups'
  | 'security' | 'maintenance' | 'settings'

interface NavItem {
  id: View
  label: string
  icon: typeof LayoutDashboard
  group: 'Système' | 'Sécurité' | 'Maintenance'
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, group: 'Système' },
  { id: 'schools', label: 'Écoles', icon: Building2, group: 'Système' },
  { id: 'licenses', label: 'Licences', icon: KeyRound, group: 'Système' },
  { id: 'users', label: 'Utilisateurs', icon: Users, group: 'Système' },
  { id: 'devices', label: 'Appareils', icon: Smartphone, group: 'Système' },
  { id: 'audit', label: 'Audit', icon: ScrollText, group: 'Sécurité' },
  { id: 'failed-logins', label: 'Échecs connexion', icon: AlertTriangle, group: 'Sécurité' },
  { id: 'sync', label: 'Synchronisation', icon: RefreshCw, group: 'Maintenance' },
  { id: 'backups', label: 'Sauvegardes', icon: DatabaseBackup, group: 'Maintenance' },
  { id: 'security', label: 'Sécurité', icon: ShieldCheck, group: 'Maintenance' },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench, group: 'Maintenance' },
  { id: 'settings', label: 'Paramètres', icon: Settings, group: 'Maintenance' },
]

interface AdminPortalProps {
  user: { displayName: string; role: string; email: string }
  schoolName: string
  initialData: AdminDashboardData
}

export interface AdminDashboardData {
  totalSchools: number
  activeSchools: number
  totalUsers: number
  activeUsers: number
  demoAccounts: number
  blockedUsers: number
  totalLicenses: number
  activeLicenses: number
  expiringLicenses: number
  totalDevices: number
  activeDevices: number
  syncErrors: number
  auditToday: number
  failedLogins: number
}

export function AdminSystemPortal({ user, schoolName, initialData }: AdminPortalProps) {
  const [view, setView] = useState<View>('dashboard')
  const [collapsed, setCollapsed] = useState(false)

  const groups: NavItem['group'][] = ['Système', 'Sécurité', 'Maintenance']

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-16' : 'w-64'} border-r border-border bg-muted/30 flex-col hidden md:flex shrink-0 transition-all`}>
        <div className="p-4 border-b border-border flex items-center justify-between">
          {!collapsed && (
            <div>
              <p className="font-semibold text-sm">SmartShule</p>
              <p className="text-xs text-muted-foreground">Super Admin</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Déplier' : 'Replier'}
          >
            <LayoutDashboard className="h-4 w-4" />
          </Button>
        </div>
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {groups.map((group) => (
            <div key={group}>
              {!collapsed && (
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase">
                  {group}
                </div>
              )}
              {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
                const Icon = item.icon
                const isActive = view === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => setView(item.id)}
                    title={item.label}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
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

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          <PortalContent
            view={view}
            user={user}
            schoolName={schoolName}
            initialData={initialData}
            onNavigate={setView}
          />
        </div>
      </div>
    </div>
  )
}

function PortalContent({
  view, user, schoolName, initialData, onNavigate,
}: {
  view: View
  user: { displayName: string; role: string; email: string }
  schoolName: string
  initialData: AdminDashboardData
  onNavigate: (v: View) => void
}) {
  switch (view) {
    case 'dashboard': return <DashboardView data={initialData} schoolName={schoolName} onNavigate={onNavigate} />
    case 'schools': return <SchoolsView />
    case 'licenses': return <LicensesView />
    case 'users': return <UsersView />
    case 'devices': return <DevicesView />
    case 'audit': return <AuditView />
    case 'failed-logins': return <FailedLoginsView />
    case 'sync': return <SyncView />
    case 'backups': return <BackupsView />
    case 'security': return <SecurityView />
    case 'maintenance': return <MaintenanceView />
    case 'settings': return <SettingsView />
  }
}

// =====================================================
// Vues
// =====================================================

function DashboardView({
  data, schoolName, onNavigate,
}: {
  data: AdminDashboardData
  schoolName: string
  onNavigate: (v: View) => void
}) {
  return (
    <>
      <PageHeader
        title="Super Admin — Tableau de bord technique"
        breadcrumbs={[{ label: 'SmartShule' }, { label: 'Super Admin' }, { label: 'Tableau de bord' }]}
        actions={
          <span className="text-xs text-muted-foreground">{schoolName}</span>
        }
      />
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Écoles" value={data.totalSchools} sub="enregistrées" icon={Building2} onClick={() => onNavigate('schools')} />
        <StatCard label="Licences" value={data.totalLicenses} sub={`${data.activeLicenses} actives`} icon={KeyRound} onClick={() => onNavigate('licenses')} />
        <StatCard label="Utilisateurs" value={data.totalUsers} sub={`${data.activeUsers} actifs`} icon={Users} onClick={() => onNavigate('users')} />
        <StatCard label="Comptes démo" value={data.demoAccounts} sub="isDemoAccount" icon={Users} />
        <StatCard label="Comptes bloqués" value={data.blockedUsers} sub="désactivés" icon={XCircle} onClick={() => onNavigate('security')} />
        <StatCard label="Échecs connexion (24h)" value={data.failedLogins} sub="LOGIN_FAILED" icon={AlertTriangle} onClick={() => onNavigate('failed-logins')} />
        <StatCard label="Audit (24h)" value={data.auditToday} sub="événements" icon={ScrollText} onClick={() => onNavigate('audit')} />
        <StatCard label="Appareils sync" value={data.totalDevices} sub={`${data.activeDevices} actifs`} icon={Smartphone} onClick={() => onNavigate('devices')} />
        <StatCard label="Erreurs sync" value={data.syncErrors} sub="non résolues" icon={RefreshCcw} onClick={() => onNavigate('sync')} />
      </div>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            Dashboard technique SYSTEM_ADMIN — aucun KPI métier (élèves, factures, caisse, notes).
            Ce rôle gère uniquement la configuration système, les licences, la sécurité et la synchronisation.
          </p>
        </CardContent>
      </Card>
    </>
  )
}

// =====================================================
// Hook utilitaire pour fetcher les données API
// =====================================================

function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
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

  useEffect(() => {
    reload()
  }, [reload])

  return { data, loading, error, reload }
}

// =====================================================
// Vue Écoles
// =====================================================

function SchoolsView() {
  const { data, loading, error, reload } = useFetch<{ schools: SchoolRow[] }>('/api/admin/schools')
  const [search, setSearch] = useState('')

  const schools = data?.schools ?? []
  const filtered = schools.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.code.toLowerCase().includes(search.toLowerCase()) ||
    (s.email || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <PageHeader
        title="Écoles enregistrées"
        breadcrumbs={[{ label: 'SmartShule' }, { label: 'Super Admin' }, { label: 'Écoles' }]}
        actions={
          <Button variant="outline" size="sm" onClick={reload}>
            <RefreshCw className="h-4 w-4 mr-2" /> Actualiser
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{schools.length} école(s)</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une école..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : error ? (
            <ErrorBox error={error} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 px-3 font-medium">Nom</th>
                    <th className="py-2 px-3 font-medium">Code</th>
                    <th className="py-2 px-3 font-medium">Email</th>
                    <th className="py-2 px-3 font-medium">Téléphone</th>
                    <th className="py-2 px-3 font-medium">Ville</th>
                    <th className="py-2 px-3 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-3 font-medium">{s.name}</td>
                      <td className="py-2 px-3 font-mono text-xs">{s.code}</td>
                      <td className="py-2 px-3 text-muted-foreground">{s.email || '—'}</td>
                      <td className="py-2 px-3 text-muted-foreground">{s.phone || '—'}</td>
                      <td className="py-2 px-3 text-muted-foreground">{s.city || '—'}</td>
                      <td className="py-2 px-3">
                        <Badge variant={s.active ? 'default' : 'secondary'}>
                          {s.active ? 'Actif' : 'Inactif'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Aucune école trouvée.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

interface SchoolRow {
  id: string
  name: string
  code: string
  email: string | null
  phone: string | null
  city: string | null
  active: boolean
  createdAt: string
}

// =====================================================
// Vue Licences
// =====================================================

function LicensesView() {
  const { data, loading, error, reload } = useFetch<{ licenses: LicenseRow[] }>('/api/admin/licenses')
  const licenses = data?.licenses ?? []

  return (
    <>
      <PageHeader
        title="Licences"
        breadcrumbs={[{ label: 'SmartShule' }, { label: 'Super Admin' }, { label: 'Licences' }]}
        actions={
          <Button variant="outline" size="sm" onClick={reload}>
            <RefreshCw className="h-4 w-4 mr-2" /> Actualiser
          </Button>
        }
      />
      <Card>
        <CardHeader><CardTitle className="text-base">{licenses.length} licence(s)</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : error ? (
            <ErrorBox error={error} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 px-3 font-medium">École</th>
                    <th className="py-2 px-3 font-medium">Clé</th>
                    <th className="py-2 px-3 font-medium">Plan</th>
                    <th className="py-2 px-3 font-medium">Statut</th>
                    <th className="py-2 px-3 font-medium">Émette</th>
                    <th className="py-2 px-3 font-medium">Expire</th>
                  </tr>
                </thead>
                <tbody>
                  {licenses.map(l => (
                    <tr key={l.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-3 font-medium">{l.schoolName}</td>
                      <td className="py-2 px-3 font-mono text-xs">{l.key}</td>
                      <td className="py-2 px-3">{l.plan}</td>
                      <td className="py-2 px-3">
                        <Badge variant={l.status === 'ACTIVE' ? 'default' : l.status === 'EXPIRED' ? 'destructive' : 'secondary'}>
                          {l.status}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">{new Date(l.issuedAt).toLocaleDateString('fr-FR')}</td>
                      <td className="py-2 px-3 text-muted-foreground">{new Date(l.expiresAt).toLocaleDateString('fr-FR')}</td>
                    </tr>
                  ))}
                  {licenses.length === 0 && (
                    <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Aucune licence enregistrée.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

interface LicenseRow {
  id: string
  key: string
  plan: string
  status: string
  issuedAt: string
  expiresAt: string
  schoolName: string
}

// =====================================================
// Vue Utilisateurs
// =====================================================

function UsersView() {
  const { data, loading, error, reload } = useFetch<{ users: UserRow[] }>('/api/admin/users')
  const [search, setSearch] = useState('')
  const users = data?.users ?? []
  const filtered = users.filter(u =>
    u.displayName.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <PageHeader
        title="Utilisateurs"
        breadcrumbs={[{ label: 'SmartShule' }, { label: 'Super Admin' }, { label: 'Utilisateurs' }]}
        actions={
          <Button variant="outline" size="sm" onClick={reload}>
            <RefreshCw className="h-4 w-4 mr-2" /> Actualiser
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{users.length} utilisateur(s)</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : error ? (
            <ErrorBox error={error} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 px-3 font-medium">Nom</th>
                    <th className="py-2 px-3 font-medium">Email</th>
                    <th className="py-2 px-3 font-medium">Rôle</th>
                    <th className="py-2 px-3 font-medium">École</th>
                    <th className="py-2 px-3 font-medium">Statut</th>
                    <th className="py-2 px-3 font-medium">Dernière connexion</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => (
                    <tr key={u.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-3 font-medium">{u.displayName}</td>
                      <td className="py-2 px-3 text-muted-foreground">{u.email}</td>
                      <td className="py-2 px-3"><Badge variant="outline">{u.role}</Badge></td>
                      <td className="py-2 px-3 text-muted-foreground">{u.schoolName || '—'}</td>
                      <td className="py-2 px-3">
                        {u.active ? (
                          <Badge variant="default" className="bg-green-100 text-green-700">Actif</Badge>
                        ) : (
                          <Badge variant="destructive">Bloqué</Badge>
                        )}
                        {u.isDemoAccount && <Badge variant="secondary" className="ml-1">Démo</Badge>}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('fr-FR') : 'Jamais'}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Aucun utilisateur.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

interface UserRow {
  id: string
  displayName: string
  email: string
  role: string
  active: boolean
  isDemoAccount: boolean
  lastLoginAt: string | null
  schoolName: string | null
}

// =====================================================
// Vue Appareils
// =====================================================

function DevicesView() {
  const { data, loading, error, reload } = useFetch<{ devices: DeviceRow[] }>('/api/admin/devices')
  const devices = data?.devices ?? []
  return (
    <>
      <PageHeader
        title="Appareils synchronisés"
        breadcrumbs={[{ label: 'SmartShule' }, { label: 'Super Admin' }, { label: 'Appareils' }]}
        actions={<Button variant="outline" size="sm" onClick={reload}><RefreshCw className="h-4 w-4 mr-2" /> Actualiser</Button>}
      />
      <Card>
        <CardHeader><CardTitle className="text-base">{devices.length} appareil(s)</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : error ? (
            <ErrorBox error={error} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 px-3 font-medium">Nom</th>
                    <th className="py-2 px-3 font-medium">UUID</th>
                    <th className="py-2 px-3 font-medium">Plateforme</th>
                    <th className="py-2 px-3 font-medium">École</th>
                    <th className="py-2 px-3 font-medium">Statut</th>
                    <th className="py-2 px-3 font-medium">Dernière sync</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map(d => (
                    <tr key={d.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-3 font-medium">{d.name || '—'}</td>
                      <td className="py-2 px-3 font-mono text-xs">{d.uuid.slice(0, 8)}…</td>
                      <td className="py-2 px-3">{d.platform}</td>
                      <td className="py-2 px-3 text-muted-foreground">{d.schoolName || '—'}</td>
                      <td className="py-2 px-3">
                        <Badge variant={d.status === 'ACTIVE' ? 'default' : 'secondary'}>{d.status}</Badge>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">
                        {d.lastSyncAt ? new Date(d.lastSyncAt).toLocaleString('fr-FR') : 'Jamais'}
                      </td>
                    </tr>
                  ))}
                  {devices.length === 0 && (
                    <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Aucun appareil enregistré.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

interface DeviceRow {
  id: string
  uuid: string
  name: string | null
  platform: string
  status: string
  lastSyncAt: string | null
  schoolName: string | null
}

// =====================================================
// Vue Audit
// =====================================================

function AuditView() {
  const { data, loading, error, reload } = useFetch<{ logs: AuditRow[]; total: number }>('/api/admin/audit?limit=200')
  const [search, setSearch] = useState('')
  const logs = data?.logs ?? []
  const filtered = logs.filter(l =>
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    (l.userName || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.target || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <PageHeader
        title="Journal d'audit"
        breadcrumbs={[{ label: 'SmartShule' }, { label: 'Super Admin' }, { label: 'Audit' }]}
        actions={<Button variant="outline" size="sm" onClick={reload}><RefreshCw className="h-4 w-4 mr-2" /> Actualiser</Button>}
      />
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{data?.total ?? 0} événement(s) — 200 plus récents affichés</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher action, utilisateur..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : error ? (
            <ErrorBox error={error} />
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-2">
                {filtered.map(log => (
                  <div key={log.id} className="flex items-start gap-3 p-3 rounded-md border hover:bg-muted/30">
                    <div className="shrink-0">
                      <Badge variant={getActionVariant(log.action)} className="font-mono text-xs">{log.action}</Badge>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{log.userName || 'Anonyme'}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="text-muted-foreground truncate">{log.target || '—'}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(log.createdAt).toLocaleString('fr-FR')}
                        {log.ip && <span className="ml-2 font-mono">{log.ip}</span>}
                      </div>
                      {log.details != null && (
                        <pre className="mt-1 text-xs text-muted-foreground bg-muted/30 p-2 rounded overflow-x-auto">
                          {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground">Aucun événement.</div>
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </>
  )
}

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

// =====================================================
// Vue Échecs connexion
// =====================================================

function FailedLoginsView() {
  const { data, loading, error, reload } = useFetch<{ logs: AuditRow[]; total: number }>('/api/admin/failed-logins?limit=200')
  const logs = data?.logs ?? []
  const byIp: Record<string, number> = {}
  logs.forEach(l => { if (l.ip) byIp[l.ip] = (byIp[l.ip] || 0) + 1 })
  const topIps = Object.entries(byIp).sort((a, b) => b[1] - a[1]).slice(0, 10)

  return (
    <>
      <PageHeader
        title="Échecs de connexion (24h)"
        breadcrumbs={[{ label: 'SmartShule' }, { label: 'Super Admin' }, { label: 'Échecs connexion' }]}
        actions={<Button variant="outline" size="sm" onClick={reload}><RefreshCw className="h-4 w-4 mr-2" /> Actualiser</Button>}
      />
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">{logs.length} échec(s) — 200 plus récents</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : error ? (
              <ErrorBox error={error} />
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {logs.map(log => (
                    <div key={log.id} className="flex items-center justify-between p-3 rounded-md border">
                      <div>
                        <p className="text-sm font-medium">{log.userName || 'Inconnu'}</p>
                        <p className="text-xs text-muted-foreground">{log.ip || 'IP inconnue'}</p>
                      </div>
                      <div className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString('fr-FR')}</div>
                    </div>
                  ))}
                  {logs.length === 0 && (
                    <div className="py-8 text-center text-muted-foreground">Aucun échec de connexion dans les dernières 24h. 🎉</div>
                  )}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Top IPs</CardTitle></CardHeader>
          <CardContent>
            {topIps.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Aucune donnée</p>
            ) : (
              <div className="space-y-2">
                {topIps.map(([ip, count]) => (
                  <div key={ip} className="flex items-center justify-between p-2 rounded border">
                    <span className="font-mono text-xs">{ip}</span>
                    <Badge variant={count > 10 ? 'destructive' : count > 3 ? 'secondary' : 'outline'}>{count}×</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

// =====================================================
// Vue Synchronisation
// =====================================================

function SyncView() {
  const { data, loading, error, reload } = useFetch<{ devices: DeviceRow[]; errors: SyncErrorRow[]; stats: { total: number; pending: number; resolved: number } }>('/api/admin/sync')
  return (
    <>
      <PageHeader
        title="Synchronisation multi-appareils"
        breadcrumbs={[{ label: 'SmartShule' }, { label: 'Super Admin' }, { label: 'Synchronisation' }]}
        actions={<Button variant="outline" size="sm" onClick={reload}><RefreshCw className="h-4 w-4 mr-2" /> Actualiser</Button>}
      />
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <StatCard label="Total appareils" value={data?.stats.total ?? 0} icon={Smartphone} />
        <StatCard label="Erreurs non résolues" value={data?.stats.pending ?? 0} icon={AlertTriangle} />
        <StatCard label="Erreurs résolues" value={data?.stats.resolved ?? 0} icon={CheckCircle2} />
        <StatCard label="Total erreurs" value={data?.errors.length ?? 0} icon={RefreshCcw} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Erreurs de synchronisation récentes</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : error ? (
            <ErrorBox error={error} />
          ) : (
            <div className="space-y-2">
              {(data?.errors ?? []).slice(0, 50).map(err => (
                <div key={err.id} className="p-3 rounded-md border flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={err.resolvedAt ? 'outline' : 'destructive'} className="text-xs">
                        {err.resolvedAt ? 'Résolu' : 'Non résolu'}
                      </Badge>
                      <span className="font-mono text-xs">{err.operation}</span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{err.errorMessage}</p>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(err.createdAt).toLocaleString('fr-FR')}</p>
                  </div>
                </div>
              ))}
              {(data?.errors ?? []).length === 0 && (
                <div className="py-8 text-center text-muted-foreground">Aucune erreur de sync. 🎉</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

interface SyncErrorRow {
  id: string
  operation: string
  errorMessage: string
  resolvedAt: string | null
  createdAt: string
}

// =====================================================
// Vue Sauvegardes
// =====================================================

function BackupsView() {
  const { data, loading, error, reload } = useFetch<{ backups: BackupRow[]; config: BackupConfig }>('/api/admin/backups')
  return (
    <>
      <PageHeader
        title="Sauvegardes"
        breadcrumbs={[{ label: 'SmartShule' }, { label: 'Super Admin' }, { label: 'Sauvegardes' }]}
        actions={<Button variant="outline" size="sm" onClick={reload}><RefreshCw className="h-4 w-4 mr-2" /> Actualiser</Button>}
      />
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Historique des sauvegardes</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : error ? (
              <ErrorBox error={error} />
            ) : (
              <div className="space-y-2">
                {(data?.backups ?? []).map(b => (
                  <div key={b.id} className="flex items-center justify-between p-3 rounded-md border">
                    <div>
                      <p className="text-sm font-medium font-mono">{b.filename}</p>
                      <p className="text-xs text-muted-foreground">{(b.sizeBytes / 1024 / 1024).toFixed(2)} MB · {b.type}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={b.status === 'SUCCESS' ? 'default' : 'destructive'}>{b.status}</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(b.createdAt).toLocaleString('fr-FR')}</span>
                    </div>
                  </div>
                ))}
                {(data?.backups ?? []).length === 0 && (
                  <div className="py-8 text-center text-muted-foreground">Aucune sauvegarde enregistrée.</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Fréquence</span><span>{data?.config.frequency || 'Quotidienne'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Rétention</span><span>{data?.config.retentionDays || 30} jours</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Destination</span><span>{data?.config.destination || 'Local'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Auto</span><Badge variant={data?.config.auto ? 'default' : 'secondary'}>{data?.config.auto ? 'Activée' : 'Désactivée'}</Badge></div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

interface BackupRow {
  id: string
  filename: string
  type: string
  status: string
  sizeBytes: number
  createdAt: string
}

interface BackupConfig {
  frequency: string
  retentionDays: number
  destination: string
  auto: boolean
}

// =====================================================
// Vue Sécurité
// =====================================================

function SecurityView() {
  const { data, loading, error, reload } = useFetch<{ policies: SecurityPolicy; blockedUsers: UserRow[] }>('/api/admin/security')
  return (
    <>
      <PageHeader
        title="Sécurité"
        breadcrumbs={[{ label: 'SmartShule' }, { label: 'Super Admin' }, { label: 'Sécurité' }]}
        actions={<Button variant="outline" size="sm" onClick={reload}><RefreshCw className="h-4 w-4 mr-2" /> Actualiser</Button>}
      />
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Politiques de sécurité</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {loading ? <Skeleton className="h-32 w-full" /> : error ? <ErrorBox error={error} /> : (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">2FA obligatoire</span><Badge variant={data?.policies.enforceTwoFactor ? 'default' : 'secondary'}>{data?.policies.enforceTwoFactor ? 'Oui' : 'Non'}</Badge></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Durée session</span><span>{data?.policies.sessionTimeoutMinutes || 60} min</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tentatives login max</span><span>{data?.policies.maxLoginAttempts || 5}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Verrouillage</span><span>{data?.policies.lockoutDurationMinutes || 15} min</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Min longueur mot de passe</span><span>{data?.policies.passwordMinLength || 8}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Expiration mot de passe</span><span>{data?.policies.passwordExpiryDays || 90} jours</span></div>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Comptes bloqués</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-32 w-full" /> : error ? <ErrorBox error={error} /> : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {(data?.blockedUsers ?? []).map(u => (
                  <div key={u.id} className="p-2 rounded border flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{u.displayName}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    <Badge variant="outline">{u.role}</Badge>
                  </div>
                ))}
                {(data?.blockedUsers ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">Aucun compte bloqué. 🎉</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

interface SecurityPolicy {
  enforceTwoFactor: boolean
  sessionTimeoutMinutes: number
  maxLoginAttempts: number
  lockoutDurationMinutes: number
  passwordMinLength: number
  passwordExpiryDays: number
}

// =====================================================
// Vue Maintenance
// =====================================================

function MaintenanceView() {
  const { data, loading, error, reload } = useFetch<{ maintenanceMode: boolean; scheduledAt: string | null; message: string | null }>('/api/admin/maintenance')
  const [toggling, setToggling] = useState(false)

  async function toggleMaintenance() {
    setToggling(true)
    try {
      await fetch('/api/admin/maintenance', { method: 'POST', body: JSON.stringify({ enabled: !data?.maintenanceMode }) })
      await reload()
    } finally {
      setToggling(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Maintenance système"
        breadcrumbs={[{ label: 'SmartShule' }, { label: 'Super Admin' }, { label: 'Maintenance' }]}
        actions={<Button variant="outline" size="sm" onClick={reload}><RefreshCw className="h-4 w-4 mr-2" /> Actualiser</Button>}
      />
      <Card>
        <CardHeader><CardTitle className="text-base">Mode maintenance</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-32 w-full" /> : error ? <ErrorBox error={error} /> : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Power className={`h-5 w-5 ${data?.maintenanceMode ? 'text-red-500' : 'text-green-500'}`} />
                <div className="flex-1">
                  <p className="font-medium">{data?.maintenanceMode ? 'Mode maintenance ACTIF' : 'Système opérationnel'}</p>
                  <p className="text-xs text-muted-foreground">
                    {data?.maintenanceMode
                      ? 'Tous les utilisateurs non-admin sont déconnectés. Seuls les SYSTEM_ADMIN peuvent se connecter.'
                      : 'Tous les utilisateurs peuvent se connecter normalement.'}
                  </p>
                </div>
                <Button
                  variant={data?.maintenanceMode ? 'destructive' : 'outline'}
                  onClick={toggleMaintenance}
                  disabled={toggling}
                >
                  {toggling ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                  {data?.maintenanceMode ? 'Désactiver' : 'Activer'}
                </Button>
              </div>
              {data?.scheduledAt && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-md text-sm">
                  <Clock className="h-4 w-4 inline mr-2" />
                  Maintenance planifiée : {new Date(data.scheduledAt).toLocaleString('fr-FR')}
                </div>
              )}
              {data?.message && (
                <div className="p-3 bg-muted rounded-md text-sm">{data.message}</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

// =====================================================
// Vue Paramètres
// =====================================================

function SettingsView() {
  const { data, loading, error, reload } = useFetch<{ settings: Record<string, string | number | boolean> }>('/api/admin/settings')
  const [saving, setSaving] = useState(false)

  async function saveSetting(key: string, value: string) {
    setSaving(true)
    try {
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      })
      await reload()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Paramètres système"
        breadcrumbs={[{ label: 'SmartShule' }, { label: 'Super Admin' }, { label: 'Paramètres' }]}
        actions={<Button variant="outline" size="sm" onClick={reload}><RefreshCw className="h-4 w-4 mr-2" /> Actualiser</Button>}
      />
      <Card>
        <CardHeader><CardTitle className="text-base">Configuration générale</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-64 w-full" /> : error ? <ErrorBox error={error} /> : (
            <div className="space-y-4">
              {Object.entries(data?.settings ?? {}).map(([key, value]) => (
                <SettingRow
                  key={key}
                  settingKey={key}
                  value={String(value)}
                  onSave={saveSetting}
                  saving={saving}
                />
              ))}
              {Object.keys(data?.settings ?? {}).length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">Aucun paramètre configuré.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function SettingRow({
  settingKey, value, onSave, saving,
}: {
  settingKey: string
  value: string
  onSave: (k: string, v: string) => void
  saving: boolean
}) {
  const [localValue, setLocalValue] = useState(value)
  useEffect(() => setLocalValue(value), [value])
  return (
    <div className="flex items-center gap-3">
      <Label className="flex-1 text-sm font-mono">{settingKey}</Label>
      <Input value={localValue} onChange={(e) => setLocalValue(e.target.value)} className="flex-1" />
      <Button size="sm" variant="outline" onClick={() => onSave(settingKey, localValue)} disabled={saving || localValue === value}>
        Enregistrer
      </Button>
    </div>
  )
}

// =====================================================
// Composants utilitaires
// =====================================================

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
    <div
      onClick={onClick}
      className={`p-4 rounded-lg border bg-card ${onClick ? 'cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all' : ''}`}
    >
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
