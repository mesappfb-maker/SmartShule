'use client'

// SmartShule — Gestion Contenu & Communication
// ============================================================
// Onglets : Articles | Contacts | Diaporama | Réceptions
// Accessible par : Direction, Secrétariat, Admin

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
  Loader2, Newspaper, Phone, Image as ImageIcon, CalendarClock,
  Plus, Trash2, CheckCircle2, LogIn, LogOut, Eye, EyeOff, Pin, PinOff,
} from 'lucide-react'
import { toast } from 'sonner'

export function ContentManager() {
  const [tab, setTab] = React.useState<'articles' | 'contacts' | 'slideshow' | 'receptions'>('articles')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contenu & Communication"
        description="Gérez les articles, l'annuaire, le diaporama et les rendez-vous de réception."
        breadcrumbs={[{ label: 'Direction' }, { label: 'Contenu' }]}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid w-full grid-cols-4 gap-1 h-auto">
          <TabsTrigger value="articles" className="flex flex-col items-center gap-1 py-2 text-xs">
            <Newspaper className="h-4 w-4" /> Articles
          </TabsTrigger>
          <TabsTrigger value="contacts" className="flex flex-col items-center gap-1 py-2 text-xs">
            <Phone className="h-4 w-4" /> Contacts
          </TabsTrigger>
          <TabsTrigger value="slideshow" className="flex flex-col items-center gap-1 py-2 text-xs">
            <ImageIcon className="h-4 w-4" /> Diaporama
          </TabsTrigger>
          <TabsTrigger value="receptions" className="flex flex-col items-center gap-1 py-2 text-xs">
            <CalendarClock className="h-4 w-4" /> Réceptions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="articles" className="mt-4"><ArticlesManager /></TabsContent>
        <TabsContent value="contacts" className="mt-4"><ContactsManager /></TabsContent>
        <TabsContent value="slideshow" className="mt-4"><SlideshowManager /></TabsContent>
        <TabsContent value="receptions" className="mt-4"><ReceptionsManager /></TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================================
// 1. ARTICLES
// ============================================================

function ArticlesManager() {
  const [articles, setArticles] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [showForm, setShowForm] = React.useState(false)
  const [title, setTitle] = React.useState('')
  const [excerpt, setExcerpt] = React.useState('')
  const [content, setContent] = React.useState('')
  const [category, setCategory] = React.useState('NEWS')
  const [targetRoles, setTargetRoles] = React.useState('ALL')
  const [imageUrl, setImageUrl] = React.useState('')
  const [published, setPublished] = React.useState(true)
  const [pinned, setPinned] = React.useState(false)
  const [pending, setPending] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/content?resource=articles', { cache: 'no-store' })
    const data = await res.json()
    if (data.ok) setArticles(data.articles)
    setLoading(false)
  }, [])

  React.useEffect(() => { load() }, [load])

  async function submit() {
    if (!title || !content) { toast.error('Titre et contenu obligatoires'); return }
    setPending(true)
    try {
      const res = await fetch('/api/admin/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-article', title, excerpt, content, category, targetRoles, imageUrl, published, pinned }),
      })
      const data = await res.json()
      if (data.ok) { toast.success(data.message); setShowForm(false); setTitle(''); setExcerpt(''); setContent(''); setImageUrl(''); load() }
      else toast.error(data.error)
    } finally { setPending(false) }
  }

  async function remove(id: string) {
    if (!confirm('Supprimer cet article ?')) return
    await fetch(`/api/admin/content?resource=article&id=${id}`, { method: 'DELETE' })
    toast.success('Article supprimé')
    load()
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  return (
    <div className="space-y-4">
      {!showForm ? (
        <Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-2" /> Nouvel article</Button>
      ) : (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Titre *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Rentrée scolaire 2026" /></div>
              <div><Label>Catégorie</Label>
                <select className="w-full p-2 border rounded-md bg-background text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="NEWS">📰 Actualité</option>
                  <option value="EVENT">🎉 Événement</option>
                  <option value="ANNOUNCEMENT">📢 Annonce</option>
                  <option value="GENERAL">📝 Général</option>
                </select>
              </div>
            </div>
            <div><Label>Résumé</Label><Input value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="Résumé court..." /></div>
            <div><Label>Contenu *</Label><Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} placeholder="Contenu complet de l'article..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Visible pour</Label>
                <select className="w-full p-2 border rounded-md bg-background text-sm" value={targetRoles} onChange={(e) => setTargetRoles(e.target.value)}>
                  <option value="ALL">Tous les rôles</option>
                  <option value="STUDENT">Élèves uniquement</option>
                  <option value="PARENT">Parents uniquement</option>
                  <option value="TEACHER">Enseignants uniquement</option>
                  <option value="DIRECTION">Direction uniquement</option>
                </select>
              </div>
              <div><Label>Image URL</Label><Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." /></div>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Publier</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> Épingler</label>
            </div>
            <div className="flex gap-2">
              <Button onClick={submit} disabled={pending}>{pending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}Créer</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {articles.length === 0 ? <EmptyState icon={<Newspaper className="h-5 w-5" />} title="Aucun article" /> : articles.map((a) => (
          <Card key={a.id}>
            <CardContent className="p-3 flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {a.pinned && <Pin className="h-3 w-3 text-amber-500" />}
                  <p className="font-medium">{a.title}</p>
                  <Badge variant="outline">{a.category}</Badge>
                  <Badge variant={a.status === 'PUBLISHED' ? 'default' : 'outline'} className="text-xs">{a.status}</Badge>
                </div>
                {a.excerpt && <p className="text-xs text-muted-foreground mt-1">{a.excerpt}</p>}
                <p className="text-xs text-muted-foreground mt-1">
                  Visible : {a.targetRoles === 'ALL' ? 'Tous' : a.targetRoles} · {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString('fr-FR') : 'Brouillon'}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// 2. CONTACTS
// ============================================================

function ContactsManager() {
  const [contacts, setContacts] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [lastName, setLastName] = React.useState('')
  const [firstName, setFirstName] = React.useState('')
  const [contactFunction, setContactFunction] = React.useState('')
  const [organization, setOrganization] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [mobilePhone, setMobilePhone] = React.useState('')
  const [category, setCategory] = React.useState('STAFF')
  const [pending, setPending] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/content?resource=contacts', { cache: 'no-store' })
    const data = await res.json()
    if (data.ok) setContacts(data.contacts)
    setLoading(false)
  }, [])

  React.useEffect(() => { load() }, [load])

  async function submit() {
    if (!lastName) { toast.error('Nom obligatoire'); return }
    setPending(true)
    try {
      const res = await fetch('/api/admin/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-contact', lastName, firstName, function: contactFunction, organization, email, phone, mobilePhone, category }),
      })
      const data = await res.json()
      if (data.ok) { toast.success(data.message); setLastName(''); setFirstName(''); setContactFunction(''); setOrganization(''); setEmail(''); setPhone(''); setMobilePhone(''); load() }
      else toast.error(data.error)
    } finally { setPending(false) }
  }

  async function remove(id: string) {
    await fetch(`/api/admin/content?resource=contact&id=${id}`, { method: 'DELETE' })
    toast.success('Contact supprimé')
    load()
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Nouveau contact</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Prénom</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
            <div><Label>Nom *</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Fonction</Label><Input value={contactFunction} onChange={(e) => setContactFunction(e.target.value)} placeholder="Directeur, Secrétaire..." /></div>
            <div><Label>Organisation</Label><Input value={organization} onChange={(e) => setOrganization(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label>Téléphone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Mobile</Label><Input value={mobilePhone} onChange={(e) => setMobilePhone(e.target.value)} /></div>
            <div><Label>Catégorie</Label>
              <select className="w-full p-2 border rounded-md bg-background text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="STAFF">Personnel</option>
                <option value="EMERGENCY">Urgence</option>
                <option value="PARTNER">Partenaire</option>
                <option value="SUPPLIER">Fournisseur</option>
                <option value="OTHER">Autre</option>
              </select>
            </div>
          </div>
          <Button onClick={submit} disabled={pending} className="w-full">{pending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}Ajouter</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Annuaire ({contacts.length})</CardTitle></CardHeader>
        <CardContent>
          {contacts.length === 0 ? <EmptyState title="Aucun contact" /> : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {contacts.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded-md border border-border bg-muted/20">
                  <div>
                    <p className="text-sm font-medium">{c.firstName} {c.lastName}</p>
                    <p className="text-xs text-muted-foreground">{c.function || '—'} · {c.email || c.phone || '—'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{c.category}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
                  </div>
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
// 3. DIAPORAMA
// ============================================================

function SlideshowManager() {
  const [slides, setSlides] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [imageUrl, setImageUrl] = React.useState('')
  const [linkUrl, setLinkUrl] = React.useState('')
  const [pending, setPending] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/content?resource=slideshow-all', { cache: 'no-store' })
    const data = await res.json()
    if (data.ok) setSlides(data.slides)
    setLoading(false)
  }, [])

  React.useEffect(() => { load() }, [load])

  async function submit() {
    if (!imageUrl) { toast.error('URL image obligatoire'); return }
    setPending(true)
    try {
      const res = await fetch('/api/admin/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-slideshow-image', title, description, imageUrl, linkUrl }),
      })
      const data = await res.json()
      if (data.ok) { toast.success(data.message); setTitle(''); setDescription(''); setImageUrl(''); setLinkUrl(''); load() }
      else toast.error(data.error)
    } finally { setPending(false) }
  }

  async function toggle(id: string) {
    await fetch('/api/admin/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle-slideshow-image', id }),
    })
    load()
  }

  async function remove(id: string) {
    await fetch(`/api/admin/content?resource=slideshow&id=${id}`, { method: 'DELETE' })
    toast.success('Image supprimée')
    load()
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Ajouter une image au diaporama</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Titre (optionnel)</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Rentrée 2026" /></div>
          <div><Label>Description (optionnel)</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
          <div><Label>URL Image *</Label><Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." /></div>
          <div><Label>Lien au clic (optionnel)</Label><Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." /></div>
          <Button onClick={submit} disabled={pending} className="w-full">{pending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}Ajouter</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Diaporama ({slides.length})</CardTitle></CardHeader>
        <CardContent>
          {slides.length === 0 ? <EmptyState icon={<ImageIcon className="h-5 w-5" />} title="Aucune image" /> : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {slides.map((s) => (
                <div key={s.id} className="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/20">
                  <img src={s.imageUrl} alt={s.title || ''} className="h-12 w-16 object-cover rounded" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{s.title || 'Sans titre'}</p>
                    <p className="text-xs text-muted-foreground">{s.description || '—'}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => toggle(s.id)} title={s.status === 'ACTIVE' ? 'Masquer' : 'Afficher'}>
                      {s.status === 'ACTIVE' ? <Eye className="h-4 w-4 text-emerald-500" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
                  </div>
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
// 4. RÉCEPTIONS
// ============================================================

function ReceptionsManager() {
  const [receptions, setReceptions] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [visitorName, setVisitorName] = React.useState('')
  const [visitorPhone, setVisitorPhone] = React.useState('')
  const [visitorEmail, setVisitorEmail] = React.useState('')
  const [purpose, setPurpose] = React.useState('MEETING')
  const [purposeDetail, setPurposeDetail] = React.useState('')
  const [targetPersonName, setTargetPersonName] = React.useState('')
  const [scheduledDate, setScheduledDate] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [pending, setPending] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/content?resource=receptions', { cache: 'no-store' })
    const data = await res.json()
    if (data.ok) setReceptions(data.receptions)
    setLoading(false)
  }, [])

  React.useEffect(() => { load() }, [load])

  async function submit() {
    if (!visitorName || !scheduledDate) { toast.error('Nom visiteur et date obligatoires'); return }
    setPending(true)
    try {
      const res = await fetch('/api/admin/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-reception', visitorName, visitorPhone, visitorEmail, purpose, purposeDetail, targetPersonName, scheduledDate, notes }),
      })
      const data = await res.json()
      if (data.ok) { toast.success(data.message); setVisitorName(''); setVisitorPhone(''); setVisitorEmail(''); setPurposeDetail(''); setTargetPersonName(''); setScheduledDate(''); setNotes(''); load() }
      else toast.error(data.error)
    } finally { setPending(false) }
  }

  async function checkIn(id: string) {
    await fetch('/api/admin/content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'check-in-reception', id }) })
    toast.success('Arrivée enregistrée')
    load()
  }

  async function checkOut(id: string) {
    await fetch('/api/admin/content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'check-out-reception', id }) })
    toast.success('Départ enregistré')
    load()
  }

  async function cancel(id: string) {
    if (!confirm('Annuler ce rendez-vous ?')) return
    await fetch('/api/admin/content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel-reception', id }) })
    toast.success('Rendez-vous annulé')
    load()
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Nouveau rendez-vous</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Nom du visiteur *</Label><Input value={visitorName} onChange={(e) => setVisitorName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Téléphone</Label><Input value={visitorPhone} onChange={(e) => setVisitorPhone(e.target.value)} /></div>
            <div><Label>Email</Label><Input type="email" value={visitorEmail} onChange={(e) => setVisitorEmail(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Motif *</Label>
              <select className="w-full p-2 border rounded-md bg-background text-sm" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                <option value="MEETING">Réunion</option>
                <option value="INTERVIEW">Entretien</option>
                <option value="DELIVERY">Livraison</option>
                <option value="PARENT_MEETING">Rendez-vous parent</option>
                <option value="OTHER">Autre</option>
              </select>
            </div>
            <div><Label>Personne visitée</Label><Input value={targetPersonName} onChange={(e) => setTargetPersonName(e.target.value)} placeholder="M. le Directeur" /></div>
          </div>
          <div><Label>Date & heure *</Label><Input type="datetime-local" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} /></div>
          <div><Label>Détails / Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
          <Button onClick={submit} disabled={pending} className="w-full">{pending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}Programmer</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Rendez-vous ({receptions.length})</CardTitle></CardHeader>
        <CardContent>
          {receptions.length === 0 ? <EmptyState icon={<CalendarClock className="h-5 w-5" />} title="Aucun rendez-vous" /> : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {receptions.map((r) => (
                <div key={r.id} className="p-3 rounded-md border border-border bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{r.visitorName}</p>
                      <p className="text-xs text-muted-foreground">{new Date(r.scheduledDate).toLocaleString('fr-FR')}</p>
                      <p className="text-xs text-muted-foreground">{r.purpose}{r.targetPersonName && ` → ${r.targetPersonName}`}</p>
                    </div>
                    <Badge variant={r.status === 'SCHEDULED' ? 'outline' : r.status === 'CHECKED_IN' ? 'default' : r.status === 'CANCELLED' ? 'destructive' : 'secondary'} className="text-xs">{r.status}</Badge>
                  </div>
                  {r.status === 'SCHEDULED' && (
                    <div className="flex gap-1 mt-2">
                      <Button size="sm" variant="outline" onClick={() => checkIn(r.id)}><LogIn className="h-3 w-3 mr-1" />Arrivée</Button>
                      <Button size="sm" variant="ghost" onClick={() => cancel(r.id)}>Annuler</Button>
                    </div>
                  )}
                  {r.status === 'CHECKED_IN' && (
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => checkOut(r.id)}><LogOut className="h-3 w-3 mr-1" />Départ</Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
