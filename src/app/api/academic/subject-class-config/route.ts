// API : Configuration matière-classe (SubjectClassConfig)
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { hasRole } from '@/lib/rbac'
import { isSubjectClassConfigUnique } from '@/lib/academic-calculation'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (!hasRole(user, ['DIRECTION', 'ADMIN', 'SECRETARY', 'TEACHER'])) {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
    }
    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const url = new URL(req.url)
    const classroomId = url.searchParams.get('classroomId')

    const where: any = { schoolId }
    if (classroomId) where.classroomId = classroomId

    // Si enseignant, filtrer par ses matières
    if (user.role === 'TEACHER') {
      const employee = await db.employee.findFirst({ where: { email: user.email || '' } })
      if (employee) where.teacherId = employee.id
    }

    const configs = await db.subjectClassConfig.findMany({
      where,
      include: {
        subject: true,
        classroom: { include: { directorate: true } },
        academicYear: true,
        teacher: { select: { id: true, firstName: true, lastName: true } },
        evaluationCategories: { where: { isActive: true } },
      },
      orderBy: [{ classroomId: 'asc' }, { subject: { name: 'asc' } }],
    })

    return NextResponse.json({
      ok: true,
      configs: configs.map((c) => ({
        id: c.id,
        subject: { id: c.subject.id, name: c.subject.name, code: c.subject.code },
        classroom: { id: c.classroom.id, name: c.classroom.name, directorate: c.classroom.directorate.name },
        academicYear: c.academicYear.label,
        teacher: c.teacher ? { id: c.teacher.id, name: `${c.teacher.firstName} ${c.teacher.lastName}` } : null,
        room: c.room,
        coefficient: c.coefficient,
        maxScore: c.maxScore,
        passingScore: c.passingScore,
        hoursPerWeek: c.hoursPerWeek,
        sessionsPerWeek: c.sessionsPerWeek,
        sessionDurationMinutes: c.sessionDurationMinutes,
        calculationType: c.calculationType,
        period: c.period,
        status: c.status,
        activatedAt: c.activatedAt?.toISOString() || null,
        evaluationCategories: c.evaluationCategories.map((cat) => ({
          id: cat.id,
          name: cat.name,
          weightPercent: cat.weightPercent,
          minEvaluations: cat.minEvaluations,
          maxEvaluations: cat.maxEvaluations,
          defaultMaxScore: cat.defaultMaxScore,
          calculationRule: cat.calculationRule,
        })),
      })),
    })
  } catch (err) {
    console.error('[api/academic/subject-class-config GET] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (!hasRole(user, ['DIRECTION', 'ADMIN'])) {
      return NextResponse.json({ ok: false, error: 'Seul le Directeur peut configurer les matières.' }, { status: 403 })
    }
    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const body = await req.json()
    const { action } = body

    if (action === 'create') {
      const { classroomId, subjectId, academicYearId, teacherId, room, coefficient, maxScore, passingScore, hoursPerWeek, sessionsPerWeek, sessionDurationMinutes, calculationType, period, evaluationCategories } = body

      // Vérifier unicité
      const isUnique = await isSubjectClassConfigUnique(schoolId, classroomId, subjectId, academicYearId, period || 'T1')
      if (!isUnique) {
        return NextResponse.json({ ok: false, error: 'Cette matière est déjà configurée pour cette classe/période/année.' }, { status: 400 })
      }

      // Vérifier coefficient
      if (!coefficient || coefficient <= 0) {
        return NextResponse.json({ ok: false, error: 'Le coefficient doit être positif.' }, { status: 400 })
      }

      // Vérifier pondérations si catégories fournies
      if (evaluationCategories && evaluationCategories.length > 0) {
        const totalWeight = evaluationCategories.reduce((sum: number, c: any) => sum + (c.isActive !== false ? c.weightPercent : 0), 0)
        if (Math.abs(totalWeight - 100) > 0.01) {
          return NextResponse.json({ ok: false, error: `Somme des pondérations = ${totalWeight}% (doit être 100%).` }, { status: 400 })
        }
      }

      const config = await db.subjectClassConfig.create({
        data: {
          schoolId,
          academicYearId,
          classroomId,
          subjectId,
          teacherId: teacherId || null,
          room: room || null,
          coefficient: coefficient || 1,
          maxScore: maxScore || 100,
          passingScore: passingScore || 50,
          hoursPerWeek: hoursPerWeek || 2,
          sessionsPerWeek: sessionsPerWeek || 2,
          sessionDurationMinutes: sessionDurationMinutes || 60,
          calculationType: calculationType || 'WEIGHTED_AVERAGE',
          period: period || 'T1',
          status: 'DRAFT',
          createdById: user.id,
          createdByName: user.displayName,
        },
      })

      // Créer les catégories d'évaluation
      if (evaluationCategories) {
        for (const cat of evaluationCategories) {
          await db.evaluationCategory.create({
            data: {
              schoolId,
              subjectClassConfigId: config.id,
              name: cat.name,
              weightPercent: cat.weightPercent,
              minEvaluations: cat.minEvaluations || 1,
              maxEvaluations: cat.maxEvaluations || 10,
              defaultMaxScore: cat.defaultMaxScore || 20,
              calculationRule: cat.calculationRule || 'AVERAGE',
              isActive: cat.isActive !== false,
            },
          })
        }
      }

      // Audit
      const h = await headers()
      await logAudit({
        userId: user.id, userName: user.displayName, userRole: user.role, schoolId,
        action: 'CREATE', entityType: 'SUBJECT_CLASS_CONFIG', entityId: config.id,
        description: `Configuration matière-classe créée (coefficient: ${coefficient}, maxScore: ${maxScore})`,
        ipAddress: getClientIP(h),
        metadata: { classroomId, subjectId, coefficient, maxScore },
      })

      return NextResponse.json({ ok: true, id: config.id, message: 'Configuration créée' })
    }

    if (action === 'activate') {
      const { configId } = body
      await db.subjectClassConfig.update({
        where: { id: configId },
        data: { status: 'ACTIVE', activatedAt: new Date(), activatedById: user.id, activatedByName: user.displayName },
      })
      return NextResponse.json({ ok: true, message: 'Matière activée' })
    }

    if (action === 'update') {
      const { configId, coefficient, maxScore, hoursPerWeek, teacherId, room } = body
      // Journaliser le changement si coefficient ou maxScore modifié
      const existing = await db.subjectClassConfig.findUnique({ where: { id: configId } })
      if (existing && (coefficient !== existing.coefficient || maxScore !== existing.maxScore)) {
        const h = await headers()
        await logAudit({
          userId: user.id, userName: user.displayName, userRole: user.role, schoolId: existing.schoolId,
          action: 'UPDATE', entityType: 'SUBJECT_CLASS_CONFIG', entityId: configId,
          description: `Modification coefficient/barème: ${existing.coefficient}→${coefficient}, ${existing.maxScore}→${maxScore}`,
          ipAddress: getClientIP(h),
          metadata: { oldCoefficient: existing.coefficient, newCoefficient: coefficient, oldMaxScore: existing.maxScore, newMaxScore: maxScore },
        })
      }

      await db.subjectClassConfig.update({
        where: { id: configId },
        data: {
          ...(coefficient !== undefined && { coefficient }),
          ...(maxScore !== undefined && { maxScore }),
          ...(hoursPerWeek !== undefined && { hoursPerWeek }),
          ...(teacherId !== undefined && { teacherId }),
          ...(room !== undefined && { room }),
        },
      })
      return NextResponse.json({ ok: true, message: 'Configuration mise à jour' })
    }

    return NextResponse.json({ ok: false, error: `Action "${action}" inconnue.` }, { status: 400 })
  } catch (err) {
    console.error('[api/academic/subject-class-config POST] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
