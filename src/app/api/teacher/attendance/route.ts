// API : Enregistrer l'appel (présent/retard/absent/excusé)
// POST FormData: emargementId, studentId, status, lateMinutes, justified, justification
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { computeIqaForStudent } from '@/lib/iqa'
import { getIqaLevel } from '@/lib/iqa-pure'

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
    const emargementId = String(formData.get('emargementId') || '')
    const studentId = String(formData.get('studentId') || '')
    const status = String(formData.get('status') || '') as 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED'
    const lateMinutes = parseInt(String(formData.get('lateMinutes') || '0'), 10)
    const justified = formData.get('justified') === 'true'
    const justification = String(formData.get('justification') || '')

    if (!emargementId || !studentId || !status) {
      return NextResponse.json({ ok: false, error: 'emargementId, studentId et status requis.' }, { status: 400 })
    }

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    // Enregistrer ou mettre à jour StudentAttendanceCall
    const existing = await db.studentAttendanceCall.findFirst({
      where: { emargementId, studentId },
    })

    if (existing) {
      await db.studentAttendanceCall.update({
        where: { id: existing.id },
        data: { status, lateMinutes, justified, justification },
      })
    } else {
      await db.studentAttendanceCall.create({
        data: {
          schoolId,
          emargementId,
          studentId,
          status,
          lateMinutes,
          justified,
          justification,
        },
      })
    }

    // Recalculer l'IQA
    let updatedIqa = 100
    let level = 'EXCELLENT'
    try {
      const now = new Date()
      const periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const iqaResult = await computeIqaForStudent(studentId, periodStart, now)
      updatedIqa = iqaResult.iqa
      level = getIqaLevel(updatedIqa)
    } catch {
      // Si computeIqa échoue, on garde 100 par défaut
    }

    // Si absent non excusé, notifier la direction
    if (status === 'ABSENT' && !justified) {
      try {
        const emargement = await db.teacherEmargement.findUnique({
          where: { id: emargementId },
          include: { teacher: true, classroom: true },
        })
        const student = await db.student.findUnique({ where: { id: studentId } })
        if (emargement && student) {
          await db.notification.create({
            data: {
              userId: user.id,
              type: 'ANNOUNCEMENT',
              title: `Absence non justifiée — ${student.firstName} ${student.lastName}`,
              message: `${student.firstName} ${student.lastName} a été marqué absent en ${emargement.classroom?.name || 'classe'} par ${emargement.teacher?.firstName || 'le professeur'}.`,
              link: '/',
            },
          })
        }
      } catch {}
    }

    return NextResponse.json({
      ok: true,
      updatedIqa,
      level,
    })
  } catch (err) {
    console.error('[api/teacher/attendance] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
