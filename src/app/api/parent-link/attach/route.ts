// API : Rattachement parent-élève (avec code OU sans code)
// POST { action: 'attach-with-code', code, childName, phone, relationship }
// POST { action: 'request-without-code', childName, birthDate, phone, relationship, ... }
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { verifyLinkCode, markCodeUsed, childNameMatches } from '@/lib/parent-link'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })

    const body = await req.json()
    const { action } = body

    // ============================================================
    // AVEC CODE — rattachement automatique
    // ============================================================
    if (action === 'attach-with-code') {
      const { code, childName, phone, relationship } = body
      if (!code || !childName || !phone || !relationship) {
        return NextResponse.json({ ok: false, error: 'Tous les champs sont obligatoires.' }, { status: 400 })
      }

      // Trouver le code dans la base
      const linkCode = await db.parentLinkCode.findUnique({
        where: { code: code.toUpperCase().trim() },
        include: { student: true },
      })

      if (!linkCode) {
        // Ne pas révéler si le code existe ou non
        return NextResponse.json({ ok: false, error: 'Code invalide ou expiré. Contactez le secrétariat.' }, { status: 400 })
      }

      // Vérifier le code
      const verification = await verifyLinkCode(code, linkCode.studentId)
      if (!verification.valid) {
        return NextResponse.json({ ok: false, error: 'Code invalide ou expiré. Contactez le secrétariat.' }, { status: 400 })
      }

      // Vérifier que le nom de l'enfant correspond
      const student = linkCode.student
      if (!childNameMatches(childName, student.firstName, student.lastName)) {
        // Ne pas révéler le vrai nom
        await logAudit({
          userId: user.id, userName: user.displayName, userRole: user.role,
          schoolId: linkCode.schoolId, action: 'LINK_FAILED', entityType: 'PARENT_LINK_CODE',
          entityId: linkCode.id, description: 'Nom enfant ne correspond pas',
          ipAddress: getClientIP(await headers()),
          metadata: { providedName: childName.slice(0, 20) },
        })
        return NextResponse.json({ ok: false, error: 'Les informations ne correspondent pas. Contactez le secrétariat.' }, { status: 400 })
      }

      // Vérifier qu'un lien n'existe pas déjà
      const existingLink = await db.guardianStudentLink.findFirst({
        where: { guardian: { userId: user.id }, studentId: student.id },
      })
      if (existingLink) {
        return NextResponse.json({ ok: false, error: 'Vous êtes déjà lié à cet enfant.' }, { status: 400 })
      }

      // Trouver ou créer le Guardian lié au user
      let guardian = await db.guardian.findFirst({ where: { userId: user.id } })
      if (!guardian) {
        guardian = await db.guardian.create({
          data: {
            schoolId: linkCode.schoolId,
            userId: user.id,
            firstName: user.displayName.split(' ')[0] || 'Parent',
            lastName: user.displayName.split(' ').slice(1).join(' ') || '—',
            phone,
          },
        })
      }

      // Créer le lien parent-enfant
      await db.guardianStudentLink.create({
        data: {
          guardianId: guardian.id,
          studentId: student.id,
          relationship,
          isPrimary: true,
        },
      })

      // Marquer le code comme utilisé
      await markCodeUsed(linkCode.id, user.id)

      // Activer PARENT_VERIFIE
      await db.user.update({
        where: { id: user.id },
        data: { accountStatus: 'PARENT_VERIFIE' },
      })

      // Audit
      const h = await headers()
      await logAudit({
        userId: user.id, userName: user.displayName, userRole: user.role,
        schoolId: linkCode.schoolId, action: 'LINK_SUCCESS', entityType: 'GUARDIAN_STUDENT_LINK',
        description: `Rattachement réussi: ${student.firstName} ${student.lastName}`,
        ipAddress: getClientIP(h),
        metadata: { studentId: student.id, relationship },
      })

      return NextResponse.json({
        ok: true,
        message: `Rattachement confirmé. Votre compte est lié au dossier de ${student.firstName} ${student.lastName}.`,
        childName: `${student.firstName} ${student.lastName}`,
      })
    }

    // ============================================================
    // SANS CODE — demande à vérifier
    // ============================================================
    if (action === 'request-without-code') {
      const { childName, birthDate, phone, relationship, reason } = body
      if (!childName || !phone || !relationship) {
        return NextResponse.json({ ok: false, error: 'Champs obligatoires manquants.' }, { status: 400 })
      }

      // Créer une demande dans AdminTask (ou ParentLinkRequest)
      const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
      if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

      const requestNumber = `REQ-LINK-${Date.now().toString(36).toUpperCase()}`

      await db.parentLinkRequest.create({
        data: {
          schoolId,
          requestNumber,
          guardianId: (await db.guardian.findFirst({ where: { userId: user.id } }))?.id || '',
          userId: user.id,
          parentName: user.displayName,
          parentEmail: user.email || '',
          parentPhone: phone,
          childName,
          childBirthDate: birthDate ? new Date(birthDate) : null,
          relationship,
          reason: reason || 'Demande de rattachement sans code',
          status: 'PENDING',
        },
      }).catch(async () => {
        // Si ParentLinkRequest n'a pas le bon schéma, utiliser AdminTask
        await db.adminTask.create({
          data: {
            schoolId,
            title: `Demande rattachement: ${childName}`,
            description: `Parent: ${user.displayName}, Tel: ${phone}, Relation: ${relationship}, Motif: ${reason || 'N/A'}`,
            category: 'LINK_REQUEST',
            priority: 'NORMAL',
            status: 'PENDING',
            createdById: user.id,
            createdByName: user.displayName,
          },
        })
      })

      // Audit
      const h = await headers()
      await logAudit({
        userId: user.id, userName: user.displayName, userRole: user.role,
        schoolId, action: 'LINK_REQUEST', entityType: 'PARENT_LINK_REQUEST',
        description: `Demande de rattachement sans code pour ${childName}`,
        ipAddress: getClientIP(h),
        metadata: { childName: childName.slice(0, 20), relationship },
      })

      // Message neutre — ne pas révéler si l'enfant existe
      return NextResponse.json({
        ok: true,
        message: 'Votre demande de rattachement a été enregistrée. Le secrétariat va vérifier les informations avant l\'activation de votre accès parent.',
      })
    }

    return NextResponse.json({ ok: false, error: `Action "${action}" inconnue.` }, { status: 400 })
  } catch (err) {
    console.error('[api/parent-link/attach] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
