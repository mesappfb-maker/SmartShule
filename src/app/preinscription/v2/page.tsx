'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { GraduationCap, Loader2, CheckCircle2, Plus, X, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'

type ChildForm = {
  childFirstName: string
  childLastName: string
  childBirthDate: string
  childGender: string
  childBirthPlace: string
  previousSchool: string
  desiredLevel: string
}

export default function PreinscriptionV2Page() {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [success, setSuccess] = React.useState(false)
  const [refNumber, setRefNumber] = React.useState('')
  const [hasDup, setHasDup] = React.useState(false)
  const [activeStep, setActiveStep] = React.useState(0)
  const [completedSteps, setCompletedSteps] = React.useState<Set<number>>(new Set())

  const [parent, setParent] = React.useState({
    parentFirstName: '', parentLastName: '', parentPhone: '', parentRelationship: 'PERE',
    address: '', acceptedTerms: false, acceptedPrivacy: false,
  })

  const [children, setChildren] = React.useState<ChildForm[]>([
    { childFirstName: '', childLastName: '', childBirthDate: '', childGender: 'M', childBirthPlace: '', previousSchool: '', desiredLevel: '' },
  ])

  const steps = [
    { num: 0, title: 'Parent', icon: '👨‍👩‍👧‍👦' },
    { num: 1, title: 'Enfants', icon: '🧒' },
    { num: 2, title: 'Documents', icon: '📚' },
    { num: 3, title: 'Envoi', icon: '✅' },
  ]

  function completeStep(step: number) {
    setCompletedSteps((prev) => new Set(prev).add(step))
    if (step < steps.length - 1) setActiveStep(step + 1)
  }

  function isStepComplete(step: number): boolean {
    if (step === 0) return !!parent.parentFirstName && !!parent.parentLastName && !!parent.parentPhone && parent.acceptedTerms && parent.acceptedPrivacy
    if (step === 1) return children.every((c) => !!c.childFirstName && !!c.childLastName)
    if (step === 2) return true
    return false
  }

  function addChild() {
    setChildren([...children, { childFirstName: '', childLastName: '', childBirthDate: '', childGender: 'M', childBirthPlace: '', previousSchool: '', desiredLevel: '' }])
  }

  function removeChild(index: number) {
    if (children.length > 1) setChildren(children.filter((_, i) => i !== index))
  }

  function updateChild(index: number, field: keyof ChildForm, value: string) {
    setChildren(children.map((c, i) => i === index ? { ...c, [field]: value } : c))
  }

  async function submit() {
    if (!isStepComplete(0) || !isStepComplete(1)) {
      toast.error('Veuillez compléter les étapes obligatoires.')
      return
    }
    setPending(true)
    try {
      const res = await fetch('/api/admissions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', ...parent, children }),
      })
      const data = await res.json()
      if (data.ok) {
        setSuccess(true)
        setRefNumber(data.referenceNumber)
        setHasDup(data.hasDuplicate)
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
              <div className={`h-16 w-16 rounded-full flex items-center justify-center ${hasDup ? 'bg-amber-100 dark:bg-amber-950' : 'bg-emerald-100 dark:bg-emerald-950'}`}>
                {hasDup ? <span className="text-3xl">⚠️</span> : <CheckCircle2 className="h-10 w-10 text-emerald-600" />}
              </div>
            </div>
            <h1 className="text-2xl font-bold">Demande soumise !</h1>
            <p className="text-sm text-muted-foreground">Référence : <strong className="font-mono text-primary">{refNumber}</strong></p>
            {hasDup && <p className="text-sm text-amber-600">⚠️ Un doublon potentiel a été détecté. Le secrétariat vérifiera votre dossier.</p>}
            <p className="text-xs text-muted-foreground">Le secrétariat va étudier votre dossier. Votre accès reste limité jusqu'à validation.</p>
            <Button onClick={() => router.push('/')} className="w-full">Retour à l'accueil</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 bg-gradient-to-br from-blue-50 to-teal-50 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Préinscription</h1>
            <p className="text-sm text-muted-foreground">Suivez les étapes ci-dessous</p>
          </div>
        </div>

        {/* Barre de progression */}
        <div className="flex items-center gap-2 mb-6">
          {steps.map((step, i) => (
            <React.Fragment key={step.num}>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                activeStep === step.num ? 'bg-primary text-primary-foreground' :
                completedSteps.has(step.num) ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
              }`}>
                {completedSteps.has(step.num) ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span>{step.icon}</span>}
                <span>{step.title}</span>
              </div>
              {i < steps.length - 1 && <div className="h-px flex-1 bg-border" />}
            </React.Fragment>
          ))}
        </div>

        {/* Étape 0 : Parent */}
        {activeStep === 0 && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-lg">Informations du parent/tuteur</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>Prénom *</Label><Input value={parent.parentFirstName} onChange={(e) => setParent({ ...parent, parentFirstName: e.target.value })} /></div>
                <div><Label>Nom *</Label><Input value={parent.parentLastName} onChange={(e) => setParent({ ...parent, parentLastName: e.target.value })} /></div>
                <div><Label>Téléphone/WhatsApp *</Label><Input value={parent.parentPhone} onChange={(e) => setParent({ ...parent, parentPhone: e.target.value })} placeholder="+243 ..." /></div>
                <div><Label>Lien</Label><select className="w-full p-2 border rounded-md bg-background text-sm" value={parent.parentRelationship} onChange={(e) => setParent({ ...parent, parentRelationship: e.target.value })}><option value="PERE">Père</option><option value="MERE">Mère</option><option value="TUTEUR">Tuteur</option><option value="AUTRE">Autre</option></select></div>
                <div className="sm:col-span-2"><Label>Adresse</Label><Input value={parent.address} onChange={(e) => setParent({ ...parent, address: e.target.value })} /></div>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={parent.acceptedTerms} onChange={(e) => setParent({ ...parent, acceptedTerms: e.target.checked })} /> J'accepte le règlement intérieur</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={parent.acceptedPrivacy} onChange={(e) => setParent({ ...parent, acceptedPrivacy: e.target.checked })} /> J'accepte la politique de confidentialité</label>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => router.push('/')}>Retour</Button>
                <Button onClick={() => completeStep(0)} disabled={!isStepComplete(0)}>Continuer</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Étape 1 : Enfants */}
        {activeStep === 1 && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Informations des enfants</h3>
                <Button size="sm" variant="outline" onClick={addChild}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
              </div>
              {children.map((child, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-3 relative">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm flex items-center gap-2"><User className="h-4 w-4" /> Enfant {index + 1}</p>
                    {children.length > 1 && <button onClick={() => removeChild(index)} className="text-red-500"><X className="h-4 w-4" /></button>}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label>Prénom *</Label><Input value={child.childFirstName} onChange={(e) => updateChild(index, 'childFirstName', e.target.value)} /></div>
                    <div><Label>Nom *</Label><Input value={child.childLastName} onChange={(e) => updateChild(index, 'childLastName', e.target.value)} /></div>
                    <div><Label>Date naissance</Label><Input type="date" value={child.childBirthDate} onChange={(e) => updateChild(index, 'childBirthDate', e.target.value)} /></div>
                    <div><Label>Genre</Label><select className="w-full p-2 border rounded-md bg-background text-sm" value={child.childGender} onChange={(e) => updateChild(index, 'childGender', e.target.value)}><option value="M">Masculin</option><option value="F">Féminin</option></select></div>
                    <div><Label>Lieu naissance</Label><Input value={child.childBirthPlace} onChange={(e) => updateChild(index, 'childBirthPlace', e.target.value)} /></div>
                    <div><Label>École précédente</Label><Input value={child.previousSchool} onChange={(e) => updateChild(index, 'previousSchool', e.target.value)} /></div>
                    <div className="sm:col-span-2"><Label>Niveau souhaité</Label><Input value={child.desiredLevel} onChange={(e) => updateChild(index, 'desiredLevel', e.target.value)} placeholder="Ex: 6ème, CP1..." /></div>
                  </div>
                </div>
              ))}
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setActiveStep(0)}>Retour</Button>
                <Button onClick={() => completeStep(1)} disabled={!isStepComplete(1)}>Continuer</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Étape 2 : Documents */}
        {activeStep === 2 && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-lg">Documents</h3>
              <p className="text-sm text-muted-foreground">Les documents pourront être téléversés après soumission depuis votre espace.</p>
              <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">📋 Votre demande sera vérifiée par le secrétariat. L'admission n'est définitive qu'après validation.</p>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setActiveStep(1)}>Retour</Button>
                <Button onClick={() => completeStep(2)}>Continuer</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Étape 3 : Envoi */}
        {activeStep === 3 && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-lg">Récapitulatif</h3>
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="font-medium text-sm mb-1">Parent</p>
                <p className="text-sm">{parent.parentFirstName} {parent.parentLastName} · {parent.parentPhone}</p>
              </div>
              {children.map((child, i) => (
                <div key={i} className="p-3 bg-muted/30 rounded-lg">
                  <p className="font-medium text-sm mb-1">Enfant {i + 1}</p>
                  <p className="text-sm">{child.childFirstName} {child.childLastName}</p>
                  {child.childBirthDate && <p className="text-xs text-muted-foreground">Né(e) le {new Date(child.childBirthDate).toLocaleDateString('fr-FR')}</p>}
                </div>
              ))}
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setActiveStep(2)}>Retour</Button>
                <Button onClick={submit} disabled={pending} size="lg">
                  {pending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Envoi...</> : <><CheckCircle2 className="h-4 w-4 mr-2" /> Envoyer</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
