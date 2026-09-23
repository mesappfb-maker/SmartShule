'use client'

// SmartShule — Listes de classes dynamiques (Secrétariat)
// ============================================================
// Vue 1 : Liste des classes (cartes cliquables)
// Vue 2 : Détails d'une classe (élèves + profs + horaires + stats)

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ss/page-header'
import {
  Loader2, Users, ArrowLeft, Calendar, BookOpen, UserCheck,
  TrendingUp, AlertTriangle, FileText, CreditCard, Eye,
} from 'lucide-react'
import { toast } from 'sonner'

type ClassroomItem = {
  id: string
  name: string
  capacity: number
  directorateName: string
  sectionName?: string
  optionName?: string
  academicYearLabel?: string
  enrolledCount: number
  teacherCount: number
  fillRate: number
}

type ClassroomDetail = {
  classroom: {
    id: string
    name: string
    capacity: number
    directorateName: string
    sectionName?: string
    optionName?: string
    academicYearLabel?: string
  }
  students: Array<{
    id: string
    fullName: string
    matricule: string
    gender: string | null
    status: string
    financialStatus: string
    guardianName?: string
    guardianPhone?: string
    absencesCount: number
    latesCount: number
  }>
  teachers: Array<{
    id: string
    name: string
    email?: string
    phone?: string
    subjectName: string
    subjectCode: string
  }>
  schedule: Array<{
    id: string
    dayName: string
    startTime: string
    endTime: string
    room?: string | null
    teacherName: string
    subjectName: string
  }>
  stats: {
    totalStudents: number
    capacity: number
    fillRate: number
    absences30d: number
    lates30d: number
    excused30d: number
    regular: number
    litigation: number
    blocked: number
  }
}

export function ClassListsDynamic() {
  const [classrooms, setClassrooms] = React.useState<ClassroomItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedClassId, setSelectedClassId] = React.useState<string | null>(null)
  const [detail, setDetail] = React.useState<ClassroomDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = React.useState(false)

  const loadClassrooms = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/secretariat', { cache: 'no-store' })
      const data = await res.json()
      if (data.ok) setClassrooms(data.classrooms)
    } catch (err) {
      toast.error('Erreur : ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { loadClassrooms() }, [loadClassrooms])

  async function loadClassDetail(classId: string) {
    setSelectedClassId(classId)
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/secretariat?classroomId=${classId}`, { cache: 'no-store' })
      const data = await res.json()
      if (data.ok) {
        setDetail(data)
      } else {
        toast.error(data.error)
      }
    } catch (err) {
      toast.error('Erreur : ' + (err as Error).message)
    } finally {
      setLoadingDetail(false)
    }
  }

  // === VUE DÉTAIL CLASSE ===
  if (selectedClassId && detail) {
    return <ClassDetail detail={detail} onBack={() => { setSelectedClassId(null); setDetail(null) }} />
  }

  if (loadingDetail) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-3 text-sm text-muted-foreground">Chargement des détails...</p>
      </div>
    )
  }

  // === VUE LISTE DES CLASSES ===
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-3 text-sm text-muted-foreground">Chargement des classes...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Listes de classes"
        description="Cliquez sur une classe pour voir les élèves, les professeurs et les horaires."
        breadcrumbs={[{ label: 'Secrétariat' }, { label: 'Classes' }]}
      />

      {classrooms.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>Aucune classe créée. Allez dans Configuration école pour en créer.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {classrooms.map((c) => (
            <Card
              key={c.id}
              className="cursor-pointer hover:border-primary hover:shadow-md transition-all"
              onClick={() => loadClassDetail(c.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-bold text-lg">{c.name}</h3>
                    <p className="text-xs text-muted-foreground">{c.directorateName}</p>
                    {c.optionName && <Badge variant="outline" className="mt-1 text-xs">{c.optionName}</Badge>}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">{c.enrolledCount}</p>
                    <p className="text-xs text-muted-foreground">/ {c.capacity}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {c.enrolledCount} élèves</span>
                  <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> {c.teacherCount} profs</span>
                  <span className="flex items-center gap-1">
                    <div className="h-2 w-16 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${c.fillRate}%` }} />
                    </div>
                    {c.fillRate}%
                  </span>
                </div>
                {c.academicYearLabel && <p className="text-xs text-muted-foreground mt-1">📅 {c.academicYearLabel}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
// VUE DÉTAIL D'UNE CLASSE
// ============================================================

function ClassDetail({ detail, onBack }: { detail: ClassroomDetail; onBack: () => void }) {
  const { classroom, students, teachers, schedule, stats } = detail

  return (
    <div className="space-y-4">
      {/* En-tête avec bouton retour */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Retour
        </Button>
        <PageHeader
          title={`${classroom.name}`}
          description={`${classroom.directorateName}${classroom.sectionName ? ` · ${classroom.sectionName}` : ''}${classroom.optionName ? ` · ${classroom.optionName}` : ''}${classroom.academicYearLabel ? ` · ${classroom.academicYearLabel}` : ''}`}
          breadcrumbs={[{ label: 'Secrétariat' }, { label: 'Classes' }, { label: classroom.name }]}
        />
      </div>

      {/* Stats rapides */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-6">
        <StatBox label="Élèves" value={stats.totalStudents} color="primary" />
        <StatBox label="Capacité" value={`${stats.fillRate}%`} color="info" />
        <StatBox label="Réguliers" value={stats.regular} color="success" />
        <StatBox label="En litige" value={stats.litigation} color="warning" />
        <StatBox label="Abs (30j)" value={stats.absences30d} color="danger" />
        <StatBox label="Retards (30j)" value={stats.lates30d} color="tertiary" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Colonne 1 : Élèves (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" /> Élèves ({students.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {students.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Aucun élève dans cette classe</p>
              ) : (
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 border-b sticky top-0">
                      <tr>
                        <th className="text-left p-2">Matricule</th>
                        <th className="text-left p-2">Nom</th>
                        <th className="text-center p-2 hidden sm:table-cell">Genre</th>
                        <th className="text-center p-2">Financier</th>
                        <th className="text-center p-2 hidden md:table-cell">Abs</th>
                        <th className="text-center p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((s) => (
                        <tr key={s.id} className="border-b hover:bg-muted/20">
                          <td className="p-2 font-mono text-xs">{s.matricule}</td>
                          <td className="p-2">
                            <p className="font-medium">{s.fullName}</p>
                            {s.guardianName && <p className="text-xs text-muted-foreground">{s.guardianName}</p>}
                          </td>
                          <td className="p-2 text-center text-xs hidden sm:table-cell">{s.gender === 'M' ? 'M' : s.gender === 'F' ? 'F' : '—'}</td>
                          <td className="p-2 text-center">
                            {s.financialStatus === 'REGULAR' && <Badge className="bg-emerald-100 text-emerald-700 text-xs">✓</Badge>}
                            {s.financialStatus === 'LITIGATION' && <Badge className="bg-amber-100 text-amber-700 text-xs">⚠</Badge>}
                            {s.financialStatus === 'BLOCKED' && <Badge className="bg-red-100 text-red-700 text-xs">✗</Badge>}
                          </td>
                          <td className="p-2 text-center text-xs hidden md:table-cell">
                            {s.absencesCount > 0 ? <span className="text-red-600 font-bold">{s.absencesCount}</span> : '0'}
                            {s.latesCount > 0 && <span className="text-amber-600 ml-1">({s.latesCount}R)</span>}
                          </td>
                          <td className="p-2">
                            <div className="flex items-center justify-center gap-1">
                              <a href={`/api/exports/attestation?studentId=${s.id}`} target="_blank" className="p-1 rounded hover:bg-blue-50 text-blue-600" title="Attestation">
                                <FileText className="h-3.5 w-3.5" />
                              </a>
                              <a href={`/api/exports/student-card?studentId=${s.id}`} target="_blank" className="p-1 rounded hover:bg-amber-50 text-amber-600" title="Carte">
                                <CreditCard className="h-3.5 w-3.5" />
                              </a>
                              <a href={`/api/exports/bulletin?studentId=${s.id}`} target="_blank" className="p-1 rounded hover:bg-emerald-50 text-emerald-600" title="Bulletin">
                                <Eye className="h-3.5 w-3.5" />
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Colonne 2 : Profs + Horaires (1/3) */}
        <div className="space-y-4">
          {/* Professeurs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UserCheck className="h-4 w-4" /> Professeurs ({teachers.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {teachers.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground text-sm">Aucun prof assigné</p>
              ) : (
                teachers.map((t) => (
                  <div key={t.id} className="p-2 rounded-md border border-border bg-muted/20">
                    <p className="font-medium text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.subjectName} ({t.subjectCode})</p>
                    {t.phone && <p className="text-xs text-muted-foreground">📞 {t.phone}</p>}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Emploi du temps */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Horaires ({schedule.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {schedule.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground text-sm">Aucun horaire défini</p>
              ) : (
                schedule.map((s) => (
                  <div key={s.id} className="p-2 rounded-md border border-border bg-muted/20">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-xs">{s.dayName}</span>
                      <span className="text-xs text-muted-foreground">{s.startTime}-{s.endTime}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{s.subjectName} · {s.teacherName}</p>
                    {s.room && <p className="text-xs text-muted-foreground">📍 {s.room}</p>}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function StatBox({ label, value, color }: { label: string; value: any; color: string }) {
  const colors: Record<string, string> = {
    primary: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300',
    info: 'bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300',
    success: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300',
    warning: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300',
    danger: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300',
    tertiary: 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300',
  }
  return (
    <div className={`p-2 rounded-md border border-border ${colors[color]}`}>
      <p className="text-xs opacity-80">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  )
}
