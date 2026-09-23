// SmartShule — Page d'accueil = page de connexion
// ============================================================
// Si déjà connecté → /dashboard
// Si non connecté → affiche le formulaire de connexion directement (pas de redirection)

import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LoginForm } from '@/modules/auth/login-form'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const user = await getUserFromSession()
  if (user) redirect('/dashboard')

  const school = await db.school.findFirst()

  return (
    <LoginForm
      schoolName={school?.name || 'SmartShule'}
      schoolSlogan={school?.slogan || undefined}
    />
  )
}
