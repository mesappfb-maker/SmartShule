'use client'

import * as React from 'react'
import { useActionState } from 'react'
import { toast } from 'sonner'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PageHeader } from '@/components/ss/page-header'
import { StatCard } from '@/components/ss/stat-card'
import { StatusBadge } from '@/components/ss/status-badge'
import { EmptyState } from '@/components/ss/empty-state'
import {
  Plus, TrendingUp, CreditCard, FileText, BookOpen, Wallet,
  Loader2, Send, CheckCircle2, XCircle, Receipt, Calculator,
} from 'lucide-react'
import {
  createInvoiceAction, recordPaymentAction, cancelPaymentAction,
} from '@/lib/finance-actions'
import { INVOICE_STATUSES, PAYMENT_METHODS } from '@/lib/constants'
import { formatCents, formatDate, formatDateTime, formatRelative } from '@/lib/format'

type FinanceData = NonNullable<Awaited<ReturnType<typeof import('@/lib/queries').getFinanceDashboardData>>>

export function FinanceView({ data, schoolId }: { data: FinanceData; schoolId: string }) {
  const [tab, setTab] = React.useState('dashboard')
  const [showCreateInvoice, setShowCreateInvoice] = React.useState(false)
  const [showRecordPayment, setShowRecordPayment] = React.useState(false)
  const [showCancelPayment, setShowCancelPayment] = React.useState(false)
  const [selectedInvoiceId, setSelectedInvoiceId] = React.useState<string>('')
  const [selectedPaymentId, setSelectedPaymentId] = React.useState<string>('')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Module Finance & Comptabilité"
        description="Plan comptable, journaux, écritures en double entrée, factures et paiements."
        breadcrumbs={[{ label: 'Espace direction' }, { label: 'Finance' }]}
        actions={
          <>
            <Button onClick={() => setShowCreateInvoice(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle facture
            </Button>
            <Button
              variant="outline"
              onClick={() => { setSelectedInvoiceId(''); setShowRecordPayment(true) }}
            >
              <Receipt className="h-4 w-4 mr-2" />
              Encaissement
            </Button>
          </>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="dashboard">Tableau de bord</TabsTrigger>
          <TabsTrigger value="invoices">Factures</TabsTrigger>
          <TabsTrigger value="payments">Paiements</TabsTrigger>
          <TabsTrigger value="entries">Écritures</TabsTrigger>
          <TabsTrigger value="chart">Plan comptable</TabsTrigger>
          <TabsTrigger value="journals">Journaux</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <FinanceDashboard data={data} />
        </TabsContent>

        <TabsContent value="invoices">
          <InvoicesList data={data} onRecordPayment={(invId) => { setSelectedInvoiceId(invId); setShowRecordPayment(true) }} />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentsList data={data} onCancelPayment={(pId) => { setSelectedPaymentId(pId); setShowCancelPayment(true) }} />
        </TabsContent>

        <TabsContent value="entries">
          <EntriesList data={data} />
        </TabsContent>

        <TabsContent value="chart">
          <ChartOfAccountsView data={data} />
        </TabsContent>

        <TabsContent value="journals">
          <JournalsView data={data} />
        </TabsContent>
      </Tabs>

      <CreateInvoiceDialog
        open={showCreateInvoice}
        onOpenChange={setShowCreateInvoice}
        students={data.students}
        schoolId={schoolId}
      />

      <RecordPaymentDialog
        open={showRecordPayment}
        onOpenChange={setShowRecordPayment}
        invoices={data.invoices.filter((i) => i.status !== 'PAID' && i.status !== 'CANCELLED')}
        selectedInvoiceId={selectedInvoiceId}
        onSelectInvoice={setSelectedInvoiceId}
      />

      <CancelPaymentDialog
        open={showCancelPayment}
        onOpenChange={setShowCancelPayment}
        paymentId={selectedPaymentId}
      />
    </div>
  )
}

// ============================================================
// Dashboard
// ============================================================

function FinanceDashboard({ data }: { data: FinanceData }) {
  const s = data.stats
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total facturé"
          value={formatCents(s.totalInvoicedCents, 'CDF')}
          icon={<FileText className="h-5 w-5" />}
          tone="info"
        />
        <StatCard
          label="Total encaissé"
          value={formatCents(s.totalCollectedCents, 'CDF')}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="success"
          hint={`${s.paymentsCount} paiement(s)`}
        />
        <StatCard
          label="Impayés"
          value={formatCents(s.totalUnpaidCents, 'CDF')}
          icon={<CreditCard className="h-5 w-5" />}
          tone={s.totalUnpaidCents > 0 ? 'danger' : 'success'}
        />
        <StatCard
          label="Avoirs émis"
          value={formatCents(s.totalRefundedCents, 'CDF')}
          icon={<Wallet className="h-5 w-5" />}
          tone="tertiary"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dernières écritures comptables</CardTitle>
            <CardDescription>Double entrée — Débit = Crédit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recentEntries.slice(0, 5).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 p-2 rounded-md hover:bg-muted/30 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{entry.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.entryNumber} · {entry.journal.code} · {formatDate(entry.entryDate)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-medium">{formatCents(entry.totalDebit, 'CDF')}</p>
                  <StatusBadge variant={entry.isBalanced ? 'success' : 'danger'}>
                    {entry.isBalanced ? 'Équilibrée' : 'Déséquilibrée'}
                  </StatusBadge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top comptes par volume</CardTitle>
            <CardDescription>Soldes débiteurs et créditeurs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.accountBalances
              .filter((ab) => ab.totalDebit > 0 || ab.totalCredit > 0)
              .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
              .slice(0, 8)
              .map(({ account, totalDebit, totalCredit, balance }) => (
                <div key={account.id} className="flex items-center justify-between gap-3 p-2 rounded-md hover:bg-muted/30 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{account.accountNumber}</code>
                      {' '}
                      {account.accountLabel}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      D: {formatCents(totalDebit, 'CDF')} · C: {formatCents(totalCredit, 'CDF')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-medium ${balance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {balance >= 0 ? 'SD' : 'SC'} {formatCents(Math.abs(balance), 'CDF')}
                    </p>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ============================================================
// Invoices list
// ============================================================

function InvoicesList({ data, onRecordPayment }: { data: FinanceData; onRecordPayment: (id: string) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Factures ({data.invoices.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.invoices.length === 0 ? (
          <EmptyState icon={<FileText className="h-5 w-5" />} title="Aucune facture" />
        ) : (
          data.invoices.map((inv) => (
            <div key={inv.id} className="flex items-start justify-between gap-3 p-3 rounded-md border border-border">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium">{inv.invoiceNumber}</p>
                  <StatusBadge variant={INVOICE_STATUSES[inv.status]?.tone}>
                    {INVOICE_STATUSES[inv.status]?.label}
                  </StatusBadge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {inv.student ? `${inv.student.firstName} ${inv.student.lastName}` : '—'} · Émise le {formatDate(inv.issueDate)}
                  {inv.dueDate && ` · Échéance ${formatDate(inv.dueDate)}`}
                </p>
                <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                  <span>Total : <span className="font-medium text-foreground">{formatCents(inv.totalAmountCents, inv.currency)}</span></span>
                  <span>Payé : <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatCents(inv.paidAmountCents, inv.currency)}</span></span>
                  {inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (
                    <span className="text-red-600 dark:text-red-400">
                      Reste : {formatCents(inv.totalAmountCents - inv.paidAmountCents, inv.currency)}
                    </span>
                  )}
                </div>
              </div>
              {inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (
                <Button size="sm" onClick={() => onRecordPayment(inv.id)}>
                  <Receipt className="h-3 w-3 mr-1" />
                  Encaisser
                </Button>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// Payments list
// ============================================================

function PaymentsList({ data, onCancelPayment }: { data: FinanceData; onCancelPayment: (id: string) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Paiements ({data.payments.length})</CardTitle>
        <CardDescription>Les paiements validés sont immuables — toute correction se fait via un avoir.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.payments.length === 0 ? (
          <EmptyState icon={<Receipt className="h-5 w-5" />} title="Aucun paiement" />
        ) : (
          data.payments.map((p) => (
            <div key={p.id} className="flex items-start justify-between gap-3 p-3 rounded-md border border-border">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <p className="font-medium">{p.receiptNumber}</p>
                  <StatusBadge variant={p.status === 'CONFIRMED' ? 'success' : p.status === 'CANCELLED' ? 'danger' : 'warning'}>
                    {p.status === 'CONFIRMED' ? 'Confirmé' : p.status === 'CANCELLED' ? 'Annulé' : 'En attente'}
                  </StatusBadge>
                  {p.reversesPaymentId && (
                    <StatusBadge variant="warning" dot>Avoir</StatusBadge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {p.invoice.student ? `${p.invoice.student.firstName} ${p.invoice.student.lastName}` : '—'} ·{' '}
                  {PAYMENT_METHODS[p.method] || p.method} · {formatDate(p.paidAt)}
                </p>
                {p.cancelledAt && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    Annulé le {formatDate(p.cancelledAt)} : {p.cancellationReason}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className={`font-semibold ${p.amountCents < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {p.amountCents < 0 ? '-' : ''}{formatCents(Math.abs(p.amountCents), 'CDF')}
                </p>
                {p.status === 'CONFIRMED' && p.amountCents > 0 && (
                  <Button size="sm" variant="outline" onClick={() => onCancelPayment(p.id)}>
                    <XCircle className="h-3 w-3 mr-1" />
                    Annuler (avoir)
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// Entries list
// ============================================================

function EntriesList({ data }: { data: FinanceData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Écritures comptables ({data.recentEntries.length})</CardTitle>
        <CardDescription>Journal des dernières écritures en double entrée</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.recentEntries.length === 0 ? (
          <EmptyState icon={<Calculator className="h-5 w-5" />} title="Aucune écriture" />
        ) : (
          data.recentEntries.map((entry) => (
            <div key={entry.id} className="p-3 rounded-md border border-border">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-medium text-sm">{entry.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.entryNumber} · {entry.journal.code} ({entry.journal.label}) · {formatDate(entry.entryDate)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCents(entry.totalDebit, 'CDF')}</p>
                  <StatusBadge variant={entry.isBalanced ? 'success' : 'danger'}>
                    {entry.isBalanced ? 'D = C' : 'Déséquilibrée'}
                  </StatusBadge>
                </div>
              </div>
              <Separator className="my-2" />
              <div className="space-y-1">
                {entry.lines.map((line) => (
                  <div key={line.id} className="flex items-center justify-between text-xs">
                    <span className="font-mono">{line.account.accountNumber}</span>
                    <span className="flex-1 ml-2 truncate text-muted-foreground">
                      {line.account.accountLabel}
                      {line.description && ` · ${line.description}`}
                    </span>
                    <span className={`font-medium ${line.debit > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {line.debit > 0
                        ? `D ${formatCents(line.debit, 'CDF')}`
                        : `C ${formatCents(line.credit, 'CDF')}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// Chart of accounts
// ============================================================

function ChartOfAccountsView({ data }: { data: FinanceData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Plan comptable ({data.chartOfAccounts.length})</CardTitle>
        <CardDescription>Structure fonctionnelle conforme au §3.11.2 du cahier des charges</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                <th className="text-left p-2 font-medium">N°</th>
                <th className="text-left p-2 font-medium">Libellé</th>
                <th className="text-left p-2 font-medium">Catégorie</th>
                <th className="text-left p-2 font-medium">Type</th>
                <th className="text-right p-2 font-medium">Débit total</th>
                <th className="text-right p-2 font-medium">Crédit total</th>
                <th className="text-right p-2 font-medium">Solde</th>
              </tr>
            </thead>
            <tbody>
              {data.chartOfAccounts.map((acc) => {
                const balance = data.accountBalances.find((b) => b.account.id === acc.id)
                return (
                  <tr key={acc.id} className="border-b border-border hover:bg-muted/20">
                    <td className="p-2"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{acc.accountNumber}</code></td>
                    <td className="p-2">{acc.accountLabel}</td>
                    <td className="p-2"><span className="text-xs text-muted-foreground">{acc.accountCategory}</span></td>
                    <td className="p-2"><span className="text-xs text-muted-foreground">{acc.accountType}</span></td>
                    <td className="p-2 text-right">{formatCents(balance?.totalDebit || 0, 'CDF')}</td>
                    <td className="p-2 text-right">{formatCents(balance?.totalCredit || 0, 'CDF')}</td>
                    <td className={`p-2 text-right font-medium ${(balance?.balance || 0) >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {formatCents(Math.abs(balance?.balance || 0), 'CDF')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Journals
// ============================================================

function JournalsView({ data }: { data: FinanceData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Journaux comptables ({data.journals.length})</CardTitle>
        <CardDescription>Conforme au §3.11.3 du cahier des charges</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.journals.map((j) => (
          <div key={j.id} className="p-3 rounded-md border border-border">
            <div className="flex items-center justify-between mb-1">
              <code className="text-sm font-mono bg-primary/10 text-primary px-2 py-1 rounded">{j.code}</code>
              <StatusBadge variant="success">{j.status}</StatusBadge>
            </div>
            <p className="font-medium text-sm">{j.label}</p>
            <p className="text-xs text-muted-foreground">{j.journalType}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ============================================================
// Dialogs
// ============================================================

function CreateInvoiceDialog({
  open, onOpenChange, students, schoolId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  students: FinanceData['students']
  schoolId: string
}) {
  const [state, formAction, isPending] = useActionState(createInvoiceAction, null)
  const [lines, setLines] = React.useState([
    { description: 'Frais de scolarité', quantity: '1', unitPrice: '120000', discountRate: '0', taxRate: '0', productAccountNumber: '706200' },
  ])

  React.useEffect(() => {
    if (state?.ok) {
      toast.success(`Facture ${state.invoiceNumber} créée. Écriture ${state.entryId.slice(-8)} générée.`)
      onOpenChange(false)
    } else if (state && !state.ok) {
      toast.error(state.error)
    }
  }, [state, onOpenChange])

  const addLine = () => {
    setLines([...lines, { description: '', quantity: '1', unitPrice: '0', discountRate: '0', taxRate: '0', productAccountNumber: '706200' }])
  }
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i))
  const updateLine = (i: number, field: string, value: string) => {
    setLines(lines.map((l, idx) => idx === i ? { ...l, [field]: value } : l))
  }

  // Calculer le total TTC à afficher en live
  const computedTotal = lines.reduce((sum, l) => {
    const qty = parseFloat(l.quantity) || 0
    const price = parseFloat(l.unitPrice) || 0
    const disc = parseFloat(l.discountRate) || 0
    const tax = parseFloat(l.taxRate) || 0
    const gross = qty * price
    const net = gross * (1 - disc / 100)
    const ttc = net * (1 + tax / 100)
    return sum + ttc
  }, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle facture</DialogTitle>
          <DialogDescription>
            La facture sera enregistrée et son écriture comptable en double entrée sera générée automatiquement.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="schoolId" value={schoolId} />
          <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
          <input type="hidden" name="lines" value={JSON.stringify(lines)} />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="studentId">Élève</Label>
              <Select name="studentId" required>
                <SelectTrigger><SelectValue placeholder="Sélectionnez un élève" /></SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.firstName} {s.lastName} ({s.enrollments[0]?.classroom.name || '—'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Date d'échéance</Label>
              <Input id="dueDate" name="dueDate" type="date" required defaultValue={new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Lignes de facture</Label>
              <Button type="button" size="sm" variant="outline" onClick={addLine}>
                <Plus className="h-3 w-3 mr-1" />Ajouter une ligne
              </Button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-12 gap-1 items-center p-2 border border-border rounded-md">
                  <Input
                    className="col-span-12 sm:col-span-3"
                    placeholder="Description"
                    value={line.description}
                    onChange={(e) => updateLine(i, 'description', e.target.value)}
                    required
                  />
                  <Input
                    className="col-span-3 sm:col-span-1"
                    type="number" step="0.01" min="0"
                    placeholder="Qté"
                    value={line.quantity}
                    onChange={(e) => updateLine(i, 'quantity', e.target.value)}
                    required
                  />
                  <Input
                    className="col-span-4 sm:col-span-2"
                    type="number" step="0.01" min="0"
                    placeholder="Prix"
                    value={line.unitPrice}
                    onChange={(e) => updateLine(i, 'unitPrice', e.target.value)}
                    required
                  />
                  <Input
                    className="col-span-2 sm:col-span-1"
                    type="number" step="0.01" min="0" max="100"
                    placeholder="Rem%"
                    value={line.discountRate}
                    onChange={(e) => updateLine(i, 'discountRate', e.target.value)}
                  />
                  <Input
                    className="col-span-2 sm:col-span-1"
                    type="number" step="0.01" min="0" max="100"
                    placeholder="Tax%"
                    value={line.taxRate}
                    onChange={(e) => updateLine(i, 'taxRate', e.target.value)}
                  />
                  <Select
                    value={line.productAccountNumber}
                    onValueChange={(v) => updateLine(i, 'productAccountNumber', v)}
                  >
                    <SelectTrigger className="col-span-3 sm:col-span-3">
                      <SelectValue placeholder="Compte" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="706100">706100 — Inscriptions</SelectItem>
                      <SelectItem value="706200">706200 — Scolarité</SelectItem>
                      <SelectItem value="706300">706300 — Transport</SelectItem>
                      <SelectItem value="706400">706400 — Cantine</SelectItem>
                      <SelectItem value="706500">706500 — Location salles</SelectItem>
                      <SelectItem value="706600">706600 — Location véhicules</SelectItem>
                    </SelectContent>
                  </Select>
                  {lines.length > 1 && (
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeLine(i)} className="col-span-1">
                      <XCircle className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
              <span className="text-sm font-medium">Total TTC (aperçu) :</span>
              <span className="text-lg font-semibold">{formatCents(Math.round(computedTotal * 100), 'CDF')}</span>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Créer la facture
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RecordPaymentDialog({
  open, onOpenChange, invoices, selectedInvoiceId, onSelectInvoice,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  invoices: FinanceData['invoices']
  selectedInvoiceId: string
  onSelectInvoice: (id: string) => void
}) {
  const [state, formAction, isPending] = useActionState(recordPaymentAction, null)

  React.useEffect(() => {
    if (state?.ok) {
      toast.success(`Paiement ${state.receiptNumber} enregistré. Statut facture : ${state.invoiceStatus}.`)
      onOpenChange(false)
    } else if (state && !state.ok) {
      toast.error(state.error)
    }
  }, [state, onOpenChange])

  const selectedInvoice = invoices.find((i) => i.id === selectedInvoiceId)
  const remaining = selectedInvoice
    ? selectedInvoice.totalAmountCents - selectedInvoice.paidAmountCents
    : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Encaissement</DialogTitle>
          <DialogDescription>
            L'encaissement sera enregistré et son écriture comptable générée automatiquement.
            Tout paiement validé est immuable : pour corriger, il faudra émettre un avoir.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />

          <div className="space-y-2">
            <Label htmlFor="invoiceId">Facture</Label>
            <Select name="invoiceId" value={selectedInvoiceId} onValueChange={onSelectInvoice} required>
              <SelectTrigger><SelectValue placeholder="Sélectionnez une facture impayée" /></SelectTrigger>
              <SelectContent>
                {invoices.map((inv) => (
                  <SelectItem key={inv.id} value={inv.id}>
                    {inv.invoiceNumber} — {inv.student ? `${inv.student.firstName} ${inv.student.lastName}` : '—'} — reste {formatCents(inv.totalAmountCents - inv.paidAmountCents, inv.currency)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedInvoice && (
            <div className="p-3 bg-muted/40 rounded-md text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Total facture :</span><span className="font-medium">{formatCents(selectedInvoice.totalAmountCents, selectedInvoice.currency)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Déjà payé :</span><span className="font-medium text-emerald-600 dark:text-emerald-400">{formatCents(selectedInvoice.paidAmountCents, selectedInvoice.currency)}</span></div>
              <Separator className="my-1" />
              <div className="flex justify-between"><span className="text-muted-foreground">Reste à encaisser :</span><span className="font-bold text-red-600 dark:text-red-400">{formatCents(remaining, selectedInvoice.currency)}</span></div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="amount">Montant encaissé</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                defaultValue={selectedInvoice ? (remaining / 100).toString() : ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="method">Méthode</Label>
              <Select name="method" defaultValue="CASH">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payerName">Nom du payeur (optionnel)</Label>
            <Input id="payerName" name="payerName" placeholder="Ex: Jean Mbumba" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={isPending || !selectedInvoiceId}>
              {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Valider l'encaissement
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CancelPaymentDialog({
  open, onOpenChange, paymentId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  paymentId: string
}) {
  const [state, formAction, isPending] = useActionState(cancelPaymentAction, null)

  React.useEffect(() => {
    if (state?.ok) {
      toast.success('Paiement annulé. Un avoir a été généré avec son écriture d\'inversion.')
      onOpenChange(false)
    } else if (state && !state.ok) {
      toast.error(state.error)
    }
  }, [state, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Annuler un paiement (émettre un avoir)</DialogTitle>
          <DialogDescription>
            Conformément au §3.11.9, le paiement original ne sera pas supprimé : il sera
            marqué comme annulé et une écriture d'inversion sera générée (Débit ↔ Crédit).
            Le solde de la facture sera restauré en conséquence.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="paymentId" value={paymentId} />
          <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />

          <div className="space-y-2">
            <Label htmlFor="reason">Motif d'annulation</Label>
            <Textarea
              id="reason"
              name="reason"
              rows={4}
              required
              minLength={5}
              placeholder="Ex : Erreur de saisie du montant. Le client a payé deux fois. Chèque sans provision."
            />
            <p className="text-xs text-muted-foreground">
              Le motif sera journalisé dans l'audit et apparaîtra sur l'écriture d'inversion.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Retour</Button>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
              Confirmer l'annulation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
