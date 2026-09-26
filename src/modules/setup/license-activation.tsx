'use client'

// SmartShule — Page d'activation de licence (premier lancement)
// ============================================================
// Affichée quand la base est vide (installateur commercial).
// L'utilisateur saisit sa clé de licence (SMART-XXXX-XXXX-XXXX-XXXX).
// Vérification online sur le serveur central (smartshule-seven.vercel.app/api/license/verify).
// Si valide → wizard de configuration (école + admin).

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { KeyRound, Loader2, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

type Step = 'activation' | 'config-school' | 'config-admin' | 'done'

interface LicenseData {
  key: string
  plan: string
  schoolName: string
  contactEmail: string
  expiresAt: string | null
  maxStudents: number
  maxDevices: number
}

export function LicenseActivationPage() {
  const [step, setStep] = useState<Step>('activation')
  const [licenseKey, setLicenseKey] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [license, setLicense] = useState<LicenseData | null>(null)

  // Wizard config école
  const [schoolName, setSchoolName] = useState('')
  const [schoolSlogan, setSchoolSlogan] = useState('')
  const [schoolAddress, setSchoolAddress] = useState('')
  const [schoolPhone, setSchoolPhone] = useState('')
  const [schoolEmail, setSchoolEmail] = useState('')

  // Wizard config admin
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('')
  const [creating, setCreating] = useState(false)

  async function verifyLicense() {
    setVerifying(true)
    try {
      const deviceId = `PC-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      const machineName = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'

      const res = await fetch('https://smartshule-seven.vercel.app/api/license/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey, deviceId, machineName }),
      })

      const data = await res.json()

      if (!data.ok) {
        toast.error(data.error || 'Licence invalide')
        return
      }

      setLicense(data.license)
      setSchoolName(data.license.schoolName || '')
      setSchoolEmail(data.license.contactEmail || '')
      toast.success(`Licence validée — Plan ${data.license.plan}`)
      setStep('config-school')
    } catch (err) {
      toast.error('Erreur réseau : ' + (err as Error).message)
    } finally {
      setVerifying(false)
    }
  }

  function configureSchool() {
    if (!schoolName) {
      toast.error('Nom de l\'école obligatoire')
      return
    }
    setStep('config-admin')
  }

  async function createAdminAndFinish() {
    if (!adminName || !adminEmail || !adminPassword) {
      toast.error('Tous les champs sont obligatoires')
      return
    }
    if (adminPassword !== adminPasswordConfirm) {
      toast.error('Les mots de passe ne correspondent pas')
      return
    }
    if (adminPassword.length < 8) {
      toast.error('Le mot de passe doit faire au moins 8 caractères')
      return
    }

    setCreating(true)
    try {
      const res = await fetch('/api/setup/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey,
          school: {
            name: schoolName,
            slogan: schoolSlogan || undefined,
            address: schoolAddress || undefined,
            phone: schoolPhone || undefined,
            email: schoolEmail || undefined,
          },
          admin: {
            displayName: adminName,
            email: adminEmail,
            password: adminPassword,
          },
        }),
      })

      const data = await res.json()
      if (!data.ok) throw new Error(data.error)

      toast.success('Configuration terminée ! Redirection...')
      setStep('done')

      setTimeout(() => {
        window.location.href = '/'
      }, 2000)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-teal-50 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="max-w-2xl w-full">
        {/* En-tête */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
            <KeyRound className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">SmartShule</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Activation de votre licence — Étape {step === 'activation' ? '1/3' : step === 'config-school' ? '2/3' : '3/3'}
          </p>
        </div>

        {/* Indicateur de progression */}
        <div className="flex items-center justify-center mb-8 gap-2">
          {['activation', 'config-school', 'config-admin'].map((s, i) => {
            const stepIndex = ['activation', 'config-school', 'config-admin', 'done'].indexOf(step)
            const isActive = i <= stepIndex
            return (
              <div
                key={s}
                className={`h-2 rounded-full transition-all ${isActive ? 'bg-primary w-16' : 'bg-muted w-8'}`}
              />
            )
          })}
        </div>

        {/* ÉTAPE 1 : Activation de licence */}
        {step === 'activation' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <KeyRound className="h-5 w-5" /> Activation de licence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Clé de licence</Label>
                <Input
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                  placeholder="SMART-XXXX-XXXX-XXXX-XXXX"
                  className="font-mono text-center text-lg tracking-wider"
                  maxLength={24}
                />
                <p className="text-xs text-muted-foreground">
                  Saisissez la clé de licence fournie par SmartShule.
                </p>
              </div>

              <Button
                onClick={verifyLicense}
                disabled={verifying || licenseKey.length < 24}
                className="w-full"
                size="lg"
              >
                {verifying ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Vérification...</>
                ) : (
                  <>Vérifier la licence <ArrowRight className="h-4 w-4 ml-2" /></>
                )}
              </Button>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md text-xs text-blue-700 dark:text-blue-300">
                <strong>Comment obtenir une licence ?</strong>
                <br />
                Contactez SmartShule au +243 999 071 754 ou visitez smartshule-seven.vercel.app
              </div>
            </CardContent>
          </Card>
        )}

        {/* ÉTAPE 2 : Configuration de l'école */}
        {step === 'config-school' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" /> Configuration de l'école
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {license && (
                <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-md text-sm">
                  <p className="font-medium text-green-700 dark:text-green-300">
                    ✓ Licence validée — Plan {license.plan}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Expire le {license.expiresAt ? new Date(license.expiresAt).toLocaleDateString('fr-FR') : 'à vie'} ·
                    Max {license.maxStudents} élèves · {license.maxDevices} appareil(s)
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Nom de l'établissement *</Label>
                <Input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="Ex: Institution Saint Joseph" />
              </div>

              <div className="space-y-2">
                <Label>Slogan</Label>
                <Input value={schoolSlogan} onChange={(e) => setSchoolSlogan(e.target.value)} placeholder="Ex: Savoir, Discipline, Réussite" />
              </div>

              <div className="space-y-2">
                <Label>Adresse</Label>
                <Input value={schoolAddress} onChange={(e) => setSchoolAddress(e.target.value)} placeholder="Ex: 12, Avenue de l'Éducation, Kinshasa" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input value={schoolPhone} onChange={(e) => setSchoolPhone(e.target.value)} placeholder="+243 8XX XXX XXX" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={schoolEmail} onChange={(e) => setSchoolEmail(e.target.value)} placeholder="contact@ecole.cd" />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep('activation')}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Retour
                </Button>
                <Button onClick={configureSchool} className="flex-1">
                  Continuer <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ÉTAPE 3 : Création du compte admin */}
        {step === 'config-admin' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <KeyRound className="h-5 w-5" /> Compte administrateur
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Créez votre compte administrateur. Ces identifiants seront utilisés pour vous connecter à SmartShule.
              </p>

              <div className="space-y-2">
                <Label>Nom complet *</Label>
                <Input value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Ex: Jean Mbumba" />
              </div>

              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="direction@ecole.cd" />
              </div>

              <div className="space-y-2">
                <Label>Mot de passe *</Label>
                <Input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="••••••••" />
                <p className="text-xs text-muted-foreground">Minimum 8 caractères</p>
              </div>

              <div className="space-y-2">
                <Label>Confirmer le mot de passe *</Label>
                <Input type="password" value={adminPasswordConfirm} onChange={(e) => setAdminPasswordConfirm(e.target.value)} placeholder="••••••••" />
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep('config-school')}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Retour
                </Button>
                <Button onClick={createAdminAndFinish} disabled={creating} className="flex-1">
                  {creating ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Configuration...</>
                  ) : (
                    <>Terminer la configuration <CheckCircle2 className="h-4 w-4 ml-2" /></>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ÉTAPE 4 : Terminé */}
        {step === 'done' && (
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold">Configuration terminée !</h2>
              <p className="text-sm text-muted-foreground">
                Votre installation SmartShule est prête.
                Vous allez être redirigé vers la page de connexion.
              </p>
              <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-muted-foreground">
            SmartShule © 2026 — L'intelligence qui rapproche l'école et la famille.
          </p>
        </div>
      </div>
    </div>
  )
}
