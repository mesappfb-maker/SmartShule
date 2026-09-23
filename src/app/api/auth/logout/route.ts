// API : Déconnexion simple (supprime le cookie de session)
import { NextResponse } from 'next/server'
import { getUserFromSession, clearSessionCookie } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const user = await getUserFromSession()
    if (user) {
      // Révoquer la session en DB
      const session = await db.session.findFirst({
        where: { userId: user.id, revokedAt: null },
      })
      if (session) {
        await db.session.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        })
      }
    }

    const response = NextResponse.redirect(new URL('/', process.env.NEXTAUTH_URL || 'https://smart-shule-seven.vercel.app'))
    // Supprimer le cookie
    response.cookies.delete('ss_session')
    return response
  } catch (err) {
    // Même en cas d'erreur, rediriger vers la page de connexion
    const response = NextResponse.redirect(new URL('/', process.env.NEXTAUTH_URL || 'https://smart-shule-seven.vercel.app'))
    response.cookies.delete('ss_session')
    return response
  }
}
