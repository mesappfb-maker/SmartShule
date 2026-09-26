// SmartShule — Layout admin central (protégé par session admin)
// ============================================================
// Toutes les routes /admin/* sont protégées par une session séparée
// du login principal. Seul Fabrice (fabricefb@gmail.com) y a accès.

import { redirect } from 'next/navigation'
import { getUserFromSession } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'
import { LayoutDashboard, Building2, KeyRound, LogOut, ExternalLink } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getUserFromSession()

  // Pas connecté → rediriger vers login admin (séparé pour éviter boucle)
  if (!user) {
    redirect('/admin-login')
  }

  // Vérifier que c'est bien Fabrice (le propriétaire)
  if (user.email !== 'fabricefb@gmail.com' || user.role !== 'SYSTEM_ADMIN') {
    redirect('/admin-login?error=unauthorized')
  }

  // Récupérer l'école associée (optionnel)
  const school = await db.school.findFirst().catch(() => null)

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar admin central */}
      <aside className="w-64 border-r border-border bg-muted/30 flex-col hidden md:flex shrink-0">
        <div className="p-4 border-b border-border">
          <p className="font-semibold text-sm">SmartShule</p>
          <p className="text-xs text-muted-foreground">Central Admin</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          <Link href="/admin/dashboard" className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted/50 transition-colors">
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </Link>
          <Link href="/admin/schools" className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted/50 transition-colors">
            <Building2 className="h-4 w-4" /> Écoles clientes
          </Link>
          <Link href="/admin/licenses" className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted/50 transition-colors">
            <KeyRound className="h-4 w-4" /> Licences
          </Link>
          <div className="pt-4 border-t mt-4">
            <Link href="/" target="_blank" className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
              <ExternalLink className="h-3 w-3" /> Voir le site démo
            </Link>
          </div>
        </nav>
        <div className="p-3 border-t border-border">
          <div className="mb-2">
            <p className="text-xs text-muted-foreground">Connecté en tant que</p>
            <p className="text-sm font-medium truncate">{user.displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
              <LogOut className="h-3 w-3" /> Se déconnecter
            </button>
          </form>
        </div>
      </aside>

      {/* Contenu principal */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
