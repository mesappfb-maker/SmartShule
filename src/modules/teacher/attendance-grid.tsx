'use client'

// SmartShule — Composant : Grille d'appel Excel-style avec IQA pastilles
// Étape 4 RDC — Portail Prof
//
// Pour chaque élève :
//   - Avatar + nom complet + matricule + classe
//   - Pastille IQA (vert/orange/rouge) + tooltip
//   - 4 boutons : Présent / Retard / Absent / Excusé
//   - Fenêtre retard/excusé s'ouvre INLINE sous la ligne de l'élève
//
// Lorsqu'on clique sur un bouton :
//   - Appel API /api/teacher/attendance (fetch)
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
import { AlertTriangle, Check, Clock, X, FileText, Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { initials, formatDate } from '@/lib/format'
import { getIqaColor, formatIqaTooltip } from '@/lib/iqa-pure'

type StudentWithIqa = {
  studentId: string
  name: string
  matricule: string
  financialStatus: string
  studentStatus: string // ACTIVE | TRANSFERRED | ARCHIVED
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
  // Fenêtre inline — s'ouvre DIRECTEMENT sous la ligne de l'élève
  const [inlineDialog, setInlineDialog] = React.useState<{
    studentId: string
    type: 'LATE' | 'EXCUSED'
    minutes: number
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

      const response = await fetch('/api/teacher/attendance', {
        method: 'POST',
        body: formData,
      })
      const result = await response.json()

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
      // Ouvrir la fenêtre INLINE sous cet élève
      setInlineDialog({ studentId, type: 'LATE', minutes: 5, justification: '' })
    } else if (status === 'EXCUSED') {
      // Ouvrir la fenêtre INLINE sous cet élève
      setInlineDialog({ studentId, type: 'EXCUSED', minutes: 0, justification: '' })
    } else {
      handleCall(studentId, status)
    }
  }

  function confirmInline() {
    if (!inlineDialog) return
    if (inlineDialog.type === 'LATE') {
      handleCall(inlineDialog.studentId, 'LATE', { lateMinutes: inlineDialog.minutes })
    } else {
      handleCall(inlineDialog.studentId, 'EXCUSED', { justification: inlineDialog.justification })
    }
    setInlineDialog(null)
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
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom ou matricule..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
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
                <th className="text-left p-2 font-medium">Statut</th>
                <th className="text-center p-2 font-medium">IQA</th>
                <th className="text-left p-2 font-medium">Appel</th>
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
                const isDialogOpen = inlineDialog?.studentId === s.studentId
                return (
                  <React.Fragment key={s.studentId}>
                    <tr className="border-b border-border hover:bg-muted/20">
                      <td className="p-2 text-muted-foreground text-xs sticky left-0 bg-background">{i + 1}</td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-[10px]">{initials(s.name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium flex items-center gap-1">
                              {s.name}
                              {s.financialStatus !== 'REGULAR' && s.financialStatus !== undefined && (
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
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs text-muted-foreground font-mono">{s.matricule}</span>
                              {s.studentStatus && s.studentStatus !== 'ACTIVE' && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0">
                                  {s.studentStatus === 'TRANSFERRED' ? 'Transféré' : s.studentStatus === 'ARCHIVED' ? 'Archivé' : s.studentStatus}
                                </Badge>
                              )}
                              {s.financialStatus && s.financialStatus !== 'REGULAR' && s.financialStatus !== undefined && (
                                <Badge className="text-[10px] h-4 px-1.5 py-0 bg-amber-100 text-amber-700">Litige financier</Badge>
                              )}
                            </div>
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
                        <div className="flex flex-col gap-0.5">
                          {!s.called ? (
                            <Badge variant="outline" className="text-xs w-fit">Non appelé</Badge>
                          ) : (
                            <StatusBadge status={s.callStatus!} lateMinutes={s.lateMinutes} justified={s.justified} />
                          )}
                          {s.studentStatus && s.studentStatus !== 'ACTIVE' && (
                            <Badge variant="outline" className="text-[10px] w-fit mt-0.5">
                              {s.studentStatus === 'TRANSFERRED' ? 'Transféré' : s.studentStatus === 'ARCHIVED' ? 'Archivé' : s.studentStatus}
                            </Badge>
                          )}
                        </div>
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
                    {/* Fenêtre INLINE — s'ouvre directement sous la ligne de l'élève */}
                    {isDialogOpen && (
                      <tr>
                        <td colSpan={9} className="p-0">
                          {inlineDialog!.type === 'LATE' ? (
                            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-900">
                              <div className="flex items-center gap-2 mb-3">
                                <Clock className="h-4 w-4 text-amber-600" />
                                <h3 className="text-sm font-semibold">
                                  Marquer en retard : <span className="text-amber-700">{s.name}</span>
                                </h3>
                                <span className="text-xs text-muted-foreground ml-2">{s.matricule}</span>
                              </div>
                              <div className="flex items-end gap-3">
                                <div className="flex-1 max-w-xs">
                                  <Label htmlFor="late-min" className="text-xs">Minutes de retard</Label>
                                  <Input
                                    id="late-min"
                                    type="number"
                                    min={1}
                                    max={120}
                                    value={inlineDialog!.minutes}
                                    onChange={(e) => setInlineDialog({ ...inlineDialog!, minutes: parseInt(e.target.value || '5', 10) })}
                                    className="mt-1"
                                  />
                                </div>
                                <Button size="sm" onClick={confirmInline}>
                                  Confirmer retard
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setInlineDialog(null)}>Annuler</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-900">
                              <div className="flex items-center gap-2 mb-3">
                                <FileText className="h-4 w-4 text-blue-600" />
                                <h3 className="text-sm font-semibold">
                                  Marquer excusé : <span className="text-blue-700">{s.name}</span>
                                </h3>
                                <span className="text-xs text-muted-foreground ml-2">{s.matricule}</span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  Statut actuel : {s.called ? s.callStatus : 'Non appelé'}
                                </span>
                              </div>
                              <div className="space-y-2">
                                <div>
                                  <Label htmlFor="justif" className="text-xs">Motif de l'excuse</Label>
                                  <Textarea
                                    id="justif"
                                    placeholder="Maladie, convocation, voyage familial..."
                                    value={inlineDialog!.justification}
                                    onChange={(e) => setInlineDialog({ ...inlineDialog!, justification: e.target.value })}
                                    rows={2}
                                    className="mt-1"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={confirmInline}>
                                    Confirmer l'excuse
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setInlineDialog(null)}>Annuler</Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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
  if (status === 'PRESENT') return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">Present</Badge>
  if (status === 'LATE') return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Retard {lateMinutes}min</Badge>
  if (status === 'ABSENT') return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Absent {justified ? '(excuse)' : '(non excuse)'}</Badge>
  if (status === 'EXCUSED') return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Excuse</Badge>
  return <Badge variant="outline">{status}</Badge>
}

// ============================================================
// Cahier de textes — Formulaire de saisie (API route, pas server action)
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
      toast.error('Titre de la lecon et resume obligatoires.')
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

      const response = await fetch('/api/teacher/lesson-log', {
        method: 'POST',
        body: formData,
      })
      const result = await response.json()

      if (result.ok) {
        toast.success(publish ? 'Cahier de textes publie' : 'Brouillon sauvegarde')
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
        <p className="text-xs text-muted-foreground">Seance du {formatDate(sessionDate)}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor="lessonTitle">Titre de la lecon</Label>
          <Input
            id="lessonTitle"
            placeholder="Ex : Chapitre 3 - Les equations du second degre"
            value={lessonTitle}
            onChange={(e) => setLessonTitle(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="summary">Resume du cours dispense</Label>
          <Textarea
            id="summary"
            placeholder="Decrivez le contenu pedagogique de la seance : concepts abordes, exemples traites, exercices en classe..."
            rows={5}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="homework">Devoirs publies</Label>
          <Textarea
            id="homework"
            placeholder="Ex : Exercices 1 a 5 page 42, a rendre pour le..."
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
            Separez plusieurs liens par des virgules. La Direction pourra consulter ce cahier en lecture seule.
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
// Bouton incident avec autocomplete eleves
// ============================================================

export function IncidentReportButton({
  teacherId,
  classroomId,
  agendaId,
  classroomStudents,
}: {
  teacherId: string
  classroomId: string
  agendaId?: string
  classroomStudents?: Array<{ id: string; name: string; matricule: string }>
}) {
  const [open, setOpen] = React.useState(false)
  const [severity, setSeverity] = React.useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM')
  const [category, setCategory] = React.useState('DISCIPLINE')
  const [description, setDescription] = React.useState('')
  const [studentSearch, setStudentSearch] = React.useState('')
  const [selectedStudentId, setSelectedStudentId] = React.useState('')
  const [selectedStudentName, setSelectedStudentName] = React.useState('')
  const [showSuggestions, setShowSuggestions] = React.useState(false)
  const [pending, setPending] = React.useState(false)

  // Filtrer les suggestions d'élèves
  const suggestions = React.useMemo(() => {
    if (!classroomStudents || !studentSearch.trim()) return []
    const q = studentSearch.toLowerCase()
    return classroomStudents
      .filter((s) => s.name.toLowerCase().includes(q) || s.matricule.toLowerCase().includes(q))
      .slice(0, 5)
  }, [classroomStudents, studentSearch])

  function selectStudent(student: { id: string; name: string }) {
    setSelectedStudentId(student.id)
    setSelectedStudentName(student.name)
    setStudentSearch(student.name)
    setShowSuggestions(false)
  }

  async function submit() {
    if (!description.trim()) {
      toast.error('Description obligatoire.')
      return
    }
    setPending(true)
    try {
      const formData = new FormData()
      formData.append('teacherId', teacherId)
      formData.append('classroomId', classroomId)
      formData.append('studentId', selectedStudentId || studentSearch)
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
        toast.success(`Incident signale (${severity}) — Direction notifiee`)
        setOpen(false)
        setDescription('')
        setStudentSearch('')
        setSelectedStudentId('')
        setSelectedStudentName('')
      } else {
        // Stockage offline
        storeIncidentOffline({
          teacherId,
          classroomId,
          studentId: selectedStudentId || studentSearch,
          severity,
          category,
          description,
          agendaId,
        })
        toast.warning('Incident sauvegarde hors-ligne. Sera synchronise au retour reseau.')
        setOpen(false)
      }
    } catch (err) {
      // Stockage offline
      storeIncidentOffline({
        teacherId,
        classroomId,
        studentId: selectedStudentId || studentSearch,
        severity,
        category,
        description,
        agendaId,
      })
      toast.warning('Incident sauvegarde hors-ligne. Sera synchronise au retour reseau.')
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
          <Label>Gravite</Label>
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
          <Label>Categorie</Label>
          <select
            className="w-full p-2 border rounded-md bg-background"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="DISCIPLINE">Discipline</option>
            <option value="MATERIAL">Panne materiel</option>
            <option value="ABSENCE">Absence prolongee</option>
            <option value="BEHAVIOR">Comportement</option>
            <option value="SAFETY">Securite</option>
            <option value="OTHER">Autre</option>
          </select>
        </div>
        <div className="relative">
          <Label htmlFor="studentSearch">Eleve concerne (optionnel)</Label>
          <Input
            id="studentSearch"
            placeholder="Tapez le nom ou matricule..."
            value={studentSearch}
            onChange={(e) => {
              setStudentSearch(e.target.value)
              setShowSuggestions(true)
              // Reset selection si on modifie le texte
              if (e.target.value !== selectedStudentName) {
                setSelectedStudentId('')
              }
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          />
          {/* Autocomplete suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm border-b last:border-0"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    selectStudent(s)
                  }}
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">{s.matricule}</span>
                </button>
              ))}
            </div>
          )}
          {selectedStudentId && (
            <p className="text-xs text-emerald-600 mt-1">Eleve selectionne : {selectedStudentName}</p>
          )}
          {!selectedStudentId && studentSearch.trim() && suggestions.length === 0 && classroomStudents && (
            <p className="text-xs text-muted-foreground mt-1">Aucun eleve trouve — texte libre accepte</p>
          )}
          {!classroomStudents && (
            <p className="text-xs text-muted-foreground mt-1">Laisser vide si classe entiere</p>
          )}
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="Decrivez l'incident..."
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="destructive" onClick={submit} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Envoyer a la Direction
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
    scheduleOfflineSync()
  } catch (err) {
    console.error('[offline] Echec stockage incident:', err)
  }
}

function scheduleOfflineSync() {
  if (typeof window === 'undefined') return
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
    toast.success('Incidents hors-ligne synchronises avec la Direction')
  }
}
