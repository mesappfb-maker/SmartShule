'use client'

// SmartShule — Liste des élèves interactive (DataGrid Excel-style)
// ============================================================
// Fonctionnalités :
//   - Recherche instantanée (nom/matricule)
//   - Filtres multicritères (classe, direction, année, statut, genre, statut financier)
//   - Colonnes : Matricule, Nom, Classe, Statut, Régularité financière
//   - Actions : Voir profil, Attestation, Carte élève, Bulletin
//   - Stats rapides en haut
//   - Pagination

import * as React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ss/page-header'
import {
  Loader2, Search, Eye, FileText, CreditCard, Users,
  CheckCircle2, AlertTriangle, XCircle, ChevronLeft, ChevronRight,
  Download, UserCheck,
} from 'lucide-react'
import { toast } from 'sonner'

type Student = {
  id: string
  matricule: string
  firstName: string
  lastName: string
  fullName: string
  gender: string | null
  status: string
  classroomName: string
  directorateName: string
  sectionName?: string
  optionName?: string
  academicYearLabel?: string
  financialStatus: string
  financialReason?: string
  guardianName?: string
  guardianPhone?: string
}

type Stats = {
  total: number
  active: number
  regular: number
  litigation: number
  blocked: number
  male: number
  female: number
}

type Filters = {
  classrooms: Array<{ id: string; name: string; directorateName: string }>
  directorates: Array<{ id: string; name: string; code: string }>
  academicYears: Array<{ id: string; label: string; active: boolean }>
}

export function StudentsList() {
  const [students, setStudents] = React.useState<Student[]>([])
  const [stats, setStats] = React.useState<Stats | null>(null)
  const [filters, setFilters] = React.useState<Filters | null>(null)
  const [loading, setLoading] = React.useState(true)

  // Filtres
  const [search, setSearch] = React.useState('')
  const [classroomId, setClassroomId] = React.useState('')
  const [status, setStatus] = React.useState('ACTIVE')
  const [gender, setGender] = React.useState('')
  const [financialStatus, setFinancialStatus] = React.useState('')
  const [yearId, setYearId] = React.useState('')

  // Pagination
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)

  // Élève sélectionné (profil)
  const [selectedStudent, setSelectedStudent] = React.useState<Student | null>(null)

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (classroomId) params.set('classroomId', classroomId)
      if (status) params.set('status', status)
      if (search) params.set('search', search)
      if (gender) params.set('gender', gender)
      if (financialStatus) params.set('financialStatus', financialStatus)
      if (yearId) params.set('academicYearId', yearId)
      params.set('page', String(page))
      params.set('limit', '100')

      const res = await fetch(`/api/students?${params}`, { cache: 'no-store' })
      const data = await res.json()
      if (data.ok) {
        setStudents(data.students)
        setStats(data.stats)
        setFilters(data.filters)
        setTotalPages(data.pagination?.pages || 1)
      }
    } catch (err) {
      toast.error('Erreur : ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [classroomId, status, search, gender, financialStatus, yearId, page])

  React.useEffect(() => { loadData() }, [loadData])

  // Reset page quand on change un filtre
  React.useEffect(() => { setPage(1) }, [classroomId, status, gender, financialStatus, yearId, search])

  function getFinStatusBadge(fs: string) {
    if (fs === 'REGULAR') return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">✓ Régulier</Badge>
    if (fs === 'LITIGATION') return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">⚠ En litige</Badge>
    if (fs === 'BLOCKED') return <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">✗ Bloqué</Badge>
    return <Badge variant="outline">—</Badge>
  }

  function getStatusBadge(s: string) {
    if (s === 'ACTIVE') return <Badge className="bg-blue-100 text-blue-700">Actif</Badge>
    if (s === 'ARCHIVED') return <Badge variant="outline">Archivé</Badge>
    if (s === 'TRANSFERRED') return <Badge variant="outline">Transféré</Badge>
    return <Badge variant="outline">{s}</Badge>
  }

  if (loading && students.length === 0) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-3 text-sm text-muted-foreground">Chargement des élèves...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Liste des élèves"
        description="Recherche, filtrez et gérez les élèves en temps réel."
        breadcrumbs={[{ label: 'Secrétariat' }, { label: 'Élèves' }]}
      />

      {/* Stats rapides */}
      {stats && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
          <StatBox label="Total" value={stats.total} icon={<Users className="h-4 w-4" />} color="primary" />
          <StatBox label="Actifs" value={stats.active} icon={<CheckCircle2 className="h-4 w-4" />} color="success" />
          <StatBox label="Réguliers" value={stats.regular} icon={<CheckCircle2 className="h-4 w-4" />} color="success" />
          <StatBox label="En litige" value={stats.litigation} icon={<AlertTriangle className="h-4 w-4" />} color="warning" />
          <StatBox label="Bloqués" value={stats.blocked} icon={<XCircle className="h-4 w-4" />} color="danger" />
          <StatBox label="Garçons" value={stats.male} icon={<UserCheck className="h-4 w-4" />} color="info" />
          <StatBox label="Filles" value={stats.female} icon={<UserCheck className="h-4 w-4" />} color="tertiary" />
        </div>
      )}

      {/* Barre de recherche + filtres */}
      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {/* Recherche */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom ou matricule..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>

            {/* Filtre classe */}
            <select className="p-2 border rounded-md bg-background text-sm" value={classroomId} onChange={(e) => setClassroomId(e.target.value)}>
              <option value="">Toutes classes</option>
              {filters?.classrooms.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.directorateName})</option>
              ))}
            </select>

            {/* Filtre statut */}
            <select className="p-2 border rounded-md bg-background text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ACTIVE">Actifs</option>
              <option value="ALL">Tous statuts</option>
              <option value="ARCHIVED">Archivés</option>
              <option value="TRANSFERRED">Transférés</option>
            </select>

            {/* Filtre genre */}
            <select className="p-2 border rounded-md bg-background text-sm" value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">Tous genres</option>
              <option value="M">Garçons</option>
              <option value="F">Filles</option>
            </select>

            {/* Filtre statut financier */}
            <select className="p-2 border rounded-md bg-background text-sm" value={financialStatus} onChange={(e) => setFinancialStatus(e.target.value)}>
              <option value="">Tous (financier)</option>
              <option value="REGULAR">Réguliers</option>
              <option value="LITIGATION">En litige</option>
              <option value="BLOCKED">Bloqués</option>
            </select>
          </div>

          {/* Filtre année académique */}
          {filters && filters.academicYears.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Année :</span>
              <select className="p-1.5 border rounded-md bg-background text-xs" value={yearId} onChange={(e) => setYearId(e.target.value)}>
                <option value="">Toutes</option>
                {filters.academicYears.map((y) => (
                  <option key={y.id} value={y.id}>{y.label}{y.active && ' (active)'}</option>
                ))}
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DataGrid */}
      <Card>
        <CardContent className="p-0">
          {students.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Aucun élève trouvé. {search && 'Essayez une autre recherche.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Matricule</th>
                    <th className="text-left p-2 font-medium">Nom & Prénom</th>
                    <th className="text-left p-2 font-medium">Classe</th>
                    <th className="text-left p-2 font-medium hidden md:table-cell">Direction</th>
                    <th className="text-center p-2 font-medium">Statut</th>
                    <th className="text-center p-2 font-medium">Régularité</th>
                    <th className="text-center p-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="p-2 font-mono text-xs">{s.matricule}</td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                            {s.firstName[0]}{s.lastName[0]}
                          </div>
                          <div>
                            <p className="font-medium">{s.fullName}</p>
                            {s.guardianName && <p className="text-xs text-muted-foreground">Parent: {s.guardianName}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="p-2">
                        <p>{s.classroomName}</p>
                        {s.optionName && <p className="text-xs text-muted-foreground">{s.optionName}</p>}
                      </td>
                      <td className="p-2 hidden md:table-cell text-xs text-muted-foreground">{s.directorateName}</td>
                      <td className="p-2 text-center">{getStatusBadge(s.status)}</td>
                      <td className="p-2 text-center">{getFinStatusBadge(s.financialStatus)}</td>
                      <td className="p-2">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedStudent(s)}
                            className="p-1.5 rounded-md hover:bg-primary/10 text-primary"
                            title="Voir le profil"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <a
                            href={`/api/exports/attestation?studentId=${s.id}`}
                            target="_blank"
                            className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600"
                            title="Attestation de fréquentation"
                          >
                            <FileText className="h-4 w-4" />
                          </a>
                          <a
                            href={`/api/exports/student-card?studentId=${s.id}`}
                            target="_blank"
                            className="p-1.5 rounded-md hover:bg-amber-50 text-amber-600"
                            title="Carte d'élève (QR)"
                          >
                            <CreditCard className="h-4 w-4" />
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} / {totalPages}</span>
          <Button size="sm" variant="outline" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Modal profil élève */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur p-4" onClick={() => setSelectedStudent(null)}>
          <Card className="max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                    {selectedStudent.firstName[0]}{selectedStudent.lastName[0]}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{selectedStudent.fullName}</h3>
                    <p className="text-sm text-muted-foreground font-mono">{selectedStudent.matricule}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedStudent(null)} className="text-muted-foreground hover:text-foreground text-xl">✕</button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Classe :</span> <strong>{selectedStudent.classroomName}</strong></div>
                <div><span className="text-muted-foreground">Direction :</span> <strong>{selectedStudent.directorateName}</strong></div>
                {selectedStudent.optionName && <div><span className="text-muted-foreground">Option :</span> <strong>{selectedStudent.optionName}</strong></div>}
                <div><span className="text-muted-foreground">Statut :</span> {getStatusBadge(selectedStudent.status)}</div>
                <div><span className="text-muted-foreground">Régularité :</span> {getFinStatusBadge(selectedStudent.financialStatus)}</div>
                <div><span className="text-muted-foreground">Genre :</span> <strong>{selectedStudent.gender === 'M' ? 'Masculin' : selectedStudent.gender === 'F' ? 'Féminin' : '—'}</strong></div>
                {selectedStudent.guardianName && <div className="col-span-2"><span className="text-muted-foreground">Parent :</span> <strong>{selectedStudent.guardianName}</strong></div>}
                {selectedStudent.guardianPhone && <div><span className="text-muted-foreground">Téléphone :</span> <strong>{selectedStudent.guardianPhone}</strong></div>}
                {selectedStudent.financialReason && <div className="col-span-2 p-2 bg-amber-50 rounded text-xs text-amber-700">Motif : {selectedStudent.financialReason}</div>}
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <a href={`/api/exports/attestation?studentId=${selectedStudent.id}`} target="_blank">
                  <Button variant="outline" size="sm"><FileText className="h-4 w-4 mr-1" /> Attestation</Button>
                </a>
                <a href={`/api/exports/student-card?studentId=${selectedStudent.id}`} target="_blank">
                  <Button variant="outline" size="sm"><CreditCard className="h-4 w-4 mr-1" /> Carte élève</Button>
                </a>
                <a href={`/api/exports/bulletin?studentId=${selectedStudent.id}`} target="_blank">
                  <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" /> Bulletin</Button>
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    primary: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300',
    success: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300',
    warning: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300',
    danger: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300',
    info: 'bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300',
    tertiary: 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300',
  }
  return (
    <div className={`p-2 rounded-md border border-border ${colors[color]}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs opacity-80">{label}</p>
        {icon}
      </div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  )
}
