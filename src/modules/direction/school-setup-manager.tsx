'use client'

// SmartShule — Gestion complète de l'établissement
// ============================================================
// Permet à la Direction de créer :
//   - Directions (Maternelle, Primaire, Secondaire)
//   - Sections (Lettres, Sciences)
//   - Options (Coupe-Couture, Commerciale, Scientifique)
//   - Matières (Mathématiques, Français)
//   - Classes (6ème A, 5ème B)
//   - Lignes de frais (Minerval, Frais inscription)
//
// Architecture senior : API unique /api/direction/setup avec action dispatch

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/ss/page-header'
import { EmptyState } from '@/components/ss/empty-state'
import {
  Loader2, Building2, Layers, GraduationCap, BookOpen,
  Wallet, Plus, RefreshCw, CheckCircle2, Users, Calendar,
  UserCheck, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/format'

type Directorate = { id: string; name: string; code: string }
type Section = { id: string; name: string; code: string; directorateId: string; directorate: Directorate }
type Option = { id: string; name: string; code: string; sectionId: string; section: Section }
type Subject = { id: string; name: string; code: string }
type Classroom = {
  id: string
  name: string
  capacity: number
  directorate: Directorate
  section?: Section | null
  option?: Option | null
  academicYearLabel: string | null
  _count: { enrollments: number }
}
type AcademicYear = { id: string; label: string; active: boolean }
type FeeLine = {
  id: string
  name: string
  code: string
  description?: string | null
  amountCents: number
  currency: string
  isMandatory: boolean
  isRecurring: boolean
  frequency?: string | null
  period?: string | null
  status: string
  directorate?: Directorate | null
}

export function SchoolSetupManager() {
  const [data, setData] = React.useState<{
    directorates: Directorate[]
    sections: Section[]
    options: Option[]
    subjects: Subject[]
    classrooms: Classroom[]
    academicYears: AcademicYear[]
    feeLines: FeeLine[]
  } | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [tab, setTab] = React.useState<'directorates' | 'sections' | 'options' | 'subjects' | 'classrooms' | 'fees' | 'assignments' | 'schedule'>('directorates')

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/direction/setup', { cache: 'no-store' })
      const result = await res.json()
      if (result.ok) {
        setData(result)
      } else {
        toast.error(result.error || 'Erreur de chargement')
      }
    } catch (err) {
      toast.error('Erreur réseau : ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  async function callApi(action: string, payload: any): Promise<any> {
    try {
      const res = await fetch('/api/direction/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success(data.message)
        await loadData()
        return data
      } else {
        toast.error(data.error)
        return null
      }
    } catch (err) {
      toast.error('Erreur : ' + (err as Error).message)
      return null
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-3 text-sm text-muted-foreground">Chargement de la configuration...</p>
      </div>
    )
  }

  if (!data) {
    return <EmptyState title="Impossible de charger les données" />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuration de l'établissement"
        description="Créez et gérez la structure complète de votre école : directions, sections, options, matières, classes et lignes de frais."
        breadcrumbs={[{ label: 'Direction' }, { label: 'Configuration' }]}
      />

      {/* Stats rapides */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatBox label="Directions" value={data.directorates.length} icon={Building2} />
        <StatBox label="Sections" value={data.sections.length} icon={Layers} />
        <StatBox label="Options" value={data.options.length} icon={GraduationCap} />
        <StatBox label="Matières" value={data.subjects.length} icon={BookOpen} />
        <StatBox label="Classes" value={data.classrooms.length} icon={Users} />
        <StatBox label="Lignes de frais" value={data.feeLines.length} icon={Wallet} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid w-full grid-cols-4 sm:grid-cols-8 gap-1 h-auto">
          <TabsTrigger value="directorates" className="flex flex-col items-center gap-1 py-2 text-xs">
            <Building2 className="h-4 w-4" /> Directions
          </TabsTrigger>
          <TabsTrigger value="sections" className="flex flex-col items-center gap-1 py-2 text-xs">
            <Layers className="h-4 w-4" /> Sections
          </TabsTrigger>
          <TabsTrigger value="options" className="flex flex-col items-center gap-1 py-2 text-xs">
            <GraduationCap className="h-4 w-4" /> Options
          </TabsTrigger>
          <TabsTrigger value="subjects" className="flex flex-col items-center gap-1 py-2 text-xs">
            <BookOpen className="h-4 w-4" /> Matières
          </TabsTrigger>
          <TabsTrigger value="classrooms" className="flex flex-col items-center gap-1 py-2 text-xs">
            <Users className="h-4 w-4" /> Classes
          </TabsTrigger>
          <TabsTrigger value="fees" className="flex flex-col items-center gap-1 py-2 text-xs">
            <Wallet className="h-4 w-4" /> Frais
          </TabsTrigger>
          <TabsTrigger value="assignments" className="flex flex-col items-center gap-1 py-2 text-xs">
            <UserCheck className="h-4 w-4" /> Affectations
          </TabsTrigger>
          <TabsTrigger value="schedule" className="flex flex-col items-center gap-1 py-2 text-xs">
            <Calendar className="h-4 w-4" /> Agenda
          </TabsTrigger>
        </TabsList>

        <TabsContent value="directorates" className="mt-4">
          <DirectoratesManager data={data.directorates} callApi={callApi} />
        </TabsContent>

        <TabsContent value="sections" className="mt-4">
          <SectionsManager data={data.sections} directorates={data.directorates} callApi={callApi} />
        </TabsContent>

        <TabsContent value="options" className="mt-4">
          <OptionsManager data={data.options} sections={data.sections} callApi={callApi} />
        </TabsContent>

        <TabsContent value="subjects" className="mt-4">
          <SubjectsManager data={data.subjects} callApi={callApi} />
        </TabsContent>

        <TabsContent value="classrooms" className="mt-4">
          <ClassroomsManager
            data={data.classrooms}
            directorates={data.directorates}
            sections={data.sections}
            options={data.options}
            academicYears={data.academicYears}
            callApi={callApi}
          />
        </TabsContent>

        <TabsContent value="fees" className="mt-4">
          <FeeLinesManager data={data.feeLines} directorates={data.directorates} callApi={callApi} />
        </TabsContent>

        <TabsContent value="assignments" className="mt-4">
          <AssignmentsManager />
        </TabsContent>

        <TabsContent value="schedule" className="mt-4">
          <WeeklyScheduleManager />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================================
// Composants partagés
// ============================================================

function StatBox({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
  return (
    <div className="p-3 rounded-md border border-border bg-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
    </div>
  )
}

function CreateCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Plus className="h-4 w-4" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  )
}

function ListCard({ title, items, emptyMessage, children }: {
  title: string
  items: any[]
  emptyMessage: string
  children: (item: any) => React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">📋 {title} ({items.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">{emptyMessage}</p>
        ) : (
          <div className="space-y-2">{items.map((item) => children(item))}</div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// 1. DIRECTIONS
// ============================================================

function DirectoratesManager({ data, callApi }: { data: Directorate[]; callApi: any }) {
  const [name, setName] = React.useState('')
  const [code, setCode] = React.useState('')
  const [pending, setPending] = React.useState(false)

  async function submit() {
    if (!name || !code) {
      toast.error('Nom et code obligatoires')
      return
    }
    setPending(true)
    await callApi('create-directorate', { name, code })
    setName('')
    setCode('')
    setPending(false)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CreateCard title="Nouvelle direction">
        <div className="space-y-2">
          <Label>Nom *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Primaire" />
          <p className="text-xs text-muted-foreground">Exemples : Maternelle, Primaire, Secondaire</p>
        </div>
        <div className="space-y-2">
          <Label>Code *</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Ex : PRIM" />
        </div>
        <Button onClick={submit} disabled={pending} className="w-full">
          {pending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
          Créer la direction
        </Button>
      </CreateCard>

      <ListCard title="Directions existantes" items={data} emptyMessage="Aucune direction créée">
        {(item: Directorate) => (
          <div key={item.id} className="flex items-center justify-between p-3 rounded-md border border-border bg-muted/20">
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground">Code : {item.code}</p>
            </div>
            <Badge variant="outline">{item.code}</Badge>
          </div>
        )}
      </ListCard>
    </div>
  )
}

// ============================================================
// 2. SECTIONS
// ============================================================

function SectionsManager({ data, directorates, callApi }: { data: Section[]; directorates: Directorate[]; callApi: any }) {
  const [name, setName] = React.useState('')
  const [code, setCode] = React.useState('')
  const [directorateId, setDirectorateId] = React.useState('')
  const [pending, setPending] = React.useState(false)

  async function submit() {
    if (!name || !code || !directorateId) {
      toast.error('Tous les champs sont obligatoires')
      return
    }
    setPending(true)
    await callApi('create-section', { name, code, directorateId })
    setName('')
    setCode('')
    setPending(false)
  }

  if (directorates.length === 0) {
    return (
      <EmptyState
        icon={<Building2 className="h-5 w-5" />}
        title="Créez d'abord une direction"
        description="Les sections sont rattachées à une direction. Allez dans l'onglet Directions pour en créer une."
      />
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CreateCard title="Nouvelle section">
        <div className="space-y-2">
          <Label>Direction *</Label>
          <select className="w-full p-2 border rounded-md bg-background text-sm" value={directorateId} onChange={(e) => setDirectorateId(e.target.value)}>
            <option value="">— Sélectionner —</option>
            {directorates.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Nom *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Lettres" />
        </div>
        <div className="space-y-2">
          <Label>Code *</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Ex : LETT" />
        </div>
        <Button onClick={submit} disabled={pending} className="w-full">
          {pending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
          Créer la section
        </Button>
      </CreateCard>

      <ListCard title="Sections existantes" items={data} emptyMessage="Aucune section créée">
        {(item: Section) => (
          <div key={item.id} className="flex items-center justify-between p-3 rounded-md border border-border bg-muted/20">
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground">Code : {item.code} · Direction : {item.directorate.name}</p>
            </div>
            <Badge variant="outline">{item.directorate.code}</Badge>
          </div>
        )}
      </ListCard>
    </div>
  )
}

// ============================================================
// 3. OPTIONS
// ============================================================

function OptionsManager({ data, sections, callApi }: { data: Option[]; sections: Section[]; callApi: any }) {
  const [name, setName] = React.useState('')
  const [code, setCode] = React.useState('')
  const [sectionId, setSectionId] = React.useState('')
  const [pending, setPending] = React.useState(false)

  async function submit() {
    if (!name || !code || !sectionId) {
      toast.error('Tous les champs sont obligatoires')
      return
    }
    setPending(true)
    await callApi('create-option', { name, code, sectionId })
    setName('')
    setCode('')
    setPending(false)
  }

  if (sections.length === 0) {
    return (
      <EmptyState
        icon={<Layers className="h-5 w-5" />}
        title="Créez d'abord une section"
        description="Les options sont rattachées à une section. Allez dans l'onglet Sections."
      />
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CreateCard title="Nouvelle option">
        <div className="space-y-2">
          <Label>Section *</Label>
          <select className="w-full p-2 border rounded-md bg-background text-sm" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
            <option value="">— Sélectionner —</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.directorate.name})</option>)}
          </select>
          <p className="text-xs text-muted-foreground">Exemples : Scientifique, Commerciale, Coupe-Couture</p>
        </div>
        <div className="space-y-2">
          <Label>Nom *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Scientifique" />
        </div>
        <div className="space-y-2">
          <Label>Code *</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Ex : SCI" />
        </div>
        <Button onClick={submit} disabled={pending} className="w-full">
          {pending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
          Créer l'option
        </Button>
      </CreateCard>

      <ListCard title="Options existantes" items={data} emptyMessage="Aucune option créée">
        {(item: Option) => (
          <div key={item.id} className="flex items-center justify-between p-3 rounded-md border border-border bg-muted/20">
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground">Code : {item.code} · Section : {item.section.name}</p>
            </div>
            <Badge variant="outline">{item.section.code}</Badge>
          </div>
        )}
      </ListCard>
    </div>
  )
}

// ============================================================
// 4. MATIÈRES
// ============================================================

function SubjectsManager({ data, callApi }: { data: Subject[]; callApi: any }) {
  const [name, setName] = React.useState('')
  const [code, setCode] = React.useState('')
  const [pending, setPending] = React.useState(false)

  async function submit() {
    if (!name || !code) {
      toast.error('Nom et code obligatoires')
      return
    }
    setPending(true)
    await callApi('create-subject', { name, code })
    setName('')
    setCode('')
    setPending(false)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CreateCard title="Nouvelle matière">
        <div className="space-y-2">
          <Label>Nom *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Mathématiques" />
        </div>
        <div className="space-y-2">
          <Label>Code *</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Ex : MATH" />
        </div>
        <Button onClick={submit} disabled={pending} className="w-full">
          {pending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
          Créer la matière
        </Button>
      </CreateCard>

      <ListCard title="Matières existantes" items={data} emptyMessage="Aucune matière créée">
        {(item: Subject) => (
          <div key={item.id} className="flex items-center justify-between p-3 rounded-md border border-border bg-muted/20">
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground">Code : {item.code}</p>
            </div>
            <Badge variant="outline">{item.code}</Badge>
          </div>
        )}
      </ListCard>
    </div>
  )
}

// ============================================================
// 5. CLASSES
// ============================================================

function ClassroomsManager({
  data, directorates, sections, options, academicYears, callApi,
}: {
  data: Classroom[]
  directorates: Directorate[]
  sections: Section[]
  options: Option[]
  academicYears: AcademicYear[]
  callApi: any
}) {
  const [name, setName] = React.useState('')
  const [capacity, setCapacity] = React.useState('40')
  const [directorateId, setDirectorateId] = React.useState('')
  const [sectionId, setSectionId] = React.useState('')
  const [optionId, setOptionId] = React.useState('')
  const [academicYearId, setAcademicYearId] = React.useState('')
  const [pending, setPending] = React.useState(false)

  const filteredSections = sections.filter((s) => !directorateId || s.directorateId === directorateId)
  const filteredOptions = options.filter((o) => !sectionId || o.sectionId === sectionId)

  async function submit() {
    if (!name || !directorateId || !academicYearId) {
      toast.error('Nom, direction et année académique obligatoires')
      return
    }
    setPending(true)
    await callApi('create-classroom', {
      name,
      capacity: parseInt(capacity, 10) || 40,
      directorateId,
      sectionId: sectionId || undefined,
      optionId: optionId || undefined,
      academicYearId,
    })
    setName('')
    setSectionId('')
    setOptionId('')
    setPending(false)
  }

  if (directorates.length === 0 || academicYears.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-5 w-5" />}
        title="Prérequis manquants"
        description="Créez d'abord une direction et une année académique active."
      />
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CreateCard title="Nouvelle classe">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2 col-span-2">
            <Label>Année académique *</Label>
            <select className="w-full p-2 border rounded-md bg-background text-sm" value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)}>
              <option value="">— Sélectionner —</option>
              {academicYears.map((y) => <option key={y.id} value={y.id}>{y.label} {y.active && '(active)'}</option>)}
            </select>
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Direction *</Label>
            <select className="w-full p-2 border rounded-md bg-background text-sm" value={directorateId} onChange={(e) => { setDirectorateId(e.target.value); setSectionId(''); setOptionId('') }}>
              <option value="">— Sélectionner —</option>
              {directorates.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Section (optionnel)</Label>
            <select className="w-full p-2 border rounded-md bg-background text-sm" value={sectionId} onChange={(e) => { setSectionId(e.target.value); setOptionId('') }} disabled={!directorateId}>
              <option value="">—</option>
              {filteredSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Option (optionnel)</Label>
            <select className="w-full p-2 border rounded-md bg-background text-sm" value={optionId} onChange={(e) => setOptionId(e.target.value)} disabled={!sectionId}>
              <option value="">—</option>
              {filteredOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Nom de la classe *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : 6ème A" />
          </div>
          <div className="space-y-2">
            <Label>Capacité</Label>
            <Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </div>
        </div>
        <Button onClick={submit} disabled={pending} className="w-full">
          {pending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
          Créer la classe
        </Button>
      </CreateCard>

      <ListCard title="Classes existantes" items={data} emptyMessage="Aucune classe créée">
        {(item: Classroom) => (
          <div key={item.id} className="flex items-center justify-between p-3 rounded-md border border-border bg-muted/20">
            <div>
              <p className="font-medium">{item.name} <span className="text-xs text-muted-foreground">({item.capacity} places)</span></p>
              <p className="text-xs text-muted-foreground">
                {item.directorate.name}
                {item.section && ` · ${item.section.name}`}
                {item.option && ` · ${item.option.name}`}
                {item.academicYearLabel && ` · ${item.academicYearLabel}`}
              </p>
              <p className="text-xs text-emerald-600 mt-1">{item._count.enrollments} élève(s) inscrit(s)</p>
            </div>
            <Badge variant="outline">{item.directorate.code}</Badge>
          </div>
        )}
      </ListCard>
    </div>
  )
}

// ============================================================
// 6. LIGNES DE FRAIS
// ============================================================

function FeeLinesManager({ data, directorates, callApi }: { data: FeeLine[]; directorates: Directorate[]; callApi: any }) {
  const [name, setName] = React.useState('')
  const [code, setCode] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [amount, setAmount] = React.useState('') // en FC (sera converti en centimes)
  const [currency, setCurrency] = React.useState('CDF')
  const [isMandatory, setIsMandatory] = React.useState(true)
  const [isRecurring, setIsRecurring] = React.useState(false)
  const [frequency, setFrequency] = React.useState('ONE_TIME')
  const [period, setPeriod] = React.useState('')
  const [directorateId, setDirectorateId] = React.useState('')
  const [pending, setPending] = React.useState(false)

  async function submit() {
    if (!name || !code || !amount) {
      toast.error('Nom, code et montant obligatoires')
      return
    }
    const amountNumber = parseFloat(amount)
    if (isNaN(amountNumber) || amountNumber <= 0) {
      toast.error('Montant invalide')
      return
    }
    setPending(true)
    await callApi('create-fee-line', {
      name,
      code,
      description,
      amountCents: Math.round(amountNumber * 100), // Conversion en centimes
      currency,
      isMandatory,
      isRecurring,
      frequency,
      period: period || undefined,
      directorateId: directorateId || undefined,
    })
    setName(''); setCode(''); setDescription(''); setAmount(''); setPeriod('')
    setPending(false)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CreateCard title="Nouvelle ligne de frais">
        <div className="space-y-2">
          <Label>Libellé *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Minerval T1" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Code *</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Ex : MIN-T1" />
          </div>
          <div className="space-y-2">
            <Label>Devise</Label>
            <select className="w-full p-2 border rounded-md bg-background text-sm" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="CDF">CDF (Franc Congolais)</option>
              <option value="USD">USD (Dollar)</option>
              <option value="EUR">EUR (Euro)</option>
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Montant *</Label>
          <Input type="number" min={0} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Ex : 50000" />
          <p className="text-xs text-muted-foreground">Montant dans la devise choisie (ex : 50000 CDF)</p>
        </div>
        <div className="space-y-2">
          <Label>Description (optionnel)</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Description du frais..." />
        </div>
        <div className="space-y-2">
          <Label>Direction concernée (optionnel)</Label>
          <select className="w-full p-2 border rounded-md bg-background text-sm" value={directorateId} onChange={(e) => setDirectorateId(e.target.value)}>
            <option value="">Toutes les directions</option>
            {directorates.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Fréquence</Label>
            <select className="w-full p-2 border rounded-md bg-background text-sm" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
              <option value="ONE_TIME">Ponctuel</option>
              <option value="MONTHLY">Mensuel</option>
              <option value="QUARTERLY">Trimestriel</option>
              <option value="YEARLY">Annuel</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Période (ex : T1)</Label>
            <Input value={period} onChange={(e) => setPeriod(e.target.value.toUpperCase())} placeholder="T1, T2, T3, EXAM" />
          </div>
        </div>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isMandatory} onChange={(e) => setIsMandatory(e.target.checked)} />
            <span>Obligatoire</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
            <span>Récurrent</span>
          </label>
        </div>
        <Button onClick={submit} disabled={pending} className="w-full">
          {pending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
          Créer la ligne de frais
        </Button>
      </CreateCard>

      <ListCard title="Lignes de frais existantes" items={data} emptyMessage="Aucune ligne de frais créée">
        {(item: FeeLine) => (
          <div key={item.id} className="p-3 rounded-md border border-border bg-muted/20">
            <div className="flex items-center justify-between">
              <p className="font-medium">{item.name}</p>
              <Badge variant="outline">{item.code}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              💰 {formatCurrency(item.amountCents / 100, item.currency)}
              {item.directorate && ` · ${item.directorate.name}`}
              {item.period && ` · ${item.period}`}
              {item.isRecurring && ` · ${item.frequency}`}
            </p>
            {item.description && <p className="text-xs text-muted-foreground mt-1">{item.description}</p>}
            <div className="flex gap-2 mt-2">
              {item.isMandatory && <Badge variant="secondary" className="text-xs">Obligatoire</Badge>}
              {item.isRecurring && <Badge variant="secondary" className="text-xs">Récurrent</Badge>}
              <Badge variant={item.status === 'ACTIVE' ? 'default' : 'outline'} className="text-xs">
                {item.status === 'ACTIVE' ? '✓ Actif' : item.status}
              </Badge>
            </div>
          </div>
        )}
      </ListCard>
    </div>
  )
}

// ============================================================
// 7. AFFECTATIONS PROF → MATIÈRE + CLASSE
// ============================================================

type Assignment = {
  id: string
  employeeId: string
  employeeName: string
  employeeEmail: string
  subjectId: string
  subjectName: string
  classroomId: string
  classroomName: string
  directorateName?: string
}

function AssignmentsManager() {
  const [data, setData] = React.useState<{
    assignments: Assignment[]
    employees: Array<{ id: string; name: string; email: string }>
    subjects: Subject[]
    classrooms: Array<{ id: string; name: string; directorateName: string }>
  } | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [employeeId, setEmployeeId] = React.useState('')
  const [subjectId, setSubjectId] = React.useState('')
  const [classroomId, setClassroomId] = React.useState('')
  const [pending, setPending] = React.useState(false)

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/direction/assign-teacher', { cache: 'no-store' })
      const result = await res.json()
      if (result.ok) setData(result)
    } catch (err) {
      toast.error('Erreur réseau : ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { loadData() }, [loadData])

  async function submit() {
    if (!employeeId || !subjectId || !classroomId) {
      toast.error('Tous les champs obligatoires')
      return
    }
    setPending(true)
    try {
      const res = await fetch('/api/direction/assign-teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, subjectId, classroomId }),
      })
      const result = await res.json()
      if (result.ok) {
        toast.success(result.message)
        setEmployeeId(''); setSubjectId(''); setClassroomId('')
        await loadData()
      } else {
        toast.error(result.error)
      }
    } catch (err) {
      toast.error('Erreur : ' + (err as Error).message)
    } finally {
      setPending(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Supprimer cette affectation ?')) return
    try {
      await fetch(`/api/direction/assign-teacher?id=${id}`, { method: 'DELETE' })
      toast.success('Affectation supprimée')
      await loadData()
    } catch (err) {
      toast.error('Erreur : ' + (err as Error).message)
    }
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
  if (!data) return <EmptyState title="Données indisponibles" />

  if (data.employees.length === 0 || data.subjects.length === 0 || data.classrooms.length === 0) {
    return (
      <EmptyState
        icon={<UserCheck className="h-5 w-5" />}
        title="Prérequis manquants"
        description="Il faut au moins 1 professeur, 1 matière et 1 classe. Créez-les dans les onglets précédents."
      />
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CreateCard title="Nouvelle affectation prof">
        <div className="space-y-2">
          <Label>Professeur *</Label>
          <select className="w-full p-2 border rounded-md bg-background text-sm" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">— Sélectionner —</option>
            {data.employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.email})</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Matière *</Label>
          <select className="w-full p-2 border rounded-md bg-background text-sm" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">— Sélectionner —</option>
            {data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Classe *</Label>
          <select className="w-full p-2 border rounded-md bg-background text-sm" value={classroomId} onChange={(e) => setClassroomId(e.target.value)}>
            <option value="">— Sélectionner —</option>
            {data.classrooms.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.directorateName})</option>)}
          </select>
        </div>
        <Button onClick={submit} disabled={pending} className="w-full">
          {pending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserCheck className="h-4 w-4 mr-2" />}
          Créer l'affectation
        </Button>
      </CreateCard>

      <ListCard title="Affectations existantes" items={data.assignments} emptyMessage="Aucune affectation créée">
        {(item: Assignment) => (
          <div key={item.id} className="flex items-center justify-between p-3 rounded-md border border-border bg-muted/20">
            <div className="flex-1">
              <p className="font-medium">{item.employeeName}</p>
              <p className="text-xs text-muted-foreground">
                {item.subjectName} → {item.classroomName}
                {item.directorateName && ` (${item.directorateName})`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{item.subjectName}</Badge>
              <Button size="sm" variant="ghost" onClick={() => remove(item.id)}>
                <Trash2 className="h-3.5 w-3.5 text-red-500" />
              </Button>
            </div>
          </div>
        )}
      </ListCard>
    </div>
  )
}

// ============================================================
// 8. AGENDA HEBDOMADAIRE (emploi du temps)
// ============================================================

type ScheduleSlot = {
  id: string
  employeeId: string
  employeeName: string
  classroomId: string
  classroomName: string
  directorateName?: string
  subjectId: string
  subjectName: string
  dayOfWeek: number
  dayName: string
  startTime: string
  endTime: string
  room?: string | null
}

const WEEK_DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const WORK_DAYS = [1, 2, 3, 4, 5, 6] // Lundi-Samedi (pas dimanche en RDC)

function WeeklyScheduleManager() {
  const [data, setData] = React.useState<{
    schedules: ScheduleSlot[]
    employees: Array<{ id: string; name: string; email: string }>
    subjects: Subject[]
    classrooms: Array<{ id: string; name: string; directorateName: string }>
    days: string[]
  } | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [filterClassroom, setFilterClassroom] = React.useState('')
  const [filterEmployee, setFilterEmployee] = React.useState('')

  // Formulaire de création
  const [employeeId, setEmployeeId] = React.useState('')
  const [subjectId, setSubjectId] = React.useState('')
  const [classroomId, setClassroomId] = React.useState('')
  const [dayOfWeek, setDayOfWeek] = React.useState('1')
  const [startTime, setStartTime] = React.useState('08:00')
  const [endTime, setEndTime] = React.useState('10:00')
  const [room, setRoom] = React.useState('')
  const [pending, setPending] = React.useState(false)

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      let url = '/api/direction/schedule'
      const params = new URLSearchParams()
      if (filterClassroom) params.append('classroomId', filterClassroom)
      if (filterEmployee) params.append('employeeId', filterEmployee)
      if (params.toString()) url += '?' + params.toString()
      const res = await fetch(url, { cache: 'no-store' })
      const result = await res.json()
      if (result.ok) setData(result)
    } catch (err) {
      toast.error('Erreur réseau : ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [filterClassroom, filterEmployee])

  React.useEffect(() => { loadData() }, [loadData])

  async function submit() {
    if (!employeeId || !subjectId || !classroomId) {
      toast.error('Professeur, matière et classe obligatoires')
      return
    }
    if (startTime >= endTime) {
      toast.error('Heure de début doit être avant la fin')
      return
    }
    setPending(true)
    try {
      const res = await fetch('/api/direction/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId, subjectId, classroomId,
          dayOfWeek: parseInt(dayOfWeek, 10),
          startTime, endTime, room,
        }),
      })
      const result = await res.json()
      if (result.ok) {
        toast.success(result.message)
        setRoom('')
        await loadData()
      } else {
        toast.error(result.error)
      }
    } catch (err) {
      toast.error('Erreur : ' + (err as Error).message)
    } finally {
      setPending(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Supprimer ce créneau ?')) return
    try {
      await fetch(`/api/direction/schedule?id=${id}`, { method: 'DELETE' })
      toast.success('Créneau supprimé')
      await loadData()
    } catch (err) {
      toast.error('Erreur : ' + (err as Error).message)
    }
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
  if (!data) return <EmptyState title="Données indisponibles" />

  if (data.employees.length === 0 || data.subjects.length === 0 || data.classrooms.length === 0) {
    return (
      <EmptyState
        icon={<Calendar className="h-5 w-5" />}
        title="Prérequis manquants"
        description="Il faut au moins 1 professeur, 1 matière et 1 classe. Créez-les dans les onglets précédents."
      />
    )
  }

  // Grouper les créneaux par jour
  const slotsByDay = new Map<number, ScheduleSlot[]>()
  for (const day of WORK_DAYS) {
    slotsByDay.set(day, (data.schedules || []).filter((s) => s.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime)))
  }

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Filtrer :</span>
          <select className="p-1.5 border rounded-md bg-background text-xs" value={filterClassroom} onChange={(e) => setFilterClassroom(e.target.value)}>
            <option value="">Toutes classes</option>
            {data.classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="p-1.5 border rounded-md bg-background text-xs" value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)}>
            <option value="">Tous profs</option>
            {data.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Formulaire */}
        <CreateCard title="Nouveau créneau horaire">
          <div className="space-y-2">
            <Label>Professeur *</Label>
            <select className="w-full p-2 border rounded-md bg-background text-sm" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">— Sélectionner —</option>
              {data.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Matière *</Label>
              <select className="w-full p-2 border rounded-md bg-background text-sm" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">—</option>
                {data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Classe *</Label>
              <select className="w-full p-2 border rounded-md bg-background text-sm" value={classroomId} onChange={(e) => setClassroomId(e.target.value)}>
                <option value="">—</option>
                {data.classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Jour *</Label>
            <select className="w-full p-2 border rounded-md bg-background text-sm" value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)}>
              {WORK_DAYS.map((d) => <option key={d} value={d}>{WEEK_DAYS[d]}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Début *</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fin *</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Salle (optionnel)</Label>
            <Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Ex : Salle 12" />
          </div>
          <Button onClick={submit} disabled={pending} className="w-full">
            {pending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calendar className="h-4 w-4 mr-2" />}
            Créer le créneau
          </Button>
        </CreateCard>

        {/* Vue calendrier */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">📅 Emploi du temps hebdomadaire</CardTitle>
          </CardHeader>
          <CardContent>
            {(data.schedules || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Aucun créneau créé</p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {WORK_DAYS.map((day) => {
                  const slots = slotsByDay.get(day) || []
                  if (slots.length === 0) return null
                  return (
                    <div key={day} className="border border-border rounded-md">
                      <div className="bg-muted/50 px-2 py-1 text-xs font-semibold border-b border-border">
                        {WEEK_DAYS[day]} ({slots.length} cours)
                      </div>
                      <div className="p-2 space-y-1.5">
                        {slots.map((s) => (
                          <div key={s.id} className="flex items-center justify-between p-2 rounded-md bg-muted/20 text-xs">
                            <div className="flex-1">
                              <p className="font-medium">{s.startTime} - {s.endTime}</p>
                              <p className="text-muted-foreground">{s.subjectName} · {s.classroomName}</p>
                              <p className="text-muted-foreground">{s.employeeName}{s.room && ` · ${s.room}`}</p>
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => remove(s.id)}>
                              <Trash2 className="h-3 w-3 text-red-500" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
