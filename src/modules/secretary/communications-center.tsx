'use client'

// SmartShule — Centre Communications (Secrétariat)
// ============================================================
// Messagerie, registre appels, registre visiteurs, rendez-vous

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { PageHeader } from '@/components/ss/page-header'
import {
  Loader2, Mail, Phone, Users, Calendar, Send, Plus, PhoneCall,
  LogIn, LogOut, Clock, CheckCircle2, ChevronLeft, ChevronRight,
  MessageSquare, UserPlus, Eye,
} from 'lucide-react'
import { toast } from 'sonner'

type Message = {
  id: string; senderName: string; senderRole: string; recipientName: string
  recipientPhone: string | null; recipientEmail: string | null
  channel: string; subject: string | null; body: string; status: string
  category: string; assignedToName: string | null; studentName: string | null
  studentMatricule: string | null; deliveredAt: string | null; deliveryStatus: string | null
  parentReply: string | null; parentReplyAt: string | null; createdAt: string
}

type CallRecord = {
  id: string; callerName: string; callerPhone: string | null; direction: string
  contactedName: string | null; contactedPhone: string | null; subject: string | null
  notes: string | null; durationMinutes: number | null; outcome: string | null
  studentName: string | null; followUpRequired: boolean; followUpDate: string | null
  handledByName: string | null; callDate: string
}

type VisitorRecord = {
  id: string; visitorName: string; visitorPhone: string | null
  visitorIdNumber: string | null; visitorType: string; purpose: string
  visitedName: string | null; badgeNumber: string | null; badgeReturned: boolean
  checkInAt: string; checkOutAt: string | null; studentName: string | null
  handledByName: string | null
}

type AppointmentRecord = {
  id: string; title: string; description: string | null; date: string
  durationMinutes: number; location: string | null; withName: string
  withPhone: string | null; withEmail: string | null; appointmentType: string
  status: string; assignedToName: string | null; studentName: string | null
  reminderSent: boolean; createdAt: string
}

const CHANNEL_LABELS: Record<string, string> = { APP: 'App', EMAIL: 'Email', SMS: 'SMS', WHATSAPP: 'WhatsApp' }
const MSG_STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700', IN_PROGRESS: 'bg-amber-100 text-amber-700',
  WAITING: 'bg-purple-100 text-purple-700', RESOLVED: 'bg-emerald-100 text-emerald-700', CLOSED: 'bg-gray-100 text-gray-500',
}
const APPT_STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700', CONFIRMED: 'bg-emerald-100 text-emerald-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700', COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-gray-100 text-gray-500', NO_SHOW: 'bg-red-100 text-red-700',
}

export function CommunicationsCenter() {
  const [sub, setSub] = React.useState('messages')
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [newMsg, setNewMsg] = React.useState({ recipientName: '', recipientPhone: '', recipientEmail: '', subject: '', body: '', channel: 'APP' })
  const [newCall, setNewCall] = React.useState({ callerName: '', callerPhone: '', direction: 'INCOMING', subject: '', notes: '', durationMinutes: '', outcome: '' })
  const [newVisitor, setNewVisitor] = React.useState({ visitorName: '', visitorPhone: '', visitorIdNumber: '', visitorType: 'PARENT', purpose: '', visitedName: '' })
  const [newAppt, setNewAppt] = React.useState({ title: '', date: '', durationMinutes: '30', location: '', withName: '', withPhone: '', withEmail: '', appointmentType: 'GENERAL' })

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ sub, page: String(page), limit: '50' })
      const res = await fetch(`/api/secretariat/communications?${params}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.ok) setData(json)
    } catch (err) {
      toast.error('Erreur : ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [sub, page])

  React.useEffect(() => { loadData() }, [loadData])

  async function sendMessage() {
    if (!newMsg.recipientName || !newMsg.body) { toast.error('Destinataire et message requis.'); return }
    try {
      const res = await fetch('/api/secretariat/communications', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send-message', ...newMsg }),
      })
      const json = await res.json()
      if (json.ok) { toast.success('Message envoyé'); setNewMsg({ recipientName: '', recipientPhone: '', recipientEmail: '', subject: '', body: '', channel: 'APP' }); loadData() }
      else toast.error(json.error)
    } catch (err) { toast.error('Erreur : ' + (err as Error).message) }
  }

  async function logCall() {
    if (!newCall.callerName) { toast.error('Nom de l\'appelant requis.'); return }
    try {
      const res = await fetch('/api/secretariat/communications', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'log-call', ...newCall, durationMinutes: newCall.durationMinutes ? parseInt(newCall.durationMinutes) : null }),
      })
      const json = await res.json()
      if (json.ok) { toast.success('Appel enregistré'); setNewCall({ callerName: '', callerPhone: '', direction: 'INCOMING', subject: '', notes: '', durationMinutes: '', outcome: '' }); loadData() }
      else toast.error(json.error)
    } catch (err) { toast.error('Erreur : ' + (err as Error).message) }
  }

  async function checkInVisitor() {
    if (!newVisitor.visitorName || !newVisitor.purpose) { toast.error('Nom et objet de visite requis.'); return }
    try {
      const res = await fetch('/api/secretariat/communications', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check-in-visitor', ...newVisitor }),
      })
      const json = await res.json()
      if (json.ok) { toast.success('Visiteur enregistré'); setNewVisitor({ visitorName: '', visitorPhone: '', visitorIdNumber: '', visitorType: 'PARENT', purpose: '', visitedName: '' }); loadData() }
      else toast.error(json.error)
    } catch (err) { toast.error('Erreur : ' + (err as Error).message) }
  }

  async function checkOutVisitor(id: string) {
    try {
      const res = await fetch('/api/secretariat/communications', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check-out-visitor', visitorLogId: id }),
      })
      const json = await res.json()
      if (json.ok) { toast.success('Sortie enregistrée'); loadData() }
      else toast.error(json.error)
    } catch (err) { toast.error('Erreur : ' + (err as Error).message) }
  }

  async function createAppointment() {
    if (!newAppt.title || !newAppt.date || !newAppt.withName) { toast.error('Titre, date et nom du visiteur requis.'); return }
    try {
      const res = await fetch('/api/secretariat/communications', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-appointment', ...newAppt, durationMinutes: parseInt(newAppt.durationMinutes) || 30 }),
      })
      const json = await res.json()
      if (json.ok) { toast.success('Rendez-vous créé'); setNewAppt({ title: '', date: '', durationMinutes: '30', location: '', withName: '', withPhone: '', withEmail: '', appointmentType: 'GENERAL' }); loadData() }
      else toast.error(json.error)
    } catch (err) { toast.error('Erreur : ' + (err as Error).message) }
  }

  async function updateAppointmentStatus(id: string, status: string) {
    try {
      const res = await fetch('/api/secretariat/communications', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-appointment', appointmentId: id, status }),
      })
      const json = await res.json()
      if (json.ok) { toast.success('Rendez-vous mis à jour'); loadData() }
      else toast.error(json.error)
    } catch (err) { toast.error('Erreur : ' + (err as Error).message) }
  }

  const messages: Message[] = data?.messages || []
  const calls: CallRecord[] = data?.calls || []
  const visitors: VisitorRecord[] = data?.visitors || []
  const appointments: AppointmentRecord[] = data?.appointments || []
  const pagination = data?.pagination

  return (
    <div className="space-y-6">
      <PageHeader title="Centre Communications" description="Messagerie, appels, visiteurs et rendez-vous." breadcrumbs={[{ label: 'Secrétariat' }, { label: 'Communications' }]} />

      {/* Onglets */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'messages', label: 'Messagerie', icon: <Mail className="h-4 w-4" /> },
          { key: 'calls', label: 'Registre appels', icon: <PhoneCall className="h-4 w-4" /> },
          { key: 'visitors', label: 'Registre visiteurs', icon: <Users className="h-4 w-4" /> },
          { key: 'appointments', label: 'Rendez-vous', icon: <Calendar className="h-4 w-4" /> },
        ].map((v) => (
          <Button key={v.key} size="sm" variant={sub === v.key ? 'default' : 'outline'} onClick={() => { setSub(v.key); setPage(1) }}>
            {v.icon} <span className="ml-1">{v.label}</span>
          </Button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}

      {/* MESSAGES */}
      {!loading && sub === 'messages' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Dialog>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nouveau message</Button></DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Envoyer un message</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Input placeholder="Nom du destinataire" value={newMsg.recipientName} onChange={(e) => setNewMsg({ ...newMsg, recipientName: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Téléphone" value={newMsg.recipientPhone} onChange={(e) => setNewMsg({ ...newMsg, recipientPhone: e.target.value })} />
                    <Input placeholder="Email" value={newMsg.recipientEmail} onChange={(e) => setNewMsg({ ...newMsg, recipientEmail: e.target.value })} />
                  </div>
                  <Select value={newMsg.channel} onValueChange={(v) => setNewMsg({ ...newMsg, channel: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(CHANNEL_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input placeholder="Objet (optionnel)" value={newMsg.subject} onChange={(e) => setNewMsg({ ...newMsg, subject: e.target.value })} />
                  <Textarea placeholder="Message" rows={4} value={newMsg.body} onChange={(e) => setNewMsg({ ...newMsg, body: e.target.value })} />
                </div>
                <DialogFooter><Button onClick={sendMessage}><Send className="h-4 w-4 mr-1" /> Envoyer</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardContent className="space-y-2">
              {messages.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">Aucun message.</p> : messages.map((m) => (
                <div key={m.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{m.subject || '(sans objet)'}</p>
                      <Badge className={`${MSG_STATUS_COLORS[m.status] || 'bg-gray-100'} text-xs`}>{m.status}</Badge>
                      <Badge variant="outline" className="text-xs">{CHANNEL_LABELS[m.channel] || m.channel}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">De : {m.senderName} → {m.recipientName}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.body}</p>
                    {m.studentName && <p className="text-xs text-muted-foreground">Élève : {m.studentName} ({m.studentMatricule})</p>}
                    {m.parentReply && <p className="text-xs text-primary mt-1">Réponse : {m.parentReply}</p>}
                    <p className="text-xs text-muted-foreground">{new Date(m.createdAt).toLocaleString('fr-FR')}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* APPELS */}
      {!loading && sub === 'calls' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Dialog>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Enregistrer un appel</Button></DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Enregistrer un appel</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Input placeholder="Nom de l'appelant" value={newCall.callerName} onChange={(e) => setNewCall({ ...newCall, callerName: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Téléphone" value={newCall.callerPhone} onChange={(e) => setNewCall({ ...newCall, callerPhone: e.target.value })} />
                    <Select value={newCall.direction} onValueChange={(v) => setNewCall({ ...newCall, direction: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="INCOMING">Entrant</SelectItem><SelectItem value="OUTGOING">Sortant</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <Input placeholder="Objet" value={newCall.subject} onChange={(e) => setNewCall({ ...newCall, subject: e.target.value })} />
                  <Textarea placeholder="Notes" rows={3} value={newCall.notes} onChange={(e) => setNewCall({ ...newCall, notes: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Durée (min)" value={newCall.durationMinutes} onChange={(e) => setNewCall({ ...newCall, durationMinutes: e.target.value })} />
                    <Select value={newCall.outcome} onValueChange={(v) => setNewCall({ ...newCall, outcome: v })}>
                      <SelectTrigger><SelectValue placeholder="Résultat" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="REACHED">Joint</SelectItem><SelectItem value="VOICEMAIL">Répondeur</SelectItem>
                        <SelectItem value="NO_ANSWER">Sans réponse</SelectItem><SelectItem value="BUSY">Occupé</SelectItem>
                        <SelectItem value="CALLBACK_REQUESTED">Rappel demandé</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter><Button onClick={logCall}><PhoneCall className="h-4 w-4 mr-1" /> Enregistrer</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardContent className="space-y-2">
              {calls.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">Aucun appel.</p> : calls.map((c) => (
                <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/20">
                  <PhoneCall className={`h-4 w-4 mt-1 ${c.direction === 'INCOMING' ? 'text-blue-500' : 'text-green-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{c.callerName} {c.callerPhone && <span className="text-muted-foreground">({c.callerPhone})</span>}</p>
                    <p className="text-xs text-muted-foreground">{c.direction === 'INCOMING' ? 'Entrant' : 'Sortant'} · {c.subject || '(sans objet)'} · {c.durationMinutes ? `${c.durationMinutes} min` : '—'}</p>
                    {c.notes && <p className="text-xs text-muted-foreground truncate">{c.notes}</p>}
                    <p className="text-xs text-muted-foreground">{new Date(c.callDate).toLocaleString('fr-FR')}</p>
                  </div>
                  {c.outcome && <Badge variant="outline" className="text-xs">{c.outcome}</Badge>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* VISITEURS */}
      {!loading && sub === 'visitors' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            {data?.activeCount > 0 && <Badge className="bg-blue-100 text-blue-700">{data.activeCount} visiteur(s) en cours</Badge>}
            <Dialog>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Enregistrer entrée</Button></DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Enregistrer un visiteur</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Input placeholder="Nom du visiteur" value={newVisitor.visitorName} onChange={(e) => setNewVisitor({ ...newVisitor, visitorName: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Téléphone" value={newVisitor.visitorPhone} onChange={(e) => setNewVisitor({ ...newVisitor, visitorPhone: e.target.value })} />
                    <Input placeholder="N° pièce d'identité" value={newVisitor.visitorIdNumber} onChange={(e) => setNewVisitor({ ...newVisitor, visitorIdNumber: e.target.value })} />
                  </div>
                  <Input placeholder="Objet de la visite" value={newVisitor.purpose} onChange={(e) => setNewVisitor({ ...newVisitor, purpose: e.target.value })} />
                  <Input placeholder="Personne visitée" value={newVisitor.visitedName} onChange={(e) => setNewVisitor({ ...newVisitor, visitedName: e.target.value })} />
                </div>
                <DialogFooter><Button onClick={checkInVisitor}><LogIn className="h-4 w-4 mr-1" /> Enregistrer</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardContent className="space-y-2">
              {visitors.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">Aucun visiteur aujourd'hui.</p> : visitors.map((v) => (
                <div key={v.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/20">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{v.visitorName} {v.badgeNumber && <Badge variant="outline" className="text-xs ml-1">Badge {v.badgeNumber}</Badge>}</p>
                    <p className="text-xs text-muted-foreground">{v.purpose} · {v.visitorType} · Entrée : {new Date(v.checkInAt).toLocaleString('fr-FR')}</p>
                    {v.checkOutAt && <p className="text-xs text-emerald-600">Sortie : {new Date(v.checkOutAt).toLocaleString('fr-FR')}</p>}
                  </div>
                  {!v.checkOutAt && (
                    <Button size="sm" variant="outline" onClick={() => checkOutVisitor(v.id)}><LogOut className="h-4 w-4 mr-1" /> Sortie</Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* RENDEZ-VOUS */}
      {!loading && sub === 'appointments' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Dialog>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nouveau rendez-vous</Button></DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Créer un rendez-vous</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Input placeholder="Titre" value={newAppt.title} onChange={(e) => setNewAppt({ ...newAppt, title: e.target.value })} />
                  <Input type="datetime-local" value={newAppt.date} onChange={(e) => setNewAppt({ ...newAppt, date: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Durée (min)" value={newAppt.durationMinutes} onChange={(e) => setNewAppt({ ...newAppt, durationMinutes: e.target.value })} />
                    <Input placeholder="Lieu" value={newAppt.location} onChange={(e) => setNewAppt({ ...newAppt, location: e.target.value })} />
                  </div>
                  <Input placeholder="Nom du visiteur/parent" value={newAppt.withName} onChange={(e) => setNewAppt({ ...newAppt, withName: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Téléphone" value={newAppt.withPhone} onChange={(e) => setNewAppt({ ...newAppt, withPhone: e.target.value })} />
                    <Input placeholder="Email" value={newAppt.withEmail} onChange={(e) => setNewAppt({ ...newAppt, withEmail: e.target.value })} />
                  </div>
                </div>
                <DialogFooter><Button onClick={createAppointment}><Calendar className="h-4 w-4 mr-1" /> Créer</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardContent className="space-y-2">
              {appointments.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">Aucun rendez-vous.</p> : appointments.map((a) => (
                <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/20">
                  <Calendar className="h-4 w-4 mt-1 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(a.date).toLocaleString('fr-FR')} · {a.durationMinutes} min · Avec : {a.withName}
                      {a.location && ` · ${a.location}`}
                    </p>
                    {a.studentName && <p className="text-xs text-muted-foreground">Élève : {a.studentName}</p>}
                  </div>
                  <Badge className={`${APPT_STATUS_COLORS[a.status] || 'bg-gray-100'} text-xs`}>{a.status}</Badge>
                  {a.status === 'SCHEDULED' && (
                    <Button size="sm" variant="ghost" onClick={() => updateAppointmentStatus(a.id, 'COMPLETED')}><CheckCircle2 className="h-4 w-4 text-emerald-500" /></Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm text-muted-foreground">Page {page} / {pagination.pages}</span>
          <Button size="sm" variant="outline" disabled={page >= pagination.pages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  )
}
