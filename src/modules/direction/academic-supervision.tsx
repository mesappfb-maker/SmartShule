'use client'

import * as React from 'react'
import { PageHeader } from '@/components/ss/page-header'
import { StatCard } from '@/components/ss/stat-card'
import { StatusBadge } from '@/components/ss/status-badge'
import { EmptyState } from '@/components/ss/empty-state'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Users, GraduationCap, BookOpen, Calendar, AlertTriangle,
  TrendingUp, Clock, ChevronRight, Eye,
} from 'lucide-react'
import { formatDate, formatRelative, initials } from '@/lib/format'

type SupervisionData = NonNullable<Awaited<ReturnType<typeof import('@/lib/academic-supervision-queries').getAcademicSupervisionData>>>

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

export function AcademicSupervision({ data }: { data: SupervisionData }) {
  const [tab, setTab] = React.useState('classes')
  const [selectedClassroom, setSelectedClassroom] = React.useState<string>('')
  const [selectedTeacher, setSelectedTeacher] = React.useState<string>('')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supervision académique"
        description="Vue détaillée : classes, élèves, notes, présences, professeurs et horaires"
        breadcrumbs={[{ label: 'Espace direction' }, { label: 'Supervision' }]}
      />

      {/* KPIs globaux */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard label="Classes" value={data.summary.totalClassrooms} icon={<Users className="h-5 w-5" />} tone="primary" />
        <StatCard label="Élèves" value={data.summary.totalStudents} icon={<GraduationCap className="h-5 w-5" />} tone="info" />
        <StatCard label="Profs" value={data.summary.totalTeachers} icon={<BookOpen className="h-5 w-5" />} tone="tertiary" />
        <StatCard label="Matières" value={data.summary.totalSubjects} icon={<BookOpen className="h-5 w-5" />} tone="info" />
        <StatCard label="Moyenne globale" value={`${data.summary.avgGlobalScore}/20`} icon={<TrendingUp className="h-5 w-5" />} tone="success" />
        <StatCard label="Assiduité" value={`${data.summary.avgGlobalAttendance}%`} icon={<Clock className="h-5 w-5" />} tone={data.summary.avgGlobalAttendance < 80 ? 'danger' : 'success'} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="classes">Classes & Élèves</TabsTrigger>
          <TabsTrigger value="teachers">Professeurs & Horaires</TabsTrigger>
          <TabsTrigger value="subjects">Matières</TabsTrigger>
        </TabsList>

        {/* ============================================================ */}
        {/* TAB 1 : CLASSES & ÉLÈVES */}
        {/* ============================================================ */}
        <TabsContent value="classes" className="space-y-4">
          <div className="flex items-center gap-3">
            <Select value={selectedClassroom} onValueChange={setSelectedClassroom}>
              <SelectTrigger className="w-80">
                <SelectValue placeholder="Toutes les classes" />
              </SelectTrigger>
              <SelectContent>
                {data.classrooms.map((c) => (
                  <SelectItem key={c.classroom.id} value={c.classroom.id}>
                    {c.classroom.name} — {c.classroom.directorateName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cartes résumées par classe */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.classrooms
              .filter((c) => !selectedClassroom || c.classroom.id === selectedClassroom)
              .map((c) => (
                <Card key={c.classroom.id} className="cursor-pointer hover:ss-shadow-card-hover transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold">{c.classroom.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.classroom.directorateName}
                          {c.classroom.sectionName && ` · ${c.classroom.sectionName}`}
                          {c.classroom.optionName && ` · ${c.classroom.optionName}`}
                        </p>
                      </div>
                      <Badge variant="outline">{c.totalStudents}/{c.classroom.capacity}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2 bg-muted/30 rounded">
                        <p className="text-muted-foreground">Moyenne</p>
                        <p className="font-bold text-primary">{c.avgScore}/20</p>
                      </div>
                      <div className="p-2 bg-muted/30 rounded">
                        <p className="text-muted-foreground">Assiduité</p>
                        <p className={`font-bold ${c.attendanceRate < 80 ? 'text-red-600' : 'text-emerald-600'}`}>{c.attendanceRate}%</p>
                      </div>
                      <div className="p-2 bg-muted/30 rounded">
                        <p className="text-muted-foreground">Litiges</p>
                        <p className={`font-bold ${c.litigationCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{c.litigationCount}</p>
                      </div>
                    </div>
                    <Separator className="my-2" />
                    <div className="space-y-1">
                      {c.teachers.slice(0, 3).map((t, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          👤 {t.name} — {t.subjectName}
                        </p>
                      ))}
                      {c.teachers.length > 3 && <p className="text-xs text-muted-foreground">+{c.teachers.length - 3} autre(s)</p>}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>

          {/* Détail des élèves quand une classe est sélectionnée */}
          {selectedClassroom && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Élèves — {data.classrooms.find((c) => c.classroom.id === selectedClassroom)?.classroom.name}
                </CardTitle>
                <CardDescription>Cliquez sur un élève pour voir ses notes et présences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.classrooms
                  .find((c) => c.classroom.id === selectedClassroom)
                  ?.students.map((s) => (
                    <StudentDetail key={s.id} student={s} />
                  ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 2 : PROFESSEURS & HORAIRES */}
        {/* ============================================================ */}
        <TabsContent value="teachers" className="space-y-4">
          <div className="flex items-center gap-3">
            <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
              <SelectTrigger className="w-80">
                <SelectValue placeholder="Tous les professeurs" />
              </SelectTrigger>
              <SelectContent>
                {data.teachers.map((t) => (
                  <SelectItem key={t.teacher.id} value={t.teacher.id}>
                    {t.teacher.name} {t.teacher.isMultiDirectorate && '🔄'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.teachers
              .filter((t) => !selectedTeacher || t.teacher.id === selectedTeacher)
              .map((t) => (
                <Card key={t.teacher.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {initials(t.teacher.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-sm">{t.teacher.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.teacher.function}
                          {t.teacher.isMultiDirectorate && ' · Multi-directions'}
                        </p>
                      </div>
                    </div>

                    {/* Affectations */}
                    <div className="space-y-1 mb-3">
                      <p className="text-xs font-medium text-muted-foreground">Affectations ({t.assignments.length})</p>
                      {t.assignments.slice(0, 4).map((a, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span>{a.subjectName}</span>
                          <span className="text-muted-foreground">{a.classroomName}</span>
                        </div>
                      ))}
                      {t.assignments.length > 4 && <p className="text-xs text-muted-foreground">+{t.assignments.length - 4}</p>}
                    </div>

                    <Separator className="my-2" />

                    {/* Horaire résumé */}
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Horaires ({t.schedule.length})</p>
                      {t.schedule.slice(0, 3).map((s, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <Badge variant="outline" className="text-[10px]">{DAYS[s.dayOfWeek]}</Badge>
                          <span>{s.startTime}-{s.endTime}</span>
                          <span className="text-muted-foreground">{s.classroomName}</span>
                        </div>
                      ))}
                      {t.schedule.length > 3 && <p className="text-xs text-muted-foreground">+{t.schedule.length - 3} autres</p>}
                    </div>

                    <Separator className="my-2" />

                    {/* Présence récente */}
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Présence récente</p>
                      {t.recentAttendance.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Non pointé</p>
                      ) : (
                        t.recentAttendance.slice(0, 3).map((a, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span>{formatDate(a.date)}</span>
                            <StatusBadge variant={a.status === 'PRESENT' ? 'success' : a.status === 'LATE' ? 'warning' : 'danger'}>
                              {a.status}
                            </StatusBadge>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>

          {/* Emploi du temps détaillé si prof sélectionné */}
          {selectedTeacher && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Emploi du temps — {data.teachers.find((t) => t.teacher.id === selectedTeacher)?.teacher.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/30">
                      <tr>
                        <th className="p-2 text-left">Jour</th>
                        <th className="p-2 text-left">Heure</th>
                        <th className="p-2 text-left">Classe</th>
                        <th className="p-2 text-left">Matière</th>
                        <th className="p-2 text-left">Salle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.teachers
                        .find((t) => t.teacher.id === selectedTeacher)
                        ?.schedule.map((s, i) => (
                          <tr key={i} className="border-b hover:bg-muted/20">
                            <td className="p-2 font-medium">{DAYS[s.dayOfWeek]}</td>
                            <td className="p-2">{s.startTime} - {s.endTime}</td>
                            <td className="p-2">{s.classroomName}</td>
                            <td className="p-2">{s.subjectName}</td>
                            <td className="p-2">{s.room || '—'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 3 : MATIÈRES */}
        {/* ============================================================ */}
        <TabsContent value="subjects" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.subjects.map((s) => (
              <Card key={s.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-semibold">{s.name}</p>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{s.code}</code>
                    </div>
                    <Badge variant="outline">{s.gradesCount} notes</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 bg-muted/30 rounded">
                      <p className="text-muted-foreground">Profs</p>
                      <p className="font-bold">{s.teacherCount}</p>
                    </div>
                    <div className="p-2 bg-muted/30 rounded">
                      <p className="text-muted-foreground">Classes</p>
                      <p className="font-bold">{s.classroomCount}</p>
                    </div>
                    <div className="p-2 bg-muted/30 rounded">
                      <p className="text-muted-foreground">Moyenne</p>
                      <p className={`font-bold ${s.avgScore >= 10 ? 'text-emerald-600' : 'text-red-600'}`}>{s.avgScore}/20</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================================
// Composant détail d'un élève (dépliable)
// ============================================================

function StudentDetail({ student }: {
  student: {
    id: string
    name: string
    matricule: string
    grades: Array<{ subject: string; score: number; maxScore: number; title: string }>
    recentAttendances: Array<{ date: Date; status: string; justified: boolean }>
    financialStatus: string
  }
}) {
  const [expanded, setExpanded] = React.useState(false)
  const avgGrade = student.grades.length > 0
    ? student.grades.reduce((sum, g) => sum + (g.score / g.maxScore) * 20, 0) / student.grades.length
    : 0

  return (
    <div className="border border-border rounded-md">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-left"
      >
        {student.financialStatus !== 'REGULAR' && (
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
        )}
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary text-xs">
            {initials(student.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{student.name}</p>
          <p className="text-xs text-muted-foreground">{student.matricule}</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {student.grades.length > 0 && (
            <div className="text-center">
              <p className="text-muted-foreground">Moy.</p>
              <p className={`font-bold ${avgGrade >= 10 ? 'text-emerald-600' : 'text-red-600'}`}>
                {avgGrade.toFixed(1)}/20
              </p>
            </div>
          )}
          {student.financialStatus !== 'REGULAR' && (
            <StatusBadge variant="danger">{student.financialStatus}</StatusBadge>
          )}
        </div>
        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <div className="border-t border-border p-3 space-y-3 bg-muted/10">
          {/* Notes récentes */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Notes publiées ({student.grades.length})</p>
            {student.grades.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucune note publiée</p>
            ) : (
              <div className="space-y-1">
                {student.grades.map((g, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span>{g.subject} — {g.title}</span>
                    <StatusBadge variant={g.score / g.maxScore >= 0.5 ? 'success' : 'danger'}>
                      {g.score}/{g.maxScore}
                    </StatusBadge>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Présences récentes */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Présences récentes</p>
            {student.recentAttendances.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucune présence enregistrée</p>
            ) : (
              <div className="space-y-1">
                {student.recentAttendances.map((a, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span>{formatDate(a.date)}</span>
                    <StatusBadge variant={a.status === 'PRESENT' ? 'success' : a.status === 'LATE' ? 'warning' : a.status === 'EXCUSED' ? 'info' : 'danger'}>
                      {a.status}
                    </StatusBadge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
