'use client'

// SmartShule — Centre Documents & Certificats (Secrétariat)
// ============================================================

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { PageHeader } from '@/components/ss/page-header'
import {
  Loader2, FileText, Award, Upload, CheckCircle2, Printer, Download,
  Plus, Search, ChevronLeft, ChevronRight, Eye, Send,
} from 'lucide-react'
import { toast } from 'sonner'

const CERT_TYPES = [
  { value: 'SCHOOL_CERTIFICATE', label: 'Certificat de scolarité' },
  { value: 'ENROLLMENT_ATTESTATION', label: "Attestation d'inscription" },
  { value: 'ATTENDANCE_ATTESTATION', label: 'Attestation de fréquentation' },
  { value: 'STUDENT_CARD', label: 'Carte élève' },
  { value: 'PARENT_CONVOCATION', label: 'Convocation parent' },
  { value: 'ABSENCE_LETTER', label: "Lettre d'absence" },
  { value: 'CLASS_LIST', label: 'Liste de classe' },
  { value: 'TRANSFER_ATTESTATION', label: 'Attestation de transfert' },
  { value: 'ENROLLMENT_FORM', label: "Fiche d'inscription" },
  { value: 'LABEL_QR', label: 'Étiquette QR/Code-barres' },
]

type Certificate = {
  id: string; studentId: string; studentName: string; matricule: string
  certificateType: string; referenceNumber: string; title: string
  generatedAt: string; generatedByName: string | null; pdfUrl: string | null
  requiresValidation: boolean; validatedByName: string | null; validatedAt: string | null
  deliveredTo: string | null; deliveredAt: string | null; reprintCount: number; reason: string | null
}

type StudentDoc = {
  id: string; documentType: string; label: string; fileName: string
  fileSize: number; mimeType: string; verified: boolean; verifiedByName: string | null
  verifiedAt: string | null; uploadedByName: string | null; createdAt: string
}

export function DocumentsCenter() {
  const [sub, setSub] = React.useState('certificates')
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [selectedStudentId, setSelectedStudentId] = React.useState('')
  const [genForm, setGenForm] = React.useState({ studentId: '', certificateType: 'SCHOOL_CERTIFICATE', reason: '' })

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ sub, page: String(page), limit: '50' })
      if (selectedStudentId) params.set('studentId', selectedStudentId)
      const res = await fetch(`/api/secretariat/documents?${params}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.ok) setData(json)
    } catch (err) {
      toast.error('Erreur : ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [sub, page, selectedStudentId])

  React.useEffect(() => { loadData() }, [loadData])

  async function generateCertificate() {
    if (!genForm.studentId || !genForm.certificateType) { toast.error('Élève et type de certificat requis.'); return }
    try {
      const res = await fetch('/api/secretariat/documents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-certificate', ...genForm }),
      })
      const json = await res.json()
      if (json.ok) {
        toast.success(json.message)
        setGenForm({ studentId: '', certificateType: 'SCHOOL_CERTIFICATE', reason: '' })
        loadData()
      } else { toast.error(json.error) }
    } catch (err) { toast.error('Erreur : ' + (err as Error).message) }
  }

  async function deliverCertificate(id: string) {
    const deliveredTo = prompt('Nom de la personne à qui le document est remis :')
    if (!deliveredTo) return
    try {
      const res = await fetch('/api/secretariat/documents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deliver-certificate', certificateId: id, deliveredTo }),
      })
      const json = await res.json()
      if (json.ok) { toast.success('Remise enregistrée'); loadData() }
      else toast.error(json.error)
    } catch (err) { toast.error('Erreur : ' + (err as Error).message) }
  }

  async function reprintCertificate(id: string) {
    try {
      const res = await fetch('/api/secretariat/documents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reprint-certificate', certificateId: id }),
      })
      const json = await res.json()
      if (json.ok) { toast.success(`Réimpression enregistrée (n°${json.reprintCount})`); loadData() }
      else toast.error(json.error)
    } catch (err) { toast.error('Erreur : ' + (err as Error).message) }
  }

  async function verifyDocument(id: string) {
    try {
      const res = await fetch('/api/secretariat/documents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify-document', documentId: id }),
      })
      const json = await res.json()
      if (json.ok) { toast.success('Document vérifié'); loadData() }
      else toast.error(json.error)
    } catch (err) { toast.error('Erreur : ' + (err as Error).message) }
  }

  const certificates: Certificate[] = data?.certificates || []
  const documents: StudentDoc[] = data?.documents || []
  const stats = data?.stats
  const pagination = data?.pagination

  return (
    <div className="space-y-6">
      <PageHeader title="Centre Documents & Certificats" description="Génération, traçabilité et archivage des documents officiels." breadcrumbs={[{ label: 'Secrétariat' }, { label: 'Documents' }]} />

      {/* Stats */}
      {stats && (
        <div className="grid gap-3 grid-cols-3">
          <StatCard label="Certificats générés" value={stats.totalGenerated} icon={<Award className="h-4 w-4" />} color="blue" />
          <StatCard label="En attente validation" value={stats.pendingValidation} icon={<FileText className="h-4 w-4" />} color="orange" />
          <StatCard label="Remis ce mois" value={stats.deliveredThisMonth} icon={<CheckCircle2 className="h-4 w-4" />} color="green" />
        </div>
      )}

      {/* Onglets */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={sub === 'certificates' ? 'default' : 'outline'} onClick={() => { setSub('certificates'); setPage(1) }}>
          <Award className="h-4 w-4 mr-1" /> Certificats
        </Button>
        <Button size="sm" variant={sub === 'student-docs' ? 'default' : 'outline'} onClick={() => { setSub('student-docs'); setPage(1) }}>
          <FileText className="h-4 w-4 mr-1" /> Documents élèves
        </Button>
      </div>

      {/* Génération certificat */}
      {sub === 'certificates' && (
        <div className="flex justify-end">
          <Dialog>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Générer un certificat</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Générer un document officiel</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="ID de l'élève (ou chercher)" value={genForm.studentId} onChange={(e) => setGenForm({ ...genForm, studentId: e.target.value })} />
                <Select value={genForm.certificateType} onValueChange={(v) => setGenForm({ ...genForm, certificateType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CERT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Textarea placeholder="Motif (optionnel)" rows={2} value={genForm.reason} onChange={(e) => setGenForm({ ...genForm, reason: e.target.value })} />
              </div>
              <DialogFooter><Button onClick={generateCertificate}><Award className="h-4 w-4 mr-1" /> Générer</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {loading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}

      {/* Certificats */}
      {!loading && sub === 'certificates' && (
        <Card>
          <CardContent className="space-y-2">
            {certificates.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">Aucun certificat.</p> : certificates.map((c) => {
              const typeLabel = CERT_TYPES.find((t) => t.value === c.certificateType)?.label || c.certificateType
              return (
                <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors">
                  <Award className="h-4 w-4 mt-1 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{c.title}</p>
                    <p className="text-xs text-muted-foreground">{c.studentName} ({c.matricule}) · Réf : {c.referenceNumber}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">{typeLabel}</Badge>
                      {c.requiresValidation && !c.validatedAt && <Badge className="bg-orange-100 text-orange-700 text-xs">En attente validation</Badge>}
                      {c.validatedAt && <Badge className="bg-emerald-100 text-emerald-700 text-xs">Validé</Badge>}
                      {c.deliveredAt && <Badge className="bg-blue-100 text-blue-700 text-xs">Remis le {new Date(c.deliveredAt).toLocaleDateString('fr-FR')}</Badge>}
                      {c.reprintCount > 0 && <Badge variant="outline" className="text-xs">{c.reprintCount} réimpression(s)</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Généré le {new Date(c.generatedAt).toLocaleString('fr-FR')} par {c.generatedByName || '—'}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => reprintCertificate(c.id)} title="Réimprimer"><Printer className="h-4 w-4" /></Button>
                    {!c.deliveredAt && (
                      <Button size="sm" variant="ghost" onClick={() => deliverCertificate(c.id)} title="Enregistrer remise"><CheckCircle2 className="h-4 w-4 text-emerald-500" /></Button>
                    )}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Documents élèves */}
      {!loading && sub === 'student-docs' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documents du dossier élève</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!selectedStudentId && <p className="text-sm text-muted-foreground py-4 text-center">Saisissez un ID élève pour voir ses documents.</p>}
            {selectedStudentId && documents.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Aucun document.</p>}
            {documents.map((d) => (
              <div key={d.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/20">
                <FileText className="h-4 w-4 mt-1 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{d.label}</p>
                  <p className="text-xs text-muted-foreground">{d.documentType} · {d.fileName} · {(d.fileSize / 1024).toFixed(1)} Ko</p>
                  <div className="flex items-center gap-2 mt-1">
                    {d.verified ? <Badge className="bg-emerald-100 text-emerald-700 text-xs">Vérifié</Badge> : <Badge className="bg-amber-100 text-amber-700 text-xs">Non vérifié</Badge>}
                    <span className="text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleDateString('fr-FR')}</span>
                  </div>
                </div>
                {!d.verified && (
                  <Button size="sm" variant="ghost" onClick={() => verifyDocument(d.id)}><CheckCircle2 className="h-4 w-4 text-emerald-500" /></Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm">Page {page} / {pagination.pages}</span>
          <Button size="sm" variant="outline" disabled={page >= pagination.pages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    blue: 'border-blue-200 bg-blue-50/50 text-blue-700',
    orange: 'border-orange-200 bg-orange-50/50 text-orange-700',
    green: 'border-emerald-200 bg-emerald-50/50 text-emerald-700',
  }
  return (
    <div className={`p-3 rounded-lg border ${colors[color] || colors.blue}`}>
      <div className="flex items-center justify-between mb-1"><p className="text-xs opacity-80">{label}</p>{icon}</div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}
