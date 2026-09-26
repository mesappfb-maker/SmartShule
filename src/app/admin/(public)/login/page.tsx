// SmartShule — Page de login admin central (Fabrice uniquement)
// ============================================================
// Login séparé du login principal pour éviter tout accès non autorisé

import { redirect } from 'next/navigation'
import { getUserFromSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const user = await getUserFromSession()
  if (user && user.email === 'fabricefb@gmail.com') {
    redirect('/admin/dashboard')
  }

  const errorMsg = searchParams.error === 'unauthorized'
    ? 'Ce compte n\'a pas accès à l\'administration centrale.'
    : null

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

        {errorMsg && (
          <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-700 dark:text-red-300">
            {errorMsg}
          </div>
        )}

        <form action="/api/auth/login" method="POST" className="space-y-4">
          <input type="hidden" name="source" value="admin" />
          <div className="space-y-2">
            <label className="text-sm font-medium">Email propriétaire</label>
            <input
              type="email"
              name="email"
              required
              placeholder="fabricefb@gmail.com"
              className="w-full px-3 py-2 border rounded-md bg-background"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Mot de passe</label>
            <input
              type="password"
              name="password"
              required
              placeholder="••••••••"
              className="w-full px-3 py-2 border rounded-md bg-background"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
          >
            Se connecter
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
