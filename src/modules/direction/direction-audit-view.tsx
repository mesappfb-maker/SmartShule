'use client'

// SmartShule — Vue Direction : Audit du cahier de textes + Temps réel
// Étape 4 RDC — Portail Prof complet
//
// Permet à la Direction de :
//   - Consulter en lecture seule tous les cahiers de textes publiés
//   - Filtrer par enseignant / matière / période
//   - Auditer un cahier (marquer comme vérifié avec commentaire)
//   - Voir en temps réel quels profs enseignent actuellement

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/ss/empty-state'
import { StatCard } from '@/components/ss/stat-card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Activity,
  BookOpen,
  Users,
  AlertTriangle,
  FileText,
  CheckCircle2,
  Clock,
  RefreshCw,
  Calendar,
  User,
  Search,
} from 'lucide-react'
import { formatDate, formatRelative } from '@/lib/format'
import { toast } from 'sonner'
import { auditLessonLogAction, resolveIncidentAction } from '@/lib/teacher-emargement-actions'

type LessonLogRow = {
  id: string
  teacherName: string
  classroomName: string
  subjectName: string
  sessionDate: Date
  lessonTitle: string
  summary: string
  homeworkPublished?: string | null
  resourcesUrl?: string | null
  status: string
  auditedAt?: Date | null
  auditComment?: string | null
}

type LiveClassRow = {
  agendaId: string
  teacherId: string
  teacherName: string
  classroomName: string
  subjectName: string
  startDateTime: Date
  endDateTime: Date
  room?: string | null
  emargementSigned: boolean
  signatureAt?: Date | null
  studentsCalled: number
  directorNotifiedAt?: Date | null
}

type IncidentRow = {
  id: string
  teacherName: string
  classroomName: string
  studentName?: string | null
  severity: string
  category: string
  description: string
  status: string
  createdAt: Date
  syncStatus: string
  resolution?: string | null
}

type EmargementRow = {
  id: string
  teacherName: string
  classroomName: string
  subjectName: string
  signatureAt: Date
  startDateTime: Date
  endDateTime: Date
  room?: string | null
  studentsCalledCount: number
  hasLessonLog: boolean
  lessonLogStatus?: string | null
}

type Stats = {
  liveCount: number
  doneToday: number
  emargementsToday: number
  criticalOpenIncidents: number
  publishedToday: number
  timestamp: Date
}

export function DirectionAuditView({
  lessonLogs,
  liveClasses,
  incidents,
  emargementsToday,
  stats,
  teachers,
  subjects,
}: {
  lessonLogs: LessonLogRow[]
  liveClasses: LiveClassRow[]
  incidents: IncidentRow[]
  emargementsToday: EmargementRow[]
  stats: Stats
  teachers: Array<{ id: string; name: string }>
  subjects: Array<{ id: string; name: string }>
}) {
  const [tab, setTab] = React.useState<'realtime' | 'lessons' | 'incidents' | 'emargements'>('realtime')
  const [filterTeacher, setFilterTeacher] = React.useState<string>('')
  const [filterSubject, setFilterSubject] = React.useState<string>('')
  const [filterStartDate, setFilterStartDate] = React.useState<string>('')
  const [filterEndDate, setFilterEndDate] = React.useState<string>('')
  const [search, setSearch] = React.useState('')
  const [autoRefresh, setAutoRefresh] = React.useState(true)

  // Filtres locaux sur lessonLogs
  const filteredLogs = React.useMemo(() => {
    return lessonLogs.filter((l) => {
      if (filterTeacher && l.teacherName !== teachers.find((t) => t.id === filterTeacher)?.name) return false
      if (filterSubject && l.subjectName !== subjects.find((s) => s.id === filterSubject)?.name) return false
      if (filterStartDate && new Date(l.sessionDate) < new Date(filterStartDate)) return false
      if (filterEndDate) {
        const end = new Date(filterEndDate)
        end.setHours(23, 59, 59, 999)
        if (new Date(l.sessionDate) > end) return false
      }
      if (search) {
        const q = search.toLowerCase()
        if (
          !l.teacherName.toLowerCase().includes(q) &&
          !l.classroomName.toLowerCase().includes(q) &&
          !l.lessonTitle.toLowerCase().includes(q) &&
          !l.summary.toLowerCase().includes(q)
        )
          return false
      }
      return true
    })
  }, [lessonLogs, filterTeacher, filterSubject, filterStartDate, filterEndDate, search, teachers, subjects])

  return (
    <div className="space-y-6">
      {/* Stats temps réel */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Cours en cours"
          value={stats.liveCount}
          icon={<Activity className="h-5 w-5" />}
          tone="primary"
        />
        <StatCard
          label="Émargements aujourd'hui"
          value={stats.emargementsToday}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="info"
        />
        <StatCard
          label="Cours terminés"
          value={stats.doneToday}
          icon={<Clock className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="Cahiers publiés"
          value={stats.publishedToday}
          icon={<BookOpen className="h-5 w-5" />}
          tone="tertiary"
        />
        <StatCard
          label="⚠️ Incidents critiques"
          value={stats.criticalOpenIncidents}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone={stats.criticalOpenIncidents > 0 ? 'danger' : 'success'}
        />
      </div>

      {/* Onglets */}
      <div className="border-b border-border">
        <nav className="flex gap-2 -mb-px overflow-x-auto">
          <TabButton active={tab === 'realtime'} onClick={() => setTab('realtime')}>
            <Activity className="h-4 w-4 mr-1.5" /> Temps réel
            {stats.liveCount > 0 && <Badge variant="default" className="ml-1.5 animate-pulse">{stats.liveCount}</Badge>}
          </TabButton>
          <TabButton active={tab === 'lessons'} onClick={() => setTab('lessons')}>
            <BookOpen className="h-4 w-4 mr-1.5" /> Cahier de textes
            <Badge variant="outline" className="ml-1.5">{lessonLogs.length}</Badge>
          </TabButton>
          <TabButton active={tab === 'incidents'} onClick={() => setTab('incidents')}>
            <AlertTriangle className="h-4 w-4 mr-1.5" /> Incidents
            {incidents.length > 0 && <Badge variant="destructive" className="ml-1.5">{incidents.length}</Badge>}
          </TabButton>
          <TabButton active={tab === 'emargements'} onClick={() => setTab('emargements')}>
            <CheckCircle2 className="h-4 w-4 mr-1.5" /> Émargements du jour
            <Badge variant="outline" className="ml-1.5">{emargementsToday.length}</Badge>
          </TabButton>
        </nav>
      </div>

      {/* TAB 1 : Temps réel */}
      {tab === 'realtime' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Profs actuellement en cours</h2>
              <p className="text-xs text-muted-foreground">
                Mis à jour à : {formatDate(stats.timestamp)} {stats.timestamp.toLocaleTimeString('fr-FR')}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setAutoRefresh(!autoRefresh); toast.info(autoRefresh ? 'Auto-refresh désactivé' : 'Auto-refresh activé') }}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
              Auto-refresh
            </Button>
          </div>

          {liveClasses.length === 0 ? (
            <EmptyState
              icon={<Activity className="h-5 w-5" />}
              title="Aucun cours en cours actuellement"
              description="Les émargements des professeurs apparaîtront ici en temps réel dès qu'ils démarreront une séance."
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {liveClasses.map((c) => (
                <LiveClassCard key={c.agendaId} cls={c} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2 : Cahier de textes (audit lecture seule) */}
      {tab === 'lessons' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Audit du cahier de textes</h2>
            <p className="text-xs text-muted-foreground">
              Consultez l&apos;avancement pédagogique. Vous pouvez auditer (valider) un cahier pour confirmer sa conformité.
            </p>
          </div>

          {/* Filtres */}
          <Card>
            <CardContent className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <Label className="text-xs">Enseignant</Label>
                <select
                  className="w-full p-2 mt-1 border rounded-md bg-background text-sm"
                  value={filterTeacher}
                  onChange={(e) => setFilterTeacher(e.target.value)}
                >
                  <option value="">Tous</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Matière</Label>
                <select
                  className="w-full p-2 mt-1 border rounded-md bg-background text-sm"
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                >
                  <option value="">Toutes</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Du</Label>
                <Input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Au</Label>
                <Input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Recherche</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Titre, contenu..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-7"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Liste des cahiers */}
          {filteredLogs.length === 0 ? (
            <EmptyState icon={<BookOpen className="h-5 w-5" />} title="Aucun cahier de textes trouvé" />
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((l) => (
                <LessonLogAuditCard key={l.id} log={l} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3 : Incidents */}
      {tab === 'incidents' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Incidents signalés par les enseignants</h2>
            <p className="text-xs text-muted-foreground">
              Classez par gravité. Vous pouvez résoudre un incident avec un commentaire.
            </p>
          </div>

          {incidents.length === 0 ? (
            <EmptyState icon={<AlertTriangle className="h-5 w-5" />} title="Aucun incident ouvert" />
          ) : (
            <div className="space-y-3">
              {incidents.map((i) => (
                <IncidentCard key={i.id} incident={i} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4 : Émargements du jour */}
      {tab === 'emargements' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Émargements du jour</h2>
            <p className="text-xs text-muted-foreground">
              Tous les professeurs qui ont signé leur présence aujourd&apos;hui.
            </p>
          </div>

          {emargementsToday.length === 0 ? (
            <EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title="Aucun émargement aujourd'hui" />
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/40">
                      <tr>
                        <th className="text-left p-2 font-medium">Professeur</th>
                        <th className="text-left p-2 font-medium">Classe</th>
                        <th className="text-left p-2 font-medium">Matière</th>
                        <th className="text-left p-2 font-medium">Signature</th>
                        <th className="text-left p-2 font-medium">Créneau</th>
                        <th className="text-center p-2 font-medium">Élèves</th>
                        <th className="text-center p-2 font-medium">Cahier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emargementsToday.map((e) => (
                        <tr key={e.id} className="border-b hover:bg-muted/20">
                          <td className="p-2 font-medium">{e.teacherName}</td>
                          <td className="p-2">{e.classroomName}</td>
                          <td className="p-2">{e.subjectName}</td>
                          <td className="p-2">
                            <Badge variant="default" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                              {e.signatureAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </Badge>
                          </td>
                          <td className="p-2 text-xs text-muted-foreground">
                            {e.startDateTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            {' → '}
                            {e.endDateTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            {e.room && ` · ${e.room}`}
                          </td>
                          <td className="p-2 text-center">
                            <Badge variant="outline">{e.studentsCalledCount}</Badge>
                          </td>
                          <td className="p-2 text-center">
                            {e.hasLessonLog ? (
                              <Badge variant="default" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                {e.lessonLogStatus}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">En attente</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
      }`}
    >
      {children}
    </button>
  )
}

function LiveClassCard({ cls }: { cls: LiveClassRow }) {
  const elapsed = Math.floor((Date.now() - cls.startDateTime.getTime()) / 60000)
  return (
    <Card className={`border-l-4 ${cls.emargementSigned ? 'border-l-emerald-500' : 'border-l-amber-500'} animate-in fade-in`}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">{cls.teacherName}</p>
            <p className="text-xs text-muted-foreground">
              {cls.classroomName} · {cls.subjectName}
            </p>
          </div>
          {cls.emargementSigned ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Live
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Signé à {cls.signatureAt?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                  <p className="text-xs text-muted-foreground">Direction notifiée</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Badge variant="outline" className="text-xs">Planifié</Badge>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>
              {cls.startDateTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              {' → '}
              {cls.endDateTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span>{cls.studentsCalled} élèves</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{elapsed} min écoulées</span>
          </div>
        </div>
        {cls.room && (
          <p className="text-xs text-muted-foreground">📍 Salle : {cls.room}</p>
        )}
      </CardContent>
    </Card>
  )
}

function LessonLogAuditCard({ log }: { log: LessonLogRow }) {
  const [auditing, setAuditing] = React.useState(false)
  const [comment, setComment] = React.useState('')
  const [pending, setPending] = React.useState(false)

  async function submitAudit() {
    setPending(true)
    try {
      const formData = new FormData()
      formData.append('lessonLogId', log.id)
      formData.append('auditComment', comment)
      const result = await auditLessonLogAction(undefined, formData)
      if (result.ok) {
        toast.success('Cahier de textes audité')
        setAuditing(false)
      } else {
        toast.error(result.error)
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className={log.status === 'AUDITED' ? 'border-l-4 border-l-emerald-500' : log.status === 'PUBLISHED' ? 'border-l-4 border-l-blue-500' : ''}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <User className="h-4 w-4 text-muted-foreground" />
              <p className="font-semibold text-sm">{log.teacherName}</p>
              <Badge variant="outline" className="text-xs">{log.classroomName}</Badge>
              <Badge variant="outline" className="text-xs">{log.subjectName}</Badge>
              <span className="text-xs text-muted-foreground">{formatDate(log.sessionDate)}</span>
            </div>
            <h3 className="font-medium text-sm">{log.lessonTitle}</h3>
            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{log.summary}</p>
            {log.homeworkPublished && (
              <div className="mt-2 p-2 bg-muted/40 rounded-md">
                <p className="text-xs font-medium">📝 Devoirs :</p>
                <p className="text-sm">{log.homeworkPublished}</p>
              </div>
            )}
            {log.resourcesUrl && (
              <p className="text-xs text-blue-600 mt-1">
                📎 Ressources : {log.resourcesUrl.split(',').map((url, i) => (
                  <a key={i} href={url.trim()} target="_blank" rel="noopener noreferrer" className="underline">
                    [{i + 1}]
                  </a>
                ))}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1 items-end">
            <StatusPill status={log.status} />
            {log.auditedAt && (
              <p className="text-xs text-muted-foreground">Audité le {formatDate(log.auditedAt)}</p>
            )}
            {log.auditComment && (
              <p className="text-xs italic text-muted-foreground mt-1 max-w-xs">« {log.auditComment} »</p>
            )}
          </div>
        </div>

        {log.status === 'PUBLISHED' && !auditing && (
          <Button size="sm" variant="outline" onClick={() => setAuditing(true)}>
            <CheckCircle2 className="h-4 w-4 mr-1" /> Auditer ce cahier
          </Button>
        )}

        {auditing && (
          <div className="space-y-2 mt-2 p-3 border rounded-md bg-muted/30">
            <Label className="text-xs">Commentaire d&apos;audit (optionnel)</Label>
            <Textarea
              placeholder="Conformité, observation pédagogique, recommandation..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={submitAudit} disabled={pending}>
                {pending ? 'Audit en cours...' : 'Valider l\'audit'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAuditing(false)}>Annuler</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function IncidentCard({ incident }: { incident: IncidentRow }) {
  const [showResolve, setShowResolve] = React.useState(false)
  const [resolution, setResolution] = React.useState('')
  const [pending, setPending] = React.useState(false)

  async function resolve() {
    if (!resolution.trim()) {
      toast.error('Veuillez décrire la résolution.')
      return
    }
    setPending(true)
    try {
      const formData = new FormData()
      formData.append('incidentId', incident.id)
      formData.append('resolution', resolution)
      const result = await resolveIncidentAction(undefined, formData)
      if (result.ok) {
        toast.success('Incident résolu')
        setShowResolve(false)
      } else {
        toast.error(result.error)
      }
    } finally {
      setPending(false)
    }
  }

  const severityColor = {
    CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border-red-200',
    HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 border-orange-200',
    MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-200',
    LOW: 'bg-slate-100 text-slate-700 dark:bg-slate-950 dark:text-slate-300 border-slate-200',
  }[incident.severity] || ''

  return (
    <Card className={`border-l-4 ${
    incident.severity === 'CRITICAL' ? 'border-l-red-500' :
    incident.severity === 'HIGH' ? 'border-l-orange-500' :
    incident.severity === 'MEDIUM' ? 'border-l-amber-500' : 'border-l-slate-500'
  }`}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${severityColor}`}>
                {incident.severity}
              </span>
              <Badge variant="outline" className="text-xs">{incident.category}</Badge>
              {incident.syncStatus === 'PENDING' && (
                <Badge variant="outline" className="text-xs text-amber-600">⚠ Hors-ligne</Badge>
              )}
              <span className="text-xs text-muted-foreground">{formatRelative(incident.createdAt)}</span>
            </div>
            <p className="text-sm">{incident.description}</p>
            <p className="text-xs text-muted-foreground mt-1">
              👤 {incident.teacherName} · 🏫 {incident.classroomName}
              {incident.studentName && ` · 🧑‍🎓 ${incident.studentName}`}
            </p>
            {incident.resolution && (
              <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-md">
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">✓ Résolution :</p>
                <p className="text-sm">{incident.resolution}</p>
              </div>
            )}
          </div>
        </div>

        {incident.status === 'OPEN' && !showResolve && (
          <Button size="sm" variant="outline" onClick={() => setShowResolve(true)}>
            <CheckCircle2 className="h-4 w-4 mr-1" /> Marquer résolu
          </Button>
        )}

        {showResolve && (
          <div className="space-y-2 mt-2 p-3 border rounded-md bg-muted/30">
            <Label className="text-xs">Résolution</Label>
            <Textarea
              placeholder="Action entreprise, sanction, suivi..."
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              rows={2}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={resolve} disabled={pending}>
                {pending ? 'Résolution...' : 'Confirmer'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowResolve(false)}>Annuler</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; className?: string }> = {
    DRAFT: { label: 'Brouillon', variant: 'outline' },
    PUBLISHED: { label: 'Publié', variant: 'default', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
    AUDITED: { label: '✓ Audité', variant: 'default', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' },
  }
  const cfg = map[status] || { label: status, variant: 'outline' as const }
  return <Badge variant={cfg.variant} className={cfg.className}>{cfg.label}</Badge>
}
