'use client'

// SmartShule — Page gestion des licences (générateur + liste)
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { KeyRound, Plus, RefreshCw, Copy, Check, Building2 } from 'lucide-react'
import { toast } from 'sonner'

interface LicenseRow {
  id: string
  key: string
  plan: string
  schoolName: string
  contactEmail: string
  contactPhone: string | null
  city: string | null
  status: string
  issuedAt: string
  activatedAt: string | null
  expiresAt: string | null
  maxStudents: number
  maxActivations: number
  activationCount: number
}

const PLANS = [
  { id: 'ESSENTIAL', name: 'Essential', maxStudents: 200, maxDevices: 1, price: '250 000 FC/an' },
  { id: 'PREMIUM', name: 'Premium', maxStudents: 1000, maxDevices: 3, price: '500 000 FC/an' },
  { id: 'ENTERPRISE', name: 'Enterprise', maxStudents: 999999, maxDevices: 10, price: '1 000 000 FC/an' },
]

export default function LicensesPage() {
  const [licenses, setLicenses] = useState<LicenseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Form state
  const [plan, setPlan] = useState('ESSENTIAL')
  const [schoolName, setSchoolName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactCity, setContactCity] = useState('')
  const [durationDays, setDurationDays] = useState('365')

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/licenses')
      const data = await res.json()
      if (data.ok) setLicenses(data.licenses)
    } catch (err) {
      toast.error('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  async function generateLicense() {
    if (!schoolName || !contactEmail) {
      toast.error('Nom de l\'école et email obligatoires')
      return
    }
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          schoolName,
          contactEmail,
          contactPhone: contactPhone || undefined,
          contactCity: contactCity || undefined,
          durationDays: parseInt(durationDays) || 365,
        }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)

      toast.success(`Licence générée : ${data.license.key}`)
      // Reset form
      setSchoolName('')
      setContactEmail('')
      setContactPhone('')
      setContactCity('')
      setShowForm(false)
      // Reload list
      reload()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  async function copyKey(key: string) {
    await navigator.clipboard.writeText(key)
    toast.success('Clé copiée')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Licences</h1>
          <p className="text-sm text-muted-foreground">Générez et gérez les licences pour vos écoles clientes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={reload}>
            <RefreshCw className="h-4 w-4 mr-2" /> Actualiser
          </Button>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" /> Générer une licence
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Générer une nouvelle licence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select value={plan} onValueChange={setPlan}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLANS.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {p.maxStudents} élèves — {p.price}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Durée (jours)</Label>
                <Input type="number" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
                <p className="text-xs text-muted-foreground">365 = 1 an, 730 = 2 ans, etc.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nom de l'école cliente *</Label>
              <Input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="Ex: Institut Saint Joseph" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email de contact *</Label>
                <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="direction@saintjoseph.cd" />
              </div>
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+243 8XX XXX XXX" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Ville</Label>
              <Input value={contactCity} onChange={(e) => setContactCity(e.target.value)} placeholder="Kinshasa" />
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={generateLicense} disabled={generating}>
                {generating ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
                {generating ? 'Génération...' : 'Générer la licence'}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{licenses.length} licence(s)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
              ))}
            </div>
          ) : licenses.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <KeyRound className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Aucune licence émise pour le moment.</p>
              <Button className="mt-4" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" /> Générer la première licence
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 px-3 font-medium">Clé</th>
                    <th className="py-2 px-3 font-medium">Plan</th>
                    <th className="py-2 px-3 font-medium">École</th>
                    <th className="py-2 px-3 font-medium">Contact</th>
                    <th className="py-2 px-3 font-medium">Statut</th>
                    <th className="py-2 px-3 font-medium">Activations</th>
                    <th className="py-2 px-3 font-medium">Expire le</th>
                    <th className="py-2 px-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {licenses.map(l => (
                    <tr key={l.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-3 font-mono text-xs">
                        <button onClick={() => copyKey(l.key)} className="hover:text-primary flex items-center gap-1">
                          {l.key}
                          <Copy className="h-3 w-3" />
                        </button>
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant="outline">{l.plan}</Badge>
                      </td>
                      <td className="py-2 px-3">
                        <p className="font-medium">{l.schoolName}</p>
                        {l.city && <p className="text-xs text-muted-foreground">{l.city}</p>}
                      </td>
                      <td className="py-2 px-3">
                        <p className="text-xs">{l.contactEmail}</p>
                        {l.contactPhone && <p className="text-xs text-muted-foreground">{l.contactPhone}</p>}
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant={
                          l.status === 'ACTIVE' ? 'default' :
                          l.status === 'PENDING' ? 'secondary' :
                          l.status === 'EXPIRED' || l.status === 'REVOKED' ? 'destructive' :
                          'outline'
                        }>
                          {l.status}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-xs">
                        {l.activationCount} / {l.maxActivations}
                      </td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">
                        {l.expiresAt ? new Date(l.expiresAt).toLocaleDateString('fr-FR') : 'À vie'}
                      </td>
                      <td className="py-2 px-3">
                        <button
                          onClick={() => copyKey(l.key)}
                          className="text-xs text-primary hover:underline"
                          title="Copier la clé"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
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
