'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { GraduationCap, Lock, Mail, Loader2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ThemeToggle } from '@/components/ss/theme-toggle'
import { toast } from 'sonner'

export function LoginForm({ schoolName, schoolSlogan, schoolLogoUrl, primaryColor, secondaryColor }: { schoolName: string; schoolSlogan?: string; schoolLogoUrl?: string; primaryColor?: string; secondaryColor?: string }) {
  const [error, setError] = React.useState<string | null>(null)
  const [isPending, setIsPending] = React.useState(false)
  const [showPassword, setShowPassword] = React.useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setIsPending(true)

    const formData = new FormData(e.currentTarget)
    const email = String(formData.get('email') || '').trim().toLowerCase()
    const password = String(formData.get('password') || '')

    if (!email || !password) {
      setError('Veuillez saisir votre email et votre mot de passe.')
      setIsPending(false)
      return
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()

      if (data.ok) {
        // Recharger la page (tout est sur /)
        window.location.href = '/'
      } else {
        setError(data.error || 'Erreur de connexion.')
      }
    } catch (err) {
      setError('Erreur réseau : ' + (err as Error).message)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Contenu principal - 2 colonnes sur desktop, 1 colonne sur mobile */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Panneau gauche (décoratif) - visible seulement sur desktop */}
        <div
          className="hidden lg:flex lg:w-1/2 p-12 flex-col justify-between text-white relative overflow-hidden"
          style={{
            background: primaryColor && secondaryColor
              ? `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
              : 'linear-gradient(135deg, #1e40af 0%, #0e7490 100%)',
          }}
        >
          {/* Image de fond si logo présent, sinon pattern décoratif */}
          {schoolLogoUrl ? (
            <div
              className="absolute inset-0 bg-cover bg-center opacity-10"
              style={{ backgroundImage: `url(${schoolLogoUrl})` }}
            />
          ) : (
            <div className="absolute inset-0 opacity-5">
              <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-white blur-3xl" />
              <div className="absolute bottom-0 -left-20 w-80 h-80 rounded-full bg-white blur-3xl" />
            </div>
          )}

          {/* Logo + nom école */}
          <div className="relative z-10 flex items-center gap-3">
            {schoolLogoUrl ? (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/90 backdrop-blur shadow-lg overflow-hidden">
                <img src={schoolLogoUrl} alt={schoolName} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
                <GraduationCap className="h-6 w-6" />
              </div>
            )}
            <div>
              <p className="text-lg font-semibold">{schoolName || 'SmartShule'}</p>
              <p className="text-xs text-white/80">Portail famille & direction</p>
            </div>
          </div>

          <div className="space-y-4 max-w-md">
            <h1 className="text-3xl xl:text-4xl font-semibold leading-tight">
              {schoolSlogan || 'L\'intelligence qui rapproche l\'école et la famille.'}
            </h1>
            <p className="text-primary-foreground/80">
              Consultez les résultats, bulletins, devoirs et frais de vos enfants.
              Communiquez avec la direction via une messagerie institutionnelle sécurisée.
            </p>
          </div>

          <div className="flex items-center gap-6 text-xs text-white/70">
            <div>
              <p className="font-semibold text-white text-lg">2 500+</p>
              <p>Élèves accompagnés</p>
            </div>
            <div>
              <p className="font-semibold text-white text-lg">98%</p>
              <p>De satisfaction</p>
            </div>
            <div>
              <p className="font-semibold text-white text-lg">24/7</p>
              <p>Accès portail</p>
            </div>
          </div>
        </div>

        {/* Panneau droit (formulaire) */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-12 bg-background overflow-y-auto">
          <div className="w-full max-w-md space-y-6 my-4">
            {/* En-tête mobile */}
            <div className="flex justify-between items-center lg:hidden">
              <div className="flex items-center gap-2">
                {schoolLogoUrl ? (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow overflow-hidden">
                    <img src={schoolLogoUrl} alt={schoolName} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                )}
                <span className="font-semibold">SmartShule</span>
              </div>
              <ThemeToggle />
            </div>

            {/* En-tête desktop (toggle en haut à droite) */}
            <div className="hidden lg:flex justify-end">
              <ThemeToggle />
            </div>

            {/* Carte de connexion */}
            <Card className="ss-shadow-card">
              <CardHeader className="space-y-1">
                <CardTitle className="text-xl">Connexion au portail</CardTitle>
                <CardDescription>
                  Accédez à l'espace {schoolName}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="vous@exemple.com"
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Mot de passe</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        placeholder="••••••••"
                        className="pl-9 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:bg-muted"
                        tabIndex={-1}
                        aria-label={showPassword ? 'Masquer' : 'Afficher'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button type="submit" disabled={isPending} className="w-full">
                    {isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Connexion…
                      </>
                    ) : (
                      'Se connecter'
                    )}
                  </Button>

                  {/* Séparateur */}
                  <div className="relative my-2">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">ou</span>
                    </div>
                  </div>

                  {/* Login Google */}
                  <a
                    href="/api/auth/google"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-muted/50 transition-colors"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continuer avec Google
                  </a>

                  {/* Lien inscription */}
                  <p className="text-center text-sm text-muted-foreground pt-2">
                    Pas encore de compte ?{' '}
                    <Link href="/register" className="text-primary hover:underline font-medium">
                      Créer un compte parent
                    </Link>
                  </p>
                </form>
              </CardContent>
            </Card>

            {/* Footer */}
            <div className="space-y-1.5 text-center">
              <p className="text-xs text-muted-foreground">
                SmartShule © 2026-2027 — Plateforme sécurisée. Toutes les actions sont journalisées.
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 lg:hidden">
                📞 Renseignements : +243 999 071 754
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
