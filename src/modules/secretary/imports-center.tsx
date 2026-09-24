'use client'

// SmartShule — Centre Imports CSV/XLSX (8 étapes)
// ============================================================
// 1. Sélection type d'import
// 2. Téléchargement modèle
// 3. Dépôt fichier
// 4. Mapping colonnes
// 5. Validation + prévisualisation
// 6. Correction erreurs
// 7. Confirmation + exécution
// 8. Résultat + rollback

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PageHeader } from '@/components/ss/page-header'
import { DataGrid, type DataGridColumn } from '@/components/ss/data-grid'
import {
  Loader2, Upload, Download, FileSpreadsheet, FileText, ArrowRight,
  CheckCircle2, XCircle, AlertCircle, RotateCcw, Eye, ChevronRight,
  ClipboardList, RefreshCw, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

type ImportType =
  | 'STUDENTS' | 'REENROLLMENTS' | 'PARENTS' | 'PARENT_STUDENT_LINKS'
  | 'CLASS_ASSIGNMENTS' | 'ADMIN_UPDATE' | 'HISTORY'

type Step = 'type' | 'download' | 'upload' | 'mapping' | 'validate' | 'correct' | 'execute' | 'result'

type ImportJob = {
  id: string
  importReference: string
  importType: ImportType
  originalFileName: string
  status: string
  totalRows: number
  validRows: number
  warningRows: number
  errorRows: number
  duplicateRows: number
  createdCount: number
  updatedCount: number
  rejectedCount: number
  progressPct: number
  isRollbackable: boolean
  rolledBackAt: string | null
  createdAt: string
  completedAt: string | null
  createdByName: string
}

const STEP_LABELS: Record<Step, string> = {
  type: '1. Type d\'import',
  download: '2. Modèle',
  upload: '3. Dépôt fichier',
  mapping: '4. Mapping colonnes',
  validate: '5. Validation',
  correct: '6. Correction',
  execute: '7. Exécution',
  result: '8. Résultat',
}

export function ImportsCenter() {
  const [step, setStep] = React.useState<Step>('type')
  const [importType, setImportType] = React.useState<ImportType | null>(null)
  const [jobId, setJobId] = React.useState<string | null>(null)
  const [job, setJob] = React.useState<ImportJob | null>(null)

  const updateJob = (j: ImportJob) => { setJob(j); setJobId(j.id) }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Centre Imports CSV / XLSX"
        description="Importation massive sécurisée — 8 étapes, validation, prévisualisation, rollback"
        breadcrumbs={[{ label: 'Secrétariat' }, { label: 'Imports' }]}
      />

      {/* Stepper */}
      <div className="flex items-center gap-2 flex-wrap">
        {(Object.keys(STEP_LABELS) as Step[]).map((s, i) => (
          <React.Fragment key={s}>
            <Button
              size="sm"
              variant={step === s ? 'default' : 'outline'}
              onClick={() => {
                // Permettre navigation arrière si job en cours
                if (i === 0 || job || s === 'result') setStep(s)
              }}
              className="h-8 text-xs"
              disabled={i > 0 && !job && s !== 'type'}
            >
              {STEP_LABELS[s]}
            </Button>
            {i < 7 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          </React.Fragment>
        ))}
      </div>

      {step === 'type' && (
        <TypeStep onSelect={(t) => { setImportType(t); setStep('download') }} />
      )}

      {step === 'download' && importType && (
        <DownloadStep importType={importType} onNext={() => setStep('upload')} onBack={() => setStep('type')} />
      )}

      {step === 'upload' && importType && (
        <UploadStep
          importType={importType}
          onUploaded={(j) => { updateJob(j); setStep('mapping') }}
          onBack={() => setStep('download')}
        />
      )}

      {step === 'mapping' && jobId && (
        <MappingStep
          jobId={jobId}
          onValidated={() => setStep('validate')}
          onBack={() => setStep('upload')}
        />
      )}

      {step === 'validate' && jobId && (
        <ValidateStep
          jobId={jobId}
          onValidate={(hasErrors) => setStep(hasErrors ? 'correct' : 'execute')}
          onBack={() => setStep('mapping')}
        />
      )}

      {step === 'correct' && jobId && (
        <CorrectStep
          jobId={jobId}
          onRetry={() => setStep('validate')}
          onBack={() => setStep('validate')}
        />
      )}

      {step === 'execute' && jobId && (
        <ExecuteStep
          jobId={jobId}
          onExecuted={() => setStep('result')}
          onBack={() => setStep('validate')}
        />
      )}

      {step === 'result' && jobId && (
        <ResultStep
          jobId={jobId}
          onNew={() => { setJob(null); setJobId(null); setImportType(null); setStep('type') }}
        />
      )}

      {/* Historique des jobs */}
      <JobsHistory onOpenJob={(j) => { updateJob(j); setStep('result') }} />
    </div>
  )
}

// ============================================================
// Étape 1: Type d'import
// ============================================================

const IMPORT_TYPES: Array<{ value: ImportType; label: string; description: string; icon: React.ReactNode; maxRows: number }> = [
  { value: 'STUDENTS', label: 'Nouveaux élèves', description: 'Importer des élèves non encore enregistrés', icon: <FileSpreadsheet className="h-5 w-5" />, maxRows: 10000 },
  { value: 'REENROLLMENTS', label: 'Réinscriptions', description: 'Réinscrire les élèves existants pour la nouvelle année', icon: <RefreshCw className="h-5 w-5" />, maxRows: 10000 },
  { value: 'PARENTS', label: 'Parents / Tuteurs', description: 'Importer des parents ou tuteurs', icon: <FileText className="h-5 w-5" />, maxRows: 5000 },
  { value: 'PARENT_STUDENT_LINKS', label: 'Relations parent-enfant', description: 'Lier des parents existants à des élèves existants', icon: <ClipboardList className="h-5 w-5" />, maxRows: 10000 },
  { value: 'CLASS_ASSIGNMENTS', label: 'Affectations de classe', description: 'Affecter des élèves à des classes', icon: <FileSpreadsheet className="h-5 w-5" />, maxRows: 10000 },
  { value: 'ADMIN_UPDATE', label: 'Mise à jour administrative', description: 'Mettre à jour des données existantes', icon: <RefreshCw className="h-5 w-5" />, maxRows: 10000 },
  { value: 'HISTORY', label: 'Import historique', description: 'Importer un historique (réservé Admin)', icon: <FileText className="h-5 w-5" />, maxRows: 20000 },
]

function TypeStep({ onSelect }: { onSelect: (t: ImportType) => void }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Choisir le type d'import</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {IMPORT_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => onSelect(t.value)}
            className="p-4 border rounded-lg text-left hover:bg-muted/40 hover:border-primary transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded">{t.icon}</div>
              <div className="flex-1">
                <p className="font-medium text-sm">{t.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                <p className="text-xs text-muted-foreground mt-2">Max: {t.maxRows} lignes</p>
              </div>
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  )
}

// ============================================================
// Étape 2: Téléchargement du modèle
// ============================================================

function DownloadStep({ importType, onNext, onBack }: { importType: ImportType; onNext: () => void; onBack: () => void }) {
  const [downloading, setDownloading] = React.useState<'csv' | 'xlsx' | null>(null)

  async function download(format: 'csv' | 'xlsx') {
    setDownloading(format)
    try {
      const res = await fetch(`/api/imports/template?action=download&type=${importType}&format=${format}`)
      if (!res.ok) throw new Error('Erreur téléchargement')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `modele-${importType.toLowerCase()}.${format}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(`Modèle ${format.toUpperCase()} téléchargé`)
    } catch (err) {
      toast.error('Erreur : ' + (err as Error).message)
    } finally {
      setDownloading(null)
    }
  }

  const typeInfo = IMPORT_TYPES.find((t) => t.value === importType)

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Télécharger le modèle</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 bg-muted/40 rounded border">
          <p className="font-medium">{typeInfo?.label}</p>
          <p className="text-sm text-muted-foreground mt-1">{typeInfo?.description}</p>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Le fichier modèle contient les en-têtes de colonnes obligatoires (en jaune) et optionnelles,
            2 lignes d'exemple, et une feuille d'instructions séparée.
            Les cellules commençant par <code className="bg-muted px-1 rounded">=</code>, <code className="bg-muted px-1 rounded">+</code>, <code className="bg-muted px-1 rounded">-</code>, <code className="bg-muted px-1 rounded">@</code> sont automatiquement neutralisées.
          </AlertDescription>
        </Alert>

        <div className="flex gap-3">
          <Button onClick={() => download('xlsx')} disabled={downloading === 'xlsx'}>
            {downloading === 'xlsx' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
            Modèle XLSX
          </Button>
          <Button onClick={() => download('csv')} variant="outline" disabled={downloading === 'csv'}>
            {downloading === 'csv' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
            Modèle CSV
          </Button>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>Retour</Button>
          <Button onClick={onNext}>Continuer <ArrowRight className="h-4 w-4 ml-1" /></Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Étape 3: Upload du fichier
// ============================================================

function UploadStep({ importType, onUploaded, onBack }: { importType: ImportType; onUploaded: (j: ImportJob) => void; onBack: () => void }) {
  const [uploading, setUploading] = React.useState(false)
  const [dragOver, setDragOver] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (max 10 Mo)')
      return
    }
    const ext = file.name.toLowerCase()
    if (!ext.endsWith('.csv') && !ext.endsWith('.xlsx') && !ext.endsWith('.xls')) {
      toast.error('Format non supporté. Utilisez CSV ou XLSX.')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('importType', importType)
      const res = await fetch('/api/imports/upload', { method: 'POST', body: formData })
      const json = await res.json()
      if (json.ok) {
        toast.success(`${json.rowCount} lignes détectées`)
        onUploaded({
          id: json.importJobId,
          importReference: json.importReference,
          importType,
          originalFileName: file.name,
          status: 'UPLOADED',
          totalRows: json.rowCount,
          validRows: 0, warningRows: 0, errorRows: 0, duplicateRows: 0,
          createdCount: 0, updatedCount: 0, rejectedCount: 0,
          progressPct: 0,
          isRollbackable: true,
          rolledBackAt: null,
          createdAt: new Date().toISOString(),
          completedAt: null,
          createdByName: '',
        })
      } else {
        toast.error(json.error)
      }
    } catch (err) {
      toast.error('Erreur : ' + (err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Déposer le fichier rempli</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/30'}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragOver(false)
            const file = e.dataTransfer.files[0]
            if (file) handleFile(file)
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Upload et parsing en cours...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm">Glissez le fichier ici ou</p>
              <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1" /> Parcourir
              </Button>
              <p className="text-xs text-muted-foreground mt-2">CSV ou XLSX — Max 10 Mo</p>
            </div>
          )}
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>Retour</Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Étape 4: Mapping des colonnes
// ============================================================

function MappingStep({ jobId, onValidated, onBack }: { jobId: string; onValidated: () => void; onBack: () => void }) {
  const [headers, setHeaders] = React.useState<string[]>([])
  const [mapping, setMapping] = React.useState<Record<string, string>>({})
  const [requiredFields, setRequiredFields] = React.useState<string[]>([])
  const [validating, setValidating] = React.useState(false)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetch(`/api/imports/validate?jobId=${jobId}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) {
          // Récupérer les infos du job (importType)
          return fetch('/api/imports/template?action=list').then((r) => r.json()).then((tjson) => {
            if (tjson.ok) {
              // Mapping automatique
              const initial: Record<string, string> = {}
              headers.forEach((h) => { initial[h] = h })
            }
          })
        }
      })
      .finally(() => setLoading(false))
  }, [jobId])

  // Récupérer le job + headers
  React.useEffect(() => {
    fetch(`/api/imports/validate?jobId=${jobId}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => {
        if (json.ok && json.job) {
          try {
            const map = JSON.parse(json.job.columnMapping || '{}')
            setHeaders(Object.keys(map))
            setMapping(map)
            // Required fields dépendent du type d'import
            const type = json.job.importType
            const requiredByType: Record<string, string[]> = {
              STUDENTS: ['firstName', 'lastName', 'gender', 'birthDate'],
              REENROLLMENTS: ['matricule', 'classroomName'],
              PARENTS: ['firstName', 'lastName'],
              PARENT_STUDENT_LINKS: ['parentPhone', 'studentMatricule', 'relation'],
              CLASS_ASSIGNMENTS: ['studentMatricule', 'classroomName'],
              ADMIN_UPDATE: ['matricule'],
              HISTORY: ['firstName', 'lastName', 'matricule'],
            }
            setRequiredFields(requiredByType[type] || [])
          } catch {}
        }
      })
  }, [jobId])

  async function validate() {
    // Vérifier que tous les champs requis sont mappés
    const mappedTargets = new Set(Object.values(mapping))
    const missing = requiredFields.filter((f) => !mappedTargets.has(f))
    if (missing.length > 0) {
      toast.error(`Champs obligatoires non mappés: ${missing.join(', ')}`)
      return
    }

    setValidating(true)
    try {
      const res = await fetch('/api/imports/validate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validate', jobId, columnMapping: mapping }),
      })
      const json = await res.json()
      if (json.ok) {
        toast.success(json.message)
        onValidated()
      } else {
        toast.error(json.error)
      }
    } finally {
      setValidating(false)
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  const allTargetFields = Array.from(new Set([
    ...requiredFields,
    'firstName', 'lastName', 'gender', 'birthDate', 'birthPlace', 'address', 'phone', 'email',
    'matricule', 'classroomName', 'directorateName', 'sectionName', 'optionName', 'academicYearLabel',
    'parentName', 'parentPhone', 'parentEmail', 'parentRelation', 'relation',
    'isPrimary', 'hasCustody', 'isEmergencyContact', 'occupation', 'workplace', 'status',
  ]))

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Mapping des colonnes</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Associez chaque colonne de votre fichier au champ SmartShule correspondant.
            Les champs marqués <Badge className="bg-amber-100 text-amber-700 text-xs ml-1">obligatoire</Badge> doivent être mappés.
          </AlertDescription>
        </Alert>

        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {headers.map((h) => (
            <div key={h} className="grid grid-cols-2 gap-2 items-center p-2 border rounded">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{h}</span>
                {requiredFields.includes(mapping[h] || '') && (
                  <Badge className="bg-amber-100 text-amber-700 text-xs">obligatoire</Badge>
                )}
              </div>
              <Select
                value={mapping[h] || ''}
                onValueChange={(v) => setMapping({ ...mapping, [h]: v === '__none' ? '' : v })}
              >
                <SelectTrigger><SelectValue placeholder="— Ignorer —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Ignorer —</SelectItem>
                  {allTargetFields.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>Retour</Button>
          <Button onClick={validate} disabled={validating}>
            {validating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Valider
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Étape 5: Validation + Prévisualisation
// ============================================================

function ValidateStep({ jobId, onValidate, onBack }: { jobId: string; onValidate: (hasErrors: boolean) => void; onBack: () => void }) {
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/imports/validate?jobId=${jobId}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.ok) setData(json.job)
    } finally { setLoading(false) }
  }, [jobId])

  React.useEffect(() => { loadData() }, [loadData])

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  const job: ImportJob | undefined = data
  if (!job) return null

  const stats = [
    { label: 'Total lignes', value: job.totalRows, color: 'gray' },
    { label: 'Valides', value: job.validRows, color: 'green' },
    { label: 'Avertissements', value: job.warningRows, color: 'orange' },
    { label: 'Erreurs', value: job.errorRows, color: 'red' },
    { label: 'Doublons', value: job.duplicateRows, color: 'orange' },
  ]

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Résultat de la validation</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-5 gap-3">
          {stats.map((s) => (
            <div key={s.label} className={`p-3 rounded border ${
              s.color === 'green' ? 'border-emerald-200 bg-emerald-50/50 text-emerald-700' :
              s.color === 'red' ? 'border-red-200 bg-red-50/50 text-red-700' :
              s.color === 'orange' ? 'border-orange-200 bg-orange-50/50 text-orange-700' :
              'border-gray-200 bg-gray-50/50 text-gray-700'
            }`}>
              <p className="text-xs opacity-80">{s.label}</p>
              <p className="text-2xl font-bold">{s.value}</p>
            </div>
          ))}
        </div>

        {job.errorRows > 0 && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              {job.errorRows} ligne(s) en erreur bloquante. Téléchargez le rapport d'erreurs, corrigez le fichier,
              puis reprenez l'import depuis l'étape 3 (Dépôt fichier).
            </AlertDescription>
          </Alert>
        )}

        {job.duplicateRows > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {job.duplicateRows} doublon(s) potentiel(s) détecté(s) — ces lignes seront ignorées lors de l'import.
            </AlertDescription>
          </Alert>
        )}

        {job.errorRows === 0 && job.validRows > 0 && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              {job.validRows} ligne(s) prête(s) à importer. Passez à l'étape suivante pour confirmer.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>Retour</Button>
          <a href={`/api/imports/report?jobId=${jobId}`} target="_blank">
            <Button variant="outline"><Download className="h-4 w-4 mr-2" /> Télécharger rapport erreurs</Button>
          </a>
          <Button onClick={() => onValidate(job.errorRows > 0)} disabled={job.validRows === 0 && job.errorRows > 0}>
            {job.errorRows > 0 ? 'Corriger' : 'Continuer'}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Étape 6: Correction (redirige vers upload)
// ============================================================

function CorrectStep({ jobId, onRetry, onBack }: { jobId: string; onRetry: () => void; onBack: () => void }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Correction des erreurs</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            Des erreurs bloquantes ont été détectées. Vous devez :
          </AlertDescription>
        </Alert>

        <ol className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <Badge className="bg-blue-100 text-blue-700 text-xs">1</Badge>
            <span>Téléchargez le rapport d'erreurs XLSX pour identifier les lignes à corriger</span>
          </li>
          <li className="flex items-start gap-2">
            <Badge className="bg-blue-100 text-blue-700 text-xs">2</Badge>
            <span>Corrigez votre fichier source selon les erreurs indiquées</span>
          </li>
          <li className="flex items-start gap-2">
            <Badge className="bg-blue-100 text-blue-700 text-xs">3</Badge>
            <span>Reprenez l'import en déposant le fichier corrigé</span>
          </li>
        </ol>

        <div className="flex gap-2">
          <a href={`/api/imports/report?jobId=${jobId}`} target="_blank">
            <Button variant="outline"><Download className="h-4 w-4 mr-2" /> Rapport erreurs XLSX</Button>
          </a>
          <Button variant="outline" onClick={onBack}>Revenir</Button>
          <Button onClick={onRetry}>Déposer fichier corrigé <ArrowRight className="h-4 w-4 ml-1" /></Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Étape 7: Confirmation + Exécution
// ============================================================

function ExecuteStep({ jobId, onExecuted, onBack }: { jobId: string; onExecuted: () => void; onBack: () => void }) {
  const [job, setJob] = React.useState<ImportJob | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [confirm, setConfirm] = React.useState(false)
  const [executing, setExecuting] = React.useState(false)

  React.useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/imports/validate?jobId=${jobId}`, { cache: 'no-store' })
        const json = await res.json()
        if (json.ok) setJob(json.job)
      } finally { setLoading(false) }
    }
    load()
    // Poll toutes les 2s si en cours
    const interval = setInterval(load, 2000)
    return () => clearInterval(interval)
  }, [jobId])

  async function execute() {
    if (!confirm) { toast.error('Cochez la case de confirmation'); return }
    setExecuting(true)
    try {
      const res = await fetch('/api/imports/execute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'execute', jobId, confirmation: true }),
      })
      const json = await res.json()
      if (json.ok) {
        toast.success(json.message)
        // Attendre un peu puis aller au résultat
        setTimeout(() => onExecuted(), 1500)
      } else {
        toast.error(json.error)
      }
    } finally {
      setExecuting(false)
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
  if (!job) return null

  const isRunning = job.status === 'RUNNING'
  const isDone = job.status === 'COMPLETED'

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Confirmation et exécution</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {!isRunning && !isDone && (
          <>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Vous êtes sur le point d'importer <strong>{job.validRows}</strong> lignes valides.
                Cette action créera ou mettra à jour des enregistrements dans la base de données.
              </AlertDescription>
            </Alert>

            <div className="p-3 bg-muted/40 rounded border">
              <p className="font-medium text-sm">{job.originalFileName}</p>
              <p className="text-xs text-muted-foreground">Référence: {job.importReference}</p>
              <p className="text-xs text-muted-foreground">{job.totalRows} lignes au total, {job.validRows} valides</p>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="rounded" />
              Je confirme l'exécution de cet import. L'opération est journalisée et réversible (rollback).
            </label>

            <div className="flex justify-between">
              <Button variant="outline" onClick={onBack}>Retour</Button>
              <Button onClick={execute} disabled={!confirm || executing}>
                {executing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Exécuter l'import
              </Button>
            </div>
          </>
        )}

        {isRunning && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-sm">Import en cours... {job.progressPct}%</p>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${job.progressPct}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">Vous pouvez continuer à travailler pendant l'import.</p>
          </div>
        )}

        {isDone && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>Import terminé ! Voir les résultats.</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// Étape 8: Résultat + Rollback
// ============================================================

function ResultStep({ jobId, onNew }: { jobId: string; onNew: () => void }) {
  const [job, setJob] = React.useState<ImportJob | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [rollbackDialog, setRollbackDialog] = React.useState(false)

  const loadJob = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/imports/validate?jobId=${jobId}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.ok) setJob(json.job)
    } finally { setLoading(false) }
  }, [jobId])

  React.useEffect(() => {
    loadJob()
    const interval = setInterval(loadJob, 3000)
    return () => clearInterval(interval)
  }, [loadJob])

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
  if (!job) return null

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Résultat de l'import</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {job.status === 'COMPLETED' && (
          <>
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>Import terminé avec succès.</AlertDescription>
            </Alert>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded border border-emerald-200 bg-emerald-50/50 text-emerald-700">
                <p className="text-xs opacity-80">Créés</p>
                <p className="text-2xl font-bold">{job.createdCount}</p>
              </div>
              <div className="p-3 rounded border border-blue-200 bg-blue-50/50 text-blue-700">
                <p className="text-xs opacity-80">Mis à jour</p>
                <p className="text-2xl font-bold">{job.updatedCount}</p>
              </div>
              <div className="p-3 rounded border border-red-200 bg-red-50/50 text-red-700">
                <p className="text-xs opacity-80">Rejetés</p>
                <p className="text-2xl font-bold">{job.rejectedCount}</p>
              </div>
            </div>

            <div className="p-3 bg-muted/40 rounded border text-sm">
              <p><strong>Référence:</strong> {job.importReference}</p>
              <p><strong>Fichier:</strong> {job.originalFileName}</p>
              <p><strong>Effectué par:</strong> {job.createdByName}</p>
              <p><strong>Date:</strong> {new Date(job.createdAt).toLocaleString('fr-FR')}</p>
              {job.completedAt && <p><strong>Terminé:</strong> {new Date(job.completedAt).toLocaleString('fr-FR')}</p>}
            </div>

            {job.rolledBackAt && (
              <Alert variant="destructive">
                <RotateCcw className="h-4 w-4" />
                <AlertDescription>
                  Cet import a été annulé (rollback) le {new Date(job.rolledBackAt).toLocaleString('fr-FR')}
                </AlertDescription>
              </Alert>
            )}

            {job.isRollbackable && !job.rolledBackAt && (
              <Button variant="destructive" onClick={() => setRollbackDialog(true)}>
                <RotateCcw className="h-4 w-4 mr-2" /> Annuler l'import (rollback)
              </Button>
            )}
          </>
        )}

        <div className="flex justify-between">
          <a href={`/api/imports/report?jobId=${jobId}`} target="_blank">
            <Button variant="outline"><Download className="h-4 w-4 mr-2" /> Rapport</Button>
          </a>
          <Button onClick={onNew}>Nouvel import</Button>
        </div>
      </CardContent>

      {rollbackDialog && (
        <Dialog open onOpenChange={setRollbackDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Rollback de l'import</DialogTitle></DialogHeader>
            <RollbackForm jobId={jobId} onDone={() => { setRollbackDialog(false); loadJob() }} />
          </DialogContent>
        </Dialog>
      )}
    </Card>
  )
}

function RollbackForm({ jobId, onDone }: { jobId: string; onDone: () => void }) {
  const [reason, setReason] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  async function rollback() {
    if (!reason) { toast.error('Motif obligatoire'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/imports/rollback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, reason }),
      })
      const json = await res.json()
      if (json.ok) { toast.success(json.message); onDone() }
      else toast.error(json.error || json.message)
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-3">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Cette action supprimera les enregistrements créés par cet import.
          Les entités modifiées ne seront pas restaurées à leur état antérieur.
        </AlertDescription>
      </Alert>
      <div>
        <Label>Motif du rollback *</Label>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Expliquez pourquoi vous annulez cet import..." />
      </div>
      <DialogFooter>
        <Button variant="destructive" onClick={rollback} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
          Confirmer le rollback
        </Button>
      </DialogFooter>
    </div>
  )
}

// ============================================================
// Historique des jobs
// ============================================================

function JobsHistory({ onOpenJob }: { onOpenJob: (j: ImportJob) => void }) {
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/imports/execute?page=${page}&limit=10`, { cache: 'no-store' })
      const json = await res.json()
      if (json.ok) setData(json)
    } finally { setLoading(false) }
  }, [page])

  React.useEffect(() => { loadData() }, [loadData])

  const jobs: ImportJob[] = data?.jobs || []
  const pagination = data?.pagination

  const columns: DataGridColumn<ImportJob>[] = [
    { key: 'importReference', header: 'Référence', width: 160, frozen: true, searchable: true },
    { key: 'importType', header: 'Type', width: 180, render: (j) => <Badge variant="outline" className="text-xs">{IMPORT_TYPES.find((t) => t.value === j.importType)?.label || j.importType}</Badge> },
    { key: 'originalFileName', header: 'Fichier', width: 200, render: (j) => <span className="truncate block max-w-xs" title={j.originalFileName}>{j.originalFileName}</span> },
    { key: 'status', header: 'Statut', type: 'status', statusColors: {
      UPLOADED: 'bg-blue-100 text-blue-700',
      MAPPED: 'bg-blue-100 text-blue-700',
      VALIDATED: 'bg-amber-100 text-amber-700',
      CONFIRMED: 'bg-amber-100 text-amber-700',
      RUNNING: 'bg-blue-100 text-blue-700',
      COMPLETED: 'bg-emerald-100 text-emerald-700',
      FAILED: 'bg-red-100 text-red-700',
      CANCELLED: 'bg-gray-100 text-gray-500',
    }, width: 120 },
    { key: 'totalRows', header: 'Lignes', type: 'number', width: 80 },
    { key: 'createdCount', header: 'Créés', type: 'number', width: 80, render: (j) => <span className="text-emerald-600">{j.createdCount}</span> },
    { key: 'updatedCount', header: 'MAJ', type: 'number', width: 80, render: (j) => <span className="text-blue-600">{j.updatedCount}</span> },
    { key: 'rejectedCount', header: 'Rejetés', type: 'number', width: 80, render: (j) => <span className="text-red-600">{j.rejectedCount}</span> },
    { key: 'createdByName', header: 'Par', width: 130 },
    { key: 'createdAt', header: 'Date', type: 'date', width: 120 },
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium">Historique des imports</h3>
        <Button size="sm" variant="ghost" onClick={loadData}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      <DataGrid
        columns={columns}
        data={jobs}
        rowKey={(j) => j.id}
        loading={loading}
        density="compact"
        pagination={pagination ? {
          page: pagination.page, limit: pagination.limit,
          total: pagination.total, pages: pagination.pages,
          onPageChange: setPage,
        } : undefined}
        rowActions={(job) => (
          <Button size="sm" variant="ghost" onClick={() => onOpenJob(job)}>
            <Eye className="h-4 w-4" />
          </Button>
        )}
      />
    </div>
  )
}
