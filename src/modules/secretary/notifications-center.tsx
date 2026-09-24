'use client'

// SmartShule — Centre Notifications (SMS / WhatsApp / Email / App)
// ============================================================
// Vue DataGrid premium avec :
//   - File d'attente
//   - Historique
//   - Modèles
//   - Consentements
//   - Configuration Twilio
//   - Sandbox mode

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/ss/page-header'
import { DataGrid, type DataGridColumn } from '@/components/ss/data-grid'
import {
  Loader2, Send, Plus, Settings, MessageSquare, Bell, AlertCircle,
  CheckCircle2, XCircle, Clock, RefreshCw, Phone, Mail, Smartphone,
  Trash2, Eye, RotateCcw, Power,
} from 'lucide-react'
import { toast } from 'sonner'

type NotificationLog = {
  id: string
  templateCode: string
  senderName: string
  senderRole: string
  recipientName: string
  recipientPhone: string | null
  recipientEmail: string | null
  channel: string
  priority: string
  status: string
  attempts: number
  maxAttempts: number
  errorCode: string | null
  errorMessage: string | null
  isSandbox: boolean
  providerName: string | null
  createdAt: string
  deliveredAt: string | null
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-blue-100 text-blue-700',
  QUEUED: 'bg-blue-100 text-blue-700',
  SENT: 'bg-emerald-100 text-emerald-700',
  DELIVERED: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-red-100 text-red-700',
  REJECTED: 'bg-orange-100 text-orange-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  SMS: <Smartphone className="h-3 w-3" />,
  WHATSAPP: <Phone className="h-3 w-3" />,
  EMAIL: <Mail className="h-3 w-3" />,
  APP: <Bell className="h-3 w-3" />,
}

export function NotificationsCenter() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Centre Notifications"
        description="SMS · WhatsApp · Email · App — File async, consentement, traçabilité"
        breadcrumbs={[{ label: 'Secrétariat' }, { label: 'Notifications' }]}
      />

      <Tabs defaultValue="logs">
        <TabsList>
          <TabsTrigger value="logs"><Bell className="h-4 w-4 mr-1" /> Journal</TabsTrigger>
          <TabsTrigger value="send"><Send className="h-4 w-4 mr-1" /> Envoyer</TabsTrigger>
          <TabsTrigger value="templates"><MessageSquare className="h-4 w-4 mr-1" /> Modèles</TabsTrigger>
          <TabsTrigger value="consents"><CheckCircle2 className="h-4 w-4 mr-1" /> Consentements</TabsTrigger>
          <TabsTrigger value="config"><Settings className="h-4 w-4 mr-1" /> Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="logs"><LogsPanel /></TabsContent>
        <TabsContent value="send"><SendPanel /></TabsContent>
        <TabsContent value="templates"><TemplatesPanel /></TabsContent>
        <TabsContent value="consents"><ConsentsPanel /></TabsContent>
        <TabsContent value="config"><ConfigPanel /></TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================================
// Panneau Journal
// ============================================================

function LogsPanel() {
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('')
  const [channelFilter, setChannelFilter] = React.useState('')

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (statusFilter) params.set('status', statusFilter)
      if (channelFilter) params.set('channel', channelFilter)
      if (search) params.set('search', search)
      const res = await fetch(`/api/notifications/log?${params}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.ok) setData(json)
    } catch (err) {
      toast.error('Erreur : ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter, channelFilter])

  React.useEffect(() => { loadData() }, [loadData])

  async function cancelNotification(id: string) {
    if (!confirm('Annuler cette notification ?')) return
    try {
      const res = await fetch('/api/notifications/log', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', logId: id }),
      })
      const json = await res.json()
      if (json.ok) { toast.success('Annulée'); loadData() }
      else toast.error(json.error)
    } catch (err) { toast.error('Erreur : ' + (err as Error).message) }
  }

  async function retryNotification(id: string) {
    try {
      const res = await fetch('/api/notifications/log', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry', logId: id }),
      })
      const json = await res.json()
      if (json.ok) { toast.success('Relancée'); loadData() }
      else toast.error(json.error)
    } catch (err) { toast.error('Erreur : ' + (err as Error).message) }
  }

  const logs: NotificationLog[] = data?.logs || []
  const stats = data?.stats
  const pagination = data?.pagination

  const columns: DataGridColumn<NotificationLog>[] = [
    { key: 'createdAt', header: 'Date', type: 'date', sortable: true, width: 130, frozen: true },
    { key: 'templateCode', header: 'Modèle', sortable: true, width: 180 },
    { key: 'recipientName', header: 'Destinataire', sortable: true, searchable: true, width: 150 },
    { key: 'channel', header: 'Canal', width: 100, render: (r) => (
      <Badge variant="outline" className="text-xs flex items-center gap-1 w-fit">
        {CHANNEL_ICONS[r.channel]} {r.channel}
      </Badge>
    )},
    { key: 'priority', header: 'Priorité', width: 100, render: (r) => (
      <Badge variant="outline" className={`text-xs ${r.priority === 'CRITICAL' ? 'border-red-300 text-red-700' : r.priority === 'URGENT' ? 'border-orange-300 text-orange-700' : ''}`}>
        {r.priority}
      </Badge>
    )},
    { key: 'status', header: 'Statut', type: 'status', statusColors: STATUS_COLORS, width: 120 },
    { key: 'attempts', header: 'Tentatives', type: 'number', width: 90, render: (r) => `${r.attempts}/${r.maxAttempts}` },
    { key: 'errorMessage', header: 'Erreur', render: (r) => r.errorMessage ? (
      <span className="text-xs text-red-600 truncate block max-w-xs" title={r.errorMessage}>{r.errorMessage}</span>
    ) : '—' },
    { key: 'isSandbox', header: 'Mode', width: 80, render: (r) => r.isSandbox ? <Badge className="bg-amber-100 text-amber-700 text-xs">Sandbox</Badge> : <Badge className="bg-emerald-100 text-emerald-700 text-xs">Prod</Badge> },
  ]

  return (
    <div className="space-y-4">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="En attente" value={stats.pending} color="blue" icon={<Clock className="h-4 w-4" />} />
          <StatCard label="Envoyées" value={stats.sent} color="green" icon={<CheckCircle2 className="h-4 w-4" />} />
          <StatCard label="Échouées" value={stats.failed} color="red" icon={<XCircle className="h-4 w-4" />} />
          <StatCard label="Rejetées" value={stats.rejected} color="orange" icon={<AlertCircle className="h-4 w-4" />} />
          <StatCard label="Total" value={stats.total} color="gray" icon={<Bell className="h-4 w-4" />} />
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Tous statuts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="PENDING">En attente</SelectItem>
            <SelectItem value="SENT">Envoyées</SelectItem>
            <SelectItem value="FAILED">Échouées</SelectItem>
            <SelectItem value="REJECTED">Rejetées</SelectItem>
            <SelectItem value="CANCELLED">Annulées</SelectItem>
          </SelectContent>
        </Select>
        <Select value={channelFilter} onValueChange={(v) => { setChannelFilter(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Tous canaux" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous canaux</SelectItem>
            <SelectItem value="SMS">SMS</SelectItem>
            <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
            <SelectItem value="EMAIL">Email</SelectItem>
            <SelectItem value="APP">App</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tableau */}
      <DataGrid
        columns={columns}
        data={logs}
        rowKey={(r) => r.id}
        loading={loading}
        enableSearch
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        pagination={pagination ? {
          page: pagination.page, limit: pagination.limit,
          total: pagination.total, pages: pagination.pages,
          onPageChange: setPage,
        } : undefined}
        rowActions={(row) => (
          <div className="flex justify-end gap-1">
            {row.status === 'PENDING' && (
              <Button size="sm" variant="ghost" onClick={() => cancelNotification(row.id)} title="Annuler">
                <XCircle className="h-4 w-4 text-red-500" />
              </Button>
            )}
            {row.status === 'FAILED' && (
              <Button size="sm" variant="ghost" onClick={() => retryNotification(row.id)} title="Réessayer">
                <RotateCcw className="h-4 w-4 text-blue-500" />
              </Button>
            )}
          </div>
        )}
      />
    </div>
  )
}

// ============================================================
// Panneau Envoyer
// ============================================================

function SendPanel() {
  const [templates, setTemplates] = React.useState<any[]>([])
  const [form, setForm] = React.useState({
    templateCode: '', recipientId: '', recipientName: '', recipientPhone: '', recipientEmail: '',
    channel: '', priority: 'NORMAL', studentId: '', relatedType: '', relatedId: '',
    studentName: '', variables: '{}',
  })
  const [sending, setSending] = React.useState(false)

  React.useEffect(() => {
    fetch('/api/notifications/templates', { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => { if (json.ok) setTemplates(json.templates) })
      .catch(() => toast.error('Erreur chargement modèles'))
  }, [])

  const selectedTemplate = templates.find((t) => t.code === form.templateCode)

  async function send() {
    if (!form.templateCode || !form.recipientName) {
      toast.error('Modèle et destinataire requis')
      return
    }
    setSending(true)
    try {
      let variables: Record<string, any> = {}
      try { variables = JSON.parse(form.variables) } catch {}
      if (form.studentName) variables.studentName = form.studentName

      const res = await fetch('/api/notifications/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          variables,
        }),
      })
      const json = await res.json()
      if (json.ok) {
        toast.success(`Notification ${json.status}: ${json.message}`)
        setForm({
          templateCode: '', recipientId: '', recipientName: '', recipientPhone: '', recipientEmail: '',
          channel: '', priority: 'NORMAL', studentId: '', relatedType: '', relatedId: '',
          studentName: '', variables: '{}',
        })
      } else {
        toast.error(json.error)
      }
    } catch (err) {
      toast.error('Erreur : ' + (err as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader><CardTitle className="text-base">Envoyer une notification</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>Modèle</Label>
          <Select value={form.templateCode} onValueChange={(v) => setForm({ ...form, templateCode: v })}>
            <SelectTrigger><SelectValue placeholder="Sélectionner un modèle" /></SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.code}>
                  {t.name} <span className="text-xs text-muted-foreground">({t.category})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedTemplate && (
          <div className="p-3 bg-muted/40 rounded-md border text-xs space-y-2">
            <div><strong>Canaux supportés:</strong> {selectedTemplate.channels.join(', ')}</div>
            {selectedTemplate.variablesDoc.length > 0 && (
              <div><strong>Variables:</strong> {selectedTemplate.variablesDoc.map((v: string) => `{{${v}}}`).join(' ')}</div>
            )}
            {selectedTemplate.templateSms && (
              <div><strong>Aperçu SMS:</strong> {selectedTemplate.templateSms}</div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Nom destinataire *</Label>
            <Input value={form.recipientName} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} />
          </div>
          <div>
            <Label>Téléphone</Label>
            <Input value={form.recipientPhone} onChange={(e) => setForm({ ...form, recipientPhone: e.target.value })} placeholder="+243812345678" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.recipientEmail} onChange={(e) => setForm({ ...form, recipientEmail: e.target.value })} />
          </div>
          <div>
            <Label>Canal (auto si vide)</Label>
            <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v === 'auto' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="Auto (préféré)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (préféré)</SelectItem>
                {selectedTemplate?.channels.includes('SMS') && <SelectItem value="SMS">SMS</SelectItem>}
                {selectedTemplate?.channels.includes('WHATSAPP') && <SelectItem value="WHATSAPP">WhatsApp</SelectItem>}
                {selectedTemplate?.channels.includes('EMAIL') && <SelectItem value="EMAIL">Email</SelectItem>}
                {selectedTemplate?.channels.includes('APP') && <SelectItem value="APP">App</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Priorité</Label>
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Basse</SelectItem>
                <SelectItem value="NORMAL">Normale</SelectItem>
                <SelectItem value="URGENT">Urgente</SelectItem>
                <SelectItem value="CRITICAL">Critique</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nom élève (si applicable)</Label>
            <Input value={form.studentName} onChange={(e) => setForm({ ...form, studentName: e.target.value })} />
          </div>
        </div>

        <div>
          <Label>Variables (JSON, optionnel)</Label>
          <Textarea
            rows={3}
            value={form.variables}
            onChange={(e) => setForm({ ...form, variables: e.target.value })}
            placeholder='{"reference": "ADM-2026-001", "date": "2026-09-25"}'
            className="font-mono text-xs"
          />
        </div>

        {selectedTemplate?.requiresConsent && (
          <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
            ⚠️ Ce modèle nécessite le consentement explicite du destinataire. L'envoi sera rejeté si aucun consentement n'est enregistré.
          </div>
        )}

        <Button onClick={send} disabled={sending} className="w-full">
          {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          Envoyer
        </Button>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Panneau Modèles
// ============================================================

function TemplatesPanel() {
  const [templates, setTemplates] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [showEdit, setShowEdit] = React.useState(false)
  const [editForm, setEditForm] = React.useState<any>(null)

  const loadTemplates = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications/templates', { cache: 'no-store' })
      const json = await res.json()
      if (json.ok) setTemplates(json.templates)
    } finally { setLoading(false) }
  }, [])

  React.useEffect(() => { loadTemplates() }, [loadTemplates])

  async function toggleActive(t: any) {
    try {
      const res = await fetch('/api/notifications/templates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle-active', id: t.id, isActive: !t.isActive }),
      })
      const json = await res.json()
      if (json.ok) { toast.success('Mis à jour'); loadTemplates() }
      else toast.error(json.error)
    } catch (err) { toast.error('Erreur : ' + (err as Error).message) }
  }

  const columns: DataGridColumn<any>[] = [
    { key: 'code', header: 'Code', width: 200, frozen: true, searchable: true },
    { key: 'name', header: 'Nom', width: 200, searchable: true },
    { key: 'category', header: 'Catégorie', width: 130, render: (t) => <Badge variant="outline" className="text-xs">{t.category}</Badge> },
    { key: 'channels', header: 'Canaux', width: 180, render: (t) => (
      <div className="flex gap-1 flex-wrap">
        {t.channels.map((c: string) => <Badge key={c} variant="outline" className="text-xs">{c}</Badge>)}
      </div>
    )},
    { key: 'version', header: 'Version', width: 80, type: 'number' },
    { key: 'isActive', header: 'Statut', width: 90, render: (t) => t.isActive ? <Badge className="bg-emerald-100 text-emerald-700 text-xs">Actif</Badge> : <Badge className="bg-gray-100 text-gray-500 text-xs">Inactif</Badge> },
    { key: 'allowedRoles', header: 'Rôles autorisés', render: (t) => t.allowedRoles.join(', ') },
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <p className="text-sm text-muted-foreground">
          {templates.length} modèle(s) — gestion versionnée, RBAC par rôle, consentement configurable
        </p>
        <Button size="sm" onClick={() => { setEditForm({ code: '', name: '', category: 'GENERAL', channels: ['APP'], templateSms: '', templateWhatsapp: '', templateEmail: '', templateApp: '', templateEmailSubject: '', allowedRoles: ['SECRETARY'], requiresConsent: true }); setShowEdit(true) }}>
          <Plus className="h-4 w-4 mr-1" /> Nouveau modèle
        </Button>
      </div>

      <DataGrid
        columns={columns}
        data={templates}
        rowKey={(t) => t.id}
        loading={loading}
        enableSearch
        enableSelection={false}
        rowActions={(t) => (
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => { setEditForm(t); setShowEdit(true) }} title="Modifier">
              <Eye className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => toggleActive(t)} title={t.isActive ? 'Désactiver' : 'Activer'}>
              <Power className={`h-4 w-4 ${t.isActive ? 'text-emerald-500' : 'text-gray-400'}`} />
            </Button>
          </div>
        )}
      />

      {showEdit && (
        <Dialog open onOpenChange={setShowEdit}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editForm.id ? 'Modifier' : 'Créer'} un modèle</DialogTitle>
            </DialogHeader>
            <TemplateForm template={editForm} onSaved={() => { setShowEdit(false); loadTemplates() }} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function TemplateForm({ template, onSaved }: { template: any; onSaved: () => void }) {
  const [form, setForm] = React.useState(template)
  const [saving, setSaving] = React.useState(false)

  const allChannels = ['SMS', 'WHATSAPP', 'EMAIL', 'APP']
  const allCategories = ['ADMISSION', 'ATTENDANCE', 'PAYMENT', 'DOCUMENT', 'TRANSFER', 'SECURITY', 'URGENT', 'GENERAL', 'ENROLLMENT']
  const allRoles = ['SECRETARY', 'DIRECTION', 'ADMIN', 'TEACHER', 'ACCOUNTANT']

  async function save() {
    if (!form.code || !form.name) { toast.error('Code et nom requis'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/notifications/templates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: form.id ? 'update' : 'create', ...form, id: form.id }),
      })
      const json = await res.json()
      if (json.ok) { toast.success('Modèle enregistré'); onSaved() }
      else toast.error(json.error)
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Code</Label>
          <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} disabled={!!form.id} />
        </div>
        <div>
          <Label>Nom</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Catégorie</Label>
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{allCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Canaux</Label>
          <div className="flex gap-2 flex-wrap mt-2">
            {allChannels.map((c) => (
              <label key={c} className="flex items-center gap-1 text-sm">
                <Checkbox checked={form.channels.includes(c)} onCheckedChange={(checked) => {
                  const newCh = checked ? [...form.channels, c] : form.channels.filter((x: string) => x !== c)
                  setForm({ ...form, channels: newCh })
                }} />
                {c}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div>
        <Label>Sujet Email</Label>
        <Input value={form.templateEmailSubject || ''} onChange={(e) => setForm({ ...form, templateEmailSubject: e.target.value })} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Contenu SMS (max 160)</Label>
          <Textarea rows={2} maxLength={160} value={form.templateSms || ''} onChange={(e) => setForm({ ...form, templateSms: e.target.value })} className="text-xs" />
          <p className="text-xs text-muted-foreground">{(form.templateSms || '').length}/160</p>
        </div>
        <div>
          <Label>Contenu App</Label>
          <Textarea rows={2} value={form.templateApp || ''} onChange={(e) => setForm({ ...form, templateApp: e.target.value })} className="text-xs" />
        </div>
      </div>

      <div>
        <Label>Contenu WhatsApp</Label>
        <Textarea rows={2} value={form.templateWhatsapp || ''} onChange={(e) => setForm({ ...form, templateWhatsapp: e.target.value })} className="text-xs" />
      </div>

      <div>
        <Label>Contenu Email (HTML)</Label>
        <Textarea rows={3} value={form.templateEmail || ''} onChange={(e) => setForm({ ...form, templateEmail: e.target.value })} className="font-mono text-xs" />
      </div>

      <div>
        <Label>Rôles autorisés à déclencher</Label>
        <div className="flex gap-2 flex-wrap mt-2">
          {allRoles.map((r) => (
            <label key={r} className="flex items-center gap-1 text-sm">
              <Checkbox
                checked={form.allowedRoles.includes(r)}
                onCheckedChange={(checked) => {
                  const newR = checked ? [...form.allowedRoles, r] : form.allowedRoles.filter((x: string) => x !== r)
                  setForm({ ...form, allowedRoles: newR })
                }}
              />
              {r}
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch checked={form.requiresConsent} onCheckedChange={(c) => setForm({ ...form, requiresConsent: c })} />
        <Label>Consentement explicite requis</Label>
      </div>

      <DialogFooter>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
          Enregistrer
        </Button>
      </DialogFooter>
    </div>
  )
}

// ============================================================
// Panneau Consentements
// ============================================================

function ConsentsPanel() {
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [showAdd, setShowAdd] = React.useState(false)

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (search) params.set('search', search)
      const res = await fetch(`/api/notifications/consent?${params}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.ok) setData(json)
    } finally { setLoading(false) }
  }, [page, search])

  React.useEffect(() => { loadData() }, [loadData])

  const consents: any[] = data?.consents || []
  const pagination = data?.pagination

  const columns: DataGridColumn<any>[] = [
    { key: 'recipientName', header: 'Nom', searchable: true, width: 200, frozen: true },
    { key: 'recipientPhone', header: 'Téléphone', width: 150 },
    { key: 'recipientEmail', header: 'Email', width: 200 },
    { key: 'consentSms', header: 'SMS', width: 60, align: 'center', render: (c) => c.consentSms ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" /> : <XCircle className="h-4 w-4 text-gray-300 mx-auto" /> },
    { key: 'consentWhatsapp', header: 'WhatsApp', width: 90, align: 'center', render: (c) => c.consentWhatsapp ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" /> : <XCircle className="h-4 w-4 text-gray-300 mx-auto" /> },
    { key: 'consentEmail', header: 'Email', width: 70, align: 'center', render: (c) => c.consentEmail ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" /> : <XCircle className="h-4 w-4 text-gray-300 mx-auto" /> },
    { key: 'preferredChannel', header: 'Préféré', width: 100, render: (c) => <Badge variant="outline" className="text-xs">{c.preferredChannel}</Badge> },
    { key: 'consentDate', header: 'Date', type: 'date', width: 120 },
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <p className="text-sm text-muted-foreground">Gestion des consentements explicites RGPD</p>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1" /> Nouveau consentement</Button>
      </div>

      <DataGrid
        columns={columns}
        data={consents}
        rowKey={(c) => c.id}
        loading={loading}
        enableSearch
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        pagination={pagination ? {
          page: pagination.page, limit: pagination.limit,
          total: pagination.total, pages: pagination.pages,
          onPageChange: setPage,
        } : undefined}
      />

      {showAdd && (
        <Dialog open onOpenChange={setShowAdd}>
          <DialogContent>
            <DialogHeader><DialogTitle>Enregistrer un consentement</DialogTitle></DialogHeader>
            <ConsentForm onSaved={() => { setShowAdd(false); loadData() }} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function ConsentForm({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = React.useState({
    recipientName: '', recipientPhone: '', recipientEmail: '',
    consentSms: false, consentWhatsapp: false, consentEmail: false, consentApp: true,
    preferredChannel: 'APP', consentProof: '',
  })
  const [saving, setSaving] = React.useState(false)

  async function save() {
    if (!form.recipientName) { toast.error('Nom requis'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/notifications/consent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'record', ...form }),
      })
      const json = await res.json()
      if (json.ok) { toast.success('Consentement enregistré'); onSaved() }
      else toast.error(json.error)
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-3">
      <Input placeholder="Nom destinataire *" value={form.recipientName} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} />
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Téléphone (+243...)" value={form.recipientPhone} onChange={(e) => setForm({ ...form, recipientPhone: e.target.value })} />
        <Input placeholder="Email" value={form.recipientEmail} onChange={(e) => setForm({ ...form, recipientEmail: e.target.value })} />
      </div>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={form.consentSms} onCheckedChange={(c) => setForm({ ...form, consentSms: !!c })} /> SMS
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={form.consentWhatsapp} onCheckedChange={(c) => setForm({ ...form, consentWhatsapp: !!c })} /> WhatsApp
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={form.consentEmail} onCheckedChange={(c) => setForm({ ...form, consentEmail: !!c })} /> Email
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={form.consentApp} onCheckedChange={(c) => setForm({ ...form, consentApp: !!c })} /> App
        </label>
      </div>
      <Select value={form.preferredChannel} onValueChange={(v) => setForm({ ...form, preferredChannel: v })}>
        <SelectTrigger><SelectValue placeholder="Canal préféré" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="SMS">SMS</SelectItem>
          <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
          <SelectItem value="EMAIL">Email</SelectItem>
          <SelectItem value="APP">App</SelectItem>
        </SelectContent>
      </Select>
      <Textarea placeholder="Preuve du consentement (formulaire, date, signature...)" value={form.consentProof} onChange={(e) => setForm({ ...form, consentProof: e.target.value })} rows={2} />
      <Button onClick={save} disabled={saving} className="w-full">
        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
        Enregistrer
      </Button>
    </div>
  )
}

// ============================================================
// Panneau Configuration Twilio
// ============================================================

function ConfigPanel() {
  const [config, setConfig] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [form, setForm] = React.useState({
    accountSid: '', authToken: '', fromSmsNumber: '', fromWhatsappNumber: '',
    fromEmail: '', sandboxMode: true, sandboxWhitelist: [] as string[],
    rateLimitPerMin: 10, rateLimitPerDay: 500,
  })
  const [saving, setSaving] = React.useState(false)
  const [whitelistPhone, setWhitelistPhone] = React.useState('')

  const loadConfig = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications/config', { cache: 'no-store' })
      const json = await res.json()
      if (json.ok && json.config) {
        setConfig(json.config)
        setForm({
          accountSid: '', authToken: '',
          fromSmsNumber: json.config.fromSmsNumber || '',
          fromWhatsappNumber: json.config.fromWhatsappNumber || '',
          fromEmail: json.config.fromEmail || '',
          sandboxMode: json.config.sandboxMode,
          sandboxWhitelist: json.config.sandboxWhitelist || [],
          rateLimitPerMin: json.config.rateLimitPerMin,
          rateLimitPerDay: json.config.rateLimitPerDay,
        })
      }
    } finally { setLoading(false) }
  }, [])

  React.useEffect(() => { loadConfig() }, [loadConfig])

  async function save() {
    if (!form.accountSid && !config?.hasCredentials) {
      toast.error('Account SID et Auth Token requis')
      return
    }
    setSaving(true)
    try {
      const payload: any = { action: 'save-config', ...form }
      if (!form.accountSid) delete payload.accountSid
      if (!form.authToken) delete payload.authToken

      const res = await fetch('/api/notifications/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (json.ok) { toast.success(json.message); loadConfig() }
      else toast.error(json.error)
    } finally { setSaving(false) }
  }

  async function activateSandbox() {
    try {
      const res = await fetch('/api/notifications/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate-sandbox' }),
      })
      const json = await res.json()
      if (json.ok) { toast.success(json.message); loadConfig() }
      else toast.error(json.error)
    } catch (err) { toast.error('Erreur : ' + (err as Error).message) }
  }

  async function addToWhitelist() {
    if (!whitelistPhone) return
    try {
      const res = await fetch('/api/notifications/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add-whitelist', phone: whitelistPhone }),
      })
      const json = await res.json()
      if (json.ok) {
        setForm({ ...form, sandboxWhitelist: json.whitelist })
        setWhitelistPhone('')
        toast.success('Numéro ajouté')
      } else toast.error(json.error)
    } catch (err) { toast.error('Erreur : ' + (err as Error).message) }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  return (
    <div className="space-y-4 max-w-3xl">
      {!config && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">Aucune configuration Twilio</p>
              <p className="text-sm text-amber-700 mt-1">
                Activez le mode sandbox pour démarrer immédiatement. Les notifications seront simulées et journalisées.
              </p>
              <Button size="sm" className="mt-2" onClick={activateSandbox}>
                <Power className="h-4 w-4 mr-1" /> Activer sandbox
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Configuration Twilio</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {config?.hasCredentials && (
            <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-700">
              ✓ Credentials enregistrés (chiffrés AES-256-GCM)
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Account SID</Label>
              <Input value={form.accountSid} onChange={(e) => setForm({ ...form, accountSid: e.target.value })} placeholder={config?.hasCredentials ? '•••••••••••• (déjà enregistré)' : 'ACxxxxxxxxxxxxxxx'} type="password" />
            </div>
            <div>
              <Label>Auth Token</Label>
              <Input value={form.authToken} onChange={(e) => setForm({ ...form, authToken: e.target.value })} placeholder="••••••••••••" type="password" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Numéro SMS (E.164)</Label>
              <Input value={form.fromSmsNumber} onChange={(e) => setForm({ ...form, fromSmsNumber: e.target.value })} placeholder="+1234567890" />
            </div>
            <div>
              <Label>Numéro WhatsApp</Label>
              <Input value={form.fromWhatsappNumber} onChange={(e) => setForm({ ...form, fromWhatsappNumber: e.target.value })} placeholder="whatsapp:+1234567890" />
            </div>
          </div>

          <div>
            <Label>Email expéditeur</Label>
            <Input type="email" value={form.fromEmail} onChange={(e) => setForm({ ...form, fromEmail: e.target.value })} placeholder="ecole@smartshule.com" />
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={form.sandboxMode} onCheckedChange={(c) => setForm({ ...form, sandboxMode: c })} />
            <Label>Mode sandbox (simule les envois, ne facture pas Twilio)</Label>
          </div>

          {form.sandboxMode && (
            <div className="space-y-2 p-3 bg-muted/40 rounded border">
              <Label>Whitelist sandbox (numéros autorisés à recevoir en mode test)</Label>
              <div className="flex gap-2">
                <Input value={whitelistPhone} onChange={(e) => setWhitelistPhone(e.target.value)} placeholder="+243812345678" className="flex-1" />
                <Button size="sm" onClick={addToWhitelist}><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {form.sandboxWhitelist.map((p, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{p}</Badge>
                ))}
                {form.sandboxWhitelist.length === 0 && <span className="text-xs text-muted-foreground">Aucun numéro whitelisté</span>}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Limite / minute</Label>
              <Input type="number" value={form.rateLimitPerMin} onChange={(e) => setForm({ ...form, rateLimitPerMin: parseInt(e.target.value) || 10 })} />
            </div>
            <div>
              <Label>Limite / jour</Label>
              <Input type="number" value={form.rateLimitPerDay} onChange={(e) => setForm({ ...form, rateLimitPerDay: parseInt(e.target.value) || 500 })} />
            </div>
          </div>

          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Enregistrer la configuration
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// Composant StatCard
// ============================================================

function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  const colors: Record<string, string> = {
    blue: 'border-blue-200 bg-blue-50/50 text-blue-700',
    green: 'border-emerald-200 bg-emerald-50/50 text-emerald-700',
    red: 'border-red-200 bg-red-50/50 text-red-700',
    orange: 'border-orange-200 bg-orange-50/50 text-orange-700',
    gray: 'border-gray-200 bg-gray-50/50 text-gray-700',
  }
  return (
    <div className={`p-3 rounded-lg border ${colors[color] || colors.gray}`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs opacity-80">{label}</p>{icon}
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}
