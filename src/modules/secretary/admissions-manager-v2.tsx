'use client'

// SmartShule — Admissions V2 (DataGrid Excel + multi-enfants + anti-doublon)
// ============================================================

import * as React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ss/page-header'
import {
  Loader2, Search, CheckCircle2, XCircle, AlertTriangle, Send,
  Archive, FileText, Users, ChevronDown, ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'

type ChildInfo = {
  id: string
  name: string
  firstName: string
  lastName: string
  birthDate: string | null
  gender: string | null
  desiredLevel: string | null
  status: string
  duplicateStatus: string | null
  matricule: string | null
  studentId: string | null
  documentsCount: number
}

type Application = {
  id: string
  referenceNumber: string
  applicationType: string
  status: string
  parentName: string
  parentEmail: string
  parentPhone: string
  parentRelationship: string
  emailVerified: boolean
  phoneVerified: boolean
  childrenCount: number
  children: ChildInfo[]
  submittedAt: string | null
  reviewedAt: string | null
  reviewedByName: string | null
  decisionReason: string | null
  createdAt: string
}

type Stats = {
  total: number
  submitted: number
  incomplete: number
  accepted: number
  refused: number
  transmitted: number
  archived: number
  duplicateSuspected: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  DRAFT: { label: 'Brouillon', color: 'bg-slate-100 text-slate-600', icon: <FileText className="h-3 w-3" /> },
  SUBMITTED: { label: 'En attente', color: 'bg-blue-100 text-blue-700', icon: <Clock className="h-3 w-3" /> },
  INCOMPLETE: { label: 'Incomplet', color: 'bg-orange-100 text-orange-700', icon: <AlertTriangle className="h-3 w-3" /> },
  TO_VERIFY: { label: 'À vérifier', color: 'bg-purple-100 text-purple-700', icon: <AlertTriangle className="h-3 w-3" /> },
  DUPLICATE_SUSPECTED: { label: 'Doublon ⚠️', color: 'bg-red-100 text-red-700', icon: <AlertTriangle className="h-3 w-3" /> },
  TRANSMITTED: { label: 'Transmis', color: 'bg-violet-100 text-violet-700', icon: <Send className="h-3 w-3" /> },
  ACCEPTED: { label: 'Accepté', color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 className="h-3 w-3" /> },
  REFUSED: { label: 'Refusé', color: 'bg-red-100 text-red-700', icon: <XCircle className="h-3 w-3" /> },
  ARCHIVED: { label: 'Archivé', color: 'bg-gray-100 text-gray-500', icon: <Archive className="h-3 w-3" /> },
  CANCELLED: { label: 'Annulé', color: 'bg-gray-100 text-gray-400', icon: <XCircle className="h-3 w-3" /> },
  PENDING: { label: 'En attente', color: 'bg-blue-100 text-blue-700', icon: <Clock className="h-3 w-3" /> },
  DUPLICATE: { label: 'Doublon', color: 'bg-red-100 text-red-700', icon: <AlertTriangle className="h-3 w-3" /> },
}

function Clock({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
}

export function AdmissionsManagerV2() {
  const [applications, setApplications] = React.useState<Application[]>([])
  const [stats, setStats] = React.useState<Stats | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('ALL')
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set())
  const [pending, setPending] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter && statusFilter !== 'ALL') params.set('status', statusFilter)
      const res = await fetch(`/api/admissions?${params}`, { cache: 'no-store' })
      const data = await res.json()
      if (data.ok) {
        setApplications(data.applications)
        setStats(data.stats)
      }
    } catch (err) {
      toast.error('Erreur : ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  React.useEffect(() => { load() }, [load])

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function doAction(appId: string, action: string, reason?: string, childId?: string) {
    const key = `${appId}-${action}${childId || ''}`
    setPending(key)
    try {
      const res = await fetch('/api/admissions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, applicationId: appId, childId, reason }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success(data.message)
        load()
      } else {
        toast.error(data.error)
      }
    } catch (err) {
      toast.error('Erreur : ' + (err as Error).message)
    } finally {
      setPending(null)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Admissions & Demandes d'inscription"
        description="Centralisez, vérifiez, acceptez, refusez et archivez toutes les demandes parentales."
        breadcrumbs={[{ label: 'Secrétariat' }, { label: 'Admissions' }]}
      />

      {/* Compteurs cliquables */}
      {stats && (
        <div className="flex flex-wrap gap-2">
          <FilterChip label="Toutes" count={stats.total} active={statusFilter === 'ALL'} onClick={() => setStatusFilter('ALL')} />
          <FilterChip label="En attente" count={stats.submitted} active={statusFilter === 'SUBMITTED'} onClick={() => setStatusFilter('SUBMITTED')} color="blue" />
          <FilterChip label="Incomplètes" count={stats.incomplete} active={statusFilter === 'INCOMPLETE'} onClick={() => setStatusFilter('INCOMPLETE')} color="orange" />
          <FilterChip label="Doublons ⚠️" count={stats.duplicateSuspected} active={statusFilter === 'DUPLICATE_SUSPECTED'} onClick={() => setStatusFilter('DUPLICATE_SUSPECTED')} color="red" />
          <FilterChip label="Transmises" count={stats.transmitted} active={statusFilter === 'TRANSMITTED'} onClick={() => setStatusFilter('TRANSMITTED')} color="violet" />
          <FilterChip label="Acceptées" count={stats.accepted} active={statusFilter === 'ACCEPTED'} onClick={() => setStatusFilter('ACCEPTED')} color="green" />
          <FilterChip label="Refusées" count={stats.refused} active={statusFilter === 'REFUSED'} onClick={() => setStatusFilter('REFUSED')} color="red" />
          <FilterChip label="Archivées" count={stats.archived} active={statusFilter === 'ARCHIVED'} onClick={() => setStatusFilter('ARCHIVED')} color="gray" />
        </div>
      )}

      {/* Recherche */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher par référence, matricule, nom, email, téléphone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Button variant="outline" onClick={() => { setSearch(''); setStatusFilter('ALL') }}>Réinitialiser</Button>
      </div>

      {/* DataGrid */}
      <Card>
        <CardContent className="p-0">
          {applications.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Aucune demande trouvée</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b sticky top-0">
                  <tr>
                    <th className="p-2 w-8"></th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Référence</th>
                    <th className="text-left p-2 font-medium">Élève(s)</th>
                    <th className="text-left p-2 font-medium hidden md:table-cell">Parent</th>
                    <th className="text-center p-2 font-medium hidden lg:table-cell">Contact</th>
                    <th className="text-center p-2 font-medium hidden lg:table-cell">Enfants</th>
                    <th className="text-center p-2 font-medium hidden xl:table-cell">Docs</th>
                    <th className="text-center p-2 font-medium">Statut</th>
                    <th className="text-left p-2 font-medium hidden xl:table-cell">Traité par</th>
                    <th className="text-center p-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app) => {
                    const isExpanded = expandedRows.has(app.id)
                    const hasDuplicate = app.children.some((c) => c.duplicateStatus === 'SUSPECTED')
                    return (
                      <React.Fragment key={app.id}>
                        <tr className={`border-b hover:bg-muted/20 ${hasDuplicate ? 'bg-red-50/50 dark:bg-red-950/10' : ''}`}>
                          <td className="p-2 text-center">
                            {app.children.length > 1 && (
                              <button onClick={() => toggleRow(app.id)} className="text-muted-foreground hover:text-foreground">
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </button>
                            )}
                          </td>
                          <td className="p-2 font-mono text-xs text-primary whitespace-nowrap">{app.referenceNumber}</td>
                          <td className="p-2">
                            {app.children.length === 1 ? (
                              <div>
                                <p className="font-medium">{app.children[0].name}</p>
                                {app.children[0].matricule && <p className="text-xs text-muted-foreground font-mono">{app.children[0].matricule}</p>}
                              </div>
                            ) : (
                              <div>
                                <p className="font-medium">{app.children[0].name} <span className="text-xs text-muted-foreground">+{app.children.length - 1} autre(s)</span></p>
                                {hasDuplicate && <Badge className="bg-red-100 text-red-700 text-xs mt-0.5">⚠️ Doublon</Badge>}
                              </div>
                            )}
                          </td>
                          <td className="p-2 hidden md:table-cell">
                            <p className="text-sm">{app.parentName}</p>
                            <p className="text-xs text-muted-foreground">{app.parentRelationship}</p>
                          </td>
                          <td className="p-2 hidden lg:table-cell text-xs">
                            <p>{app.parentPhone} {app.phoneVerified && '✓'}</p>
                            <p className="text-muted-foreground">{app.parentEmail} {app.emailVerified && '✓'}</p>
                          </td>
                          <td className="p-2 text-center hidden lg:table-cell">
                            <Badge variant="outline">{app.childrenCount}</Badge>
                          </td>
                          <td className="p-2 text-center hidden xl:table-cell">
                            {app.children.every((c) => c.documentsCount > 0) ? (
                              <Badge className="bg-emerald-100 text-emerald-700 text-xs">Complet</Badge>
                            ) : (
                              <Badge className="bg-orange-100 text-orange-700 text-xs">Incomplet</Badge>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            <StatusBadge status={app.status} />
                          </td>
                          <td className="p-2 hidden xl:table-cell text-xs text-muted-foreground">
                            {app.reviewedByName || '—'}
                          </td>
                          <td className="p-2">
                            <div className="flex items-center justify-center gap-1">
                              {['SUBMITTED', 'INCOMPLETE', 'DUPLICATE_SUSPECTED', 'TO_VERIFY'].includes(app.status) && (
                                <>
                                  <ActionBtn icon={<CheckCircle2 className="h-4 w-4" />} color="emerald" title="Accepter"
                                    onClick={() => doAction(app.id, 'accept')}
                                    disabled={pending === `${app.id}-accept`} loading={pending === `${app.id}-accept`} />
                                  <ActionBtn icon={<AlertTriangle className="h-4 w-4" />} color="orange" title="Incomplet"
                                    onClick={() => { const r = prompt('Motif :'); if (r) doAction(app.id, 'incomplete', r) }} />
                                  <ActionBtn icon={<Send className="h-4 w-4" />} color="violet" title="Transmettre"
                                    onClick={() => doAction(app.id, 'transmit')} />
                                  <ActionBtn icon={<XCircle className="h-4 w-4" />} color="red" title="Refuser"
                                    onClick={() => { const r = prompt('Motif du refus :'); if (r) doAction(app.id, 'refuse', r) }} />
                                </>
                              )}
                              {['ACCEPTED', 'REFUSED'].includes(app.status) && (
                                <ActionBtn icon={<Archive className="h-4 w-4" />} color="gray" title="Archiver"
                                  onClick={() => doAction(app.id, 'archive')} />
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Lignes enfants (si multi-enfants) */}
                        {isExpanded && app.children.length > 1 && app.children.map((child) => (
                          <tr key={child.id} className="border-b bg-muted/10">
                            <td></td>
                            <td className="p-2 text-xs text-muted-foreground pl-8">└─</td>
                            <td className="p-2">
                              <p className="text-sm">{child.name}</p>
                              {child.birthDate && <p className="text-xs text-muted-foreground">Né(e) le {new Date(child.birthDate).toLocaleDateString('fr-FR')}</p>}
                              {child.duplicateStatus === 'SUSPECTED' && (
                                <Badge className="bg-red-100 text-red-700 text-xs mt-0.5">⚠️ Doublon suspecté</Badge>
                              )}
                              {child.matricule && <p className="text-xs font-mono text-primary">{child.matricule}</p>}
                            </td>
                            <td colSpan={4} className="p-2 text-xs text-muted-foreground">
                              Niveau: {child.desiredLevel || '—'} · Docs: {child.documentsCount}
                            </td>
                            <td className="p-2 text-center"><StatusBadge status={child.status} /></td>
                            <td></td>
                            <td className="p-2 text-center">
                              {child.status === 'PENDING' && (
                                <ActionBtn icon={<CheckCircle2 className="h-4 w-4" />} color="emerald" title="Accepter cet enfant"
                                  onClick={() => doAction(app.id, 'accept-child', undefined, child.id)} />
                              )}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: 'bg-gray-100 text-gray-500', icon: null }
  return (
    <Badge className={`${cfg.color} text-xs whitespace-nowrap`}>
      {cfg.icon}
      <span className="ml-1">{cfg.label}</span>
    </Badge>
  )
}

function FilterChip({ label, count, active, onClick, color }: { label: string; count: number; active: boolean; onClick: () => void; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    violet: 'bg-violet-50 text-violet-700 border-violet-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    gray: 'bg-gray-50 text-gray-700 border-gray-200',
  }
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
        active ? 'bg-primary text-primary-foreground border-primary' : (color ? colors[color] : 'bg-muted/40 text-muted-foreground border-border')
      }`}
    >
      {label} <span className="ml-1 opacity-70">({count})</span>
    </button>
  )
}

function ActionBtn({ icon, color, title, onClick, disabled, loading }: { icon: React.ReactNode; color: string; title: string; onClick: () => void; disabled?: boolean; loading?: boolean }) {
  const colors: Record<string, string> = {
    emerald: 'hover:bg-emerald-50 text-emerald-600',
    orange: 'hover:bg-orange-50 text-orange-600',
    red: 'hover:bg-red-50 text-red-600',
    violet: 'hover:bg-violet-50 text-violet-600',
    gray: 'hover:bg-gray-50 text-gray-600',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-md transition-colors ${colors[color]} ${disabled ? 'opacity-50' : ''}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
    </button>
  )
}
