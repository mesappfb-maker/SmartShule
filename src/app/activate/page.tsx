'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { GraduationCap, Loader2, CheckCircle2, KeyRound, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'

export default function ActivatePage() {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [activated, setActivated] = React.useState(false)
  const [licenseKey, setLicenseKey] = React.useState('')
  const [activationCode, setActivationCode] = React.useState('')
  const [licenseInfo, setLicenseInfo] = React.useState<any>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!licenseKey || !activationCode) {
      toast.error('Clé de licence et code d\'activation obligatoires')
      return
    }
    setPending(true)
    try {
      const res = await fetch('/api/license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'activate',
          licenseKey,
          activationCode,
          machineId: 'web-demo-' + Math.random().toString(36).slice(2, 10),
          machineName: navigator.userAgent.substring(0, 50),
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setActivated(true)
        setLicenseInfo(data.license)
        toast.success('Licence activée !')
      } else {
        toast.error(data.error)
      }
    } catch (err) {
      toast.error('Erreur : ' + (err as Error).message)
    } finally {
      setPending(false)
    }
  }

  if (activated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-primary to-[#0F766E]">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold">Licence activée !</h1>
            <div className="text-left p-4 bg-muted rounded-lg space-y-2 text-sm">
              <p><strong>École :</strong> {licenseInfo?.clientName}</p>
              <p><strong>Plan :</strong> {licenseInfo?.planType}</p>
              <p><strong>Élèves max :</strong> {licenseInfo?.maxStudents}</p>
              <p><strong>Modules :</strong> {licenseInfo?.modules}</p>
              <p><strong>Expire le :</strong> {licenseInfo?.expiresAt ? new Date(licenseInfo.expiresAt).toLocaleDateString('fr-FR') : 'À vie'}</p>
            </div>
            <Button onClick={() => router.push('/')} className="w-full">
              Accéder à l'application
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-primary to-[#0F766E]">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <div className="h-16 w-16 rounded-xl bg-white flex items-center justify-center">
              <img src="/logo-officiel.jpeg" alt="SmartShule" className="h-12 w-12 rounded-lg" />
            </div>
          </div>
          <CardTitle className="text-2xl">Activation de SmartShule</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Saisissez votre clé de licence et votre code d'activation
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="licenseKey">
                <KeyRound className="h-4 w-4 inline mr-1" />
                Clé de licence
              </Label>
              <Input
                id="licenseKey"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
                className="text-center font-mono text-lg tracking-wider"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="activationCode">
                <ShieldCheck className="h-4 w-4 inline mr-1" />
                Code d'activation
              </Label>
              <Input
                id="activationCode"
                value={activationCode}
                onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                placeholder="AC-XXXXXX-XXXXXX-XXXXXX"
                className="text-center font-mono text-lg tracking-wider"
                required
              />
            </div>
            <Button type="submit" disabled={pending} className="w-full" size="lg">
              {pending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
              Activer ma licence
            </Button>
          </form>
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
            <p className="text-xs text-muted-foreground">
              🔒 Votre licence est liée à cet ordinateur. Une fois activée, elle ne peut pas être transférée sans autorisation.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
