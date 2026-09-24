// SmartShule — API : Génération bulletins (par classe)
// ============================================================
// POST /api/accountant/bulletins
// Action : generate-bulletins
//   - classroomId : génère les bulletins pour tous les élèves d'une classe
//   - periodId : période d'évaluation
//   - Retourne la liste des URLs PDF

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { hasRole } from '@/lib/rbac'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })

    if (!hasRole(user, ['ACCOUNTANT', 'DIRECTION', 'ADMIN', 'SECRETARY'])) {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
    }

    const body = await req.json()
    const { action, classroomId, periodId } = body

    if (action === 'list-students-for-bulletin') {
      // Liste les élèves d'une classe avec leur statut de bulletin
      if (!classroomId) {
        return NextResponse.json({ ok: false, error: 'classroomId obligatoire' }, { status: 400 })
      }

      const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
      if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable' }, { status: 404 })

      const enrollments = await db.enrollment.findMany({
        where: { classroomId, status: 'ACTIVE' },
        include: {
          student: {
            select: {
              id: true, firstName: true, lastName: true, matricule: true,
            },
          },
        },
        orderBy: [{ student: { firstName: 'asc' } }, { student: { lastName: 'asc' } }],
      })

      // Pour chaque élève, compter les notes publiées
      const studentsWithGrades = await Promise.all(
        enrollments.map(async (e) => {
          const gradesCount = await db.grade.count({
            where: {
              studentId: e.studentId,
              status: 'PUBLISHED',
              ...(periodId ? { periodId } : {}),
            },
          })
          return {
            studentId: e.student.id,
            studentName: `${e.student.firstName} ${e.student.lastName}`,
            matricule: e.student.matricule,
            gradesCount,
            hasGrades: gradesCount > 0,
            bulletinUrl: `/api/exports/bulletin?studentId=${e.student.id}${periodId ? `&periodId=${periodId}` : ''}`,
          }
        })
      )

      return NextResponse.json({
        ok: true,
        students: studentsWithGrades,
      })
    }

    return NextResponse.json({ ok: false, error: `Action "${action}" inconnue.` }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

// GET : liste des périodes d'évaluation disponibles
export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable' }, { status: 404 })

    const periods = await db.evaluationPeriod.findMany({
      where: { schoolId },
      orderBy: { startDate: 'desc' },
    })

    return NextResponse.json({
      ok: true,
      periods: periods.map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        periodType: p.periodType,
        status: p.status,
        startDate: p.startDate.toISOString(),
        endDate: p.endDate.toISOString(),
      })),
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
