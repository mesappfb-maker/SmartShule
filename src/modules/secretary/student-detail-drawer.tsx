'use client'

// SmartShule — Dossier élève centralisé (Drawer complexe)
// ============================================================
// Drawer plein écran avec 7 onglets :
//   1. Identité — Nom, matricule, naissance, statut, photo, compte user
//   2. Famille — Parents, tuteurs, contacts, profession
//   3. Scolarité — Inscriptions historiques + actuelle
//   4. Finances — Dettes, reçus, factures, bourses, restes à payer
//   5. Notes — Bulletins, notes par période, moyennes
//   6. Présences — IQA, absences, retards, justificatifs
//   7. Documents — Attestations, cartes, bulletins (génération PDF)

import * as React from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import {
  Loader2,
  User,
  Users,
  School,
  Wallet,
  GraduationCap,
  Calendar,
  FileText,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Download,
  CreditCard,
  Printer,
  Award,
  Receipt as ReceiptIcon,
  Banknote,
  CalendarOff,
} from 'lucide-react'
import { toast } from 'sonner'

// Types ==========================================================
type DetailData = {
  ok: boolean
  student: {
    id: string
    matricule: string
    firstName: string
    lastName: string
    fullName: string
    birthDate: string | null
    gender: string | null
    photoUrl: string | null
    status: string
    createdAt: string
    user?: {
      id: string
      email: string | null
      phone: string | null
      accountStatus: string
      lastLoginAt: string | null
    } | null
  }
  family: Array<{
    id: string
    relationship: string
    isPrimary: boolean
    guardian: {
      id: string
      firstName: string
      lastName: string
      fullName: string
      phone: string | null
      email: string | null
      address: string | null
      profession: string | null
    }
  }>
  enrollments: Array<{
    id: string
    status: string
    enrolledAt: string
    classroom: {
      id: string
      name: string
      directorate: { id: string; name: string; code: string }
      section?: string | null
      option?: string | null
    }
    academicYear: { id: string; label: string; active: boolean }
  }>
  currentEnrollment: {
    id: string
    classroom: {
      id: string
      name: string
      directorate: { id: string; name: string; code: string }
    }
    academicYear: { id: string; label: string; active: boolean }
  } | null
  financialStatus: {
    status: string
    reason: string | null
    updatedAt: string | null
  }
  finances: {
    summary: {
      totalDueCents: number
      totalPaidCents: number
      totalCancelledCents: number
      totalReductionCents: number
      currency: string
      debtsCount: number
      debtsOpen: number
      debtsPartiallyPaid: number
      debtsPaid: number
      debtsCancelled: number
      receiptsCount: number
      invoicesCount: number
      scholarshipsCount: number
      remainingCents: number
      totalDue: number
      totalPaid: number
      remaining: number
      totalReduction: number
    }
    debts: Array<{
      id: string
      status: string
      period: string | null
      currency: string
      amountDue: number
      amountPaid: number
      amountCancelled: number
      remaining: number
      reductionPercent: number
      reductionAmount: number
      feeLabel: string
      feeDescription: string | null
      directorateName: string | null
      classroomName: string | null
      academicYearLabel: string | null
      scholarshipName: string | null
      generatedAt: string
      lastPaymentAt: string | null
      closedAt: string | null
      recentReceipts: Array<{
        id: string
        receiptNumber: string
        amountCents: number
        currency: string
        paymentMethod: string
        payerName: string | null
        issuedAt: string
        status: string
      }>
    }>
    receipts: Array<{
      id: string
      receiptNumber: string
      receiptType: string
      amount: number
      currency: string
      paymentMethod: string
      paymentProvider: string | null
      transactionReference: string | null
      payerName: string | null
      payerPhone: string | null
      status: string
      cancelledAt: string | null
      cancellationReason: string | null
      issuedAt: string
      debtLabel: string | null
      debtPeriod: string | null
      mobileMoney: { provider: string; transactionId: string; status: string } | null
    }>
    invoices: Array<{
      id: string
      invoiceNumber: string
      status: string
      totalAmount: number
      paidAmount: number
      remaining: number
      currency: string
      issueDate: string
      dueDate: string | null
      academicYearLabel: string | null
      linesCount: number
      paymentsCount: number
    }>
    scholarships: Array<{
      id: string
      name: string
      code: string
      reductionPercent: number
      appliesToCategory: string | null
      status: string
    }>
  }
  grades: {
    periods: Array<{
      period: string
      subjects: Array<{
        subject: { id: string; name: string; code: string }
        grades: Array<{
          id: string
          title: string
          score: number
          maxScore: number
          weight: number
          status: string
          publishedAt: string | null
          teacherComment: string | null
          scorePercent: number | null
        }>
        average: number | null
      }>
      generalAverage: number | null
      gradesCount: number
    }>
    reportCards: Array<{
      id: string
      period: string
      status: string
      average: number | null
      rank: number | null
      appreciation: string | null
      publishedAt: string | null
      academicYearLabel: string | null
    }>
    totalGrades: number
    subjectsCount: number
  }
  attendance: {
    summary: {
      present: number
      late: number
      absent: number
      excused: number
      total: number
      iqa: number
      presenceRate: number
    }
    recent: Array<{
      id: string
      date: string
      status: string
      justified: boolean
      justification: string | null
      subjectName: string
      teacherName: string | null
    }>
  }
}

// Helpers ========================================================
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

function fmtDateTime(iso: string | null) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function fmtMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency || 'CDF',
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

function getRelLabel(rel: string) {
  const map: Record<string, string> = {
    PERE: 'Père',
    MERE: 'Mère',
    TUTEUR: 'Tuteur légal',
    AUTRE: 'Autre',
  }
  return map[rel] || rel
}

function getStatusBadge(s: string) {
  if (s === 'ACTIVE') return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">Actif</Badge>
  if (s === 'ARCHIVED') return <Badge variant="outline">Archivé</Badge>
  if (s === 'TRANSFERRED') return <Badge variant="outline">Transféré</Badge>
  return <Badge variant="outline">{s}</Badge>
}

function getFinStatusBadge(fs: string) {
  if (fs === 'REGULAR') return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">✓ Régulier</Badge>
  if (fs === 'LITIGATION') return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">⚠ En litige</Badge>
  if (fs === 'BLOCKED') return <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">✗ Bloqué</Badge>
  return <Badge variant="outline">—</Badge>
}

function getDebtStatusBadge(s: string) {
  if (s === 'OPEN') return <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">À payer</Badge>
  if (s === 'PARTIALLY_PAID') return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">Partiel</Badge>
  if (s === 'PAID') return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">Soldé</Badge>
  if (s === 'CANCELLED') return <Badge variant="outline">Annulé</Badge>
  return <Badge variant="outline">{s}</Badge>
}

function getPaymentMethodBadge(method: string) {
  const map: Record<string, { label: string; cls: string }> = {
    CASH: { label: 'Espèces', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' },
    BANK: { label: 'Banque', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
    MOBILE_MONEY: { label: 'Mobile Money', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
    CARD: { label: 'Carte', cls: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300' },
  }
  const info = map[method] || { label: method, cls: '' }
  return <Badge className={info.cls}>{info.label}</Badge>
}

function getIqaColor(iqa: number) {
  if (iqa >= 90) return 'text-emerald-600 dark:text-emerald-400'
  if (iqa >= 75) return 'text-amber-600 dark:text-amber-400'
  if (iqa >= 50) return 'text-orange-600 dark:text-orange-400'
  return 'text-red-600 dark:text-red-400'
}

function getIqaLabel(iqa: number) {
  if (iqa >= 90) return 'Excellent'
  if (iqa >= 75) return 'Bon'
  if (iqa >= 50) return 'Moyen'
  return 'Critique'
}

function getPeriodLabel(period: string) {
  if (period === 'T1') return '1er Trimestre'
  if (period === 'T2') return '2ème Trimestre'
  if (period === 'T3') return '3ème Trimestre'
  if (period === 'NON_PERIOD') return 'Hors période'
  return period
}

function getGradeColor(score: number, max: number) {
  const pct = max > 0 ? (score / max) * 100 : 0
  if (pct >= 80) return 'text-emerald-600 dark:text-emerald-400 font-bold'
  if (pct >= 50) return 'text-blue-600 dark:text-blue-400 font-semibold'
  if (pct >= 30) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400 font-bold'
}

// Composant principal ============================================
type Props = {
  studentId: string | null
  studentName?: string
  onClose: () => void
}

export function StudentDetailDrawer({ studentId, studentName, onClose }: Props) {
  const [data, setData] = React.useState<DetailData | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const open = !!studentId

  React.useEffect(() => {
    if (!studentId) {
      setData(null)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    fetch(`/api/students/${studentId}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d) => {
        if (d.ok) {
          setData(d)
        } else {
          setError(d.error || 'Erreur de chargement')
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [studentId])

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[1100px] p-0 overflow-y-auto"
      >
        <SheetHeader className="px-6 py-4 border-b bg-muted/30 sticky top-0 z-10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {data?.student.photoUrl ? (
                <img
                  src={data.student.photoUrl}
                  alt={data.student.fullName}
                  className="h-12 w-12 rounded-full object-cover border-2 border-primary"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold shrink-0">
                  {data?.student.firstName?.[0] || '?'}{data?.student.lastName?.[0] || ''}
                </div>
              )}
              <div className="min-w-0">
                <SheetTitle className="truncate text-xl">
                  {data?.student.fullName || studentName || 'Chargement...'}
                </SheetTitle>
                <SheetDescription className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs">
                    {data?.student.matricule || '—'}
                  </span>
                  {data && getStatusBadge(data.student.status)}
                  {data && getFinStatusBadge(data.financialStatus.status)}
                  {data?.currentEnrollment && (
                    <Badge variant="outline" className="text-xs">
                      {data.currentEnrollment.classroom.name}
                    </Badge>
                  )}
                </SheetDescription>
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="p-4 sm:p-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground">
                Chargement du dossier élève...
              </p>
            </div>
          )}

          {error && (
            <Card className="border-red-200 dark:border-red-900">
              <CardContent className="p-6 text-center">
                <XCircle className="h-10 w-10 mx-auto mb-2 text-red-500" />
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </CardContent>
            </Card>
          )}

          {data && !loading && !error && (
            <Tabs defaultValue="identity" className="w-full">
              <TabsList className="grid w-full grid-cols-4 sm:grid-cols-7 h-auto">
                <TabsTrigger value="identity" className="text-xs flex flex-col gap-1 py-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">Identité</span>
                </TabsTrigger>
                <TabsTrigger value="family" className="text-xs flex flex-col gap-1 py-2">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Famille</span>
                </TabsTrigger>
                <TabsTrigger value="school" className="text-xs flex flex-col gap-1 py-2">
                  <School className="h-4 w-4" />
                  <span className="hidden sm:inline">Scolarité</span>
                </TabsTrigger>
                <TabsTrigger value="finances" className="text-xs flex flex-col gap-1 py-2 relative">
                  <Wallet className="h-4 w-4" />
                  <span className="hidden sm:inline">Finances</span>
                  {data.finances.summary.remainingCents > 0 && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="grades" className="text-xs flex flex-col gap-1 py-2">
                  <GraduationCap className="h-4 w-4" />
                  <span className="hidden sm:inline">Notes</span>
                </TabsTrigger>
                <TabsTrigger value="attendance" className="text-xs flex flex-col gap-1 py-2">
                  <Calendar className="h-4 w-4" />
                  <span className="hidden sm:inline">Présences</span>
                </TabsTrigger>
                <TabsTrigger value="documents" className="text-xs flex flex-col gap-1 py-2">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Documents</span>
                </TabsTrigger>
              </TabsList>

              {/* ============================================== */}
              {/* 1. IDENTITÉ =================================== */}
              {/* ============================================== */}
              <TabsContent value="identity" className="mt-4 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <User className="h-4 w-4" /> Informations personnelles
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <Row label="Nom complet" value={data.student.fullName} />
                      <Row label="Prénom" value={data.student.firstName} />
                      <Row label="Nom" value={data.student.lastName} />
                      <Row
                        label="Genre"
                        value={
                          data.student.gender === 'M'
                            ? 'Masculin'
                            : data.student.gender === 'F'
                            ? 'Féminin'
                            : '—'
                        }
                      />
                      <Row label="Date de naissance" value={fmtDate(data.student.birthDate)} />
                      <Row
                        label="Statut"
                        value={getStatusBadge(data.student.status)}
                      />
                      <Row label="Inscrit le" value={fmtDate(data.student.createdAt)} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <CreditCard className="h-4 w-4" /> Compte utilisateur
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <Row label="Matricule" value={<code className="font-mono">{data.student.matricule}</code>} />
                      {data.student.user ? (
                        <>
                          <Row label="Email" value={data.student.user.email || '—'} />
                          <Row label="Téléphone" value={data.student.user.phone || '—'} />
                          <Row
                            label="Statut compte"
                            value={
                              <Badge variant="outline">
                                {data.student.user.accountStatus}
                              </Badge>
                            }
                          />
                          <Row label="Dernière connexion" value={fmtDateTime(data.student.user.lastLoginAt)} />
                        </>
                      ) : (
                        <div className="text-sm text-muted-foreground italic">
                          Aucun compte utilisateur associé
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {data.financialStatus.reason && (
                  <Card className="border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium text-amber-800 dark:text-amber-200">
                            Statut financier : {data.financialStatus.status}
                          </p>
                          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                            Motif : {data.financialStatus.reason}
                          </p>
                          {data.financialStatus.updatedAt && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                              Mis à jour le {fmtDateTime(data.financialStatus.updatedAt)}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <School className="h-4 w-4" /> Affectation actuelle
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {data.currentEnrollment ? (
                      <>
                        <Row label="Classe" value={<strong>{data.currentEnrollment.classroom.name}</strong>} />
                        <Row
                          label="Direction"
                          value={data.currentEnrollment.classroom.directorate.name}
                        />
                        <Row
                          label="Année académique"
                          value={
                            <Badge variant="outline">
                              {data.currentEnrollment.academicYear.label}
                            </Badge>
                          }
                        />
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground italic">
                        Aucune inscription active
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ============================================== */}
              {/* 2. FAMILLE ==================================== */}
              {/* ============================================== */}
              <TabsContent value="family" className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Membres de la famille ({data.family.length})
                  </h3>
                </div>

                {data.family.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p>Aucun parent ou tuteur enregistré pour cet élève.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {data.family.map((link) => (
                      <Card key={link.id} className={link.isPrimary ? 'border-primary/40' : ''}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                                {link.guardian.firstName[0]}{link.guardian.lastName[0]}
                              </div>
                              <span className="text-sm">{link.guardian.fullName}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className="text-xs">
                                {getRelLabel(link.relationship)}
                              </Badge>
                              {link.isPrimary && (
                                <Badge className="bg-primary text-primary-foreground text-xs">
                                  Principal
                                </Badge>
                              )}
                            </div>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          {link.guardian.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                              <a
                                href={`tel:${link.guardian.phone}`}
                                className="text-blue-600 hover:underline"
                              >
                                {link.guardian.phone}
                              </a>
                            </div>
                          )}
                          {link.guardian.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                              <a
                                href={`mailto:${link.guardian.email}`}
                                className="text-blue-600 hover:underline truncate"
                              >
                                {link.guardian.email}
                              </a>
                            </div>
                          )}
                          {link.guardian.profession && (
                            <div className="flex items-center gap-2">
                              <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span>{link.guardian.profession}</span>
                            </div>
                          )}
                          {link.guardian.address && (
                            <div className="flex items-start gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                              <span className="text-muted-foreground">{link.guardian.address}</span>
                            </div>
                          )}
                          {!link.guardian.phone && !link.guardian.email && !link.guardian.profession && !link.guardian.address && (
                            <p className="text-xs text-muted-foreground italic">
                              Aucune information de contact renseignée
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ============================================== */}
              {/* 3. SCOLARITÉ =================================== */}
              {/* ============================================== */}
              <TabsContent value="school" className="mt-4 space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <School className="h-4 w-4" />
                      Historique des inscriptions ({data.enrollments.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {data.enrollments.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">
                        Aucune inscription enregistrée.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {data.enrollments.map((e, idx) => (
                          <div
                            key={e.id}
                            className="flex items-start gap-3 p-3 rounded-md border bg-muted/20"
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <strong>{e.classroom.name}</strong>
                                <Badge variant="outline" className="text-xs">
                                  {e.classroom.directorate.name}
                                </Badge>
                                {e.status === 'ACTIVE' && (
                                  <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                                    Active
                                  </Badge>
                                )}
                                {e.status === 'TRANSFERRED' && (
                                  <Badge variant="outline" className="text-xs">Transférée</Badge>
                                )}
                                {e.status === 'ARCHIVED' && (
                                  <Badge variant="outline" className="text-xs">Archivée</Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {e.academicYear.label}
                                {e.classroom.section && ` • ${e.classroom.section}`}
                                {e.classroom.option && ` • Option: ${e.classroom.option}`}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                Inscrit le {fmtDate(e.enrolledAt)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ============================================== */}
              {/* 4. FINANCES =================================== */}
              {/* ============================================== */}
              <TabsContent value="finances" className="mt-4 space-y-4">
                {/* Résumé financier en haut */}
                <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                  <FinStatCard
                    label="Total dû"
                    value={fmtMoney(data.finances.summary.totalDue, data.finances.summary.currency)}
                    icon={<TrendingUp className="h-4 w-4" />}
                    color="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
                  />
                  <FinStatCard
                    label="Total payé"
                    value={fmtMoney(data.finances.summary.totalPaid, data.finances.summary.currency)}
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    color="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                  />
                  <FinStatCard
                    label="Reste à payer"
                    value={fmtMoney(data.finances.summary.remaining, data.finances.summary.currency)}
                    icon={<AlertTriangle className="h-4 w-4" />}
                    color={
                      data.finances.summary.remaining > 0
                        ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
                        : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                    }
                  />
                  <FinStatCard
                    label="Réductions"
                    value={fmtMoney(data.finances.summary.totalReduction, data.finances.summary.currency)}
                    icon={<Award className="h-4 w-4" />}
                    color="bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300"
                  />
                </div>

                {/* Compteurs de statut */}
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">
                    {data.finances.summary.debtsCount} dette(s) au total
                  </Badge>
                  <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                    {data.finances.summary.debtsOpen} à payer
                  </Badge>
                  <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                    {data.finances.summary.debtsPartiallyPaid} partielles
                  </Badge>
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                    {data.finances.summary.debtsPaid} soldées
                  </Badge>
                  <Badge variant="outline">
                    {data.finances.summary.receiptsCount} reçu(s) émis
                  </Badge>
                  <Badge variant="outline">
                    {data.finances.summary.scholarshipsCount} bourse(s)
                  </Badge>
                </div>

                {/* Détail des dettes (Restes à payer) */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Banknote className="h-4 w-4" />
                      Décomposition des frais ({data.finances.debts.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {data.finances.debts.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">
                        Aucune dette enregistrée pour cet élève.
                      </p>
                    ) : (
                      <div className="overflow-x-auto -mx-2">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-xs text-muted-foreground">
                              <th className="p-2">Frais</th>
                              <th className="p-2 text-center">Période</th>
                              <th className="p-2 text-right">Dû</th>
                              <th className="p-2 text-right">Payé</th>
                              <th className="p-2 text-right">Reste</th>
                              <th className="p-2 text-center">Réduction</th>
                              <th className="p-2 text-center">Statut</th>
                              <th className="p-2 text-center">Dernier paiement</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.finances.debts.map((d) => (
                              <tr key={d.id} className="border-b hover:bg-muted/30">
                                <td className="p-2">
                                  <div className="font-medium">{d.feeLabel}</div>
                                  {d.feeDescription && (
                                    <div className="text-xs text-muted-foreground">
                                      {d.feeDescription}
                                    </div>
                                  )}
                                  {d.scholarshipName && (
                                    <div className="text-xs text-purple-600 dark:text-purple-400">
                                      Bourse: {d.scholarshipName} ({d.reductionPercent}%)
                                    </div>
                                  )}
                                </td>
                                <td className="p-2 text-center text-xs">
                                  {d.period ? (
                                    <Badge variant="outline" className="text-xs">
                                      {d.period}
                                    </Badge>
                                  ) : '—'}
                                </td>
                                <td className="p-2 text-right font-mono text-xs">
                                  {fmtMoney(d.amountDue, d.currency)}
                                </td>
                                <td className="p-2 text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">
                                  {fmtMoney(d.amountPaid, d.currency)}
                                </td>
                                <td className="p-2 text-right font-mono text-xs font-bold">
                                  <span className={d.remaining > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}>
                                    {fmtMoney(d.remaining, d.currency)}
                                  </span>
                                </td>
                                <td className="p-2 text-center text-xs">
                                  {d.reductionPercent > 0 ? (
                                    <Badge className="bg-purple-100 text-purple-700 text-xs">
                                      -{d.reductionPercent}%
                                    </Badge>
                                  ) : '—'}
                                </td>
                                <td className="p-2 text-center">
                                  {getDebtStatusBadge(d.status)}
                                </td>
                                <td className="p-2 text-center text-xs text-muted-foreground">
                                  {fmtDate(d.lastPaymentAt)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 font-bold bg-muted/30">
                              <td className="p-2" colSpan={2}>TOTAL</td>
                              <td className="p-2 text-right font-mono">
                                {fmtMoney(data.finances.summary.totalDue, data.finances.summary.currency)}
                              </td>
                              <td className="p-2 text-right font-mono text-emerald-600 dark:text-emerald-400">
                                {fmtMoney(data.finances.summary.totalPaid, data.finances.summary.currency)}
                              </td>
                              <td className="p-2 text-right font-mono">
                                <span className={data.finances.summary.remaining > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}>
                                  {fmtMoney(data.finances.summary.remaining, data.finances.summary.currency)}
                                </span>
                              </td>
                              <td colSpan={3}></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Reçus émis */}
                {data.finances.receipts.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <ReceiptIcon className="h-4 w-4" />
                        Reçus émis ({data.finances.receipts.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto -mx-2 max-h-[400px] overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-background">
                            <tr className="border-b text-left text-xs text-muted-foreground">
                              <th className="p-2">N° Reçu</th>
                              <th className="p-2 text-right">Montant</th>
                              <th className="p-2 text-center">Méthode</th>
                              <th className="p-2">Payeur</th>
                              <th className="p-2 text-center">Date</th>
                              <th className="p-2 text-center">Statut</th>
                              <th className="p-2 text-center">PDF</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.finances.receipts.map((r) => (
                              <tr key={r.id} className="border-b hover:bg-muted/30">
                                <td className="p-2">
                                  <code className="font-mono text-xs">{r.receiptNumber}</code>
                                  {r.debtLabel && (
                                    <div className="text-xs text-muted-foreground">
                                      {r.debtLabel}
                                      {r.debtPeriod && ` • ${r.debtPeriod}`}
                                    </div>
                                  )}
                                </td>
                                <td className="p-2 text-right font-mono text-xs font-bold">
                                  {fmtMoney(r.amount, r.currency)}
                                </td>
                                <td className="p-2 text-center">
                                  {getPaymentMethodBadge(r.paymentMethod)}
                                  {r.paymentProvider && (
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                      {r.paymentProvider}
                                    </div>
                                  )}
                                </td>
                                <td className="p-2 text-xs">
                                  {r.payerName || '—'}
                                  {r.payerPhone && (
                                    <div className="text-xs text-muted-foreground">
                                      {r.payerPhone}
                                    </div>
                                  )}
                                </td>
                                <td className="p-2 text-center text-xs">
                                  {fmtDate(r.issuedAt)}
                                </td>
                                <td className="p-2 text-center">
                                  {r.status === 'CANCELLED' ? (
                                    <Badge variant="outline" className="bg-red-50 text-red-700 text-xs">
                                      Annulé
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 text-xs">
                                      Valide
                                    </Badge>
                                  )}
                                </td>
                                <td className="p-2 text-center">
                                  <a
                                    href={`/api/exports/receipt-v2?receiptId=${r.id}`}
                                    target="_blank"
                                    className="inline-flex p-1.5 rounded-md hover:bg-primary/10 text-primary"
                                    title="Imprimer le reçu PDF"
                                  >
                                    <Printer className="h-3.5 w-3.5" />
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Bourses */}
                {data.finances.scholarships.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Award className="h-4 w-4" />
                        Bourses & réductions ({data.finances.scholarships.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {data.finances.scholarships.map((s) => (
                          <div key={s.id} className="flex items-start justify-between gap-3 p-3 rounded-md border bg-purple-50/30 dark:bg-purple-950/20">
                            <div>
                              <div className="font-medium">{s.name}</div>
                              <div className="text-xs text-muted-foreground">
                                Code: {s.code}
                                {s.appliesToCategory && ` • Catégorie: ${s.appliesToCategory}`}
                                {' • '}Statut: {s.status}
                              </div>
                            </div>
                            <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                              -{s.reductionPercent}%
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Factures legacy (si elles existent) */}
                {data.finances.invoices.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Factures ({data.finances.invoices.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto -mx-2">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-xs text-muted-foreground">
                              <th className="p-2">N°</th>
                              <th className="p-2 text-right">Total</th>
                              <th className="p-2 text-right">Payé</th>
                              <th className="p-2 text-right">Reste</th>
                              <th className="p-2 text-center">Statut</th>
                              <th className="p-2 text-center">Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.finances.invoices.map((inv) => (
                              <tr key={inv.id} className="border-b hover:bg-muted/30">
                                <td className="p-2">
                                  <code className="font-mono text-xs">{inv.invoiceNumber}</code>
                                </td>
                                <td className="p-2 text-right font-mono text-xs">
                                  {fmtMoney(inv.totalAmount, inv.currency)}
                                </td>
                                <td className="p-2 text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">
                                  {fmtMoney(inv.paidAmount, inv.currency)}
                                </td>
                                <td className="p-2 text-right font-mono text-xs">
                                  <span className={inv.remaining > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}>
                                    {fmtMoney(inv.remaining, inv.currency)}
                                  </span>
                                </td>
                                <td className="p-2 text-center">
                                  {inv.status === 'PAID' && (
                                    <Badge className="bg-emerald-100 text-emerald-700 text-xs">Soldée</Badge>
                                  )}
                                  {inv.status === 'PARTIALLY_PAID' && (
                                    <Badge className="bg-amber-100 text-amber-700 text-xs">Partielle</Badge>
                                  )}
                                  {inv.status === 'UNPAID' && (
                                    <Badge className="bg-red-100 text-red-700 text-xs">Impayée</Badge>
                                  )}
                                  {inv.status === 'CANCELLED' && (
                                    <Badge variant="outline" className="text-xs">Annulée</Badge>
                                  )}
                                </td>
                                <td className="p-2 text-center text-xs">
                                  {fmtDate(inv.issueDate)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* ============================================== */}
              {/* 5. NOTES & BULLETINS ========================== */}
              {/* ============================================== */}
              <TabsContent value="grades" className="mt-4 space-y-4">
                {/* Statistiques rapides */}
                <div className="grid gap-3 grid-cols-3">
                  <FinStatCard
                    label="Total notes"
                    value={String(data.grades.totalGrades)}
                    icon={<GraduationCap className="h-4 w-4" />}
                    color="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
                  />
                  <FinStatCard
                    label="Matières"
                    value={String(data.grades.subjectsCount)}
                    icon={<FileText className="h-4 w-4" />}
                    color="bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300"
                  />
                  <FinStatCard
                    label="Bulletins"
                    value={String(data.grades.reportCards.length)}
                    icon={<Award className="h-4 w-4" />}
                    color="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
                  />
                </div>

                {/* Bulletins édités */}
                {data.grades.reportCards.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Award className="h-4 w-4" />
                        Bulletins officiels
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {data.grades.reportCards.map((rc) => (
                          <div
                            key={rc.id}
                            className="flex items-center justify-between gap-3 p-3 rounded-md border"
                          >
                            <div className="flex items-center gap-3">
                              <Badge variant="outline">{rc.period}</Badge>
                              <div>
                                <div className="font-medium text-sm">
                                  {rc.academicYearLabel || '—'}
                                </div>
                                {rc.appreciation && (
                                  <div className="text-xs text-muted-foreground">
                                    {rc.appreciation}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {rc.average !== null && (
                                <div className="text-right">
                                  <div className="font-bold text-lg">
                                    {rc.average.toFixed(2)}<span className="text-xs text-muted-foreground">/20</span>
                                  </div>
                                  {rc.rank && (
                                    <div className="text-xs text-muted-foreground">
                                      Rang: {rc.rank}
                                    </div>
                                  )}
                                </div>
                              )}
                              <Badge variant="outline" className="text-xs">
                                {rc.status}
                              </Badge>
                              <a
                                href={`/api/exports/bulletin?studentId=${data.student.id}&period=${rc.period}`}
                                target="_blank"
                                className="inline-flex p-1.5 rounded-md hover:bg-primary/10 text-primary"
                                title="Télécharger le bulletin PDF"
                              >
                                <Download className="h-4 w-4" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Notes par période */}
                {data.grades.periods.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <GraduationCap className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p>Aucune note publiée pour cet élève.</p>
                    </CardContent>
                  </Card>
                ) : (
                  data.grades.periods.map((p) => (
                    <Card key={p.period}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center justify-between">
                          <span>{getPeriodLabel(p.period)}</span>
                          <div className="flex items-center gap-2">
                            {p.gradesCount > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {p.gradesCount} note(s)
                              </Badge>
                            )}
                            {p.generalAverage !== null && (
                              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                Moy: {p.generalAverage.toFixed(2)}/20
                              </Badge>
                            )}
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {p.subjects.map((s, idx) => (
                            <div key={idx} className="border-l-2 border-primary/30 pl-3">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{s.subject.name}</span>
                                  {s.average !== null && (
                                    <Badge variant="outline" className="text-xs">
                                      Moy: {s.average.toFixed(2)}/20
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {s.grades.map((g) => (
                                  <div
                                    key={g.id}
                                    className="px-2 py-1 rounded text-xs bg-muted/40 border"
                                    title={g.teacherComment || ''}
                                  >
                                    <div className="text-muted-foreground">{g.title}</div>
                                    <div className={getGradeColor(g.score, g.maxScore)}>
                                      {g.score}/{g.maxScore}
                                      {g.weight !== 1 && (
                                        <span className="text-xs text-muted-foreground ml-1">
                                          (×{g.weight})
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              {/* ============================================== */}
              {/* 6. PRÉSENCES ================================== */}
              {/* ============================================== */}
              <TabsContent value="attendance" className="mt-4 space-y-4">
                {/* IQA et indicateurs */}
                <div className="grid gap-3 md:grid-cols-4">
                  <Card className="md:col-span-1">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">IQA</span>
                        <Badge variant="outline" className={getIqaColor(data.attendance.summary.iqa)}>
                          {getIqaLabel(data.attendance.summary.iqa)}
                        </Badge>
                      </div>
                      <div className={`text-3xl font-bold ${getIqaColor(data.attendance.summary.iqa)}`}>
                        {data.attendance.summary.iqa.toFixed(1)}
                      </div>
                      <Progress
                        value={data.attendance.summary.iqa}
                        className="mt-2 h-2"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Indicateur Qualité d'Assiduité
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">Taux de présence</span>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      </div>
                      <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                        {data.attendance.summary.presenceRate.toFixed(1)}%
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {data.attendance.summary.present + data.attendance.summary.excused} / {data.attendance.summary.total} séances
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">Absences non excusées</span>
                        <XCircle className="h-4 w-4 text-red-500" />
                      </div>
                      <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                        {data.attendance.summary.absent}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Séances manquées
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">Retards</span>
                        <Clock className="h-4 w-4 text-amber-500" />
                      </div>
                      <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                        {data.attendance.summary.late}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {data.attendance.summary.excused} absence(s) justifiée(s)
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Dernières absences */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CalendarOff className="h-4 w-4" />
                      Dernières absences et retards
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {data.attendance.recent.length === 0 ? (
                      <div className="py-8 text-center text-muted-foreground">
                        <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-500 opacity-50" />
                        <p>Aucune absence ou retard enregistré. Excellent assiduité !</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[500px] overflow-y-auto">
                        {data.attendance.recent.map((a) => (
                          <div
                            key={a.id}
                            className="flex items-start gap-3 p-2 rounded-md border bg-muted/20"
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 shrink-0">
                              {a.status === 'LATE' ? <Clock className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium">
                                  {a.subjectName}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {fmtDate(a.date)}
                                </Badge>
                                {a.status === 'LATE' ? (
                                  <Badge className="bg-amber-100 text-amber-700 text-xs">
                                    Retard
                                  </Badge>
                                ) : (
                                  <Badge className="bg-red-100 text-red-700 text-xs">
                                    Absent
                                  </Badge>
                                )}
                                {a.justified && (
                                  <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                                    Justifié
                                  </Badge>
                                )}
                              </div>
                              {a.teacherName && (
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  Prof: {a.teacherName}
                                </div>
                              )}
                              {a.justification && (
                                <div className="text-xs text-muted-foreground italic mt-1">
                                  « {a.justification} »
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ============================================== */}
              {/* 7. DOCUMENTS ================================== */}
              {/* ============================================== */}
              <TabsContent value="documents" className="mt-4 space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Génération de documents officiels
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <DocAction
                        title="Attestation de fréquentation"
                        description="Certifie que l'élève est régulièrement inscrit à l'établissement pour l'année académique en cours."
                        href={`/api/exports/attestation?studentId=${data.student.id}`}
                        icon={<FileText className="h-5 w-5" />}
                        color="bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400"
                      />
                      <DocAction
                        title="Carte d'élève (avec QR code)"
                        description="Carte d'identification avec matricule, QR code de vérification et photo."
                        href={`/api/exports/student-card?studentId=${data.student.id}`}
                        icon={<CreditCard className="h-5 w-5" />}
                        color="bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400"
                      />
                      <DocAction
                        title="Bulletin de notes"
                        description="Bulletin complet avec notes par matière, moyennes et appréciations."
                        href={`/api/exports/bulletin?studentId=${data.student.id}`}
                        icon={<GraduationCap className="h-5 w-5" />}
                        color="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400"
                      />
                      <DocAction
                        title="Reçu de paiement"
                        description="Dernier reçu de paiement avec signature HMAC et QR code de vérification."
                        href={data.finances.receipts[0] ? `/api/exports/receipt-v2?receiptId=${data.finances.receipts[0].id}` : null}
                        icon={<ReceiptIcon className="h-5 w-5" />}
                        color="bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400"
                        disabled={data.finances.receipts.length === 0}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ReceiptIcon className="h-4 w-4" />
                      Reçus émis ({data.finances.receipts.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {data.finances.receipts.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">
                        Aucun reçu émis pour cet élève.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {data.finances.receipts.map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between gap-3 p-2 rounded-md border hover:bg-muted/30"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <code className="font-mono text-xs">{r.receiptNumber}</code>
                              <span className="text-sm font-mono font-bold">
                                {fmtMoney(r.amount, r.currency)}
                              </span>
                              {getPaymentMethodBadge(r.paymentMethod)}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-muted-foreground">
                                {fmtDate(r.issuedAt)}
                              </span>
                              <a
                                href={`/api/exports/receipt-v2?receiptId=${r.id}`}
                                target="_blank"
                                className="inline-flex p-1.5 rounded-md hover:bg-primary/10 text-primary"
                                title="Imprimer"
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ============================================================
// Sous-composants
// ============================================================

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground shrink-0 text-xs uppercase tracking-wide">
        {label}
      </span>
      <span className="text-right font-medium text-sm">{value}</span>
    </div>
  )
}

function FinStatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string
  value: string
  icon: React.ReactNode
  color: string
}) {
  return (
    <div className={`p-3 rounded-md border ${color}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs opacity-80">{label}</span>
        {icon}
      </div>
      <p className="text-lg font-bold font-mono">{value}</p>
    </div>
  )
}

function DocAction({
  title,
  description,
  href,
  icon,
  color,
  disabled,
}: {
  title: string
  description: string
  href: string | null
  icon: React.ReactNode
  color: string
  disabled?: boolean
}) {
  if (disabled || !href) {
    return (
      <div className="p-3 rounded-md border border-dashed opacity-50 bg-muted/20">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-md ${color}`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
            <p className="text-xs text-muted-foreground italic mt-1">Non disponible</p>
          </div>
        </div>
      </div>
    )
  }
  return (
    <a
      href={href}
      target="_blank"
      className="block p-3 rounded-md border hover:border-primary/40 hover:shadow-sm transition-colors group"
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-md ${color}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm group-hover:text-primary">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          <p className="text-xs text-primary mt-1 flex items-center gap-1">
            <Download className="h-3 w-3" /> Télécharger PDF
          </p>
        </div>
      </div>
    </a>
  )
}
