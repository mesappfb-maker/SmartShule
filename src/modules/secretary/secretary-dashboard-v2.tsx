'use client'

import * as React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ss/page-header'
import {
  Loader2, Search, FileText, AlertTriangle, Users, Clock,
  CheckCircle2, XCircle, Send, UserCheck, CalendarClock,
  Mail, AlertCircle, ListChecks, Plus,
} from 'lucide-react'
import { toast } from 'sonner'

type Stats = {
  admissionsPending: number
  admissionsIncomplete: number
  admissionsTransmitted: number
  admissionsDuplicate: number
  studentsWithoutClass: number
  studentsWithoutGuardian: number
  absencesToday: number
  latesToday: number
  parentsToContact: number
  documentsToProduce: number
  transfersToProcess: number
  appointmentsToday: number
  messagesUnread: number
  tasksOverdue: number
  tasksPending: number
  totalStudents: number
  totalActive: number
}

type Task = {
  id: string
  title: string
  description: string | null
  category: string
  priority: string
  status: string
  dueDate: string | null
  assignedToName: string | null
  studentName: string | null
  studentMatricule: string | null
  createdAt: string
}

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700 border-red-200',
  URGENT: 'bg-orange-100 text-orange-700 border-orange-200',
  NORMAL: 'bg-blue-100 text-blue-700 border-blue-200',
  LOW: 'bg-slate-100 text-slate-700 border-slate-200',
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'À traiter', color: 'bg-blue-100 text-blue-700' },
  IN_PROGRESS: { label: 'En cours', color: 'bg-amber-100 text-amber-700' },
  WAITING_PARENT: { label: 'Attente parent', color: 'bg-purple-100 text-purple-700' },
  WAITING_DIRECTION: { label: 'Attente direction', color: 'bg-violet-100 text-violet-700' },
  WAITING_SERVICE: { label: 'Attente service', color: 'bg-cyan-100 text-cyan-700' },
  DONE: { label: 'Terminé', color: 'bg-emerald-100 text-emerald-700' },
  CANCELLED: { label: 'Annulé', color: 'bg-gray-100 text-gray-500' },
}

export function SecretaryDashboardV2({ onNavigate }: { onNavigate: (view: string) => void }) {
  const [stats, setStats] = React.useState<Stats | null>(null)
  const [tasks, setTasks] = React.useState<Task[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')

  React.useEffect(() => {
    Promise.all([
      fetch('/api/secretariat/dashboard', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/secretariat/tasks', { cache: 'no-store' }).then((r) => r.json()),
    ]).then(([dash, taskData]) => {
      if (dash.ok) setStats(dash.stats)
      if (taskData.ok) setTasks(taskData.tasks)
    }).finally(() => setLoading(false))
  }, [])

  async function updateTaskStatus(taskId: string, status: string) {
    try {
      const res = await fetch('/api/secretariat/tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-status', taskId, status }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success(data.message)
        setTasks((prev) => prev.filter((t) => t.id !== taskId))
      }
    } catch (err) {
      toast.error('Erreur : ' + (err as Error).message)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  const filteredTasks = search
    ? tasks.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()) || (t.studentName || '').toLowerCase().includes(search.toLowerCase()))
    : tasks

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tableau de bord — Secrétariat"
        description="Centre opérationnel administratif de l'établissement."
        breadcrumbs={[{ label: 'Secrétariat' }, { label: 'Dashboard' }]}
      />

      {/* Barre d'actions */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onNavigate('admissions')}><FileText className="h-4 w-4 mr-1" /> Admissions</Button>
        <Button size="sm" variant="outline" onClick={() => onNavigate('students')}><Users className="h-4 w-4 mr-1" /> Élèves</Button>
        <Button size="sm" variant="outline" onClick={() => onNavigate('enrollment')}><Plus className="h-4 w-4 mr-1" /> Nouvel élève</Button>
        <Button size="sm" variant="outline" onClick={() => onNavigate('classes')}><ListChecks className="h-4 w-4 mr-1" /> Classes</Button>
        <Button size="sm" variant="outline" onClick={() => onNavigate('absences')}><XCircle className="h-4 w-4 mr-1" /> Absences</Button>
        <Button size="sm" variant="outline" onClick={() => onNavigate('documents')}><FileText className="h-4 w-4 mr-1" /> Documents</Button>
        <Button size="sm" variant="outline" onClick={() => onNavigate('communications')}><Mail className="h-4 w-4 mr-1" /> Communications</Button>
        <Button size="sm" variant="outline" onClick={() => onNavigate('transfers')}><Send className="h-4 w-4 mr-1" /> Transferts</Button>
        <Button size="sm" variant="outline" onClick={() => onNavigate('reports')}><ListChecks className="h-4 w-4 mr-1" /> Rapports</Button>
      </div>

      {/* Indicateurs cliquables */}
      {stats && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          <KPI label="Admissions en attente" value={stats.admissionsPending} icon={<FileText className="h-4 w-4" />} color="blue" onClick={() => onNavigate('admissions')} />
          <KPI label="Dossiers incomplets" value={stats.admissionsIncomplete} icon={<AlertTriangle className="h-4 w-4" />} color="orange" onClick={() => onNavigate('admissions')} />
          <KPI label="Transmis direction" value={stats.admissionsTransmitted} icon={<Send className="h-4 w-4" />} color="violet" onClick={() => onNavigate('admissions')} />
          <KPI label="Doublons ⚠️" value={stats.admissionsDuplicate} icon={<AlertCircle className="h-4 w-4" />} color="red" onClick={() => onNavigate('admissions')} />
          <KPI label="Sans classe" value={stats.studentsWithoutClass} icon={<Users className="h-4 w-4" />} color="amber" onClick={() => onNavigate('students')} />
          <KPI label="Sans parent" value={stats.studentsWithoutGuardian} icon={<UserCheck className="h-4 w-4" />} color="red" onClick={() => onNavigate('students')} />
          <KPI label="Absences aujourd'hui" value={stats.absencesToday} icon={<XCircle className="h-4 w-4" />} color="red" onClick={() => onNavigate('absences')} />
          <KPI label="Retards aujourd'hui" value={stats.latesToday} icon={<Clock className="h-4 w-4" />} color="amber" onClick={() => onNavigate('absences')} />
          <KPI label="Parents à contacter" value={stats.parentsToContact} icon={<Mail className="h-4 w-4" />} color="blue" onClick={() => onNavigate('communications')} />
          <KPI label="Doc. à produire" value={stats.documentsToProduce} icon={<FileText className="h-4 w-4" />} color="teal" onClick={() => onNavigate('documents')} />
          <KPI label="Transferts à traiter" value={stats.transfersToProcess} icon={<Send className="h-4 w-4" />} color="orange" onClick={() => onNavigate('transfers')} />
          <KPI label="RDV du jour" value={stats.appointmentsToday} icon={<CalendarClock className="h-4 w-4" />} color="teal" onClick={() => onNavigate('communications')} />
          <KPI label="Messages non lus" value={stats.messagesUnread} icon={<Mail className="h-4 w-4" />} color="blue" onClick={() => onNavigate('communications')} />
          <KPI label="Tâches en retard" value={stats.tasksOverdue} icon={<AlertTriangle className="h-4 w-4" />} color="red" />
          <KPI label="Tâches en cours" value={stats.tasksPending} icon={<ListChecks className="h-4 w-4" />} color="blue" />
          <KPI label="Total élèves" value={stats.totalStudents} icon={<Users className="h-4 w-4" />} color="primary" onClick={() => onNavigate('students')} />
          <KPI label="Élèves actifs" value={stats.totalActive} icon={<CheckCircle2 className="h-4 w-4" />} color="green" onClick={() => onNavigate('students')} />
        </div>
      )}

      {/* File d'attente administrative */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-primary" />
              Ma file d'attente administrative
            </h3>
            <div className="relative w-64">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher une tâche..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Aucune tâche en attente. Vous êtes à jour ! 🎉</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredTasks.map((task) => (
                <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors">
                  <div className={`px-2 py-0.5 rounded-full text-xs font-bold border ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.NORMAL}`}>
                    {task.priority}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{task.title}</p>
                    {task.description && <p className="text-xs text-muted-foreground truncate">{task.description}</p>}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge className={`${STATUS_LABELS[task.status]?.color || 'bg-gray-100'} text-xs`}>{STATUS_LABELS[task.status]?.label || task.status}</Badge>
                      <Badge variant="outline" className="text-xs">{task.category}</Badge>
                      {task.studentName && <span className="text-xs text-muted-foreground">👤 {task.studentName}</span>}
                      {task.dueDate && <span className={`text-xs ${new Date(task.dueDate) < new Date() ? 'text-red-600 font-bold' : 'text-muted-foreground'}`}>📅 {new Date(task.dueDate).toLocaleDateString('fr-FR')}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => updateTaskStatus(task.id, 'IN_PROGRESS')} title="Démarrer">
                      <Clock className="h-4 w-4 text-amber-500" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => updateTaskStatus(task.id, 'DONE')} title="Terminer">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function KPI({ label, value, icon, color, onClick }: { label: string; value: number; icon: React.ReactNode; color: string; onClick?: () => void }) {
  const colors: Record<string, string> = {
    blue: 'border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300',
    orange: 'border-orange-200 bg-orange-50/50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-300',
    red: 'border-red-200 bg-red-50/50 dark:bg-red-950/20 text-red-700 dark:text-red-300',
    amber: 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300',
    violet: 'border-violet-200 bg-violet-50/50 dark:bg-violet-950/20 text-violet-700 dark:text-violet-300',
    teal: 'border-teal-200 bg-teal-50/50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-300',
    primary: 'border-primary/20 bg-primary/5 text-primary',
    green: 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300',
  }
  return (
    <div
      className={`p-3 rounded-lg border ${colors[color] || colors.blue} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs opacity-80 truncate">{label}</p>
        {icon}
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}
