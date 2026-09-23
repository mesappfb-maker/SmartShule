'use client'

import * as React from 'react'
import { AppShell, NavSection } from '@/components/ss/app-shell'
import { PageHeader } from '@/components/ss/page-header'
import { StatCard } from '@/components/ss/stat-card'
import { StatusBadge } from '@/components/ss/status-badge'
import { EmptyState } from '@/components/ss/empty-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Home, Server, RefreshCw, AlertTriangle, Users, ShieldCheck,
  Activity, Database, HardDrive, Mail, User,
} from 'lucide-react'
import { logoutAction } from '@/lib/actions'
import { formatRelative, formatDate } from '@/lib/format'
import { toast } from 'sonner'
import { ProfilePage, type ProfileData } from '@/modules/shared/profile-page'

type ServerData = NonNullable<Awaited<ReturnType<typeof import('@/lib/server-portal-queries').getServerPortalData>>>

export function ServerPortal({
  user, schoolName, data, profileData,
}: {
  user: { displayName: string; role: string; email: string }
  schoolName: string
  data: ServerData
  profileData?: ProfileData
}) {
  const [view, setView] = React.useState('dashboard')
  const s = data.schoolStats

  const sections: NavSection[] = [{
    id: 'main', label: 'PromoServeur',
    items: [
      { key: 'dashboard', label: 'Vue d\'ensemble', icon: <Home className="h-4 w-4" /> },
      { key: 'instances', label: 'Instances & Sync', icon: <Server className="h-4 w-4" /> },
      { key: 'conflicts', label: 'Conflits', icon: <AlertTriangle className="h-4 w-4" />, badge: s.openConflictsCount },
      { key: 'rh', label: 'Rapports RH', icon: <Users className="h-4 w-4" /> },
      { key: 'stats', label: 'Statistiques', icon: <Database className="h-4 w-4" /> },
      { key: 'profile', label: 'Mon profil', icon: <User className="h-4 w-4" /> },
    ],
  }]

  return (
    <AppShell
      user={user} schoolName={schoolName} unreadNotifications={0}
      sections={sections} activeView={view} onNavigate={setView}
      onLogout={logoutAction}
      onOpenNotifications={() => toast.info('Aucune notification')}
      onOpenSearch={() => toast.info('Recherche à venir')}
      sidebarFooter={<div><p>{schoolName}</p><p className="text-[10px]">PromoServeur · Central</p></div>}
    >
      {view === 'dashboard' && (
        <div className="space-y-6">
          <PageHeader title="PromoServeur — Vue d'ensemble" description="Supervision centralisée du système" breadcrumbs={[{ label: 'PromoServeur' }]} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Élèves actifs" value={s.studentsCount} icon={<Users className="h-5 w-5" />} tone="primary" />
            <StatCard label="Personnel actif" value={s.employeesCount} icon={<ShieldCheck className="h-5 w-5" />} tone="info" />
            <StatCard label="Instances actives" value={s.activeInstances} icon={<Server className="h-5 w-5" />} tone="tertiary" />
            <StatCard label="Conflits ouverts" value={s.openConflictsCount} icon={<AlertTriangle className="h-5 w-5" />} tone={s.openConflictsCount > 0 ? 'danger' : 'success'} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Factures" value={s.invoicesCount} icon={<Database className="h-5 w-5" />} tone="info" />
            <StatCard label="Paiements" value={s.paymentsCount} icon={<Database className="h-5 w-5" />} tone="success" />
            <StatCard label="Encaissements" value={s.encashmentsCount} icon={<Database className="h-5 w-5" />} tone="primary" />
            <StatCard label="Notes" value={s.gradesCount} icon={<Database className="h-5 w-5" />} tone="tertiary" />
            <StatCard label="Présences" value={s.attendancesCount} icon={<Database className="h-5 w-5" />} tone="info" />
            <StatCard label="Écritures comptables" value={s.journalEntriesCount} icon={<Database className="h-5 w-5" />} tone="primary" />
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Instances connectées</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {data.instances.length === 0 ? <EmptyState icon={<Server className="h-5 w-5" />} title="Aucune instance configurée" /> : (
                data.instances.map((i) => (
                  <div key={i.id} className="flex items-center justify-between p-2 rounded-md border border-border">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4 text-muted-foreground" />
                      <div><p className="text-sm font-medium">{i.role}</p><p className="text-xs text-muted-foreground">{i.syncTarget}{i.serverIp && ` · ${i.serverIp}`}</p></div>
                    </div>
                    <StatusBadge variant={i.isActive ? 'success' : 'default'}>{i.isActive ? 'Actif' : 'Inactif'}</StatusBadge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
      {view === 'instances' && (
        <div className="space-y-6">
          <PageHeader title="Instances & Synchronisation" breadcrumbs={[{ label: 'PromoServeur' }, { label: 'Instances' }]} />
          <Card>
            <CardHeader><CardTitle className="text-base">Dernières opérations de sync</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {data.recentSyncOps.length === 0 ? <EmptyState icon={<RefreshCw className="h-5 w-5" />} title="Aucune opération" /> : (
                data.recentSyncOps.map((op) => (
                  <div key={op.id} className="flex items-center justify-between text-sm p-2 rounded-md border border-border">
                    <div><p className="font-medium">{op.aggregateType}</p><p className="text-xs text-muted-foreground">{op.operationId.slice(0, 8)}... · {formatRelative(op.receivedAt)}</p></div>
                    <StatusBadge variant={op.status === 'ACCEPTED' ? 'success' : op.status === 'CONFLICT' ? 'danger' : 'warning'}>{op.status}</StatusBadge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
      {view === 'conflicts' && (
        <div className="space-y-6">
          <PageHeader title="Conflits de synchronisation" description="Conflits ouverts nécessitant une résolution manuelle" breadcrumbs={[{ label: 'PromoServeur' }, { label: 'Conflits' }]} />
          <Card><CardContent className="space-y-2">
            {data.openConflicts.length === 0 ? <EmptyState icon={<AlertTriangle className="h-5 w-5" />} title="Aucun conflit ouvert" description="Toutes les synchronisations sont résolues" /> : (
              data.openConflicts.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-md border border-border">
                  <div><p className="text-sm font-medium">{c.aggregateType}</p><p className="text-xs text-muted-foreground">{c.conflictType} · {formatRelative(c.createdAt)}</p></div>
                  <StatusBadge variant="danger">{c.conflictType}</StatusBadge>
                </div>
              ))
            )}
          </CardContent></Card>
        </div>
      )}
      {view === 'rh' && (
        <div className="space-y-6">
          <PageHeader title="Rapports RH" description="Taux de présence du personnel par période" breadcrumbs={[{ label: 'PromoServeur' }, { label: 'Rapports RH' }]} />
          <div className="space-y-3">
            {data.staffReports.length === 0 ? <EmptyState icon={<Users className="h-5 w-5" />} title="Aucun rapport généré" /> : (
              data.staffReports.map((r) => (
                <Card key={r.id}><CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div><p className="font-medium">{r.periodType} — {r.period}</p><p className="text-xs text-muted-foreground">{r.totalStaff} personnel(s)</p></div>
                    <div className="text-right"><p className="text-2xl font-bold text-primary">{r.attendanceRate.toFixed(1)}%</p><p className="text-xs text-muted-foreground">Taux de présence</p></div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-sm">
                    <div className="text-center p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-md"><p className="text-xs text-muted-foreground">Présents</p><p className="font-semibold text-emerald-600">{r.presentCount}</p></div>
                    <div className="text-center p-2 bg-amber-50 dark:bg-amber-950/30 rounded-md"><p className="text-xs text-muted-foreground">Retards</p><p className="font-semibold text-amber-600">{r.lateCount}</p></div>
                    <div className="text-center p-2 bg-red-50 dark:bg-red-950/30 rounded-md"><p className="text-xs text-muted-foreground">Absents</p><p className="font-semibold text-red-600">{r.absentCount}</p></div>
                    <div className="text-center p-2 bg-blue-50 dark:bg-blue-950/30 rounded-md"><p className="text-xs text-muted-foreground">Excusés</p><p className="font-semibold text-blue-600">{r.excusedCount}</p></div>
                  </div>
                </CardContent></Card>
              ))
            )}
          </div>
        </div>
      )}
      {view === 'stats' && (
        <div className="space-y-6">
          <PageHeader title="Statistiques globales" breadcrumbs={[{ label: 'PromoServeur' }, { label: 'Statistiques' }]} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Élèves" value={s.studentsCount} icon={<Users className="h-5 w-5" />} tone="primary" />
            <StatCard label="Employés" value={s.employeesCount} icon={<ShieldCheck className="h-5 w-5" />} tone="info" />
            <StatCard label="Parents" value={s.guardiansCount} icon={<Users className="h-5 w-5" />} tone="tertiary" />
            <StatCard label="Factures" value={s.invoicesCount} icon={<Database className="h-5 w-5" />} tone="info" />
            <StatCard label="Paiements" value={s.paymentsCount} icon={<Database className="h-5 w-5" />} tone="success" />
            <StatCard label="Encaissements" value={s.encashmentsCount} icon={<Database className="h-5 w-5" />} tone="primary" />
            <StatCard label="Notes" value={s.gradesCount} icon={<Database className="h-5 w-5" />} tone="tertiary" />
            <StatCard label="Présences" value={s.attendancesCount} icon={<Database className="h-5 w-5" />} tone="info" />
            <StatCard label="Écritures" value={s.journalEntriesCount} icon={<Database className="h-5 w-5" />} tone="primary" />
          </div>
        </div>
      )}
      {view === 'profile' && profileData && <ProfilePage data={profileData} onBack={() => setView('dashboard')} />}
    </AppShell>
  )
}
