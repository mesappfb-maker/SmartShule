// SmartShule — API unifiée Contenu & Communication
// ============================================================
// Gère : Articles, Contacts, Slideshow, Réceptions
// RBAC : DIRECTION/ADMIN pour écriture, tous pour lecture (articles filtrés par rôle)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'
import { getSchoolIdForUser } from '@/lib/school-context'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

// ============================================================
// POST : actions dispatch (création)
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (user.role !== 'DIRECTION' && user.role !== 'ADMIN' && user.role !== 'SECRETARY') {
      return NextResponse.json({ ok: false, error: 'Accès réservé à la Direction/Secrétariat.' }, { status: 403 })
    }

    const body = await req.json()
    const { action } = body

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const h = await headers()
    const ip = getClientIP(h)

    switch (action) {
      // ============================================================
      // ARTICLES
      // ============================================================
      case 'create-article': {
        const { title, excerpt, content, category, targetRoles, imageUrl, imageAlt, published, pinned } = body
        if (!title || !content) {
          return NextResponse.json({ ok: false, error: 'Titre et contenu obligatoires.' }, { status: 400 })
        }
        let slug = slugify(title)
        const existing = await db.article.findUnique({ where: { schoolId_slug: { schoolId, slug } } })
        if (existing) slug = `${slug}-${Date.now().toString(36)}`

        const article = await db.article.create({
          data: {
            schoolId,
            title,
            slug,
            excerpt: excerpt || null,
            content,
            category: category || 'GENERAL',
            targetRoles: targetRoles || 'ALL',
            imageUrl: imageUrl || null,
            imageAlt: imageAlt || null,
            status: published ? 'PUBLISHED' : 'DRAFT',
            publishedAt: published ? new Date() : null,
            pinned: pinned || false,
            createdById: user.id,
            createdByName: user.displayName,
          },
        })
        await logAudit({ userId: user.id, userName: user.displayName, userRole: user.role, schoolId, action: 'CREATE', entityType: 'OTHER', entityId: article.id, description: `Article créé : ${title}`, ipAddress: ip })
        return NextResponse.json({ ok: true, id: article.id, message: `Article "${title}" créé` })
      }

      case 'update-article': {
        const { id, ...updates } = body
        if (!id) return NextResponse.json({ ok: false, error: 'ID obligatoire.' }, { status: 400 })
        await db.article.update({ where: { id }, data: { ...updates, updatedById: user.id, updatedAt: new Date() } })
        return NextResponse.json({ ok: true, message: 'Article mis à jour' })
      }

      case 'delete-article': {
        const { id } = body
        if (!id) return NextResponse.json({ ok: false, error: 'ID obligatoire.' }, { status: 400 })
        await db.article.delete({ where: { id } })
        return NextResponse.json({ ok: true, message: 'Article supprimé' })
      }

      // ============================================================
      // CONTACTS
      // ============================================================
      case 'create-contact': {
        const { firstName, lastName, function: contactFunction, organization, email, phone, mobilePhone, address, category, isPublic } = body
        if (!lastName) return NextResponse.json({ ok: false, error: 'Nom obligatoire.' }, { status: 400 })
        const contact = await db.contact.create({
          data: {
            schoolId,
            firstName: firstName || null,
            lastName,
            function: contactFunction || null,
            organization: organization || null,
            email: email || null,
            phone: phone || null,
            mobilePhone: mobilePhone || null,
            address: address || null,
            category: category || 'STAFF',
            isPublic: isPublic !== false,
          },
        })
        return NextResponse.json({ ok: true, id: contact.id, message: `Contact "${lastName}" créé` })
      }

      case 'delete-contact': {
        const { id } = body
        if (!id) return NextResponse.json({ ok: false, error: 'ID obligatoire.' }, { status: 400 })
        await db.contact.delete({ where: { id } })
        return NextResponse.json({ ok: true, message: 'Contact supprimé' })
      }

      // ============================================================
      // SLIDESHOW
      // ============================================================
      case 'create-slideshow-image': {
        const { title, description, imageUrl, linkUrl, sortOrder } = body
        if (!imageUrl) return NextResponse.json({ ok: false, error: 'URL image obligatoire.' }, { status: 400 })
        const slide = await db.slideshowImage.create({
          data: {
            schoolId,
            title: title || null,
            description: description || null,
            imageUrl,
            linkUrl: linkUrl || null,
            sortOrder: sortOrder || 0,
            status: 'ACTIVE',
          },
        })
        return NextResponse.json({ ok: true, id: slide.id, message: 'Image ajoutée au diaporama' })
      }

      case 'delete-slideshow-image': {
        const { id } = body
        if (!id) return NextResponse.json({ ok: false, error: 'ID obligatoire.' }, { status: 400 })
        await db.slideshowImage.delete({ where: { id } })
        return NextResponse.json({ ok: true, message: 'Image supprimée du diaporama' })
      }

      case 'toggle-slideshow-image': {
        const { id } = body
        if (!id) return NextResponse.json({ ok: false, error: 'ID obligatoire.' }, { status: 400 })
        const slide = await db.slideshowImage.findUnique({ where: { id } })
        if (!slide) return NextResponse.json({ ok: false, error: 'Introuvable.' }, { status: 404 })
        await db.slideshowImage.update({ where: { id }, data: { status: slide.status === 'ACTIVE' ? 'HIDDEN' : 'ACTIVE' } })
        return NextResponse.json({ ok: true, message: 'Statut basculé' })
      }

      // ============================================================
      // RECEPTIONS
      // ============================================================
      case 'create-reception': {
        const { visitorName, visitorPhone, visitorEmail, visitorOrganization, purpose, purposeDetail, targetPersonName, scheduledDate, scheduledEndTime, notes } = body
        if (!visitorName || !purpose || !scheduledDate) {
          return NextResponse.json({ ok: false, error: 'Nom visiteur, motif et date obligatoires.' }, { status: 400 })
        }
        const reception = await db.reception.create({
          data: {
            schoolId,
            visitorName,
            visitorPhone: visitorPhone || null,
            visitorEmail: visitorEmail || null,
            visitorOrganization: visitorOrganization || null,
            purpose,
            purposeDetail: purposeDetail || null,
            targetPersonName: targetPersonName || null,
            scheduledDate: new Date(scheduledDate),
            scheduledEndTime: scheduledEndTime ? new Date(scheduledEndTime) : null,
            notes: notes || null,
            status: 'SCHEDULED',
            createdById: user.id,
            createdByName: user.displayName,
          },
        })
        await logAudit({ userId: user.id, userName: user.displayName, userRole: user.role, schoolId, action: 'CREATE', entityType: 'OTHER', entityId: reception.id, description: `Réservation visite : ${visitorName}`, ipAddress: ip })
        return NextResponse.json({ ok: true, id: reception.id, message: `Visite de ${visitorName} programmée` })
      }

      case 'check-in-reception': {
        const { id } = body
        if (!id) return NextResponse.json({ ok: false, error: 'ID obligatoire.' }, { status: 400 })
        await db.reception.update({ where: { id }, data: { status: 'CHECKED_IN', checkInTime: new Date() } })
        return NextResponse.json({ ok: true, message: 'Visiteur enregistré (arrivée)' })
      }

      case 'check-out-reception': {
        const { id } = body
        if (!id) return NextResponse.json({ ok: false, error: 'ID obligatoire.' }, { status: 400 })
        await db.reception.update({ where: { id }, data: { status: 'CHECKED_OUT', checkOutTime: new Date() } })
        return NextResponse.json({ ok: true, message: 'Visiteur parti (départ)' })
      }

      case 'cancel-reception': {
        const { id } = body
        if (!id) return NextResponse.json({ ok: false, error: 'ID obligatoire.' }, { status: 400 })
        await db.reception.update({ where: { id }, data: { status: 'CANCELLED' } })
        return NextResponse.json({ ok: true, message: 'Rendez-vous annulé' })
      }

      default:
        return NextResponse.json({ ok: false, error: `Action "${action}" inconnue.` }, { status: 400 })
    }
  } catch (err) {
    console.error('[api/admin/content] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

// ============================================================
// GET : liste des ressources
// ============================================================

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const url = new URL(req.url)
    const resource = url.searchParams.get('resource') || 'articles'

    switch (resource) {
      case 'articles': {
        const articles = await db.article.findMany({
          where: { schoolId },
          orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
          take: 200,
        })
        return NextResponse.json({
          ok: true,
          articles: articles.map((a) => ({
            ...a,
            // Filtrage par rôle pour les non-admin
            visible: a.targetRoles === 'ALL' || a.targetRoles.split(',').includes(user.role),
          })),
        })
      }

      case 'contacts': {
        const contacts = await db.contact.findMany({
          where: { schoolId },
          orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { lastName: 'asc' }],
          take: 500,
        })
        return NextResponse.json({ ok: true, contacts })
      }

      case 'slideshow': {
        const slides = await db.slideshowImage.findMany({
          where: { schoolId, status: 'ACTIVE' },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        })
        return NextResponse.json({ ok: true, slides })
      }

      case 'slideshow-all': {
        const slides = await db.slideshowImage.findMany({
          where: { schoolId },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        })
        return NextResponse.json({ ok: true, slides })
      }

      case 'receptions': {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const weekEnd = new Date(today)
        weekEnd.setDate(weekEnd.getDate() + 7)

        const receptions = await db.reception.findMany({
          where: {
            schoolId,
            scheduledDate: { gte: today, lte: weekEnd },
          },
          orderBy: { scheduledDate: 'asc' },
          take: 100,
        })
        return NextResponse.json({ ok: true, receptions })
      }

      default:
        return NextResponse.json({ ok: false, error: `Resource "${resource}" inconnue.` }, { status: 400 })
    }
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

// ============================================================
// DELETE : suppression générique
// ============================================================

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (user.role !== 'DIRECTION' && user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'Accès réservé à la Direction.' }, { status: 403 })
    }

    const url = new URL(req.url)
    const resource = url.searchParams.get('resource')
    const id = url.searchParams.get('id')
    if (!resource || !id) return NextResponse.json({ ok: false, error: 'resource et id obligatoires.' }, { status: 400 })

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    switch (resource) {
      case 'article': await db.article.delete({ where: { id } }); break
      case 'contact': await db.contact.delete({ where: { id } }); break
      case 'slideshow': await db.slideshowImage.delete({ where: { id } }); break
      case 'reception': await db.reception.delete({ where: { id } }); break
      default: return NextResponse.json({ ok: false, error: `Resource "${resource}" inconnue.` }, { status: 400 })
    }
    return NextResponse.json({ ok: true, message: `${resource} supprimé` })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
