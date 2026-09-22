'use client'

import * as React from 'react'
import { useActionState } from 'react'
import { GraduationCap, Lock, Mail, Loader2, Eye, EyeOff, User, Users, Briefcase, Wallet, Server, BookOpen, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { loginAction } from '@/lib/actions'
import { ThemeToggle } from '@/components/ss/theme-toggle'

// ✅ 7 comptes démo cliquables directement sur la page
const DEMO_ACCOUNTS = [
  { label: 'Direction',     email: 'direction@smartshule.demo',  role: 'DIRECTION',  icon: Shield,    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  { label: 'Professeur',   email: 'prof@smartshule.demo',       role: 'TEACHER',    icon: BookOpen,  color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  { label: 'Comptable',    email: 'comptable@smartshule.demo',  role: 'ACCOUNTANT', icon: Wallet,    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  { label: 'Secrétariat',  email: 'secretaire@smartshule.demo', role: 'SECRETARY',  icon: Briefcase, color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  { label: 'Parent',       email: 'parent@smartshule.demo',     role: 'PARENT',     icon: Users,     color: 'bg-pink-500/10 text-pink-600 dark:text-pink-400' },
  { label: 'Élève',        email: 'eleve@smartshule.demo',       role: 'STUDENT',   icon: User,      color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400' },
  { label: 'PromoServeur', email: 'server@smartshule.demo',     role: 'SERVER',    icon: Server,    color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400' },
]

const DEMO_PASSWORD = 'SmartShule2026!'

export function LoginForm({ schoolName, schoolSlogan }: { schoolName: string; schoolSlogan?: string }) {
  const [state, formAction, isPending] = useActionState(loginAction, null)
  const [showPassword, setShowPassword] = React.useState(false)
  const [selectedAccount, setSelectedAccount] = React.useState<string>('')

  function selectAccount(email: string) {
    setSelectedAccount(email)
    const emailInput = document.getElementById('email') as HTMLInputElement
    const passwordInput = document.getElementById('password') as HTMLInputElement
    if (emailInput) emailInput.value = email
    if (passwordInput) passwordInput.value = DEMO_PASSWORD
  }

  return (
    <div className="relative min-h-screen flex flex-col lg:flex-row">
      {/* Panneau gauche (décoratif) */}
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
      <div className="flex flex-1 items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md space-y-6">
          <div className="flex justify-between items-center">
            <div className="lg:hidden flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <GraduationCap className="h-5 w-5" />
              </div>
              <span className="font-semibold">SmartShule</span>
            </div>
            <div className="ml-auto">
              <ThemeToggle />
            </div>
          </div>

          <Card className="ss-shadow-card">
            <CardHeader>
              <CardTitle className="text-xl">Connexion au portail</CardTitle>
              <CardDescription>
                Accédez à l'espace {schoolName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={formAction} className="space-y-4">
                {state && !state.ok && (
                  <Alert variant="destructive">
                    <AlertDescription>{state.error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
              </form>

              {/* 7 comptes démo cliquables */}
              <div className="mt-6 pt-4 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground mb-3">
                  🔑 Comptes de démonstration (cliquez pour vous connecter) :
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {DEMO_ACCOUNTS.map((acc) => {
                    const Icon = acc.icon
                    const isSelected = selectedAccount === acc.email
                    return (
                      <button
                        key={acc.email}
                        type="button"
                        onClick={() => selectAccount(acc.email)}
                        className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs transition-all hover:bg-muted ${isSelected ? 'border-primary bg-primary/5' : 'border-border bg-muted/40'}`}
                        title={`Se connecter en tant que ${acc.label}`}
                      >
                        <div className={`flex h-6 w-6 items-center justify-center rounded ${acc.color}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <span className="font-medium">{acc.label}</span>
                      </button>
                    )
                  })}
                </div>
                <div className="mt-3 p-2 bg-muted/40 rounded-md">
                  <p className="text-[11px] text-muted-foreground">
                    🔒 Mot de passe commun pour tous les comptes :{' '}
                    <code className="font-mono text-primary font-semibold">{DEMO_PASSWORD}</code>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            SmartShule © 2026-2027 — Plateforme sécurisée. Toutes les actions sont journalisées.
          </p>
        </div>
      </div>
    </div>
  )
}
