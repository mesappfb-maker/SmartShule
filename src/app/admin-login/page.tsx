'use client'

// SmartShule — Page de login admin central (Fabrice uniquement)
// ============================================================
// Login séparé du login principal. Envoie JSON à /api/auth/login.
// Après succès, redirige vers /admin/dashboard.

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function AdminLoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const unauthorized = searchParams.get('error') === 'unauthorized'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!data.ok) {
        setError(data.error || 'Email ou mot de passe incorrect')
        return
      }

      // Vérifier que c'est bien le compte admin
      if (data.role !== 'SYSTEM_ADMIN') {
        setError('Ce compte n\'a pas accès à l\'administration centrale.')
        return
      }

      // Rediriger vers le dashboard admin
      router.push('/admin/dashboard')
      router.refresh()
    } catch (err) {
      setError('Erreur réseau : ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="max-w-md w-full bg-card rounded-2xl shadow-2xl p-8 space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="text-3xl">🔐</span>
          </div>
          <h1 className="text-2xl font-bold">Central Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Accès réservé au propriétaire SmartShule
          </p>
        </div>

        {unauthorized && (
          <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-700 dark:text-red-300">
            Ce compte n'a pas accès à l'administration centrale.
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Email propriétaire</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="fabricefb@gmail.com"
              className="w-full px-3 py-2 border rounded-md bg-background"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-3 py-2 border rounded-md bg-background"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <div className="text-center">
          <a href="/" className="text-xs text-muted-foreground hover:text-foreground">
            ← Retour au site démo
          </a>
        </div>
      </div>
    </div>
  )
}
