'use client'

import * as React from 'react'
import { PageHeader } from '@/components/ss/page-header'
import { StatCard } from '@/components/ss/stat-card'
import { StatusBadge } from '@/components/ss/status-badge'
import { EmptyState } from '@/components/ss/empty-state'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Users, GraduationCap, BookOpen, Calendar, AlertTriangle,
  TrendingUp, Clock, ChevronRight, FileText, CreditCard,
  Wallet, Receipt, CheckCircle2,
} from 'lucide-react'
import { formatDate, formatRelative, initials } from '@/lib/format'
import { Button } from '@/components/ui/button'

type SupervisionData = NonNullable<Awaited<ReturnType<typeof import('@/lib/academic-supervision-queries').getAcademicSupervisionData>>>

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

export function AcademicSupervision({ data }: { data: SupervisionData }) {
  const [tab, setTab] = React.useState('classes')
  const [selectedClassroomId, setSelectedClassroomId] = React.useState('')
  const [selectedStudentId, setSelectedStudentId] = React.useState('')
  const [selectedTeacherId, setSelectedTeacherId] = React.useState('')
  const [selectedSubjectId, setSelectedSubjectId] = React.useState('')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion de l'école"
        description="Classes, élèves, professeurs, matières — cliquez pour voir les dossiers détaillés"
        breadcrumbs={[{ label: 'Direction' }, { label: 'Gestion école' }]}
      />

      {/* KPIs globaux cliquables */}
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <button onClick={() => { setTab('classes'); setSelectedClassroomId('') }}>
          <StatCard label="Classes" value={data.summary.totalClassrooms} icon={<Users className="h-5 w-5" />} tone="primary" className="w-full" />
        </button>
        <button onClick={() => { setTab('classes'); setSelectedClassroomId('') }}>
          <StatCard label="Élèves" value={data.summary.totalStudents} icon={<GraduationCap className="h-5 w-5" />} tone="info" className="w-full" />
        </button>
        <button onClick={() => { setTab('teachers'); setSelectedTeacherId('') }}>
          <StatCard label="Profs" value={data.summary.totalTeachers} icon={<BookOpen className="h-5 w-5" />} tone="tertiary" className="w-full" />
        </button>
        <button onClick={() => { setTab('subjects'); setSelectedSubjectId('') }}>
          <StatCard label="Matières" value={data.summary.totalSubjects} icon={<BookOpen className="h-5 w-5" />} tone="info" className="w-full" />
        </button>
        <StatCard label="Moyenne" value={`${data.summary.avgGlobalScore}/20`} icon={<TrendingUp className="h-5 w-5" />} tone="success" />
        <StatCard label="Assiduité" value={`${data.summary.avgGlobalAttendance}%`} icon={<Clock className="h-5 w-5" />} tone={data.summary.avgGlobalAttendance < 80 ? 'danger' : 'success'} />
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); setSelectedStudentId(''); setSelectedTeacherId(''); setSelectedSubjectId('') }}>
        <TabsList>
          <TabsTrigger value="classes">Classes & Élèves</TabsTrigger>
          <TabsTrigger value="teachers">Professeurs</TabsTrigger>
          <TabsTrigger value="subjects">Matières</TabsTrigger>
        </TabsList>

        {/* ============================================================ */}
        {/* TAB 1 : CLASSES → ÉLÈVES → DOSSIER ÉLÈVE */}
        {/* ============================================================ */}
        <TabsContent value="classes" className="space-y-4">
          {/* Niveau 1 : Liste des classes (si aucun élève sélectionné) */}
          {!selectedClassroomId && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.classrooms.map((c) => (
                <Card key={c.classroom.id} className="cursor-pointer hover:ss-shadow-card-hover transition-shadow"
                  onClick={() => setSelectedClassroomId(c.classroom.id)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold">{c.classroom.name}</p>
                        <p className="text-xs text-muted-foreground">{c.classroom.directorateName}
                          {c.classroom.sectionName && ` · ${c.classroom.sectionName}`}
                          {c.classroom.optionName && ` · ${c.classroom.optionName}`}</p>
                      </div>
                      <Badge variant="outline">{c.totalStudents}/{c.classroom.capacity}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2 bg-muted/30 rounded"><p className="text-muted-foreground">Moy</p><p className="font-bold text-primary">{c.avgScore}/20</p></div>
                      <div className="p-2 bg-muted/30 rounded"><p className="text-muted-foreground">Présence</p><p className={`font-bold ${c.attendanceRate < 80 ? 'text-red-600' : 'text-emerald-600'}`}>{c.attendanceRate}%</p></div>
                      <div className="p-2 bg-muted/30 rounded"><p className="text-muted-foreground">Litiges</p><p className={`font-bold ${c.litigationCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{c.litigationCount}</p></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Niveau 2 : Liste des élèves d'une classe */}
          {selectedClassroomId && !selectedStudentId && (() => {
            const classroom = data.classrooms.find((c) => c.classroom.id === selectedClassroomId)
            if (!classroom) return null
            return (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={() => setSelectedClassroomId('')}>← Toutes les classes</Button>
                  <h3 className="text-lg font-semibold">{classroom.classroom.name}</h3>
                  <Badge variant="outline">{classroom.totalStudents} élèves</Badge>
                </div>
                <div className="space-y-2">
                  {classroom.students.map((s) => {
                    const avg = s.grades.length > 0 ? s.grades.reduce((sum, g) => sum + (g.score / g.maxScore) * 20, 0) / s.grades.length : 0
                    return (
                      <Card key={s.id} className="cursor-pointer hover:ss-shadow-card-hover" onClick={() => setSelectedStudentId(s.id)}>
                        <CardContent className="p-3 flex items-center gap-3">
                          {s.financialStatus !== 'REGULAR' && <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />}
                          <Avatar className="h-10 w-10 shrink-0"><AvatarFallback className="bg-primary/10 text-primary text-xs">{initials(s.name)}</AvatarFallback></Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">{s.name}</p>
                            <p className="text-xs text-muted-foreground">{s.matricule}</p>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <div className="text-center"><p className="text-muted-foreground">Notes</p><p className="font-bold">{s.grades.length}</p></div>
                            <div className="text-center"><p className="text-muted-foreground">Présences</p><p className="font-bold">{s.recentAttendances.length}</p></div>
                            {s.grades.length > 0 && <div className="text-center"><p className="text-muted-foreground">Moy</p><p className={`font-bold ${avg >= 10 ? 'text-emerald-600' : 'text-red-600'}`}>{avg.toFixed(1)}</p></div>}
                            {s.financialStatus !== 'REGULAR' && <StatusBadge variant="danger">{s.financialStatus}</StatusBadge>}
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Niveau 3 : Dossier complet de l'élève */}
          {selectedClassroomId && selectedStudentId && (() => {
            const classroom = data.classrooms.find((c) => c.classroom.id === selectedClassroomId)
            const student = classroom?.students.find((s) => s.id === selectedStudentId)
            if (!student) return null
            const avg = student.grades.length > 0 ? student.grades.reduce((sum, g) => sum + (g.score / g.maxScore) * 20, 0) / student.grades.length : 0
            const presentCount = student.recentAttendances.filter((a) => a.status === 'PRESENT').length
            const absentCount = student.recentAttendances.filter((a) => a.status === 'ABSENT').length
            const attendanceRate = student.recentAttendances.length > 0 ? (presentCount / student.recentAttendances.length) * 100 : 100

            return (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={() => setSelectedStudentId('')}>← Retour à la classe</Button>
                </div>

                {/* En-tête du dossier élève */}
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-20 w-20"><AvatarFallback className="bg-primary/10 text-primary text-2xl">{initials(student.name)}</AvatarFallback></Avatar>
                      <div className="flex-1">
                        <h2 className="text-xl font-semibold">{student.name}</h2>
                        <p className="text-sm text-muted-foreground">{student.matricule} · {classroom?.classroom.name} · {classroom?.classroom.directorateName}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <StatusBadge variant={student.financialStatus === 'REGULAR' ? 'success' : 'danger'} dot>
                            {student.financialStatus === 'REGULAR' ? 'Régulier' : student.financialStatus}
                          </StatusBadge>
                          <Badge variant="outline">{classroom?.classroom.name}</Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Stats élève */}
                <div className="grid gap-4 sm:grid-cols-4">
                  <StatCard label="Moyenne" value={avg > 0 ? `${avg.toFixed(1)}/20` : '—'} icon={<TrendingUp className="h-5 w-5" />} tone={avg >= 10 ? 'success' : 'danger'} />
                  <StatCard label="Notes publiées" value={student.grades.length} icon={<FileText className="h-5 w-5" />} tone="primary" />
                  <StatCard label="Présence" value={`${attendanceRate.toFixed(0)}%`} icon={<CheckCircle2 className="h-5 w-5" />} tone={attendanceRate >= 80 ? 'success' : 'danger'} />
                  <StatCard label="Absences" value={absentCount} icon={<AlertTriangle className="h-5 w-5" />} tone={absentCount > 0 ? 'danger' : 'success'} />
                    </div>

                {/* Détail des notes */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Notes publiées</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {student.grades.length === 0 ? <EmptyState icon={<FileText className="h-5 w-5" />} title="Aucune note publiée" /> : (
                      <div className="space-y-2">
                        {student.grades.map((g, i) => (
                          <div key={i} className="flex items-center justify-between p-2 rounded-md border border-border">
                            <div><p className="text-sm font-medium">{g.subject}</p><p className="text-xs text-muted-foreground">{g.title}</p></div>
                            <StatusBadge variant={g.score / g.maxScore >= 0.5 ? 'success' : 'danger'}>{g.score}/{g.maxScore}</StatusBadge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Présences */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Présences récentes</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {student.recentAttendances.length === 0 ? <EmptyState title="Aucune présence enregistrée" /> : (
                      <div className="space-y-1">
                        {student.recentAttendances.map((a, i) => (
                          <div key={i} className="flex items-center justify-between text-sm p-2 rounded-md hover:bg-muted/30">
                            <span>{formatDate(a.date)}</span>
                            <StatusBadge variant={a.status === 'PRESENT' ? 'success' : a.status === 'LATE' ? 'warning' : a.status === 'EXCUSED' ? 'info' : 'danger'}>{a.status}</StatusBadge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )
          })()}
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 2 : PROFESSEURS → DOSSIER PROF */}
        {/* ============================================================ */}
        <TabsContent value="teachers" className="space-y-4">
          {/* Niveau 1 : Liste des profs */}
          {!selectedTeacherId && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.teachers.map((t) => (
                <Card key={t.teacher.id} className="cursor-pointer hover:ss-shadow-card-hover"
                  onClick={() => setSelectedTeacherId(t.teacher.id)}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar className="h-12 w-12"><AvatarFallback className="bg-primary/10 text-primary">{initials(t.teacher.name)}</AvatarFallback></Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{t.teacher.name}</p>
                        <p className="text-xs text-muted-foreground">{t.teacher.function}{t.teacher.isMultiDirectorate && ' · 🔄 Multi'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2 bg-muted/30 rounded"><p className="text-muted-foreground">Affect.</p><p className="font-bold">{t.assignments.length}</p></div>
                      <div className="p-2 bg-muted/30 rounded"><p className="text-muted-foreground">Horaires</p><p className="font-bold">{t.schedule.length}</p></div>
                      <div className="p-2 bg-muted/30 rounded"><p className="text-muted-foreground">Pointés</p><p className="font-bold">{t.recentAttendance.length}</p></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Niveau 2 : Dossier complet du prof */}
          {selectedTeacherId && (() => {
            const t = data.teachers.find((tt) => tt.teacher.id === selectedTeacherId)
            if (!t) return null
            return (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={() => setSelectedTeacherId('')}>← Tous les profs</Button>
                </div>

                {/* En-tête profil prof */}
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-20 w-20"><AvatarFallback className="bg-primary/10 text-primary text-2xl">{initials(t.teacher.name)}</AvatarFallback></Avatar>
                      <div className="flex-1">
                        <h2 className="text-xl font-semibold">{t.teacher.name}</h2>
                        <p className="text-sm text-muted-foreground">{t.teacher.function}{t.teacher.globalRole && ` · ${t.teacher.globalRole}`}</p>
                        <div className="flex items-center gap-2 mt-2">
                          {t.teacher.isMultiDirectorate && <Badge variant="info">🔄 Multi-directions</Badge>}
                          <Badge variant="outline">{t.assignments.length} affectation(s)</Badge>
                          <Badge variant="outline">{t.schedule.length} créneau(x)</Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Affectations */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Affectations (matières → classes)</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {t.assignments.length === 0 ? <EmptyState title="Aucune affectation" /> : (
                      t.assignments.map((a, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded-md border border-border">
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{a.subjectName}</span>
                          </div>
                          <div className="text-right text-xs">
                            <p className="font-medium">{a.classroomName}</p>
                            <p className="text-muted-foreground">{a.directorateName}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* Emploi du temps */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Emploi du temps</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    {t.schedule.length === 0 ? <EmptyState icon={<Calendar className="h-5 w-5" />} title="Aucun horaire" /> : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b bg-muted/30"><tr><th className="p-2 text-left">Jour</th><th className="p-2 text-left">Heure</th><th className="p-2 text-left">Classe</th><th className="p-2 text-left">Matière</th><th className="p-2 text-left">Salle</th></tr></thead>
                          <tbody>
                            {t.schedule.map((s, i) => (
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
                    )}
                  </CardContent>
                </Card>

                {/* Présences (pointage) */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Pointages récents</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {t.recentAttendance.length === 0 ? <EmptyState title="Aucun pointage" /> : (
                      t.recentAttendance.map((a, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded-md border border-border">
                          <div><p className="text-sm font-medium">{formatDate(a.date)}</p>{a.arrivalTime && <p className="text-xs text-muted-foreground">{a.arrivalTime} - {a.departureTime || '—'}</p>}</div>
                          <StatusBadge variant={a.status === 'PRESENT' ? 'success' : a.status === 'LATE' ? 'warning' : 'danger'}>{a.status}</StatusBadge>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            )
          })()}
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 3 : MATIÈRES → DÉTAIL */}
        {/* ============================================================ */}
        <TabsContent value="subjects" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.subjects.map((s) => (
              <Card key={s.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div><p className="font-semibold">{s.name}</p><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{s.code}</code></div>
                    <Badge variant="outline">{s.gradesCount} notes</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 bg-muted/30 rounded"><p className="text-muted-foreground">Profs</p><p className="font-bold">{s.teacherCount}</p></div>
                    <div className="p-2 bg-muted/30 rounded"><p className="text-muted-foreground">Classes</p><p className="font-bold">{s.classroomCount}</p></div>
                    <div className="p-2 bg-muted/30 rounded"><p className="text-muted-foreground">Moy</p><p className={`font-bold ${s.avgScore >= 10 ? 'text-emerald-600' : 'text-red-600'}`}>{s.avgScore}/20</p></div>
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

