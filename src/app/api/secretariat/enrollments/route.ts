// API : Inscriptions annuelles et gestion des classes — Secrétariat
// ============================================================
// GET : élèves sans classe, non réinscrits, listes d'attente, capacité
// POST : réinscrire, affecter classe, changement de classe, traitement de masse

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (user.role !== 'SECRETARY' && user.role !== 'DIRECTION' && user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
    }

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const url = new URL(req.url)
    const view = url.searchParams.get('view') || 'overview' // overview | no-class | not-reenrolled | classrooms | waiting-list
    const academicYearId = url.searchParams.get('academicYearId')
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = parseInt(url.searchParams.get('limit') || '50', 10)

    // Obtenir l'année académique active
    const activeYear = academicYearId
      ? await db.academicYear.findUnique({ where: { id: academicYearId } })
      : await db.academicYear.findFirst({ where: { schoolId, active: true } })

    const yearId = activeYear?.id

    if (view === 'overview') {
      const [totalStudents, activeStudents, studentsWithoutClass, enrolledThisYear, classrooms] = await Promise.all([
        db.student.count({ where: { schoolId } }),
        db.student.count({ where: { schoolId, status: 'ACTIVE' } }),
        db.student.count({ where: { schoolId, status: 'ACTIVE', enrollments: { none: { status: 'ACTIVE' } } } }),
        yearId ? db.enrollment.count({ where: { academicYearId: yearId, status: 'ACTIVE' } }) : 0,
        db.classroom.findMany({
          where: { directorate: { schoolId } },
          include: {
            directorate: { select: { name: true } },
            section: { select: { name: true } },
            option: { select: { name: true } },
            _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } },
          },
          orderBy: [{ name: 'asc' }],
        }),
      ])

      return NextResponse.json({
        ok: true,
        view: 'overview',
        activeYear: activeYear ? { id: activeYear.id, label: activeYear.label } : null,
        stats: { totalStudents, activeStudents, studentsWithoutClass, enrolledThisYear },
        classrooms: classrooms.map((c) => ({
          id: c.id,
          name: c.name,
          directorateName: c.directorate.name,
          sectionName: c.section?.name,
          optionName: c.option?.name,
          capacity: c.capacity,
          enrolled: c._count.enrollments,
          fillRate: c.capacity ? Math.round((c._count.enrollments / c.capacity) * 100) : null,
          isFull: c.capacity ? c._count.enrollments >= c.capacity : false,
        })),
      })
    }

    if (view === 'no-class') {
      const where = { schoolId, status: 'ACTIVE', enrollments: { none: { status: 'ACTIVE' } } }
      const [students, total] = await Promise.all([
        db.student.findMany({
          where,
          include: {
            guardianLinks: { take: 1, select: { guardian: { select: { firstName: true, lastName: true, phone: true } } } },
          },
          orderBy: [{ lastName: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        db.student.count({ where }),
      ])

      return NextResponse.json({
        ok: true,
        view: 'no-class',
        students: students.map((s) => ({
          id: s.id,
          matricule: s.matricule,
          firstName: s.firstName,
          lastName: s.lastName,
          gender: s.gender,
          birthDate: s.birthDate?.toISOString() || null,
          guardianName: s.guardianLinks[0]?.guardian ? `${s.guardianLinks[0].guardian.firstName} ${s.guardianLinks[0].guardian.lastName}` : null,
          guardianPhone: s.guardianLinks[0]?.guardian?.phone || null,
        })),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      })
    }

    if (view === 'not-reenrolled') {
      if (!yearId) return NextResponse.json({ ok: false, error: 'Aucune année académique active.' }, { status: 400 })

      // Élèves actifs sans inscription pour l'année en cours
      const where = {
        schoolId,
        status: 'ACTIVE',
        enrollments: { none: { academicYearId: yearId, status: 'ACTIVE' } },
      }

      const [students, total] = await Promise.all([
        db.student.findMany({
          where,
          include: {
            enrollments: { where: { status: { in: ['ACTIVE', 'TRANSFERRED'] } }, take: 1, include: { classroom: { select: { name: true } }, academicYear: { select: { label: true } } } },
            guardianLinks: { take: 1, select: { guardian: { select: { firstName: true, lastName: true, phone: true } } } },
          },
          orderBy: [{ lastName: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        db.student.count({ where }),
      ])

      return NextResponse.json({
        ok: true,
        view: 'not-reenrolled',
        academicYear: activeYear ? { id: activeYear.id, label: activeYear.label } : null,
        students: students.map((s) => ({
          id: s.id,
          matricule: s.matricule,
          firstName: s.firstName,
          lastName: s.lastName,
          gender: s.gender,
          lastClassroom: s.enrollments[0]?.classroom?.name || '—',
          lastYear: s.enrollments[0]?.academicYear?.label || '—',
          guardianName: s.guardianLinks[0]?.guardian ? `${s.guardianLinks[0].guardian.firstName} ${s.guardianLinks[0].guardian.lastName}` : null,
          guardianPhone: s.guardianLinks[0]?.guardian?.phone || null,
        })),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      })
    }

    if (view === 'classrooms') {
      const classroomId = url.searchParams.get('classroomId')
      if (classroomId) {
        // Détail d'une classe
        const classroom = await db.classroom.findUnique({
          where: { id: classroomId },
          include: {
            directorate: true,
            section: true,
            option: true,
            enrollments: {
              where: { status: 'ACTIVE' },
              include: {
                student: {
                  include: {
                    guardianLinks: { take: 1, select: { guardian: { select: { firstName: true, lastName: true, phone: true } } } },
                  },
                },
              },
              orderBy: [{ student: { lastName: 'asc' } }],
            },
          },
        })

        if (!classroom) return NextResponse.json({ ok: false, error: 'Classe introuvable.' }, { status: 404 })

        return NextResponse.json({
          ok: true,
          classroom: {
            id: classroom.id,
            name: classroom.name,
            capacity: classroom.capacity,
            directorateName: classroom.directorate.name,
            sectionName: classroom.section?.name,
            optionName: classroom.option?.name,
            enrolled: classroom.enrollments.length,
            fillRate: classroom.capacity ? Math.round((classroom.enrollments.length / classroom.capacity) * 100) : null,
          },
          students: classroom.enrollments.map((e) => ({
            enrollmentId: e.id,
            studentId: e.studentId,
            matricule: e.student.matricule,
            firstName: e.student.firstName,
            lastName: e.student.lastName,
            gender: e.student.gender,
            status: e.student.status,
            guardianName: e.student.guardianLinks[0]?.guardian ? `${e.student.guardianLinks[0].guardian.firstName} ${e.student.guardianLinks[0].guardian.lastName}` : null,
            guardianPhone: e.student.guardianLinks[0]?.guardian?.phone || null,
            enrolledAt: e.enrolledAt.toISOString(),
          })),
        })
      }

      // Liste des classes
      const classrooms = await db.classroom.findMany({
        where: { directorate: { schoolId } },
        include: {
          directorate: { select: { name: true } },
          section: { select: { name: true } },
          option: { select: { name: true } },
          _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } },
        },
        orderBy: [{ name: 'asc' }],
      })

      return NextResponse.json({
        ok: true,
        classrooms: classrooms.map((c) => ({
          id: c.id,
          name: c.name,
          directorateName: c.directorate.name,
          sectionName: c.section?.name,
          optionName: c.option?.name,
          capacity: c.capacity,
          enrolled: c._count.enrollments,
          isFull: c.capacity ? c._count.enrollments >= c.capacity : false,
        })),
      })
    }

    return NextResponse.json({ ok: false, error: `Vue "${view}" inconnue.` }, { status: 400 })
  } catch (err) {
    console.error('[api/secretariat/enrollments] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (user.role !== 'SECRETARY' && user.role !== 'DIRECTION' && user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
    }

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const body = await req.json()
    const { action } = body

    // Affecter un élève à une classe
    if (action === 'assign-class') {
      const { studentId, classroomId, academicYearId } = body
      if (!studentId || !classroomId || !academicYearId) {
        return NextResponse.json({ ok: false, error: 'studentId, classroomId et academicYearId requis.' }, { status: 400 })
      }

      // Vérifier la capacité
      const classroom = await db.classroom.findUnique({
        where: { id: classroomId },
        include: { _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } } },
      })
      if (!classroom) return NextResponse.json({ ok: false, error: 'Classe introuvable.' }, { status: 404 })
      if (classroom.capacity && classroom._count.enrollments >= classroom.capacity) {
        return NextResponse.json({ ok: false, error: `Classe pleine (${classroom._count.enrollments}/${classroom.capacity}).` }, { status: 409 })
      }

      // Vérifier qu'il n'y a pas déjà une inscription active
      const existing = await db.enrollment.findFirst({
        where: { studentId, academicYearId, status: 'ACTIVE' },
      })
      if (existing) {
        return NextResponse.json({ ok: false, error: 'Cet élève a déjà une inscription active pour cette année.' }, { status: 409 })
      }

      const enrollment = await db.enrollment.create({
        data: { studentId, classroomId, academicYearId, status: 'ACTIVE' },
      })

      // Journal de masse
      await db.massOperation.create({
        data: {
          schoolId,
          operationType: 'ASSIGN_CLASS',
          parameters: JSON.stringify({ studentId, classroomId, academicYearId }),
          affectedCount: 1,
          successCount: 1,
          failCount: 0,
          confirmedById: user.id,
          confirmedByName: user.displayName,
          confirmedAt: new Date(),
          createdById: user.id,
          createdByName: user.displayName,
          completedAt: new Date(),
        },
      })

      return NextResponse.json({ ok: true, id: enrollment.id, message: 'Élève affecté à la classe' })
    }

    // Changement de classe
    if (action === 'change-class') {
      const { studentId, fromClassroomId, toClassroomId, academicYearId } = body
      if (!studentId || !fromClassroomId || !toClassroomId || !academicYearId) {
        return NextResponse.json({ ok: false, error: 'Tous les paramètres sont requis.' }, { status: 400 })
      }

      // Vérifier la capacité de la classe cible
      const toClassroom = await db.classroom.findUnique({
        where: { id: toClassroomId },
        include: { _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } } },
      })
      if (!toClassroom) return NextResponse.json({ ok: false, error: 'Classe cible introuvable.' }, { status: 404 })
      if (toClassroom.capacity && toClassroom._count.enrollments >= toClassroom.capacity) {
        return NextResponse.json({ ok: false, error: `Classe cible pleine (${toClassroom._count.enrollments}/${toClassroom.capacity}).` }, { status: 409 })
      }

      // Désactiver l'ancienne inscription
      await db.enrollment.updateMany({
        where: { studentId, classroomId: fromClassroomId, academicYearId, status: 'ACTIVE' },
        data: { status: 'TRANSFERRED' },
      })

      // Créer la nouvelle
      const enrollment = await db.enrollment.create({
        data: { studentId, classroomId: toClassroomId, academicYearId, status: 'ACTIVE' },
      })

      return NextResponse.json({ ok: true, id: enrollment.id, message: 'Classe changée' })
    }

    // Réinscription de masse
    if (action === 'mass-reenroll') {
      const { studentIds, classroomId, academicYearId } = body
      if (!studentIds?.length || !classroomId || !academicYearId) {
        return NextResponse.json({ ok: false, error: 'studentIds, classroomId et academicYearId requis.' }, { status: 400 })
      }

      // Vérifier la capacité
      const classroom = await db.classroom.findUnique({
        where: { id: classroomId },
        include: { _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } } },
      })
      if (!classroom) return NextResponse.json({ ok: false, error: 'Classe introuvable.' }, { status: 404 })
      const available = classroom.capacity ? classroom.capacity - classroom._count.enrollments : Infinity
      if (studentIds.length > available) {
        return NextResponse.json({ ok: false, error: `Capacité insuffisante. Places disponibles: ${available === Infinity ? '∞' : available}, demandées: ${studentIds.length}` }, { status: 409 })
      }

      let successCount = 0
      let failCount = 0
      const errors: string[] = []

      for (const sid of studentIds) {
        try {
          // Vérifier unicité
          const exists = await db.enrollment.findFirst({
            where: { studentId: sid, academicYearId, status: 'ACTIVE' },
          })
          if (exists) {
            failCount++
            errors.push(`Élève ${sid}: déjà inscrit`)
            continue
          }

          await db.enrollment.create({
            data: { studentId: sid, classroomId, academicYearId, status: 'ACTIVE' },
          })
          successCount++
        } catch (e) {
          failCount++
          errors.push(`Élève ${sid}: ${(e as Error).message}`)
        }
      }

      // Journal de masse
      await db.massOperation.create({
        data: {
          schoolId,
          operationType: 'REENROLL',
          parameters: JSON.stringify({ classroomId, academicYearId, count: studentIds.length }),
          affectedCount: studentIds.length,
          successCount,
          failCount,
          errors: errors.length ? JSON.stringify(errors) : null,
          confirmedById: user.id,
          confirmedByName: user.displayName,
          confirmedAt: new Date(),
          createdById: user.id,
          createdByName: user.displayName,
          completedAt: new Date(),
        },
      })

      return NextResponse.json({
        ok: true,
        successCount,
        failCount,
        errors: errors.length ? errors : undefined,
        message: `${successCount} élève(s) réinscrit(s), ${failCount} échec(s)`,
      })
    }

    return NextResponse.json({ ok: false, error: `Action "${action}" inconnue.` }, { status: 400 })
  } catch (err) {
    console.error('[api/secretariat/enrollments POST] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
