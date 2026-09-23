// SmartShule — API publique : Articles filtrés par rôle
// ============================================================
// GET /api/articles?role=PARENT
// Retourne les articles PUBLISHED visibles pour le rôle donné

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const url = new URL(req.url)
    const category = url.searchParams.get('category')
    const limit = parseInt(url.searchParams.get('limit') || '20', 10)

    const articles = await db.article.findMany({
      where: {
        schoolId,
        status: 'PUBLISHED',
        ...(category ? { category } : {}),
      },
      orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }],
      take: Math.min(limit, 100),
    })

    // Filtrer par rôle cible
    const userRole = user.role
    const filtered = articles.filter((a) => {
      if (a.targetRoles === 'ALL') return true
      return a.targetRoles.split(',').map((r) => r.trim()).includes(userRole)
    })

    return NextResponse.json({
      ok: true,
      articles: filtered.map((a) => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        excerpt: a.excerpt,
        content: a.content,
        category: a.category,
        imageUrl: a.imageUrl,
        imageAlt: a.imageAlt,
        publishedAt: a.publishedAt?.toISOString() || a.createdAt.toISOString(),
        pinned: a.pinned,
      })),
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
