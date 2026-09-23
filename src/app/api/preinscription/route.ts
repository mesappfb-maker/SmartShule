// API : Préinscription (soumission + suivi)
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const body = await req.json()
    const {
      parentFirstName, parentLastName, parentPhone, parentRelationship,
      childFirstName, childLastName, childBirthDate, childGender,
      desiredLevel, academicYearLabel,
      emergencyContactName, emergencyContactPhone, address,
      acceptedTerms, acceptedPrivacy, preferredContact,
    } = body

    if (!parentFirstName || !parentLastName || !parentPhone || !childFirstName || !childLastName) {
      return NextResponse.json({ ok: false, error: 'Champs obligatoires manquants.' }, { status: 400 })
    }
    if (!acceptedTerms || !acceptedPrivacy) {
      return NextResponse.json({ ok: false, error: 'Vous devez accepter les conditions.' }, { status: 400 })
    }

    // Générer numéro de référence unique
    const year = new Date().getFullYear()
    const count = await db.preRegistration.count({ where: { schoolId } })
    const referenceNumber = `PRE-${year}-${String(count + 1).padStart(6, '0')}`

    const preReg = await db.preRegistration.create({
      data: {
        schoolId,
        userId: user.id,
        referenceNumber,
        parentFirstName, parentLastName,
        parentEmail: user.email,
        parentPhone, parentRelationship: parentRelationship || 'PERE',
        childFirstName, childLastName,
        childBirthDate: childBirthDate ? new Date(childBirthDate) : null,
        childGender: childGender || null,
        desiredLevel: desiredLevel || null,
        academicYearLabel: academicYearLabel || null,
        emergencyContactName: emergencyContactName || null,
        emergencyContactPhone: emergencyContactPhone || null,
        address: address || null,
        acceptedTerms: true,
        acceptedPrivacy: true,
        preferredContact: preferredContact || 'WHATSAPP',
        status: 'SOUMIS',
        submittedAt: new Date(),
      },
    })

    // Historique
    await db.preRegistrationHistory.create({
      data: {
        preRegistrationId: preReg.id,
        action: 'SUBMITTED',
        performedById: user.id,
        performedByName: user.displayName,
        notes: `Dossier soumis par ${parentFirstName} ${parentLastName}`,
        newStatus: 'SOUMIS',
      },
    })

    // Notifier le secrétariat
    const secretaries = await db.user.findMany({
      where: { role: 'SECRETARY', active: true },
      select: { id: true },
    })
    if (secretaries.length > 0) {
      await db.notification.createMany({
        data: secretaries.map((s) => ({
          userId: s.id,
          type: 'PREINSCRIPTION_SUBMITTED',
          title: '📋 Nouvelle préinscription',
          message: `Dossier ${referenceNumber} : ${childFirstName} ${childLastName} (${parentFirstName} ${parentLastName})`,
          read: false,
        })),
      })
    }

    // Audit
    const h = await headers()
    await logAudit({
      userId: user.id, userName: user.displayName, userRole: user.role, schoolId,
      action: 'CREATE', entityType: 'OTHER', entityId: preReg.id,
      description: `Préinscription soumise : ${referenceNumber} pour ${childFirstName} ${childLastName}`,
      ipAddress: getClientIP(h),
    })

    return NextResponse.json({
      ok: true,
      referenceNumber,
      preRegistrationId: preReg.id,
      message: `Dossier soumis avec succès. Référence : ${referenceNumber}`,
    })
  } catch (err) {
    console.error('[api/preinscription] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })

    // Le parent voit ses propres dossiers
    const preRegs = await db.preRegistration.findMany({
      where: { userId: user.id },
      include: { history: { orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      ok: true,
      preRegistrations: preRegs.map((p) => ({
        id: p.id,
        referenceNumber: p.referenceNumber,
        childName: `${p.childFirstName} ${p.childLastName}`,
        status: p.status,
        submittedAt: p.submittedAt?.toISOString() || null,
        reviewedAt: p.reviewedAt?.toISOString() || null,
        decisionReason: p.decisionReason,
        history: p.history.map((h) => ({
          action: h.action,
          notes: h.notes,
          performedByName: h.performedByName,
          createdAt: h.createdAt.toISOString(),
        })),
      })),
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
