// SmartShule — Page de connexion alternative (/login)
// ============================================================
// Affiche le formulaire de connexion sans redirection

import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LoginForm } from '@/modules/auth/login-form'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
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
