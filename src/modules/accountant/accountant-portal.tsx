'use client'

import * as React from 'react'
import { useActionState } from 'react'
import { AppShell, NavSection } from '@/components/ss/app-shell'
import { PageHeader } from '@/components/ss/page-header'
import { StatCard } from '@/components/ss/stat-card'
import { StatusBadge } from '@/components/ss/status-badge'
import { EmptyState } from '@/components/ss/empty-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Home, Receipt, FileText, AlertTriangle, TrendingUp, Wallet,
  Bell, Mail, Users, CheckCircle2, User, Settings, Search,
} from 'lucide-react'
import { logoutAction } from '@/lib/actions'
import { recordEncashmentAction } from '@/lib/finance-encashment-actions'
import { formatCents, formatDate, formatRelative } from '@/lib/format'
import { toast } from 'sonner'
import { ProfilePage, type ProfileData } from '@/modules/shared/profile-page'
import { AccountantFullPortal } from './accountant-full-portal'

type AccountantData = NonNullable<Awaited<ReturnType<typeof import('@/lib/accountant-portal-queries').getAccountantPortalData>>>

export function AccountantPortal({
  user, schoolName, data, profileData,
}: {
  user: { displayName: string; role: string; email: string }
  schoolName: string
  data: AccountantData
  profileData?: ProfileData
}) {
  const [view, setView] = React.useState('dashboard')
  const [tab, setTab] = React.useState('encashments')

  const sections: NavSection[] = [{
    id: 'main', label: 'Portail Comptable',
    items: [
      { key: 'dashboard', label: 'Tableau de bord', icon: <Home className="h-4 w-4" /> },
      { key: 'full', label: 'Module Comptable ERP', icon: <Settings className="h-4 w-4" /> },
      { key: 'encash', label: 'Encaissements (legacy)', icon: <Receipt className="h-4 w-4" /> },
      { key: 'lines', label: 'Lignes de frais (legacy)', icon: <FileText className="h-4 w-4" /> },
      { key: 'alerts', label: 'Élèves en litige', icon: <AlertTriangle className="h-4 w-4" />, badge: data.pendingStudents.length },
      { key: 'notifications', label: 'Notifications', icon: <Mail className="h-4 w-4" /> },
      { key: 'profile', label: 'Mon profil', icon: <User className="h-4 w-4" /> },
    ],
  }]

  return (
    <AppShell
      user={user} schoolName={schoolName} unreadNotifications={0}
      sections={sections} activeView={view} onNavigate={setView}
      onLogout={logoutAction}
      onOpenNotifications={() => setView('notifications')}
      onOpenSearch={() => toast.info('Recherche à venir')}
      sidebarFooter={<div><p>{schoolName}</p><p className="text-[10px]">Comptable</p></div>}
    >
      {view === 'dashboard' && (
        <div className="space-y-6">
          <PageHeader title="Tableau de bord comptable" breadcrumbs={[{ label: 'Comptable' }]} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total encaissé" value={formatCents(data.stats.totalCollectedCents, 'CDF')} icon={<TrendingUp className="h-5 w-5" />} tone="success" />
            <StatCard label="Encaissements" value={data.stats.totalEncashments} icon={<Receipt className="h-5 w-5" />} tone="primary" />
            <StatCard label="Lignes de frais" value={data.invoiceLineConfigs.length} icon={<FileText className="h-5 w-5" />} tone="info" />
            <StatCard label="En litige" value={data.stats.pendingCount} icon={<AlertTriangle className="h-5 w-5" />} tone={data.stats.pendingCount > 0 ? 'danger' : 'success'} />
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Derniers encaissements</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {data.recentEncashments.length === 0 ? <EmptyState title="Aucun encaissement" /> : (
                data.recentEncashments.slice(0, 10).map((e) => (
                  <div key={e.id} className="flex items-center justify-between text-sm p-2 rounded-md border border-border">
                    <div><p className="font-medium">{e.receiptNumber}</p><p className="text-xs text-muted-foreground">{e.lineName} · {e.studentName}</p></div>
                    <div className="text-right"><p className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCents(e.amountCents, 'CDF')}</p><p className="text-xs text-muted-foreground">{formatDate(e.encashedAt)}</p></div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
      {view === 'full' && <AccountantFullPortal />}
      {view === 'encash' && (
        <div className="space-y-6">
          <PageHeader title="Encaissements" description="Validez un encaissement contre une ligne de frais existante" breadcrumbs={[{ label: 'Comptable' }, { label: 'Encaissements' }]} />
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList><TabsTrigger value="encashments">Historique</TabsTrigger><TabsTrigger value="new">Nouvel encaissement</TabsTrigger></TabsList>
            <TabsContent value="encashments">
              <Card><CardContent className="space-y-2">
                {data.recentEncashments.length === 0 ? <EmptyState title="Aucun encaissement" /> : (
                  data.recentEncashments.map((e) => (
                    <div key={e.id} className="flex items-center justify-between p-3 rounded-md border border-border">
                      <div><p className="text-sm font-medium">{e.receiptNumber}</p><p className="text-xs text-muted-foreground">{e.lineName} · {e.studentName} · {e.paymentMethod}</p></div>
                      <div className="text-right"><p className="font-semibold">{formatCents(e.amountCents, 'CDF')}</p><StatusBadge variant={e.status === 'CONFIRMED' ? 'success' : 'danger'}>{e.status}</StatusBadge></div>
                    </div>
                  ))
                )}
              </CardContent></Card>
            </TabsContent>
            <TabsContent value="new">
              <NewEncashmentForm invoiceLineConfigs={data.invoiceLineConfigs} students={data.students} />
            </TabsContent>
          </Tabs>
        </div>
      )}
      {view === 'lines' && (
        <div className="space-y-6">
          <PageHeader title="Lignes de frais" description="Configurées par le Directeur. Le comptable ne peut qu'encaisser." breadcrumbs={[{ label: 'Comptable' }, { label: 'Lignes de frais' }]} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.invoiceLineConfigs.map((l) => (
              <Card key={l.id}><CardContent className="p-4">
                <div className="flex items-center justify-between mb-2"><StatusBadge variant={l.isMandatory ? 'danger' : 'default'}>{l.isMandatory ? 'Obligatoire' : 'Optionnel'}</StatusBadge><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{l.code}</code></div>
                <p className="font-semibold">{l.name}</p>
                <p className="text-2xl font-bold text-primary mt-1">{formatCents(l.amountCents, 'CDF')}</p>
                <p className="text-xs text-muted-foreground mt-1">{l.directorateName}{l.period && ` · ${l.period}`}</p>
              </CardContent></Card>
            ))}
          </div>
        </div>
      )}
      {view === 'alerts' && (
        <div className="space-y-6">
          <PageHeader title="Élèves en litige de paiement" description="Statut bloqué — alerte automatique envoyée aux professeurs" breadcrumbs={[{ label: 'Comptable' }, { label: 'Litiges' }]} />
          <Card><CardContent className="space-y-2">
            {data.pendingStudents.length === 0 ? <EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title="Aucun litige" description="Tous les élèves sont à jour" /> : (
              data.pendingStudents.map((p) => (
                <div key={p.studentId} className="flex items-center justify-between p-3 rounded-md border border-border">
                  <div><p className="text-sm font-medium">{p.studentName}</p><p className="text-xs text-muted-foreground">{p.classroomName} · {p.directorateName}</p></div>
                  <div className="text-right"><StatusBadge variant="danger">{p.status}</StatusBadge><p className="text-xs text-muted-foreground mt-1">{p.reason}</p></div>
                </div>
              ))
            )}
          </CardContent></Card>
        </div>
      )}
      {view === 'notifications' && <div className="space-y-6"><PageHeader title="Notifications" breadcrumbs={[{ label: 'Comptable' }, { label: 'Notifications' }]} /><Card><CardContent className="py-12"><EmptyState icon={<Mail className="h-5 w-5" />} title="Aucune notification" /></CardContent></Card></div>}
      {view === 'profile' && profileData && <ProfilePage data={profileData} onBack={() => setView('dashboard')} />}
    </AppShell>
  )
}

// =====================================================
// Formulaire Nouvel Encaissement avec sélection d'élève
// =====================================================

interface StudentOption {
  id: string
  matricule: string
  displayName: string
  classroomName: string
  directorateName: string
}

interface NewEncashmentFormProps {
  invoiceLineConfigs: Array<{ id: string; name: string; code: string; amountCents: number; directorateName: string }>
  students: StudentOption[]
}

function NewEncashmentForm({ invoiceLineConfigs, students }: NewEncashmentFormProps) {
  const [state, formAction, isPending] = useActionState(recordEncashmentAction, { ok: true, receiptNumber: '', encashmentId: '' })
  const [search, setSearch] = React.useState('')
  const [selectedStudent, setSelectedStudent] = React.useState<StudentOption | null>(null)
  const [lineId, setLineId] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [method, setMethod] = React.useState('CASH')
  const [payerName, setPayerName] = React.useState('')

  // Réagir au résultat de l'action
  React.useEffect(() => {
    if (!state) return
    if (state.ok === true && state.receiptNumber) {
      toast.success(`Encaissement validé — Reçu ${state.receiptNumber}`)
      // Reset form
      setSelectedStudent(null)
      setLineId('')
      setAmount('')
      setPayerName('')
    } else if (state.ok === false) {
      toast.error(state.error)
    }
  }, [state])

  const filteredStudents = students.filter(s =>
    s.displayName.toLowerCase().includes(search.toLowerCase()) ||
    s.matricule.toLowerCase().includes(search.toLowerCase()) ||
    s.classroomName.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 50)

  const selectedLine = invoiceLineConfigs.find(l => l.id === lineId)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Nouvel encaissement</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {/* 1. Ligne de frais (obligatoire) */}
          <div className="space-y-2">
            <Label>Ligne de frais *</Label>
            <Select name="invoiceLineConfigId" value={lineId} onValueChange={setLineId} required>
              <SelectTrigger><SelectValue placeholder="Sélectionner une ligne de frais" /></SelectTrigger>
              <SelectContent>
                {invoiceLineConfigs.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name} — {formatCents(l.amountCents, 'CDF')} ({l.directorateName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedLine && (
              <p className="text-xs text-muted-foreground">
                Montant par défaut : {formatCents(selectedLine.amountCents, 'CDF')} · Code : {selectedLine.code}
              </p>
            )}
          </div>

          {/* 2. Élève concerné — nouvelle section recherche */}
          <div className="space-y-2 border-t pt-4">
            <Label>Élève concerné *</Label>
            <input type="hidden" name="studentId" value={selectedStudent?.id || ''} />

            {selectedStudent ? (
              <div className="flex items-center justify-between p-3 bg-primary/5 rounded-md border border-primary/20">
                <div>
                  <p className="font-medium text-sm">{selectedStudent.displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    Matricule : <span className="font-mono">{selectedStudent.matricule}</span> · {selectedStudent.classroomName} · {selectedStudent.directorateName}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedStudent(null)}
                >
                  Changer
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par nom, matricule ou classe..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
                {search && (
                  <div className="max-h-64 overflow-y-auto border rounded-md divide-y">
                    {filteredStudents.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground text-center">Aucun élève trouvé</div>
                    ) : (
                      filteredStudents.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => { setSelectedStudent(s); setSearch('') }}
                          className="w-full text-left p-2 hover:bg-muted/50 transition-colors flex items-center justify-between"
                        >
                          <div>
                            <p className="text-sm font-medium">{s.displayName}</p>
                            <p className="text-xs text-muted-foreground">{s.classroomName} · {s.directorateName}</p>
                          </div>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{s.matricule}</code>
                        </button>
                      ))
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  💡 Tapez le nom, matricule ou classe de l'élève puis cliquez pour le sélectionner.
                </p>
              </div>
            )}
          </div>

          {/* 3. Montant (pré-rempli avec la ligne) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="amount">Montant (CDF) *</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                placeholder="50000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              {selectedLine && (
                <button
                  type="button"
                  onClick={() => setAmount(String(selectedLine.amountCents / 100))}
                  className="text-xs text-primary hover:underline"
                >
                  Utiliser le montant par défaut ({formatCents(selectedLine.amountCents, 'CDF')})
                </button>
              )}
            </div>
            <div className="space-y-2">
              <Label>Méthode de paiement *</Label>
              <input type="hidden" name="paymentMethod" value={method} />
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Espèces</SelectItem>
                  <SelectItem value="BANK">Banque</SelectItem>
                  <SelectItem value="MOBILE_MONEY">Mobile Money</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 4. Payeur (optionnel) */}
          <div className="space-y-2">
            <Label htmlFor="payerName">Nom du payeur (optionnel)</Label>
            <Input
              id="payerName"
              name="payerName"
              placeholder="Jean Mbumba"
              value={payerName}
              onChange={(e) => setPayerName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Si différent de l'élève (ex : parent, tuteur).
            </p>
          </div>

          <Button
            type="submit"
            disabled={isPending || !lineId || !selectedStudent || !amount}
            className="w-full"
          >
            <Receipt className="h-4 w-4 mr-2" />
            {isPending ? 'Validation...' : 'Valider l\'encaissement'}
          </Button>

          {!selectedStudent && (
            <p className="text-xs text-amber-600 text-center">
              ⚠️ Sélectionnez l'élève concerné avant de valider
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
