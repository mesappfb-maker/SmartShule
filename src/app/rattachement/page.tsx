'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { GraduationCap, Loader2, CheckCircle2, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export default function RattachementPage() {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [success, setSuccess] = React.useState(false)
  const [form, setForm] = React.useState({
    parentFirstName: '', parentLastName: '', parentPhone: '',
    childMatricule: '', childFirstName: '', childLastName: '', childBirthDate: '',
    relationship: 'PERE', verificationCode: '',
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.parentFirstName || !form.parentLastName || !form.parentPhone || !form.childMatricule) {
      toast.error('Veuillez remplir tous les champs obligatoires.')
      return
    }
    setPending(true)
    try {
      const res = await fetch('/api/rattachement', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.ok) {
        setSuccess(true)
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
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-teal-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold">Demande envoyée !</h1>
            <p className="text-sm text-muted-foreground">
              Votre demande de rattachement a été transmise au secrétariat.
              Vous recevrez une notification dès qu'elle sera traitée.
            </p>
            <Button onClick={() => router.push('/')} className="w-full">Retour à l'accueil</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 bg-gradient-to-br from-teal-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-600 text-white">
            <Link2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Rattachement à un élève existant</h1>
            <p className="text-sm text-muted-foreground">Votre enfant est déjà inscrit ? Demandez le rattachement</p>
          </div>
        </div>

        <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg mb-4">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            🔒 Votre demande sera vérifiée par le secrétariat. L'accès au portail parent ne sera activé qu'après validation.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Vos informations</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div><Label>Prénom *</Label><Input value={form.parentFirstName} onChange={(e) => setForm({ ...form, parentFirstName: e.target.value })} required /></div>
              <div><Label>Nom *</Label><Input value={form.parentLastName} onChange={(e) => setForm({ ...form, parentLastName: e.target.value })} required /></div>
              <div><Label>Téléphone/WhatsApp *</Label><Input value={form.parentPhone} onChange={(e) => setForm({ ...form, parentPhone: e.target.value })} placeholder="+243 ..." required /></div>
              <div><Label>Lien avec l'enfant</Label>
                <select className="w-full p-2 border rounded-md bg-background text-sm" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })}>
                  <option value="PERE">Père</option><option value="MERE">Mère</option><option value="TUTEUR">Tuteur légal</option><option value="AUTRE">Autre</option>
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Informations de l'enfant</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label>Matricule de l'élève *</Label><Input value={form.childMatricule} onChange={(e) => setForm({ ...form, childMatricule: e.target.value.toUpperCase() })} placeholder="ELV-001" required /></div>
              <div><Label>Prénom de l'enfant</Label><Input value={form.childFirstName} onChange={(e) => setForm({ ...form, childFirstName: e.target.value })} /></div>
              <div><Label>Nom de l'enfant</Label><Input value={form.childLastName} onChange={(e) => setForm({ ...form, childLastName: e.target.value })} /></div>
              <div><Label>Date de naissance (vérification)</Label><Input type="date" value={form.childBirthDate} onChange={(e) => setForm({ ...form, childBirthDate: e.target.value })} /></div>
              <div><Label>Code de liaison (si fourni par l'école)</Label><Input value={form.verificationCode} onChange={(e) => setForm({ ...form, verificationCode: e.target.value })} placeholder="Optionnel" /></div>
            </CardContent>
          </Card>

          <Button type="submit" disabled={pending} size="lg" className="w-full">
            {pending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Envoi en cours...</> : <><Link2 className="h-4 w-4 mr-2" /> Envoyer la demande</>}
          </Button>
        </form>
      </div>
    </div>
  )
}
