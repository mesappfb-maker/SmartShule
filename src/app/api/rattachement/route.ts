// API : Demande de rattachement parent-enfant
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
    const { parentFirstName, parentLastName, parentPhone, childMatricule, childFirstName, childLastName, childBirthDate, relationship, verificationCode } = body

    if (!parentFirstName || !parentLastName || !parentPhone || !childMatricule) {
      return NextResponse.json({ ok: false, error: 'Champs obligatoires manquants.' }, { status: 400 })
    }

    // Vérifier que l'élève existe (sans révéler s'il existe ou non — sécurité)
    const student = await db.student.findFirst({
      where: { matricule: childMatricule, schoolId },
    })

    // Même si l'élève n'existe pas, on crée la demande (le secrétariat vérifiera)
    // Ne pas révéler si l'élève existe ou non
    if (student) {
      // Vérifier qu'il n'y a pas déjà une demande en attente
      const existing = await db.parentLinkRequest.findFirst({
        where: { userId: user.id, studentId: student.id, status: 'EN_ATTENTE' },
      })
      if (existing) {
        return NextResponse.json({ ok: false, error: 'Vous avez déjà une demande en attente pour cet élève.' }, { status: 409 })
      }

      const request = await db.parentLinkRequest.create({
        data: {
          schoolId,
          userId: user.id,
          studentId: student.id,
          parentFirstName, parentLastName, parentPhone,
          relationship: relationship || 'PERE',
          childBirthDateProvided: childBirthDate ? new Date(childBirthDate) : null,
          verificationCode: verificationCode || null,
          status: 'EN_ATTENTE',
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
            type: 'PARENT_LINK_REQUEST',
            title: '🔗 Demande de rattachement',
            message: `${parentFirstName} ${parentLastName} demande le rattachement à l'élève ${student.firstName} ${student.lastName} (${student.matricule})`,
            read: false,
          })),
        })
      }

      const h = await headers()
      await logAudit({
        userId: user.id, userName: user.displayName, userRole: user.role, schoolId,
        action: 'CREATE', entityType: 'OTHER', entityId: request.id,
        description: `Demande de rattachement : ${parentFirstName} ${parentLastName} → élève ${childMatricule}`,
        ipAddress: getClientIP(h),
      })
    }

    // Toujours retourner le même message (ne pas révéler si l'élève existe)
    return NextResponse.json({
      ok: true,
      message: 'Votre demande a été transmise au secrétariat. Vous recevrez une notification dès qu\'elle sera traitée.',
    })
  } catch (err) {
    console.error('[api/rattachement] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
