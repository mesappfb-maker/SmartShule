'use client'

// SmartShule — Centre Absences & Retards (Secrétariat)
// ============================================================
// Centre administratif de suivi des absences et retards :
//   - Absences/retards du jour
//   - Sans justificatif
//   - Justificatifs en attente de validation
//   - Relance parents
//   - Statistiques

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/ss/page-header'
import {
  Loader2, XCircle, Clock, AlertTriangle, CheckCircle2, Mail,
  Phone, FileText, Filter, RefreshCw, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'

type AttendanceRecord = {
  id: string
  studentId: string
  studentName: string
  matricule: string
  gender: string | null
  status: string
  date: string
  justified: boolean
  justification: string | null
  guardian: { name: string; phone: string | null; email: string | null } | null
}

type Justification = {
  id: string
  studentId: string
  studentName: string
  matricule: string
  justificationType: string
  justificationDate: string
  endDate: string | null
  description: string | null
  documentUrl: string | null
  status: string
  submittedByName: string | null
  createdAt: string
}

export function AbsencesCenter() {
  const [view, setView] = React.useState('today')
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [classroomId, setClassroomId] = React.useState<string>('')
  const [page, setPage] = React.useState(1)

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ view, page: String(page), limit: '50' })
      if (classroomId) params.set('classroomId', classroomId)
      const res = await fetch(`/api/secretariat/absences?${params}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.ok) setData(json)
    } catch (err) {
      toast.error('Erreur : ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [view, classroomId, page])

  React.useEffect(() => { loadData() }, [loadData])

  async function validateJustification(id: string, validate: boolean) {
    try {
      const res = await fetch('/api/secretariat/absences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'validate-justification',
          justificationId: id,
          ...(validate ? {} : { rejectionReason: 'Rejeté par la secrétaire' }),
        }),
      })
      const json = await res.json()
      if (json.ok) {
        toast.success(json.message)
        loadData()
      } else {
        toast.error(json.error)
      }
    } catch (err) {
      toast.error('Erreur : ' + (err as Error).message)
    }
  }

  async function notifyParent(studentId: string) {
    try {
      const res = await fetch('/api/secretariat/absences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'notify-parent', studentId }),
      })
      const json = await res.json()
      if (json.ok) toast.success('Parent notifié')
      else toast.error(json.error)
    } catch (err) {
      toast.error('Erreur : ' + (err as Error).message)
    }
  }

  const stats = data?.stats
  const attendances: AttendanceRecord[] = data?.attendances || []
  const justifications: Justification[] = data?.justifications || []
  const pagination = data?.pagination

  return (
    <div className="space-y-6">
      <PageHeader
        title="Centre Absences & Retards"
        description="Suivi administratif des absences, retards et justificatifs."
        breadcrumbs={[{ label: 'Secrétariat' }, { label: 'Absences' }]}
      />

      {/* Stats rapides */}
      {stats && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <StatCard label="Absences aujourd'hui" value={stats.absencesToday} icon={<XCircle className="h-4 w-4" />} color="red" />
          <StatCard label="Retards aujourd'hui" value={stats.latesToday} icon={<Clock className="h-4 w-4" />} color="amber" />
          <StatCard label="Non justifiées" value={stats.unjustified} icon={<AlertTriangle className="h-4 w-4" />} color="orange" />
          <StatCard label="Justificatifs en attente" value={stats.justificationsPending} icon={<FileText className="h-4 w-4" />} color="blue" />
        </div>
      )}

      {/* Onglets de vue */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'today', label: "Aujourd'hui" },
          { key: 'unjustified', label: 'Sans justificatif' },
          { key: 'repeated', label: 'Répétées ce mois' },
          { key: 'justifications', label: 'Justificatifs en attente' },
          { key: 'all', label: 'Toutes' },
        ].map((v) => (
          <Button key={v.key} size="sm" variant={view === v.key ? 'default' : 'outline'} onClick={() => { setView(v.key); setPage(1) }}>
            {v.label}
          </Button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}

      {/* Justificatifs en attente */}
      {!loading && view === 'justifications' && (
        <Card>
          <CardHeader><CardTitle className="text-base">Justificatifs en attente de validation</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {justifications.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Aucun justificatif en attente.</p>
            ) : justifications.map((j) => (
              <div key={j.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{j.studentName} <span className="text-muted-foreground">({j.matricule})</span></p>
                  <p className="text-xs text-muted-foreground">
                    Type : {j.justificationType} · Date : {new Date(j.justificationDate).toLocaleDateString('fr-FR')}
                    {j.endDate && ` → ${new Date(j.endDate).toLocaleDateString('fr-FR')}`}
                  </p>
                  {j.description && <p className="text-xs mt-1">{j.description}</p>}
                  {j.documentUrl && (
                    <a href={j.documentUrl} target="_blank" rel="noopener" className="text-xs text-primary hover:underline">Voir le document</a>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">Soumis par : {j.submittedByName || 'Inconnu'} · {new Date(j.createdAt).toLocaleDateString('fr-FR')}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={() => validateJustification(j.id, true)}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Valider
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => validateJustification(j.id, false)}>
                    <XCircle className="h-4 w-4 mr-1" /> Rejeter
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Liste des absences/retards */}
      {!loading && view !== 'justifications' && (
        <Card>
          <CardHeader><CardTitle className="text-base">
            {view === 'today' ? "Absences et retards du jour" : view === 'unjustified' ? 'Absences sans justificatif' : view === 'repeated' ? 'Absences répétées ce mois' : 'Toutes les absences'}
          </CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {attendances.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Aucun enregistrement.</p>
            ) : attendances.map((a) => (
              <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors">
                <div className={`w-2 h-2 mt-2 rounded-full ${a.status === 'ABSENT' ? 'bg-red-500' : 'bg-amber-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{a.studentName} <span className="text-muted-foreground">({a.matricule})</span></p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge className={`${a.status === 'ABSENT' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'} text-xs`}>
                      {a.status === 'ABSENT' ? 'Absent' : 'Retard'}
                    </Badge>
                    {a.justified ? (
                      <Badge className="bg-emerald-100 text-emerald-700 text-xs">Justifié</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700 text-xs">Non justifié</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{new Date(a.date).toLocaleDateString('fr-FR')}</span>
                  </div>
                  {a.guardian && (
                    <p className="text-xs text-muted-foreground mt-1">Parent : {a.guardian.name} {a.guardian.phone && `· ${a.guardian.phone}`}</p>
                  )}
                </div>
                {a.guardian && !a.justified && (
                  <Button size="sm" variant="ghost" onClick={() => notifyParent(a.studentId)} title="Notifier le parent">
                    <Mail className="h-4 w-4 text-blue-500" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm text-muted-foreground">Page {page} / {pagination.pages}</span>
          <Button size="sm" variant="outline" disabled={page >= pagination.pages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    red: 'border-red-200 bg-red-50/50 text-red-700',
    amber: 'border-amber-200 bg-amber-50/50 text-amber-700',
    orange: 'border-orange-200 bg-orange-50/50 text-orange-700',
    blue: 'border-blue-200 bg-blue-50/50 text-blue-700',
  }
  return (
    <div className={`p-3 rounded-lg border ${colors[color] || colors.blue}`}>
      <div className="flex items-center justify-between mb-1"><p className="text-xs opacity-80">{label}</p>{icon}</div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}
