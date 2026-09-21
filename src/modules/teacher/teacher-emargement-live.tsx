'use client'

// SmartShule — Vue Émargement Live du Portail Prof
// Étape 4 RDC — Portail Prof complet
//
// Permet au prof de :
//   1. Sélectionner une classe + matière + horaire
//   2. Démarrer la séance → crée TeacherAgenda + TeacherEmargement
//   3. Faire l'appel via AttendanceGrid (Excel-style avec IQA pastilles)
//   4. Saisir le cahier de textes (LessonLogForm)
//   5. Signaler un incident (IncidentReportButton — Offline Queue)

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/ss/page-header'
import { EmptyState } from '@/components/ss/empty-state'
import { StatCard } from '@/components/ss/stat-card'
import {
  Activity, Calendar, Clock, Users, Loader2, Play, FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/format'
import { startAttendanceAction } from '@/lib/teacher-emargement-actions'
import { AttendanceGrid, LessonLogForm, IncidentReportButton } from './attendance-grid'

type Assignment = {
  id: string
  subjectId: string
  subjectName: string
  classroomId: string | null
  classroomName: string
  directorateName: string
  sectionName?: string
  optionName?: string
}

type EmargementDetails = {
  emargement: {
    id: string
    agendaId: string
    signatureAt: string
    status: string
    classroomName: string
    classroomId: string
    subjectId: string | null
    subjectName: string
    startDateTime: string
    endDateTime: string
  }
  students: Array<{
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
  }>
  periodLabel: string
}

export function TeacherEmargementLiveView({
  teacherId,
  assignments,
}: {
  teacherId: string
  assignments: Assignment[]
}) {
  const [selectedClassroom, setSelectedClassroom] = React.useState<string>('')
  const [selectedSubject, setSelectedSubject] = React.useState<string>('')
  const [startDateTime, setStartDateTime] = React.useState<string>('')
  const [endDateTime, setEndDateTime] = React.useState<string>('')
  const [room, setRoom] = React.useState<string>('')
  const [starting, setStarting] = React.useState(false)
  const [emargementId, setEmargementId] = React.useState<string | null>(null)
  const [emargementDetails, setEmargementDetails] = React.useState<EmargementDetails | null>(null)
  const [loadingDetails, setLoadingDetails] = React.useState(false)

  // Init valeurs par défaut : maintenant
  React.useEffect(() => {
    const now = new Date()
    now.setMinutes(0, 0, 0)
    const end = new Date(now)
    end.setHours(now.getHours() + 2)
    setStartDateTime(now.toISOString().slice(0, 16))
    setEndDateTime(end.toISOString().slice(0, 16))
  }, [])

  async function startSession() {
    if (!selectedClassroom || !startDateTime) {
      toast.error('Veuillez sélectionner une classe et un horaire.')
      return
    }
    setStarting(true)
    try {
      const formData = new FormData()
      formData.append('classroomId', selectedClassroom)
      formData.append('subjectId', selectedSubject)
      formData.append('startDateTime', new Date(startDateTime).toISOString())
      formData.append('endDateTime', new Date(endDateTime).toISOString())
      formData.append('room', room)

      const result = await startAttendanceAction(undefined, formData)
      if (result.ok) {
        setEmargementId(result.emargementId)
        toast.success(`Séance démarrée — ${result.studentsCount} élèves attendus. Direction notifiée.`)
        // Charger les détails
        await loadEmargementDetails(result.emargementId)
      } else {
        toast.error(result.error)
      }
    } catch (err) {
      toast.error('Erreur : ' + (err as Error).message)
    } finally {
      setStarting(false)
    }
  }

  async function loadEmargementDetails(emargId: string) {
    setLoadingDetails(true)
    try {
      const response = await fetch(`/api/teacher/emargement-details?id=${encodeURIComponent(emargId)}`)
      const result = await response.json()
      if (result.ok) {
        // Convertir les dates ISO en Date pour le composant
        const details = {
          ...result.details,
          emargement: {
            ...result.details.emargement,
            signatureAt: result.details.emargement.signatureAt,
            startDateTime: result.details.emargement.startDateTime,
            endDateTime: result.details.emargement.endDateTime,
          },
          students: result.details.students,
        }
        setEmargementDetails(details)
      } else {
        toast.error(result.error || 'Erreur de chargement')
      }
    } catch (err) {
      toast.error('Erreur réseau : ' + (err as Error).message)
    } finally {
      setLoadingDetails(false)
    }
  }

  // Quand l'émargement est chargé, on affiche la grille + cahier + incident
  if (emargementId && emargementDetails) {
    const startDate = new Date(emargementDetails.emargement.startDateTime)
    return (
      <div className="space-y-6">
        <PageHeader
          title="Séance en cours"
          description={`${emargementDetails.emargement.classroomName} · ${emargementDetails.emargement.subjectName} · Signé à ${new Date(emargementDetails.emargement.signatureAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
          breadcrumbs={[{ label: 'Portail Prof' }, { label: 'Émargement Live' }]}
        />

        {/* Statistiques rapides */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Élèves à appeler"
            value={emargementDetails.students.length}
            icon={<Users className="h-5 w-5" />}
            tone="primary"
          />
          <StatCard
            label="Déjà appelés"
            value={emargementDetails.students.filter((s) => s.called).length}
            icon={<Activity className="h-5 w-5" />}
            tone="success"
          />
          <StatCard
            label="En litige financier"
            value={emargementDetails.students.filter((s) => s.financialStatus !== 'REGULAR').length}
            icon={<FileText className="h-5 w-5" />}
            tone="tertiary"
          />
          <StatCard
            label="IQA critique"
            value={emargementDetails.students.filter((s) => s.iqaLevel === 'CRITICAL').length}
            icon={<Activity className="h-5 w-5" />}
            tone="danger"
          />
        </div>

        {/* Grille d'appel Excel-style avec IQA */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Appel — Grille Excel avec IQA
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Cliquez sur les boutons pour marquer chaque élève. L&apos;IQA est recalculé automatiquement.
            </p>
          </CardHeader>
          <CardContent>
            <AttendanceGrid
              emargementId={emargementId}
              students={emargementDetails.students}
              periodLabel={emargementDetails.periodLabel}
            />
          </CardContent>
        </Card>

        {/* Cahier de textes */}
        <LessonLogForm
          emargementId={emargementId}
          classroomName={emargementDetails.emargement.classroomName}
          subjectName={emargementDetails.emargement.subjectName}
          sessionDate={startDate}
          existing={null}
        />

        {/* Bouton incident */}
        <div className="flex justify-end">
          <IncidentReportButton
            teacherId={teacherId}
            classroomId={emargementDetails.emargement.classroomId}
            agendaId={emargementDetails.emargement.agendaId}
          />
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => { setEmargementId(null); setEmargementDetails(null) }}>
            ← Nouvelle séance
          </Button>
          <Button variant="default" onClick={() => loadEmargementDetails(emargementId)}>
            <Loader2 className={`h-4 w-4 mr-2 ${loadingDetails ? 'animate-spin' : 'hidden'}`} />
            Rafraîchir l&apos;IQA
          </Button>
        </div>
      </div>
    )
  }

  // Écran de démarrage d'une séance
  return (
    <div className="space-y-6">
      <PageHeader
        title="Émargement Live & Appel"
        description="Démarrez une séance pour faire l'appel avec IQA temps réel. La Direction sera notifiée immédiatement."
        breadcrumbs={[{ label: 'Portail Prof' }, { label: 'Émargement Live' }]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Play className="h-4 w-4" /> Démarrer une séance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="classroom">Classe</Label>
              <select
                id="classroom"
                className="w-full p-2 mt-1 border rounded-md bg-background text-sm"
                value={selectedClassroom}
                onChange={(e) => setSelectedClassroom(e.target.value)}
              >
                <option value="">— Sélectionner —</option>
                {assignments.filter((a) => a.classroomId).map((a) => (
                  <option key={a.id} value={a.classroomId!}>
                    {a.classroomName} — {a.subjectName} ({a.directorateName}
                    {a.optionName ? ` · ${a.optionName}` : ''})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="subject">Matière</Label>
              <select
                id="subject"
                className="w-full p-2 mt-1 border rounded-md bg-background text-sm"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
              >
                <option value="">— Sélectionner —</option>
                {assignments
                  .filter((a) => !selectedClassroom || a.classroomId === selectedClassroom)
                  .map((a) => (
                    <option key={a.subjectId} value={a.subjectId}>
                      {a.subjectName}
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="start">Début</Label>
                <Input
                  id="start"
                  type="datetime-local"
                  value={startDateTime}
                  onChange={(e) => setStartDateTime(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="end">Fin</Label>
                <Input
                  id="end"
                  type="datetime-local"
                  value={endDateTime}
                  onChange={(e) => setEndDateTime(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="room">Salle (optionnel)</Label>
              <Input
                id="room"
                placeholder="Ex : Salle 12B"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
              />
            </div>

            <Button onClick={startSession} disabled={starting || !selectedClassroom} className="w-full">
              {starting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Démarrage en cours...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Démarrer la séance + Signer l&apos;émargement
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              ⚡ Dès que vous démarrez, la Direction est notifiée en temps réel. L&apos;IQA de chaque élève sera affiché dans la grille d&apos;appel.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Comment ça marche
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex gap-3">
              <div className="bg-primary/10 text-primary rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold shrink-0">1</div>
              <div>
                <p className="font-medium text-foreground">Sélection classe + matière + horaire</p>
                <p>Choisissez la classe où vous allez enseigner, la matière et le créneau horaire.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="bg-primary/10 text-primary rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold shrink-0">2</div>
              <div>
                <p className="font-medium text-foreground">Démarrage + signature électronique</p>
                <p>L&apos;émargement est horodaté. La Direction reçoit instantanément une notification.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="bg-primary/10 text-primary rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold shrink-0">3</div>
              <div>
                <p className="font-medium text-foreground">Appel — Grille Excel avec IQA</p>
                <p>Marquez chaque élève (Présent, Retard, Absent, Excusé). L&apos;IQA est recalculé en direct.</p>
                <p className="text-xs mt-1">
                  Pastilles couleur : <Badge variant="outline" className="ml-1 bg-emerald-100 text-emerald-700">🟢 ≥ 90%</Badge>
                  <Badge variant="outline" className="ml-1 bg-amber-100 text-amber-700">🟡 75-89%</Badge>
                  <Badge variant="outline" className="ml-1 bg-red-100 text-red-700">🔴 &lt; 75%</Badge>
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="bg-primary/10 text-primary rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold shrink-0">4</div>
              <div>
                <p className="font-medium text-foreground">Cahier de textes</p>
                <p>Saisissez le titre, le résumé, les devoirs et les ressources. Auditable par la Direction.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="bg-primary/10 text-primary rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold shrink-0">5</div>
              <div>
                <p className="font-medium text-foreground">Bouton incident ⚠️</p>
                <p>Signalez un problème (matériel, discipline, sécurité). Sauvegarde hors-ligne si réseau coupé.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {assignments.length === 0 && (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="Aucune affectation"
          description="Vous n'avez pas encore de classes assignées. Contactez la Direction."
        />
      )}
    </div>
  )
}
