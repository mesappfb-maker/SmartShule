// API : Déconnexion simple (supprime le cookie de session)
// Utilise l'URL de la requête pour la redirection (compatible Vercel + localhost + Electron)
import { NextResponse } from 'next/server'
import { getUserFromSession, clearSessionCookie } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

function getBaseUrl(request: Request): string {
  // 1. Utiliser l'URL de la requête (compatible Vercel, localhost, Electron)
  const url = new URL(request.url)
  return `${url.protocol}//${url.host}`
}

export async function POST(request: Request) {
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

    const baseUrl = getBaseUrl(request)
    const response = NextResponse.redirect(new URL('/', baseUrl))
    // Supprimer le cookie avec les bonnes options
    response.cookies.delete('ss_session')
    response.cookies.set('ss_session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    })
    return response
  } catch (err) {
    console.error('[logout] Error:', err)
    // Même en cas d'erreur, rediriger vers la page de connexion
    const baseUrl = getBaseUrl(request)
    const response = NextResponse.redirect(new URL('/', baseUrl))
    response.cookies.delete('ss_session')
    response.cookies.set('ss_session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    })
    return response
  }
}
