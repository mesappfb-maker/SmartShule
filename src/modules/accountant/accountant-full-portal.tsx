'use client'

// SmartShule — Portail Comptable complet
// ============================================================
// Architecture ERP multi-section :
//   - Vue d'ensemble (KPIs temps réel)
//   - Dettes élèves (Excel-style DataGrid + filtres solvabilité)
//   - Encaissement (génération reçus sécurisés)
//   - Reçus (historique + QR code + annulation via avoir)
//   - Bourses (création + application)
//   - Dépenses (création + validation Promoteur)

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
import { StatCard } from '@/components/ss/stat-card'
import {
  Loader2, Wallet, Receipt, TrendingUp, AlertTriangle, Plus,
  Search, CheckCircle2, XCircle, FileText, Award, CreditCard, Printer, Eye,
} from 'lucide-react'
import { toast } from 'sonner'

// ============================================================
// Types
// ============================================================

type Debt = {
  id: string
  studentId: string
  studentName: string
  matricule: string
  classroomName: string
  directorateName: string
  feeName: string
  feeCode: string
  period: string
  amountDue: number
  amountPaid: number
  reduction: number
  balance: number
  currency: string
  status: string
  lastPaymentAt: string | null
}

type ReceiptItem = {
  id: string
  receiptNumber: string
  studentName: string
  matricule: string
  amount: number
  currency: string
  paymentMethod: string
  paymentProvider: string | null
  payerName: string | null
  cancelled: boolean
  cancellationReason: string | null
  issuedAt: string
  accountantName: string
  qrCodeData: string
}

type Scholarship = {
  id: string
  name: string
  code: string
  description: string | null
  reductionPercent: number
  appliesToCategory: string | null
}

type Expense = {
  id: string
  expenseNumber: string
  category: string
  description: string
  supplierName: string | null
  amount: number
  currency: string
  paymentMethod: string
  status: string
  requestedByName: string | null
  approvedByName: string | null
  rejectionReason: string | null
  expenseDate: string
}

type Stats = {
  collectedToday: number
  collectedThisMonth: number
  totalOutstandingDebt: number
  collectionRate: number
  pendingExpenses: number
  currency: string
}

type DebtStats = {
  totalStudents: number
  totalDebts: number
  totalDue: number
  totalPaid: number
  totalBalance: number
  collectionRate: number
  paid: number
  partiallyPaid: number
  open: number
}

// ============================================================
// Composant principal
// ============================================================

export function AccountantFullPortal() {
  const [tab, setTab] = React.useState<'dashboard' | 'debts' | 'collect' | 'receipts' | 'scholarships' | 'expenses' | 'bulletins'>('dashboard')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Module Comptable"
        description="Encaissement sécurisé, reçus infalsifiables, suivi des dettes élèves et gestion des dépenses."
        breadcrumbs={[{ label: 'Comptable' }, { label: 'Module' }]}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid w-full grid-cols-4 sm:grid-cols-7 gap-1 h-auto">
          <TabsTrigger value="dashboard" className="flex flex-col items-center gap-1 py-2 text-xs">
            <TrendingUp className="h-4 w-4" /> Vue d'ensemble
          </TabsTrigger>
          <TabsTrigger value="debts" className="flex flex-col items-center gap-1 py-2 text-xs">
            <AlertTriangle className="h-4 w-4" /> Dettes
          </TabsTrigger>
          <TabsTrigger value="collect" className="flex flex-col items-center gap-1 py-2 text-xs">
            <Wallet className="h-4 w-4" /> Encaisser
          </TabsTrigger>
          <TabsTrigger value="receipts" className="flex flex-col items-center gap-1 py-2 text-xs">
            <Receipt className="h-4 w-4" /> Reçus
          </TabsTrigger>
          <TabsTrigger value="bulletins" className="flex flex-col items-center gap-1 py-2 text-xs">
            <FileText className="h-4 w-4" /> Bulletins
          </TabsTrigger>
          <TabsTrigger value="scholarships" className="flex flex-col items-center gap-1 py-2 text-xs">
            <Award className="h-4 w-4" /> Bourses
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex flex-col items-center gap-1 py-2 text-xs">
            <CreditCard className="h-4 w-4" /> Dépenses
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
          <DashboardView />
        </TabsContent>
        <TabsContent value="debts" className="mt-4">
          <DebtsView />
        </TabsContent>
        <TabsContent value="collect" className="mt-4">
          <CollectView />
        </TabsContent>
        <TabsContent value="receipts" className="mt-4">
          <ReceiptsView />
        </TabsContent>
        <TabsContent value="bulletins" className="mt-4">
          <BulletinsView />
        </TabsContent>
        <TabsContent value="scholarships" className="mt-4">
          <ScholarshipsView />
        </TabsContent>
        <TabsContent value="expenses" className="mt-4">
          <ExpensesView />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================================
// 1. DASHBOARD
// ============================================================

function DashboardView() {
  const [stats, setStats] = React.useState<Stats | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetch('/api/accountant?resource=stats', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => data.ok && setStats(data.stats))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
  if (!stats) return <EmptyState title="Stats indisponibles" />

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Encaissé aujourd'hui" value={`${stats.collectedToday.toLocaleString()} ${stats.currency}`} icon={<Wallet className="h-5 w-5" />} tone="success" />
        <StatCard label="Encaissé ce mois" value={`${stats.collectedThisMonth.toLocaleString()} ${stats.currency}`} icon={<TrendingUp className="h-5 w-5" />} tone="info" />
        <StatCard label="Dette en attente" value={`${stats.totalOutstandingDebt.toLocaleString()} ${stats.currency}`} icon={<AlertTriangle className="h-5 w-5" />} tone="danger" />
        <StatCard label="Taux recouvrement" value={`${stats.collectionRate}%`} icon={<CheckCircle2 className="h-5 w-5" />} tone="tertiary" />
      </div>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            💡 <strong>Générez les dettes</strong> dans l'onglet « Dettes élèves » avant d'encaisser. Les reçus sont numérotés chronologiquement et infalsifiables (signature HMAC + QR code).
            {stats.pendingExpenses > 0 && (
              <span className="ml-2 text-amber-600">⚠️ {stats.pendingExpenses} dépense(s) en attente de validation.</span>
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// 2. DETTES ÉLÈVES — Vue DataGrid Excel
// ============================================================

function DebtsView() {
  const [data, setData] = React.useState<{ debts: Debt[]; stats: DebtStats } | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [filterStatus, setFilterStatus] = React.useState('')
  const [minDebt, setMinDebt] = React.useState('')
  const [showGenerate, setShowGenerate] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    let url = '/api/accountant?resource=debts'
    if (filterStatus) url += `&status=${filterStatus}`
    if (minDebt) url += `&minDebt=${minDebt}`
    const res = await fetch(url, { cache: 'no-store' })
    const result = await res.json()
    if (result.ok) setData(result)
    setLoading(false)
  }, [filterStatus, minDebt])

  React.useEffect(() => { load() }, [load])

  const filtered = data?.debts.filter((d) =>
    !search || d.studentName.toLowerCase().includes(search.toLowerCase()) || d.matricule.toLowerCase().includes(search.toLowerCase())
  ) || []

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>

  return (
    <div className="space-y-4">
      {/* Stats solvabilité */}
      {data?.stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatBox label="Élèves concernés" value={data.stats.totalStudents} tone="primary" />
          <StatBox label="Total dû" value={`${data.stats.totalDue.toLocaleString()}`} tone="info" />
          <StatBox label="Total payé" value={`${data.stats.totalPaid.toLocaleString()}`} tone="success" />
          <StatBox label="Solde restant" value={`${data.stats.totalBalance.toLocaleString()}`} tone="danger" />
          <StatBox label="Taux recouvrement" value={`${data.stats.collectionRate}%`} tone="tertiary" />
        </div>
      )}

      {/* Filtres */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher par nom ou matricule..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
          <select className="p-2 border rounded-md bg-background text-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Tous statuts</option>
            <option value="OPEN">Non payé</option>
            <option value="PARTIALLY_PAID">Partiellement payé</option>
            <option value="PAID">Payé</option>
          </select>
          <Input type="number" placeholder="Dette min" value={minDebt} onChange={(e) => setMinDebt(e.target.value)} className="w-32" />
          <Button onClick={() => setShowGenerate(!showGenerate)} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" /> Générer dettes
          </Button>
        </CardContent>
      </Card>

      {/* Formulaire génération dettes */}
      {showGenerate && <GenerateDebtsForm onDone={() => { setShowGenerate(false); load() }} />}

      {/* DataGrid Excel-style */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState icon={<AlertTriangle className="h-5 w-5" />} title="Aucune dette" description="Générez les dettes via le bouton ci-dessus." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b">
                  <tr>
                    <th className="text-left p-2 font-medium">Élève</th>
                    <th className="text-left p-2 font-medium">Matricule</th>
                    <th className="text-left p-2 font-medium">Classe</th>
                    <th className="text-left p-2 font-medium">Frais</th>
                    <th className="text-right p-2 font-medium">Dû</th>
                    <th className="text-right p-2 font-medium">Payé</th>
                    <th className="text-right p-2 font-medium">Réduction</th>
                    <th className="text-right p-2 font-medium">Solde</th>
                    <th className="text-center p-2 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => {
                    const balanceColor = d.balance > 0 ? (d.balance > d.amountDue * 0.5 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400') : 'text-emerald-600 dark:text-emerald-400'
                    return (
                      <tr key={d.id} className="border-b hover:bg-muted/20">
                        <td className="p-2 font-medium">{d.studentName}</td>
                        <td className="p-2 text-xs text-muted-foreground font-mono">{d.matricule}</td>
                        <td className="p-2 text-xs">{d.classroomName}</td>
                        <td className="p-2 text-xs">{d.feeName} <span className="text-muted-foreground">({d.period})</span></td>
                        <td className="p-2 text-right">{d.amountDue.toLocaleString()} {d.currency}</td>
                        <td className="p-2 text-right text-emerald-600 dark:text-emerald-400">{d.amountPaid.toLocaleString()}</td>
                        <td className="p-2 text-right text-blue-600 dark:text-blue-400">{d.reduction > 0 ? `-${d.reduction.toLocaleString()}` : '—'}</td>
                        <td className={`p-2 text-right font-semibold ${balanceColor}`}>{d.balance.toLocaleString()} {d.currency}</td>
                        <td className="p-2 text-center">
                          <StatusBadge status={d.status} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function GenerateDebtsForm({ onDone }: { onDone: () => void }) {
  const [classroomId, setClassroomId] = React.useState('')
  const [academicYearId, setAcademicYearId] = React.useState('')
  const [classrooms, setClassrooms] = React.useState<any[]>([])
  const [years, setYears] = React.useState<any[]>([])
  const [pending, setPending] = React.useState(false)

  React.useEffect(() => {
    Promise.all([
      fetch('/api/direction/classrooms').then((r) => r.json()),
      fetch('/api/direction/setup').then((r) => r.json()),
    ]).then(([cls, setup]) => {
      if (cls.ok) setClassrooms(cls.classrooms || [])
      if (setup.ok) setYears(setup.academicYears || [])
    })
  }, [])

  async function submit() {
    if (!classroomId || !academicYearId) {
      toast.error('Classe et année obligatoires')
      return
    }
    setPending(true)
    try {
      const res = await fetch('/api/accountant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-debts', classroomId, academicYearId }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success(data.message)
        onDone()
      } else toast.error(data.error)
    } finally { setPending(false) }
  }

  return (
    <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
      <CardContent className="p-4 space-y-3">
        <p className="text-sm font-medium">📋 Générer les dettes pour une classe</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Année académique *</Label>
            <select className="w-full p-2 border rounded-md bg-background text-sm" value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)}>
              <option value="">— Sélectionner —</option>
              {years.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
            </select>
          </div>
          <div>
            <Label>Classe *</Label>
            <select className="w-full p-2 border rounded-md bg-background text-sm" value={classroomId} onChange={(e) => setClassroomId(e.target.value)}>
              <option value="">— Sélectionner —</option>
              {classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <Button onClick={submit} disabled={pending} size="sm">
          {pending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
          Générer les dettes
        </Button>
      </CardContent>
    </Card>
  )
}

// ============================================================
// 3. ENCAISSEMENT
// ============================================================

function CollectView() {
  const [studentDebtId, setStudentDebtId] = React.useState('')
  const [studentId, setStudentId] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [currency, setCurrency] = React.useState('CDF')
  const [paymentMethod, setPaymentMethod] = React.useState('CASH')
  const [paymentProvider, setPaymentProvider] = React.useState('')
  const [payerName, setPayerName] = React.useState('')
  const [payerPhone, setPayerPhone] = React.useState('')
  const [transactionReference, setTransactionReference] = React.useState('')
  const [pending, setPending] = React.useState(false)
  const [debts, setDebts] = React.useState<Debt[]>([])

  React.useEffect(() => {
    fetch('/api/accountant?resource=debts&status=OPEN')
      .then((r) => r.json())
      .then((data) => data.ok && setDebts(data.debts))
  }, [])

  async function submit() {
    if (!studentId || !amount) {
      toast.error('Élève et montant obligatoires')
      return
    }
    if (paymentMethod === 'MOBILE_MONEY' && !paymentProvider) {
      toast.error('Sélectionnez le provider Mobile Money')
      return
    }
    setPending(true)
    try {
      const res = await fetch('/api/accountant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'collect-payment',
          studentDebtId: studentDebtId || null,
          studentId,
          amountCents: Math.round(parseFloat(amount) * 100),
          currency,
          paymentMethod,
          paymentProvider: paymentProvider || null,
          payerName,
          payerPhone,
          transactionReference,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success(`✅ Reçu ${data.receiptNumber} émis`)
        setAmount(''); setPayerName(''); setPayerPhone(''); setTransactionReference('')
      } else toast.error(data.error)
    } finally { setPending(false) }
  }

  const mobileProviders = [
    { code: 'MPESA', name: '📱 M-Pesa (Vodacom)' },
    { code: 'ORANGE', name: '🟠 Orange Money' },
    { code: 'MTN', name: '💛 MTN Mobile Money' },
    { code: 'AIRTEL', name: '🔴 Airtel Money' },
    { code: 'WAVE', name: '🌊 Wave' },
  ]

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4" /> Encaissement</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Dette à régler (recherche par élève)</Label>
            <select className="w-full p-2 border rounded-md bg-background text-sm" value={studentDebtId} onChange={(e) => {
              const d = debts.find((x) => x.id === e.target.value)
              setStudentDebtId(e.target.value)
              if (d) { setStudentId(d.studentId); setAmount(String(d.balance)); setCurrency(d.currency) }
            }}>
              <option value="">— Sélectionner une dette —</option>
              {debts.map((d) => (
                <option key={d.id} value={d.id}>{d.studentName} · {d.feeName} · Solde : {d.balance} {d.currency}</option>
              ))}
            </select>
            {studentDebtId && <p className="text-xs text-emerald-600 mt-1">✓ Montant auto-rempli avec le solde dû</p>}
          </div>
          {!studentDebtId && (
            <div>
              <Label>Ou ID élève directement</Label>
              <Input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="cmu..." />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Montant *</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label>Devise</Label>
              <select className="w-full p-2 border rounded-md bg-background text-sm" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="CDF">CDF</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>
          <div>
            <Label>Moyen de paiement *</Label>
            <select className="w-full p-2 border rounded-md bg-background text-sm" value={paymentMethod} onChange={(e) => { setPaymentMethod(e.target.value); setPaymentProvider('') }}>
              <option value="CASH">💵 Espèces (Caisse)</option>
              <option value="BANK">🏦 Banque (Virement)</option>
              <option value="MOBILE_MONEY">📱 Mobile Money</option>
              <option value="CARD">💳 Carte bancaire</option>
            </select>
          </div>
          {paymentMethod === 'MOBILE_MONEY' && (
            <>
              <div>
                <Label>Provider Mobile Money *</Label>
                <select className="w-full p-2 border rounded-md bg-background text-sm" value={paymentProvider} onChange={(e) => setPaymentProvider(e.target.value)}>
                  <option value="">— Sélectionner —</option>
                  {mobileProviders.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Téléphone du payeur *</Label>
                <Input value={payerPhone} onChange={(e) => setPayerPhone(e.target.value)} placeholder="+243 ..." />
              </div>
              <div>
                <Label>Référence transaction</Label>
                <Input value={transactionReference} onChange={(e) => setTransactionReference(e.target.value)} placeholder="ID transaction Mobile Money" />
              </div>
            </>
          )}
          <div>
            <Label>Nom du payeur</Label>
            <Input value={payerName} onChange={(e) => setPayerName(e.target.value)} placeholder="Nom du parent/tuteur" />
          </div>
          <Button onClick={submit} disabled={pending} className="w-full">
            {pending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Receipt className="h-4 w-4 mr-2" />}
            Encaisser + Émettre reçu
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">🔒 Sécurité du reçu</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Numérotation chronologique stricte</p>
              <p className="text-xs">Format : REC-2026-000001 — impossible de sauter un numéro</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Signature HMAC-SHA256</p>
              <p className="text-xs">Chaque reçu est signé cryptographiquement (anti-falsification)</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">QR code de vérification</p>
              <p className="text-xs">Le QR contient toutes les infos + signature</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Aucune suppression possible</p>
              <p className="text-xs">Annulation uniquement via avoir (CREDIT_NOTE) tracé</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Audit complet</p>
              <p className="text-xs">Chaque encaissement est journalisé avec IP + comptable</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// 4. REÇUS
// ============================================================

function ReceiptsView() {
  const [receipts, setReceipts] = React.useState<ReceiptItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedReceipt, setSelectedReceipt] = React.useState<ReceiptItem | null>(null)
  const [showCancel, setShowCancel] = React.useState(false)
  const [cancelReason, setCancelReason] = React.useState('')

  const load = React.useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/accountant?resource=receipts', { cache: 'no-store' })
    const data = await res.json()
    if (data.ok) setReceipts(data.receipts)
    setLoading(false)
  }, [])

  React.useEffect(() => { load() }, [load])

  async function cancel() {
    if (!selectedReceipt || !cancelReason) return
    const res = await fetch('/api/accountant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel-receipt', receiptId: selectedReceipt.id, cancellationReason: cancelReason }),
    })
    const data = await res.json()
    if (data.ok) {
      toast.success(data.message)
      setShowCancel(false); setCancelReason(''); setSelectedReceipt(null)
      load()
    } else toast.error(data.error)
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">📋 Reçus émis ({receipts.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {receipts.length === 0 ? (
            <EmptyState icon={<Receipt className="h-5 w-5" />} title="Aucun reçu émis" description="Allez dans l'onglet « Encaisser » pour émettre votre premier reçu." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b">
                  <tr>
                    <th className="text-left p-2">N° Reçu</th>
                    <th className="text-left p-2">Élève</th>
                    <th className="text-right p-2">Montant</th>
                    <th className="text-left p-2">Moyen</th>
                    <th className="text-left p-2">Payeur</th>
                    <th className="text-left p-2">Date</th>
                    <th className="text-center p-2">Statut</th>
                    <th className="text-center p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((r) => (
                    <tr key={r.id} className={`border-b hover:bg-muted/20 ${r.cancelled ? 'opacity-50' : ''}`}>
                      <td className="p-2 font-mono text-xs">{r.receiptNumber}</td>
                      <td className="p-2">{r.studentName}<br /><span className="text-xs text-muted-foreground">{r.matricule}</span></td>
                      <td className="p-2 text-right font-medium">{r.amount.toLocaleString()} {r.currency}</td>
                      <td className="p-2 text-xs">{r.paymentMethod}{r.paymentProvider && ` (${r.paymentProvider})`}</td>
                      <td className="p-2 text-xs">{r.payerName || '—'}</td>
                      <td className="p-2 text-xs">{new Date(r.issuedAt).toLocaleString('fr-FR')}</td>
                      <td className="p-2 text-center">
                        {r.cancelled ? <Badge variant="destructive">Annulé</Badge> : <Badge className="bg-emerald-100 text-emerald-700">Valide</Badge>}
                      </td>
                      <td className="p-2 text-center">
                        <div className="flex gap-1 justify-center">
                          <a
                            href={`/api/exports/receipt-v2?id=${r.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center rounded-md p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
                            title="Imprimer / Voir le PDF"
                          >
                            <Printer className="h-4 w-4" />
                          </a>
                          {!r.cancelled && (
                            <Button size="sm" variant="ghost" onClick={() => { setSelectedReceipt(r); setShowCancel(true) }} title="Annuler le reçu (via avoir)">
                              <XCircle className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
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

      {showCancel && selectedReceipt && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-4 space-y-3">
            <p className="font-medium text-red-700 dark:text-red-300">⚠️ Annuler le reçu {selectedReceipt.receiptNumber}</p>
            <p className="text-xs text-muted-foreground">Un avoir sera automatiquement créé. Cette action est irréversible.</p>
            <div>
              <Label>Motif d&apos;annulation *</Label>
              <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={2} placeholder="Erreur de montant, doublon, etc." />
            </div>
            <div className="flex gap-2">
              <Button variant="destructive" onClick={cancel} disabled={!cancelReason}>Confirmer l&apos;annulation</Button>
              <Button variant="outline" onClick={() => { setShowCancel(false); setCancelReason(''); setSelectedReceipt(null) }}>Annuler</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ============================================================
// 5. BULLETINS — Génération PDF par classe
// ============================================================

function BulletinsView() {
  const [periods, setPeriods] = React.useState<any[]>([])
  const [classrooms, setClassrooms] = React.useState<any[]>([])
  const [periodId, setPeriodId] = React.useState('')
  const [classroomId, setClassroomId] = React.useState('')
  const [students, setStudents] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searching, setSearching] = React.useState(false)

  React.useEffect(() => {
    Promise.all([
      fetch('/api/accountant/bulletins').then((r) => r.json()),
      fetch('/api/direction/classrooms').then((r) => r.json()),
    ]).then(([p, c]) => {
      if (p.ok) setPeriods(p.periods || [])
      if (c.ok) setClassrooms(c.classrooms || [])
    }).finally(() => setLoading(false))
  }, [])

  async function searchStudents() {
    if (!classroomId) {
      toast.error('Sélectionnez une classe')
      return
    }
    setSearching(true)
    try {
      const res = await fetch('/api/accountant/bulletins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list-students-for-bulletin', classroomId, periodId: periodId || undefined }),
      })
      const data = await res.json()
      if (data.ok) setStudents(data.students)
      else toast.error(data.error)
    } finally { setSearching(false) }
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">📋 Génération des bulletins de notes</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Période d&apos;évaluation</Label>
            <select className="w-full p-2 border rounded-md bg-background text-sm" value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
              <option value="">— Période active —</option>
              {periods.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code}) — {new Date(p.startDate).toLocaleDateString('fr-FR')} → {new Date(p.endDate).toLocaleDateString('fr-FR')}</option>)}
            </select>
          </div>
          <div>
            <Label>Classe *</Label>
            <select className="w-full p-2 border rounded-md bg-background text-sm" value={classroomId} onChange={(e) => setClassroomId(e.target.value)}>
              <option value="">— Sélectionner —</option>
              {classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <Button onClick={searchStudents} disabled={searching} className="w-full">
              {searching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Lister les élèves
            </Button>
          </div>
        </CardContent>
      </Card>

      {students.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              📊 Bulletins de {classrooms.find((c) => c.id === classroomId)?.name || '—'} ({students.length} élèves)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b">
                  <tr>
                    <th className="text-left p-2">Élève</th>
                    <th className="text-left p-2">Matricule</th>
                    <th className="text-center p-2">Notes publiées</th>
                    <th className="text-center p-2">Statut</th>
                    <th className="text-center p-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.studentId} className="border-b hover:bg-muted/20">
                      <td className="p-2 font-medium">{s.studentName}</td>
                      <td className="p-2 text-xs text-muted-foreground font-mono">{s.matricule}</td>
                      <td className="p-2 text-center">{s.gradesCount}</td>
                      <td className="p-2 text-center">
                        {s.hasGrades ? (
                          <Badge className="bg-emerald-100 text-emerald-700">Prêt</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Aucune note</Badge>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {s.hasGrades ? (
                          <a
                            href={s.bulletinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs"
                          >
                            <Eye className="h-3.5 w-3.5" /> Voir PDF
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 bg-muted/20 border-t flex gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                // Ouvrir tous les bulletins dans des onglets séparés
                students.filter((s) => s.hasGrades).forEach((s) => {
                  window.open(s.bulletinUrl, '_blank')
                })
              }}>
                <Printer className="h-4 w-4 mr-1" /> Imprimer tous les bulletins ({students.filter((s) => s.hasGrades).length})
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ============================================================
// 6. BOURSES
// ============================================================

function ScholarshipsView() {
  const [scholarships, setScholarships] = React.useState<Scholarship[]>([])
  const [loading, setLoading] = React.useState(true)
  const [name, setName] = React.useState('')
  const [code, setCode] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [reductionPercent, setReductionPercent] = React.useState('50')
  const [pending, setPending] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/accountant?resource=scholarships', { cache: 'no-store' })
    const data = await res.json()
    if (data.ok) setScholarships(data.scholarships)
    setLoading(false)
  }, [])

  React.useEffect(() => { load() }, [load])

  async function submit() {
    if (!name || !code || !reductionPercent) { toast.error('Tous les champs obligatoires'); return }
    setPending(true)
    try {
      const res = await fetch('/api/accountant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-scholarship', name, code, description, reductionPercent: parseInt(reductionPercent, 10) }),
      })
      const data = await res.json()
      if (data.ok) { toast.success(data.message); setName(''); setCode(''); setDescription(''); load() }
      else toast.error(data.error)
    } finally { setPending(false) }
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">🎓 Nouvelle bourse</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Nom *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bourse enfant personnel" /></div>
          <div><Label>Code *</Label><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="PERS-50" /></div>
          <div><Label>Pourcentage réduction * (0-100)</Label><Input type="number" min={0} max={100} value={reductionPercent} onChange={(e) => setReductionPercent(e.target.value)} /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
          <Button onClick={submit} disabled={pending} className="w-full">
            {pending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Award className="h-4 w-4 mr-2" />}
            Créer la bourse
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">📋 Bourses existantes ({scholarships.length})</CardTitle></CardHeader>
        <CardContent>
          {scholarships.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucune bourse créée</p>
          ) : (
            <div className="space-y-2">
              {scholarships.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-md border bg-muted/20">
                  <div>
                    <p className="font-medium">{s.name} <Badge variant="outline" className="ml-1">{s.code}</Badge></p>
                    {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                  </div>
                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">-{s.reductionPercent}%</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// 6. DÉPENSES
// ============================================================

function ExpensesView() {
  const [expenses, setExpenses] = React.useState<Expense[]>([])
  const [loading, setLoading] = React.useState(true)
  const [description, setDescription] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [category, setCategory] = React.useState('SUPPLIES')
  const [supplierName, setSupplierName] = React.useState('')
  const [pending, setPending] = React.useState(false)
  const [userRole, setUserRole] = React.useState('')

  const load = React.useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/accountant?resource=expenses', { cache: 'no-store' })
    const data = await res.json()
    if (data.ok) setExpenses(data.expenses)
    setLoading(false)
  }, [])

  React.useEffect(() => {
    load()
    // Récupérer le rôle user via /api/health (qui retourne rien) ou autre
    fetch('/api/direction/classrooms').then((r) => {
      // Juste pour vérifier que la session est OK
    })
  }, [load])

  async function submit() {
    if (!description || !amount) { toast.error('Description et montant obligatoires'); return }
    setPending(true)
    try {
      const res = await fetch('/api/accountant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-expense',
          category, description, amountCents: Math.round(parseFloat(amount) * 100),
          supplierName, currency: 'CDF',
        }),
      })
      const data = await res.json()
      if (data.ok) { toast.success(data.message); setDescription(''); setAmount(''); setSupplierName(''); load() }
      else toast.error(data.error)
    } finally { setPending(false) }
  }

  async function approve(id: string, approved: boolean) {
    const res = await fetch('/api/accountant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve-expense', expenseId: id, approved }),
    })
    const data = await res.json()
    if (data.ok) { toast.success(data.message); load() } else toast.error(data.error)
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">💳 Nouvelle dépense</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Catégorie *</Label>
            <select className="w-full p-2 border rounded-md bg-background text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="SUPPLIES">📦 Fournitures</option>
              <option value="MAINTENANCE">🔧 Maintenance</option>
              <option value="SALARY">💰 Salaire</option>
              <option value="UTILITIES">⚡ Charges (eau/électricité)</option>
              <option value="RENT">🏢 Loyer</option>
              <option value="OTHER">📝 Autre</option>
            </select>
          </div>
          <div className="col-span-2">
            <Label>Description *</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Achat de craies, salaire M. X..." />
          </div>
          <div>
            <Label>Montant (CDF) *</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Fournisseur</Label>
            <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Nom du fournisseur" />
          </div>
          <Button onClick={submit} disabled={pending} className="col-span-2 sm:col-span-1 self-end">
            {pending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Enregistrer
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">📋 Dépenses ({expenses.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {expenses.length === 0 ? (
            <EmptyState icon={<CreditCard className="h-5 w-5" />} title="Aucune dépense" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b">
                  <tr>
                    <th className="text-left p-2">N°</th>
                    <th className="text-left p-2">Description</th>
                    <th className="text-right p-2">Montant</th>
                    <th className="text-left p-2">Catégorie</th>
                    <th className="text-center p-2">Statut</th>
                    <th className="text-center p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} className="border-b hover:bg-muted/20">
                      <td className="p-2 font-mono text-xs">{e.expenseNumber}</td>
                      <td className="p-2">{e.description}<br /><span className="text-xs text-muted-foreground">{e.supplierName || '—'}</span></td>
                      <td className="p-2 text-right font-medium">{e.amount.toLocaleString()} {e.currency}</td>
                      <td className="p-2 text-xs">{e.category}</td>
                      <td className="p-2 text-center">
                        <Badge variant={e.status === 'APPROVED' ? 'default' : e.status === 'REJECTED' ? 'destructive' : 'outline'}>{e.status}</Badge>
                      </td>
                      <td className="p-2 text-center">
                        {e.status === 'PENDING' && (
                          <div className="flex gap-1 justify-center">
                            <Button size="sm" variant="ghost" onClick={() => approve(e.id, true)}><CheckCircle2 className="h-4 w-4 text-emerald-500" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => approve(e.id, false)}><XCircle className="h-4 w-4 text-red-500" /></Button>
                          </div>
                        )}
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
  )
}

// ============================================================
// Helpers
// ============================================================

function StatBox({ label, value, tone }: { label: string; value: any; tone: string }) {
  const tones: Record<string, string> = {
    primary: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200',
    info: 'bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300 border-cyan-200',
    success: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200',
    danger: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-200',
    tertiary: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200',
  }
  return (
    <div className={`p-3 rounded-md border ${tones[tone]}`}>
      <p className="text-xs opacity-80">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    OPEN: { label: 'Non payé', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
    PARTIALLY_PAID: { label: 'Partiel', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
    PAID: { label: '✓ Payé', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' },
    CANCELLED: { label: 'Annulé', className: 'bg-slate-100 text-slate-700' },
  }
  const cfg = map[status] || { label: status, className: '' }
  return <Badge className={cfg.className}>{cfg.label}</Badge>
}
