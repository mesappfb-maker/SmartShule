// API : Démarrer une séance d'émargement
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
    if (user.role !== 'TEACHER' && user.role !== 'DIRECTION' && user.role !== 'ADMIN' && user.role !== 'DIRECTOR' && user.role !== 'SCHOOL_ADMIN') {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
    }

    const formData = await req.formData()
    const classroomId = String(formData.get('classroomId') || '')
    const subjectId = String(formData.get('subjectId') || '')
    const startDateTime = String(formData.get('startDateTime') || '')
    const endDateTime = String(formData.get('endDateTime') || '')
    const room = String(formData.get('room') || '')

    if (!classroomId || !subjectId) {
      return NextResponse.json({ ok: false, error: 'classroomId et subjectId requis.' }, { status: 400 })
    }

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const employee = await db.employee.findFirst({ where: { email: user.email || '' } })
    if (!employee) return NextResponse.json({ ok: false, error: 'Employé introuvable.' }, { status: 404 })

    const agenda = await db.teacherAgenda.create({
      data: {
        schoolId, teacherId: employee.id, classroomId, subjectId,
        startDateTime: new Date(startDateTime),
        endDateTime: new Date(endDateTime || startDateTime),
        status: 'IN_PROGRESS',
      },
    })

    const emargement = await db.teacherEmargement.create({
      data: {
        schoolId, teacherId: employee.id, classroomId, subjectId,
        agendaId: agenda.id, signatureAt: new Date(), status: 'IN_PROGRESS',
      },
    })

    const studentsCount = await db.enrollment.count({
      where: { classroomId, status: 'ACTIVE' },
    })

    try {
      const directors = await db.user.findMany({
        where: { role: { in: ['DIRECTOR', 'DIRECTION'] }, active: true },
      })
      for (const director of directors) {
        await db.notification.create({
          data: {
            userId: director.id, type: 'ANNOUNCEMENT',
            title: `Séance démarrée — ${employee.firstName} ${employee.lastName}`,
            message: `Une séance vient de démarrer. ${studentsCount} élèves attendus.`,
            link: '/',
          },
        })
      }
    } catch {}

    const h = await headers()
    await logAudit({
      userId: user.id, userName: user.displayName, userRole: user.role, schoolId,
      action: 'CREATE', entityType: 'TEACHER_EMARGEMENT', entityId: emargement.id,
      description: `Séance démarrée — ${studentsCount} élèves`,
      ipAddress: getClientIP(h),
      metadata: { emargementId: emargement.id, classroomId, studentsCount },
    })

    return NextResponse.json({
      ok: true, emargementId: emargement.id, studentsCount,
    })
  } catch (err) {
    console.error('[api/teacher/start-session] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
