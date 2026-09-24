// API : Modèles de notifications (templates)
// ============================================================
// GET : liste / détail / catégories
// POST : créer / modifier / dupliquer / activer-désactiver / supprimer

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { hasRole } from '@/lib/rbac'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'
import { seedDefaultTemplates } from '@/lib/notifications'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    // Tous les rôles peuvent voir les modèles (pour sélection) ; l'édition est restreinte
    if (!['SECRETARY', 'DIRECTION', 'ADMIN', 'TEACHER', 'ACCOUNTANT'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
    }
    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const url = new URL(req.url)
    const filter = url.searchParams.get('filter') || 'all' // all | by-category | by-code

    // Si aucun modèle n'existe, seed par défaut
    const count = await db.notificationTemplate.count({ where: { schoolId } })
    if (count === 0) {
      await seedDefaultTemplates(schoolId, user.id, user.displayName)
    }

    const where: any = { schoolId }
    if (filter === 'by-category') {
      const cat = url.searchParams.get('category')
      if (cat) where.category = cat
    }
    if (filter === 'by-code') {
      const code = url.searchParams.get('code')
      if (code) where.code = code
    }

    // Filtrer par rôle : ne montrer que les modèles que ce rôle peut utiliser
    const templates = await db.notificationTemplate.findMany({
      where,
      orderBy: [{ category: 'asc' }, { code: 'asc' }],
    })

    // Filtre RBAC : ne retourner que ceux que l'utilisateur peut déclencher
    const filtered = templates.filter((t) => {
      try {
        const roles: string[] = JSON.parse(t.allowedRoles)
        return roles.includes(user.role) || user.role === 'ADMIN'
      } catch {
        return false
      }
    })

    return NextResponse.json({
      ok: true,
      templates: filtered.map((t) => ({
        id: t.id,
        code: t.code,
        name: t.name,
        category: t.category,
        channels: JSON.parse(t.channels || '[]'),
        templateSms: t.templateSms,
        templateWhatsapp: t.templateWhatsapp,
        templateEmail: t.templateEmail,
        templateApp: t.templateApp,
        templateEmailSubject: t.templateEmailSubject,
        variablesDoc: t.variablesDoc ? JSON.parse(t.variablesDoc) : [],
        version: t.version,
        isActive: t.isActive,
        allowedRoles: JSON.parse(t.allowedRoles),
        requiresConsent: t.requiresConsent,
        createdByName: t.createdByName,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      categories: Array.from(new Set(filtered.map((t) => t.category))),
    })
  } catch (err) {
    console.error('[api/notifications/templates GET] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    // Seuls DIRECTION et ADMIN peuvent modifier les modèles
    if (!hasRole(user, ['DIRECTION', 'ADMIN'])) {
      return NextResponse.json({ ok: false, error: 'Seul le Directeur ou l\'Admin peut modifier les modèles.' }, { status: 403 })
    }
    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const body = await req.json()
    const { action } = body

    if (action === 'create' || action === 'update') {
      const { id, code, name, category, channels, templateSms, templateWhatsapp, templateEmail, templateApp, templateEmailSubject, variablesDoc, allowedRoles, requiresConsent } = body

      if (!code || !name || !category || !channels || !allowedRoles) {
        return NextResponse.json({ ok: false, error: 'Champs requis: code, name, category, channels, allowedRoles.' }, { status: 400 })
      }

      const data = {
        code,
        name,
        category,
        channels: JSON.stringify(channels),
        templateSms: templateSms || null,
        templateWhatsapp: templateWhatsapp || null,
        templateEmail: templateEmail || null,
        templateApp: templateApp || null,
        templateEmailSubject: templateEmailSubject || null,
        variablesDoc: variablesDoc ? JSON.stringify(variablesDoc) : null,
        allowedRoles: JSON.stringify(allowedRoles),
        requiresConsent: requiresConsent !== undefined ? requiresConsent : true,
        createdById: user.id,
        createdByName: user.displayName,
      }

      if (action === 'create') {
        // Pour create : version 1 (ou version max+1 si le code existe déjà)
        const existing = await db.notificationTemplate.findFirst({
          where: { schoolId, code },
          orderBy: { version: 'desc' },
        })
        const version = existing ? existing.version + 1 : 1

        // Si une version active existe, la désactiver
        if (existing) {
          await db.notificationTemplate.updateMany({
            where: { schoolId, code, isActive: true },
            data: { isActive: false },
          })
        }

        const tpl = await db.notificationTemplate.create({
          data: { schoolId, ...data, version, isActive: true },
        })

        const h = await headers()
        await logAudit({
          userId: user.id, userName: user.displayName, userRole: user.role, schoolId,
          action: 'CREATE',
          entityType: 'NOTIFICATION_TEMPLATE',
          entityId: tpl.id,
          description: `Modèle notification créé: ${code} v${version}`,
          ipAddress: getClientIP(h),
          metadata: { code, version, category },
        })

        return NextResponse.json({ ok: true, id: tpl.id, message: `Modèle créé (v${version})` })
      } else {
        // update : créer une nouvelle version (jamais écraser)
        if (!id) return NextResponse.json({ ok: false, error: 'id requis pour update.' }, { status: 400 })

        const existing = await db.notificationTemplate.findUnique({ where: { id } })
        if (!existing) return NextResponse.json({ ok: false, error: 'Modèle introuvable.' }, { status: 404 })

        const newVersion = existing.version + 1
        // Désactiver l'ancien
        await db.notificationTemplate.update({ where: { id }, data: { isActive: false } })

        const tpl = await db.notificationTemplate.create({
          data: { schoolId, ...data, version: newVersion, isActive: true },
        })

        const h = await headers()
        await logAudit({
          userId: user.id, userName: user.displayName, userRole: user.role, schoolId,
          action: 'UPDATE',
          entityType: 'NOTIFICATION_TEMPLATE',
          entityId: tpl.id,
          description: `Modèle notification mis à jour: ${code} v${newVersion}`,
          ipAddress: getClientIP(h),
          metadata: { code, version: newVersion, oldId: id },
        })

        return NextResponse.json({ ok: true, id: tpl.id, message: `Nouvelle version créée (v${newVersion})` })
      }
    }

    if (action === 'toggle-active') {
      const { id, isActive } = body
      if (!id) return NextResponse.json({ ok: false, error: 'id requis.' }, { status: 400 })

      await db.notificationTemplate.update({
        where: { id },
        data: { isActive },
      })

      return NextResponse.json({ ok: true, message: `Modèle ${isActive ? 'activé' : 'désactivé'}` })
    }

    if (action === 'restore-version') {
      const { id } = body
      if (!id) return NextResponse.json({ ok: false, error: 'id requis.' }, { status: 400 })

      const target = await db.notificationTemplate.findUnique({ where: { id } })
      if (!target) return NextResponse.json({ ok: false, error: 'Version introuvable.' }, { status: 404 })

      // Désactiver toutes les versions actives
      await db.notificationTemplate.updateMany({
        where: { schoolId, code: target.code, isActive: true },
        data: { isActive: false },
      })

      // Activer la version ciblée
      await db.notificationTemplate.update({
        where: { id },
        data: { isActive: true },
      })

      return NextResponse.json({ ok: true, message: `Version ${target.version} restaurée` })
    }

    return NextResponse.json({ ok: false, error: `Action "${action}" inconnue.` }, { status: 400 })
  } catch (err) {
    console.error('[api/notifications/templates POST] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
