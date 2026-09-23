'use client'

// SmartShule — Centre Transferts, Sorties, Réintégrations (Secrétariat)
// ============================================================

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { PageHeader } from '@/components/ss/page-header'
import {
  Loader2, ArrowRightLeft, ArrowDown, ArrowUp, LogOut, Ban,
  RotateCcw, Plus, CheckCircle2, XCircle, Play, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'

const TRANSFER_TYPES = [
  { value: 'INCOMING', label: 'Transfert entrant', color: 'bg-blue-100 text-blue-700' },
  { value: 'OUTGOING', label: 'Transfert sortant', color: 'bg-orange-100 text-orange-700' },
  { value: 'VOLUNTARY_WITHDRAWAL', label: 'Retrait volontaire', color: 'bg-red-100 text-red-700' },
  { value: 'DEFINITIVE_EXIT', label: 'Sortie définitive', color: 'bg-red-100 text-red-700' },
  { value: 'ADMINISTRATIVE_SUSPENSION', label: 'Suspension administrative', color: 'bg-purple-100 text-purple-700' },
  { value: 'REINTEGRATION', label: 'Réintégration', color: 'bg-emerald-100 text-emerald-700' },
]

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'En attente', color: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Approuvé', color: 'bg-blue-100 text-blue-700' },
  EXECUTED: { label: 'Exécuté', color: 'bg-emerald-100 text-emerald-700' },
  CANCELLED: { label: 'Annulé', color: 'bg-gray-100 text-gray-500' },
}

type Transfer = {
  id: string; studentId: string; studentName: string; matricule: string
  studentStatus: string; classroomName: string; transferType: string
  originSchool: string | null; destinationSchool: string | null
  reason: string; effectiveDate: string; status: string
  requestedByName: string | null; approvedByName: string | null
  approvedAt: string | null; decisionReason: string | null
  originalMatricule: string | null; createdAt: string
}

export function TransfersCenter() {
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [filterType, setFilterType] = React.useState('')
  const [filterStatus, setFilterStatus] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [form, setForm] = React.useState({
    studentId: '', transferType: 'OUTGOING', reason: '', effectiveDate: '',
    originSchool: '', destinationSchool: '',
  })

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (filterType) params.set('transferType', filterType)
      if (filterStatus) params.set('status', filterStatus)
      const res = await fetch(`/api/secretariat/transfers?${params}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.ok) setData(json)
    } catch (err) {
      toast.error('Erreur : ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [filterType, filterStatus, page])

  React.useEffect(() => { loadData() }, [loadData])

  async function createTransfer() {
    if (!form.studentId || !form.transferType || !form.reason || !form.effectiveDate) {
      toast.error('Tous les champs sont requis.'); return
    }
    try {
      const res = await fetch('/api/secretariat/transfers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', ...form }),
      })
      const json = await res.json()
      if (json.ok) {
        toast.success(json.message)
        setForm({ studentId: '', transferType: 'OUTGOING', reason: '', effectiveDate: '', originSchool: '', destinationSchool: '' })
        loadData()
      } else { toast.error(json.error) }
    } catch (err) { toast.error('Erreur : ' + (err as Error).message) }
  }

  async function approveTransfer(id: string) {
    const reason = prompt('Motif d\'approbation (optionnel) :') || ''
    try {
      const res = await fetch('/api/secretariat/transfers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', transferId: id, decisionReason: reason }),
      })
      const json = await res.json()
      if (json.ok) { toast.success('Transfert approuvé'); loadData() }
      else toast.error(json.error)
    } catch (err) { toast.error('Erreur : ' + (err as Error).message) }
  }

  async function executeTransfer(id: string) {
    if (!confirm('Confirmer l\'exécution de ce transfert ? Cette action est irréversible.')) return
    try {
      const res = await fetch('/api/secretariat/transfers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'execute', transferId: id }),
      })
      const json = await res.json()
      if (json.ok) { toast.success('Transfert exécuté'); loadData() }
      else toast.error(json.error)
    } catch (err) { toast.error('Erreur : ' + (err as Error).message) }
  }

  async function cancelTransfer(id: string) {
    const reason = prompt('Motif d\'annulation :')
    if (!reason) return
    try {
      const res = await fetch('/api/secretariat/transfers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', transferId: id, decisionReason: reason }),
      })
      const json = await res.json()
      if (json.ok) { toast.success('Transfert annulé'); loadData() }
      else toast.error(json.error)
    } catch (err) { toast.error('Erreur : ' + (err as Error).message) }
  }

  const transfers: Transfer[] = data?.transfers || []
  const stats = data?.stats
  const pagination = data?.pagination

  return (
    <div className="space-y-6">
      <PageHeader title="Centre Transferts & Sorties" description="Gestion des transferts, retraits, suspensions et réintégrations." breadcrumbs={[{ label: 'Secrétariat' }, { label: 'Transferts' }]} />

      {/* Stats */}
      {stats && (
        <div className="grid gap-3 grid-cols-3">
          <StatCard label="En attente" value={stats.pending} icon={<Clock className="h-4 w-4" />} color="amber" />
          <StatCard label="Exécutés" value={stats.executed} icon={<CheckCircle2 className="h-4 w-4" />} color="green" />
          <StatCard label="Ce mois" value={stats.thisMonth} icon={<ArrowRightLeft className="h-4 w-4" />} color="blue" />
        </div>
      )}

      {/* Filtres + Création */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filterType} onValueChange={(v) => { setFilterType(v === 'ALL' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Type de transfert" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tous</SelectItem>
            {TRANSFER_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v === 'ALL' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tous</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Dialog>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nouveau transfert</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Créer un transfert</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="ID de l'élève" value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} />
              <Select value={form.transferType} onValueChange={(v) => setForm({ ...form, transferType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRANSFER_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Textarea placeholder="Motif" rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              <Input type="date" value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} />
              <Input placeholder="École d'origine (optionnel)" value={form.originSchool} onChange={(e) => setForm({ ...form, originSchool: e.target.value })} />
              <Input placeholder="École de destination (optionnel)" value={form.destinationSchool} onChange={(e) => setForm({ ...form, destinationSchool: e.target.value })} />
            </div>
            <DialogFooter><Button onClick={createTransfer}><ArrowRightLeft className="h-4 w-4 mr-1" /> Créer</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}

      {/* Liste */}
      {!loading && (
        <Card>
          <CardContent className="space-y-2">
            {transfers.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">Aucun transfert.</p> : transfers.map((t) => {
              const typeConfig = TRANSFER_TYPES.find((tt) => tt.value === t.transferType)
              const statusConfig = STATUS_CONFIG[t.status]
              return (
                <div key={t.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors">
                  <ArrowRightLeft className="h-4 w-4 mt-1 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{t.studentName} <span className="text-muted-foreground">({t.matricule})</span></p>
                    <p className="text-xs text-muted-foreground">{t.classroomName} · Effectif : {new Date(t.effectiveDate).toLocaleDateString('fr-FR')}</p>
                    <p className="text-xs text-muted-foreground">Motif : {t.reason}</p>
                    {t.originSchool && <p className="text-xs text-muted-foreground">Origine : {t.originSchool}</p>}
                    {t.destinationSchool && <p className="text-xs text-muted-foreground">Destination : {t.destinationSchool}</p>}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge className={`${typeConfig?.color || 'bg-gray-100'} text-xs`}>{typeConfig?.label || t.transferType}</Badge>
                      <Badge className={`${statusConfig?.color || 'bg-gray-100'} text-xs`}>{statusConfig?.label || t.status}</Badge>
                      {t.originalMatricule && <Badge variant="outline" className="text-xs">Ancien matricule : {t.originalMatricule}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Demandé par {t.requestedByName || '—'} le {new Date(t.createdAt).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {t.status === 'PENDING' && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => approveTransfer(t.id)} title="Approuver"><CheckCircle2 className="h-4 w-4 text-blue-500" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => cancelTransfer(t.id)} title="Annuler"><XCircle className="h-4 w-4 text-red-500" /></Button>
                      </>
                    )}
                    {t.status === 'APPROVED' && (
                      <Button size="sm" variant="ghost" onClick={() => executeTransfer(t.id)} title="Exécuter"><Play className="h-4 w-4 text-emerald-500" /></Button>
                    )}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm">Page {page} / {pagination.pages}</span>
          <Button size="sm" variant="outline" disabled={page >= pagination.pages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  )
}

function Clock(props: any) { return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> }

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    amber: 'border-amber-200 bg-amber-50/50 text-amber-700',
    green: 'border-emerald-200 bg-emerald-50/50 text-emerald-700',
    blue: 'border-blue-200 bg-blue-50/50 text-blue-700',
  }
  return (
    <div className={`p-3 rounded-lg border ${colors[color] || colors.blue}`}>
      <div className="flex items-center justify-between mb-1"><p className="text-xs opacity-80">{label}</p>{icon}</div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}
