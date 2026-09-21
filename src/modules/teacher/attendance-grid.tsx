'use client'

// SmartShule — Composant : Grille d'appel Excel-style avec IQA pastilles
// Étape 4 RDC — Portail Prof
//
// Pour chaque élève :
//   - Avatar + nom complet + matricule + classe
//   - Pastille IQA (vert/orange/rouge) + tooltip [X Abs | Y Ret | Z Exc]
//   - Alerte financière discrète (⚠️)
//   - 4 boutons : Présent / Retard / Absent / Excusé
//
// Lorsqu'on clique sur un bouton :
//   - Appel de `recordStudentCallAction`
//   - Mise à jour immédiate du state
//   - Toast de confirmation + IQA recalculé affiché

import * as React from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle, Check, Clock, X, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { initials, formatDate } from '@/lib/format'
import { recordStudentCallAction, saveLessonLogAction } from '@/lib/teacher-emargement-actions'
import { getIqaColor, formatIqaTooltip } from '@/lib/iqa-pure'

type StudentWithIqa = {
  studentId: string
  name: string
  matricule: string
  financialStatus: string
  called: boolean
  callStatus: string | null
  lateMinutes: number
  justified: boolean
  justification: string | null
  iqa: number
  iqaLevel: 'EXCELLENT' | 'WARNING' | 'CRITICAL'
  totalSessions: number
  absencesUnexcused: number
  absencesExcused: number
  lateCount: number
}

type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED'

export function AttendanceGrid({
  emargementId,
  students,
  periodLabel,
}: {
  emargementId: string
  students: StudentWithIqa[]
  periodLabel: string
}) {
  const [rows, setRows] = React.useState<StudentWithIqa[]>(students)
  const [pending, setPending] = React.useState<Record<string, AttendanceStatus | null>>({})
  const [lateDialog, setLateDialog] = React.useState<{ studentId: string; minutes: number } | null>(null)
  const [justificationDialog, setJustificationDialog] = React.useState<{
    studentId: string
    justification: string
  } | null>(null)
  const [search, setSearch] = React.useState('')

  // Filtre recherche
  const filteredRows = React.useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter(
      (r) => r.name.toLowerCase().includes(q) || r.matricule.toLowerCase().includes(q)
    )
  }, [rows, search])

  // Stats globales
  const stats = React.useMemo(() => {
    let present = 0, late = 0, absent = 0, excused = 0, uncalled = 0
    let criticalCount = 0, warningCount = 0
    for (const r of rows) {
      if (!r.called) uncalled++
      else if (r.callStatus === 'PRESENT') present++
      else if (r.callStatus === 'LATE') late++
      else if (r.callStatus === 'ABSENT') absent++
      else if (r.callStatus === 'EXCUSED') excused++
      if (r.iqaLevel === 'CRITICAL') criticalCount++
      if (r.iqaLevel === 'WARNING') warningCount++
    }
    return { present, late, absent, excused, uncalled, criticalCount, warningCount, total: rows.length }
  }, [rows])

  async function handleCall(studentId: string, status: AttendanceStatus, extra?: { lateMinutes?: number; justification?: string }) {
    setPending((p) => ({ ...p, [studentId]: status }))
    try {
      const formData = new FormData()
      formData.append('emargementId', emargementId)
      formData.append('studentId', studentId)
      formData.append('status', status)
      formData.append('lateMinutes', String(extra?.lateMinutes || 0))
      formData.append('justified', extra?.justification ? 'true' : 'false')
      formData.append('justification', extra?.justification || '')

      const result = await recordStudentCallAction(undefined, formData)
      if (result.ok) {
        // Mise à jour locale
        setRows((prev) =>
          prev.map((r) => {
            if (r.studentId !== studentId) return r
            const newIqa = result.updatedIqa
            return {
              ...r,
              called: true,
              callStatus: status,
              lateMinutes: extra?.lateMinutes || 0,
              justified: !!extra?.justification,
              justification: extra?.justification || null,
              iqa: newIqa,
              iqaLevel: result.level as 'EXCELLENT' | 'WARNING' | 'CRITICAL',
            }
          })
        )
        toast.success(
          `Appel enregistré : ${status === 'PRESENT' ? 'Présent' : status === 'LATE' ? `Retard (${extra?.lateMinutes || 0} min)` : status === 'ABSENT' ? 'Absent' : 'Excusé'} — IQA mis à jour (${result.updatedIqa.toFixed(1)}%)`
        )
      } else {
        toast.error(result.error)
      }
    } catch (err) {
      toast.error('Erreur réseau : ' + (err as Error).message)
    } finally {
      setPending((p) => ({ ...p, [studentId]: null }))
    }
  }

  function onClickStatus(studentId: string, status: AttendanceStatus) {
    if (status === 'LATE') {
      setLateDialog({ studentId, minutes: 5 })
    } else if (status === 'EXCUSED') {
      setJustificationDialog({ studentId, justification: '' })
    } else {
      handleCall(studentId, status)
    }
  }

  return (
    <div className="space-y-4">
      {/* En-tête — Statistiques */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatBox label="Présents" value={stats.present} tone="emerald" />
        <StatBox label="Retards" value={stats.late} tone="amber" />
        <StatBox label="Absents" value={stats.absent} tone="red" />
        <StatBox label="Excusés" value={stats.excused} tone="blue" />
        <StatBox label="Non appelés" value={stats.uncalled} tone="slate" />
        <StatBox label="Total" value={stats.total} tone="indigo" />
      </div>

      {/* Alerte IQA critiques */}
      {(stats.criticalCount > 0 || stats.warningCount > 0) && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
          <CardContent className="p-3 flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <p className="text-sm text-amber-900 dark:text-amber-200">
              <strong>{stats.criticalCount}</strong> élève(s) en IQA critique (&lt; 75%) et{' '}
              <strong>{stats.warningCount}</strong> en alerte (75-89%). Surveillez ces élèves de près.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recherche */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="🔍 Rechercher par nom ou matricule..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <span className="text-xs text-muted-foreground">
          Période : <strong>{periodLabel}</strong>
        </span>
      </div>

      {/* Tableau Excel-style */}
      <div className="border border-border rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="text-left p-2 font-medium sticky left-0 bg-muted/40">#</th>
                <th className="text-left p-2 font-medium">Élève</th>
                <th className="text-left p-2 font-medium">Matricule</th>
                <th className="text-center p-2 font-medium">IQA</th>
                <th className="text-left p-2 font-medium">Statut</th>
                <th className="text-center p-2 font-medium">Présent</th>
                <th className="text-center p-2 font-medium">Retard</th>
                <th className="text-center p-2 font-medium">Absent</th>
                <th className="text-center p-2 font-medium">Excusé</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((s, i) => {
                const iqaColor = getIqaColor(s.iqaLevel)
                const isPending = pending[s.studentId]
                return (
                  <tr key={s.studentId} className="border-b border-border hover:bg-muted/20">
                    <td className="p-2 text-muted-foreground text-xs sticky left-0 bg-background">{i + 1}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-[10px]">{initials(s.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium flex items-center gap-1">
                            {s.name}
                            {s.financialStatus !== 'REGULAR' && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertTriangle className="h-3 w-3 text-amber-500 inline" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Élève en litige financier : {s.financialStatus}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">{s.financialStatus !== 'REGULAR' ? '⚠️ Litige financier' : 'Régulier'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-2 text-xs text-muted-foreground font-mono">{s.matricule}</td>
                    <td className="p-2 text-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${iqaColor.bg} ${iqaColor.text} ${iqaColor.border} border cursor-help`}>
                              <span className={`h-2 w-2 rounded-full ${iqaColor.dot}`} />
                              {s.iqa.toFixed(1)}%
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-medium">{iqaColor.label} — IQA {s.iqa.toFixed(2)}%</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatIqaTooltip({
                                iqa: s.iqa,
                                level: s.iqaLevel,
                                totalSessions: s.totalSessions,
                                absencesUnexcused: s.absencesUnexcused,
                                absencesExcused: s.absencesExcused,
                                lateCount: s.lateCount,
                                formula: '',
                              })}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {s.totalSessions} séances au total
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                    <td className="p-2">
                      {!s.called ? (
                        <Badge variant="outline" className="text-xs">— Non appelé —</Badge>
                      ) : (
                        <StatusBadge status={s.callStatus!} lateMinutes={s.lateMinutes} justified={s.justified} />
                      )}
                    </td>
                    <td className="p-2 text-center">
                      <Button
                        size="sm"
                        variant={s.callStatus === 'PRESENT' ? 'default' : 'outline'}
                        className="h-8 w-8 p-0 disabled:opacity-50"
                        onClick={() => onClickStatus(s.studentId, 'PRESENT')}
                        disabled={isPending !== undefined && isPending !== null}
                        title="Présent"
                      >
                        {isPending === 'PRESENT' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      </Button>
                    </td>
                    <td className="p-2 text-center">
                      <Button
                        size="sm"
                        variant={s.callStatus === 'LATE' ? 'default' : 'outline'}
                        className="h-8 w-8 p-0 disabled:opacity-50"
                        onClick={() => onClickStatus(s.studentId, 'LATE')}
                        disabled={isPending !== undefined && isPending !== null}
                        title="Retard"
                      >
                        {isPending === 'LATE' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                      </Button>
                    </td>
                    <td className="p-2 text-center">
                      <Button
                        size="sm"
                        variant={s.callStatus === 'ABSENT' ? 'destructive' : 'outline'}
                        className="h-8 w-8 p-0 disabled:opacity-50"
                        onClick={() => onClickStatus(s.studentId, 'ABSENT')}
                        disabled={isPending !== undefined && isPending !== null}
                        title="Absent"
                      >
                        {isPending === 'ABSENT' ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                      </Button>
                    </td>
                    <td className="p-2 text-center">
                      <Button
                        size="sm"
                        variant={s.callStatus === 'EXCUSED' ? 'secondary' : 'outline'}
                        className="h-8 w-8 p-0 disabled:opacity-50"
                        onClick={() => onClickStatus(s.studentId, 'EXCUSED')}
                        disabled={isPending !== undefined && isPending !== null}
                        title="Excusé"
                      >
                        {isPending === 'EXCUSED' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                      </Button>
                    </td>
                  </tr>
                )
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    Aucun élève trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal retard */}
      {lateDialog && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              <h3 className="text-sm font-semibold">Marquer en retard</h3>
            </div>
            <div className="space-y-2">
              <Label htmlFor="late-min">Minutes de retard</Label>
              <Input
                id="late-min"
                type="number"
                min={1}
                max={120}
                value={lateDialog.minutes}
                onChange={(e) => setLateDialog({ ...lateDialog, minutes: parseInt(e.target.value || '5', 10) })}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { handleCall(lateDialog.studentId, 'LATE', { lateMinutes: lateDialog.minutes }); setLateDialog(null) }}>
                Confirmer retard
              </Button>
              <Button size="sm" variant="outline" onClick={() => setLateDialog(null)}>Annuler</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal justification */}
      {justificationDialog && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-semibold">Marquer excusé</h3>
            </div>
            <div className="space-y-2">
              <Label htmlFor="justif">Motif d&apos;excuse</Label>
              <Textarea
                id="justif"
                placeholder="Maladie, convocation, voyage familial..."
                value={justificationDialog.justification}
                onChange={(e) => setJustificationDialog({ ...justificationDialog, justification: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  handleCall(justificationDialog.studentId, 'EXCUSED', { justification: justificationDialog.justification })
                  setJustificationDialog(null)
                }}
              >
                Confirmer excuse
              </Button>
              <Button size="sm" variant="outline" onClick={() => setJustificationDialog(null)}>Annuler</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatBox({ label, value, tone }: { label: string; value: number; tone: string }) {
  const toneClasses: Record<string, string> = {
    emerald: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
    amber: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900',
    red: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900',
    blue: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900',
    slate: 'bg-slate-50 dark:bg-slate-950/30 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-900',
    indigo: 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900',
  }
  return (
    <div className={`p-3 rounded-md border ${toneClasses[tone]}`}>
      <p className="text-xs opacity-80">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}

function StatusBadge({ status, lateMinutes, justified }: { status: string; lateMinutes: number; justified: boolean }) {
  if (status === 'PRESENT') return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">✓ Présent</Badge>
  if (status === 'LATE') return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">⏰ Retard {lateMinutes}min</Badge>
  if (status === 'ABSENT') return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">✗ Absent {justified ? '(excusé)' : '(non excusé)'}</Badge>
  if (status === 'EXCUSED') return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">📄 Excusé</Badge>
  return <Badge variant="outline">{status}</Badge>
}

// ============================================================
// Cahier de textes — Formulaire de saisie
// ============================================================

export function LessonLogForm({
  emargementId,
  classroomName,
  subjectName,
  sessionDate,
  existing,
}: {
  emargementId: string
  classroomName: string
  subjectName: string
  sessionDate: Date
  existing?: {
    lessonTitle: string
    summary: string
    homeworkPublished?: string | null
    resourcesUrl?: string | null
    status: string
  } | null
}) {
  const [lessonTitle, setLessonTitle] = React.useState(existing?.lessonTitle || '')
  const [summary, setSummary] = React.useState(existing?.summary || '')
  const [homework, setHomework] = React.useState(existing?.homeworkPublished || '')
  const [resources, setResources] = React.useState(existing?.resourcesUrl || '')
  const [pending, setPending] = React.useState<'draft' | 'publish' | null>(null)

  async function save(publish: boolean) {
    if (!lessonTitle.trim() || !summary.trim()) {
      toast.error('Titre de la leçon et résumé obligatoires.')
      return
    }
    setPending(publish ? 'publish' : 'draft')
    try {
      const formData = new FormData()
      formData.append('emargementId', emargementId)
      formData.append('lessonTitle', lessonTitle)
      formData.append('summary', summary)
      formData.append('homeworkPublished', homework)
      formData.append('resourcesUrl', resources)
      formData.append('publish', publish ? 'true' : 'false')

      const result = await saveLessonLogAction(undefined, formData)
      if (result.ok) {
        toast.success(publish ? 'Cahier de textes publié' : 'Brouillon sauvegardé')
      } else {
        toast.error(result.error)
      }
    } catch (err) {
      toast.error('Erreur : ' + (err as Error).message)
    } finally {
      setPending(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Cahier de textes — {classroomName} · {subjectName}
        </CardTitle>
        <p className="text-xs text-muted-foreground">Séance du {formatDate(sessionDate)}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor="lessonTitle">Titre de la leçon</Label>
          <Input
            id="lessonTitle"
            placeholder="Ex : Chapitre 3 - Les équations du second degré"
            value={lessonTitle}
            onChange={(e) => setLessonTitle(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="summary">Résumé du cours dispensé</Label>
          <Textarea
            id="summary"
            placeholder="Décrivez le contenu pédagogique de la séance : concepts abordés, exemples traités, exercices en classe..."
            rows={5}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="homework">Devoirs publiés</Label>
          <Textarea
            id="homework"
            placeholder="Ex : Exercices 1 à 5 page 42, à rendre pour le..."
            rows={2}
            value={homework}
            onChange={(e) => setHomework(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="resources">Ressources (liens PowerPoint, PDF, etc.)</Label>
          <Input
            id="resources"
            placeholder="https://drive.google.com/... ou https://example.com/cours.pdf"
            value={resources}
            onChange={(e) => setResources(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Séparez plusieurs liens par des virgules. La Direction pourra consulter ce cahier en lecture seule.
          </p>
        </div>
        <div className="flex gap-2 pt-2">
          <Button onClick={() => save(false)} variant="outline" disabled={pending !== null}>
            {pending === 'draft' && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Sauvegarder brouillon
          </Button>
          <Button onClick={() => save(true)} disabled={pending !== null}>
            {pending === 'publish' && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Publier le cahier
          </Button>
        </div>
        {existing && (
          <p className="text-xs text-muted-foreground">
            Statut actuel : <Badge variant="outline">{existing.status}</Badge>
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// Bouton incident rapide
// ============================================================

export function IncidentReportButton({
  teacherId,
  classroomId,
  agendaId,
}: {
  teacherId: string
  classroomId: string
  agendaId?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [severity, setSeverity] = React.useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM')
  const [category, setCategory] = React.useState('DISCIPLINE')
  const [description, setDescription] = React.useState('')
  const [studentId, setStudentId] = React.useState('')
  const [pending, setPending] = React.useState(false)

  // Génère un UUID offline unique pour cette action
  // (sera sauvegardé en localStorage si réseau KO)
  const clientUUID = React.useMemo(() => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
    return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }, [open]) // régénère à chaque ouverture

  async function submit() {
    if (!description.trim()) {
      toast.error('Description obligatoire.')
      return
    }
    setPending(true)
    try {
      const formData = new FormData()
      formData.append('clientUUID', clientUUID)
      formData.append('teacherId', teacherId)
      formData.append('classroomId', classroomId)
      formData.append('studentId', studentId)
      formData.append('severity', severity)
      formData.append('category', category)
      formData.append('description', description)
      if (agendaId) formData.append('agendaId', agendaId)

      const response = await fetch('/api/incidents/report', {
        method: 'POST',
        body: formData,
      })
      const result = await response.json()

      if (result.ok) {
        toast.success(`Incident signalé (${severity}) — Direction notifiée`)
        setOpen(false)
        setDescription('')
        setStudentId('')
      } else {
        // Tentative de stockage offline
        storeIncidentOffline({
          clientUUID,
          teacherId,
          classroomId,
          studentId,
          severity,
          category,
          description,
          agendaId,
        })
        toast.warning('Réseau indisponible — incident sauvegardé localement. Sera synchronisé au retour réseau.')
        setOpen(false)
      }
    } catch (err) {
      // Stockage offline si réseau KO
      storeIncidentOffline({
        clientUUID,
        teacherId,
        classroomId,
        studentId,
        severity,
        category,
        description,
        agendaId,
      })
      toast.warning('Incident sauvegardé hors-ligne. Sera synchronisé au retour réseau.')
      setOpen(false)
    } finally {
      setPending(false)
    }
  }

  if (!open) {
    return (
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)} className="gap-2">
        <AlertTriangle className="h-4 w-4" />
        Signaler un incident
      </Button>
    )
  }

  return (
    <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          Signaler un incident
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>Gravité</Label>
          <div className="grid grid-cols-4 gap-2 mt-1">
            {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={severity === s ? 'default' : 'outline'}
                onClick={() => setSeverity(s)}
              >
                {s}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <Label>Catégorie</Label>
          <select
            className="w-full p-2 border rounded-md bg-background"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="DISCIPLINE">Discipline</option>
            <option value="MATERIAL">Panne matériel</option>
            <option value="ABSENCE">Absence prolongée</option>
            <option value="BEHAVIOR">Comportement</option>
            <option value="SAFETY">Sécurité</option>
            <option value="OTHER">Autre</option>
          </select>
        </div>
        <div>
          <Label htmlFor="studentId">Élève concerné (optionnel)</Label>
          <Input
            id="studentId"
            placeholder="Matricule ou nom (laisser vide si classe entière)"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="Décrivez l'incident..."
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="destructive" onClick={submit} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Envoyer à la Direction
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Offline Queue — Stockage local des incidents hors-ligne
// ============================================================

const OFFLINE_QUEUE_KEY = 'smartshule:offline-incidents'

function storeIncidentOffline(incident: {
  clientUUID: string
  teacherId: string
  classroomId: string
  studentId: string
  severity: string
  category: string
  description: string
  agendaId?: string
}) {
  if (typeof window === 'undefined') return
  try {
    const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]')
    queue.push({ ...incident, storedAt: new Date().toISOString() })
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
    // Planifier la synchronisation
    scheduleOfflineSync()
  } catch (err) {
    console.error('[offline] Échec stockage incident:', err)
  }
}

function scheduleOfflineSync() {
  if (typeof window === 'undefined') return
  // Tente toutes les 30 secondes si offline
  // + au retour du réseau (event online)
  window.addEventListener('online', syncOfflineIncidents, { once: true })
  setTimeout(syncOfflineIncidents, 30000)
}

export async function syncOfflineIncidents() {
  if (typeof window === 'undefined') return
  let queue: any[] = []
  try {
    queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]')
  } catch {
    return
  }
  if (queue.length === 0) return

  const remaining: any[] = []
  for (const incident of queue) {
    try {
      const formData = new FormData()
      Object.entries(incident).forEach(([k, v]) => {
        if (v !== undefined && v !== null) formData.append(k, String(v))
      })
      const response = await fetch('/api/incidents/report', { method: 'POST', body: formData })
      const result = await response.json()
      if (!result.ok) {
        remaining.push(incident)
      }
    } catch {
      remaining.push(incident)
    }
  }
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining))
  if (remaining.length === 0) {
    toast.success('Incidents hors-ligne synchronisés avec la Direction')
  }
}
