'use client'

// SmartShule — Centre Rapports & Opérations de masse (Secrétariat)
// ============================================================

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/ss/page-header'
import {
  Loader2, BarChart3, Users, FileText, Download, Send,
  RefreshCw, CheckCircle2, XCircle, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'

export function ReportsCenter() {
  const [report, setReport] = React.useState('effectifs')
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/secretariat/reports?report=${report}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.ok) setData(json)
    } catch (err) {
      toast.error('Erreur : ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [report])

  React.useEffect(() => { loadData() }, [loadData])

  return (
    <div className="space-y-6">
      <PageHeader title="Rapports & Statistiques" description="Effectifs, admissions, absences, opérations de masse." breadcrumbs={[{ label: 'Secrétariat' }, { label: 'Rapports' }]} />

      {/* Onglets rapports */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'effectifs', label: 'Effectifs', icon: <Users className="h-4 w-4" /> },
          { key: 'admission-stats', label: 'Admissions', icon: <FileText className="h-4 w-4" /> },
          { key: 'absence-stats', label: 'Absences', icon: <BarChart3 className="h-4 w-4" /> },
          { key: 'mass-operations', label: 'Opérations de masse', icon: <RefreshCw className="h-4 w-4" /> },
        ].map((v) => (
          <Button key={v.key} size="sm" variant={report === v.key ? 'default' : 'outline'} onClick={() => setReport(v.key)}>
            {v.icon} <span className="ml-1">{v.label}</span>
          </Button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}

      {/* Effectifs */}
      {!loading && report === 'effectifs' && data && (
        <div className="space-y-4">
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            <StatCard label="Total élèves" value={data.total} />
            <StatCard label="Actifs" value={data.active} />
            <StatCard label="Archivés" value={data.archived} />
            <StatCard label="Transférés" value={data.transferred} />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Par genre (actifs)</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-4">
                {data.byGender.map((g: any) => (
                  <div key={g.gender} className="flex items-center gap-2">
                    <Badge variant="outline">{g.gender === 'M' ? 'Garçons' : g.gender === 'F' ? 'Filles' : g.gender}</Badge>
                    <span className="font-bold">{g.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Par direction</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {data.byDirectorate.map((d: any) => (
                <div key={d.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{d.name} ({d.code})</span>
                    <Badge variant="outline">{d.totalEnrolled} élèves</Badge>
                  </div>
                  <div className="pl-4 space-y-1">
                    {d.classrooms.map((c: any) => (
                      <div key={c.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{c.name}</span>
                        <span>{c.enrolled}/{c.capacity || '∞'}</span>
                        {c.capacity && <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, (c.enrolled / c.capacity) * 100)}%` }} /></div>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Admission stats */}
      {!loading && report === 'admission-stats' && data && (
        <div className="space-y-4">
          <div className="grid gap-3 grid-cols-2">
            <StatCard label="Ce mois" value={data.totalThisMonth} />
            <StatCard label="Cette année" value={data.totalThisYear} />
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Par statut</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                {data.byStatus.map((s: any) => (
                  <div key={s.status} className="p-3 rounded-lg border border-border text-center">
                    <p className="text-xs text-muted-foreground">{s.status}</p>
                    <p className="text-xl font-bold">{s.count}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Absence stats */}
      {!loading && report === 'absence-stats' && data && (
        <div className="space-y-4">
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            <StatCard label="Absences aujourd'hui" value={data.absencesToday} />
            <StatCard label="Retards aujourd'hui" value={data.latesToday} />
            <StatCard label="Ce mois" value={data.absencesThisMonth} />
            <StatCard label="Non justifiées (total)" value={data.unjustifiedTotal} />
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Répartition ce mois</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-4 flex-wrap">
                {data.byStatus.map((s: any) => (
                  <div key={s.status} className="flex items-center gap-2">
                    <Badge variant="outline">{s.status}</Badge>
                    <span className="font-bold">{s.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Opérations de masse */}
      {!loading && report === 'mass-operations' && data && (
        <Card>
          <CardHeader><CardTitle className="text-base">Journal des opérations de masse</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(data.operations || []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Aucune opération de masse.</p>
            ) : (data.operations || []).map((op: any) => (
              <div key={op.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/20">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{op.operationType}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-xs">{op.affectedCount} affecté(s)</Badge>
                    <Badge className="bg-emerald-100 text-emerald-700 text-xs">{op.successCount} réussi(s)</Badge>
                    {op.failCount > 0 && <Badge className="bg-red-100 text-red-700 text-xs">{op.failCount} échec(s)</Badge>}
                    {op.cancelled && <Badge className="bg-gray-100 text-gray-500 text-xs">Annulé</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Par {op.confirmedByName || '—'} · {new Date(op.createdAt).toLocaleString('fr-FR')}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-3 rounded-lg border border-border bg-card">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}
