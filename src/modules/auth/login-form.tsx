'use client'

import * as React from 'react'
import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { GraduationCap, Lock, Mail, Loader2, Eye, EyeOff, User, Users, Briefcase, Wallet, Server, BookOpen, Shield, Phone, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { loginAction } from '@/lib/actions'
import { ThemeToggle } from '@/components/ss/theme-toggle'

// ✅ 7 comptes démo cliquables directement sur la page
const DEMO_ACCOUNTS = [
  { label: 'Direction',     email: 'direction@smartshule.demo',  role: 'DIRECTION',  icon: Shield,    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  { label: 'Professeur',    email: 'prof@smartshule.demo',       role: 'TEACHER',    icon: BookOpen,  color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  { label: 'Comptable',     email: 'comptable@smartshule.demo',   role: 'ACCOUNTANT', icon: Wallet,    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  { label: 'Secrétariat',   email: 'secretaire@smartshule.demo',  role: 'SECRETARY',  icon: Briefcase, color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
  { label: 'Parent',        email: 'parent@smartshule.demo',      role: 'PARENT',     icon: Users,     color: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20' },
  { label: 'Élève',         email: 'eleve@smartshule.demo',        role: 'STUDENT',   icon: User,      color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20' },
  { label: 'PromoServeur',  email: 'server@smartshule.demo',      role: 'SERVER',    icon: Server,    color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' },
]

const DEMO_PASSWORD = 'SmartShule2026!'

export function LoginForm({ schoolName, schoolSlogan }: { schoolName: string; schoolSlogan?: string }) {
  const [state, formAction, isPending] = useActionState(loginAction, null)
  const [showPassword, setShowPassword] = React.useState(false)
  const [selectedAccount, setSelectedAccount] = React.useState<string>('')
  const router = useRouter()

  // Rediriger vers /dashboard après connexion réussie
  React.useEffect(() => {
    if (state && state.ok) {
      router.push('/dashboard')
    }
  }, [state, router])

  function selectAccount(email: string) {
    setSelectedAccount(email)
    const emailInput = document.getElementById('email') as HTMLInputElement
    const passwordInput = document.getElementById('password') as HTMLInputElement
    if (emailInput) emailInput.value = email
    if (passwordInput) passwordInput.value = DEMO_PASSWORD
  }

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Bannière marketing temporaire - À SUPPRIMER */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-medium">
            <Monitor className="h-4 w-4 shrink-0" />
            <span>
              <strong>Version démo en ligne</strong> — Logiciel conçu pour ordinateur desktop (Windows/macOS/Linux)
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-xs sm:text-sm bg-white/20 px-3 py-0.5 rounded-full">
            <Phone className="h-3 w-3" />
            <span>Renseignements : <strong>+243 999 071 754</strong></span>
          </div>
        </div>
      </div>

      {/* Contenu principal - 2 colonnes sur desktop, 1 colonne sur mobile */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Panneau gauche (décoratif) - visible seulement sur desktop */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary to-[var(--ss-color-secondary)] p-12 flex-col justify-between text-primary-foreground">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-semibold">SmartShule</p>
              <p className="text-xs text-primary-foreground/80">Portail famille</p>
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

          <div className="flex items-center gap-6 text-xs text-primary-foreground/70">
            <div>
              <p className="font-semibold text-primary-foreground text-lg">2 500+</p>
              <p>Élèves accompagnés</p>
            </div>
            <div>
              <p className="font-semibold text-primary-foreground text-lg">98%</p>
              <p>De satisfaction</p>
            </div>
            <div>
              <p className="font-semibold text-primary-foreground text-lg">24/7</p>
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
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <GraduationCap className="h-5 w-5" />
                </div>
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
                <form action={formAction} className="space-y-4">
                  {state && !state.ok && (
                    <Alert variant="destructive">
                      <AlertDescription>{state.error}</AlertDescription>
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

                {/* 7 comptes démo cliquables */}
                <div className="pt-4 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-3 text-center sm:text-left">
                    🔑 Comptes de démonstration (cliquez pour vous connecter)
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {DEMO_ACCOUNTS.map((acc) => {
                      const Icon = acc.icon
                      const isSelected = selectedAccount === acc.email
                      return (
                        <button
                          key={acc.email}
                          type="button"
                          onClick={() => selectAccount(acc.email)}
                          className={`flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1.5 sm:gap-2 rounded-md border px-2 py-2 text-xs transition-all hover:bg-muted/60 ${isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-muted/30'}`}
                          title={`Se connecter en tant que ${acc.label}`}
                        >
                          <div className={`flex h-6 w-6 items-center justify-center rounded ${acc.color} border`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <span className="font-medium text-center sm:text-left">{acc.label}</span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="mt-3 p-2.5 bg-muted/40 rounded-md text-center">
                    <p className="text-[11px] text-muted-foreground">
                      🔒 Mot de passe commun :{' '}
                      <code className="font-mono text-primary font-semibold">{DEMO_PASSWORD}</code>
                    </p>
                  </div>
                </div>
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
