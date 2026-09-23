'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { GraduationCap, Loader2, CheckCircle2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'

export default function PreinscriptionPage() {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [success, setSuccess] = React.useState(false)
  const [refNumber, setRefNumber] = React.useState('')
  const [form, setForm] = React.useState({
    parentFirstName: '', parentLastName: '', parentPhone: '', parentRelationship: 'PERE',
    childFirstName: '', childLastName: '', childBirthDate: '', childGender: 'M',
    desiredLevel: '', academicYearLabel: '2026-2027',
    emergencyContactName: '', emergencyContactPhone: '', address: '',
    acceptedTerms: false, acceptedPrivacy: false, preferredContact: 'WHATSAPP',
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.parentFirstName || !form.parentLastName || !form.parentPhone || !form.childFirstName || !form.childLastName) {
      toast.error('Veuillez remplir tous les champs obligatoires.')
      return
    }
    if (!form.acceptedTerms || !form.acceptedPrivacy) {
      toast.error('Vous devez accepter les conditions.')
      return
    }
    setPending(true)
    try {
      const res = await fetch('/api/preinscription', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.ok) {
        setSuccess(true)
        setRefNumber(data.referenceNumber)
        toast.success(data.message)
      } else {
        toast.error(data.error)
      }
    } catch (err) {
      toast.error('Erreur : ' + (err as Error).message)
    } finally { setPending(false) }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-teal-50 dark:from-slate-900 dark:to-slate-800">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold">Dossier soumis !</h1>
            <p className="text-sm text-muted-foreground">
              Votre numéro de référence : <strong className="font-mono text-primary">{refNumber}</strong>
            </p>
            <p className="text-xs text-muted-foreground">
              Le secrétariat va étudier votre dossier. Vous recevrez une notification dès qu'une décision sera prise.
              Votre accès reste limité jusqu'à validation.
            </p>
            <Button onClick={() => router.push('/')} className="w-full">Retour à l'accueil</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 bg-gradient-to-br from-blue-50 to-teal-50 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Préinscription d'un nouvel enfant</h1>
            <p className="text-sm text-muted-foreground">Remplissez le formulaire ci-dessous</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">👨‍👩‍👧‍👦 Informations du parent/tuteur</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div><Label>Prénom *</Label><Input value={form.parentFirstName} onChange={(e) => setForm({ ...form, parentFirstName: e.target.value })} required /></div>
              <div><Label>Nom *</Label><Input value={form.parentLastName} onChange={(e) => setForm({ ...form, parentLastName: e.target.value })} required /></div>
              <div><Label>Téléphone/WhatsApp *</Label><Input value={form.parentPhone} onChange={(e) => setForm({ ...form, parentPhone: e.target.value })} placeholder="+243 ..." required /></div>
              <div><Label>Lien avec l'enfant</Label>
                <select className="w-full p-2 border rounded-md bg-background text-sm" value={form.parentRelationship} onChange={(e) => setForm({ ...form, parentRelationship: e.target.value })}>
                  <option value="PERE">Père</option><option value="MERE">Mère</option><option value="TUTEUR">Tuteur légal</option><option value="AUTRE">Autre</option>
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">🧒 Informations de l'enfant</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div><Label>Prénom *</Label><Input value={form.childFirstName} onChange={(e) => setForm({ ...form, childFirstName: e.target.value })} required /></div>
              <div><Label>Nom *</Label><Input value={form.childLastName} onChange={(e) => setForm({ ...form, childLastName: e.target.value })} required /></div>
              <div><Label>Date de naissance</Label><Input type="date" value={form.childBirthDate} onChange={(e) => setForm({ ...form, childBirthDate: e.target.value })} /></div>
              <div><Label>Genre</Label>
                <select className="w-full p-2 border rounded-md bg-background text-sm" value={form.childGender} onChange={(e) => setForm({ ...form, childGender: e.target.value })}>
                  <option value="M">Masculin</option><option value="F">Féminin</option>
                </select>
              </div>
              <div><Label>Niveau/Classe souhaité</Label><Input value={form.desiredLevel} onChange={(e) => setForm({ ...form, desiredLevel: e.target.value })} placeholder="Ex: 6ème, CP1..." /></div>
              <div><Label>Année scolaire</Label><Input value={form.academicYearLabel} onChange={(e) => setForm({ ...form, academicYearLabel: e.target.value })} /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">📞 Contacts d'urgence</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div><Label>Nom contact d'urgence</Label><Input value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} /></div>
              <div><Label>Téléphone d'urgence</Label><Input value={form.emergencyContactPhone} onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Adresse</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <Label>Moyen de contact préféré</Label>
              <select className="w-full p-2 border rounded-md bg-background text-sm" value={form.preferredContact} onChange={(e) => setForm({ ...form, preferredContact: e.target.value })}>
                <option value="WHATSAPP">WhatsApp</option><option value="EMAIL">Email</option><option value="SMS">SMS</option><option value="CALL">Appel téléphonique</option>
              </select>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.acceptedTerms} onChange={(e) => setForm({ ...form, acceptedTerms: e.target.checked })} /> J'accepte le règlement intérieur</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.acceptedPrivacy} onChange={(e) => setForm({ ...form, acceptedPrivacy: e.target.checked })} /> J'accepte la politique de confidentialité</label>
            </CardContent>
          </Card>

          <Button type="submit" disabled={pending} size="lg" className="w-full">
            {pending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Soumission en cours...</> : <><FileText className="h-4 w-4 mr-2" /> Soumettre le dossier</>}
          </Button>
        </form>
      </div>
    </div>
  )
}
