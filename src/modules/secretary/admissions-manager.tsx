'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ss/page-header'
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Send } from 'lucide-react'
import { toast } from 'sonner'

type Admission = {
  id: string
  referenceNumber: string
  parentName: string
  parentPhone: string
  parentEmail: string
  parentRelationship: string
  childName: string
  childBirthDate: string | null
  childGender: string | null
  desiredLevel: string | null
  status: string
  submittedAt: string | null
}

export function AdmissionsManager() {
  const [admissions, setAdmissions] = React.useState<Admission[]>([])
  const [loading, setLoading] = React.useState(true)
  const [pending, setPending] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/secretariat/admissions', { cache: 'no-store' })
    const data = await res.json()
    if (data.ok) setAdmissions(data.admissions)
    setLoading(false)
  }, [])

  React.useEffect(() => { load() }, [load])

  async function action(id: string, act: string, reason?: string) {
    setPending(id + act)
    try {
      const res = await fetch('/api/secretariat/admissions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: act, preRegistrationId: id, reason }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success(data.message)
        load()
      } else {
        toast.error(data.error)
      }
    } catch (err) {
      toast.error('Erreur : ' + (err as Error).message)
    } finally { setPending(null) }
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  return (
    <div className="space-y-4">
      <PageHeader
        title="Admissions & Demandes parentales"
        description="Validez ou refusez les dossiers de préinscription. L'acceptation crée l'élève et active le compte parent."
        breadcrumbs={[{ label: 'Secrétariat' }, { label: 'Admissions' }]}
      />

      {admissions.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>Aucune demande en attente</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {admissions.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-primary">{a.referenceNumber}</span>
                      <Badge variant="outline" className="text-xs">{a.status}</Badge>
                    </div>
                    <p className="font-semibold">{a.childName}</p>
                    <p className="text-xs text-muted-foreground">
                      👤 Parent : {a.parentName} ({a.parentRelationship}) · 📞 {a.parentPhone} · 📧 {a.parentEmail}
                    </p>
                    {a.desiredLevel && <p className="text-xs text-muted-foreground mt-1">Niveau souhaité : {a.desiredLevel}</p>}
                    {a.submittedAt && <p className="text-xs text-muted-foreground">Soumis le {new Date(a.submittedAt).toLocaleString('fr-FR')}</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button size="sm" variant="default" onClick={() => action(a.id, 'accept')} disabled={pending === a.id + 'accept'}>
                      {pending === a.id + 'accept' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                      Accepter
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { const r = prompt('Motif de l\'incomplétude :'); if (r) action(a.id, 'incomplete', r) }} disabled={pending === a.id + 'incomplete'}>
                      <AlertTriangle className="h-4 w-4 mr-1" /> Incomplet
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => action(a.id, 'transmit')} disabled={pending === a.id + 'transmit'}>
                      <Send className="h-4 w-4 mr-1" /> Transmettre
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => { const r = prompt('Motif du refus :'); if (r) action(a.id, 'refuse', r) }} disabled={pending === a.id + 'refuse'}>
                      <XCircle className="h-4 w-4 mr-1" /> Refuser
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
