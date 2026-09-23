// SmartShule — API : Liste des élèves avec filtres + stats financières
// ============================================================
// GET /api/students?classroomId=X&status=ACTIVE&search=jean&yearId=Y
// Retourne : liste + stats + matricule auto

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

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const url = new URL(req.url)
    const classroomId = url.searchParams.get('classroomId')
    const status = url.searchParams.get('status') || 'ACTIVE'
    const search = url.searchParams.get('search') || ''
    const academicYearId = url.searchParams.get('academicYearId')
    const gender = url.searchParams.get('gender')
    const financialStatus = url.searchParams.get('financialStatus') // REGULAR | LITIGATION | BLOCKED
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = parseInt(url.searchParams.get('limit') || '100', 10)

    // Construction du where
    const where: any = { schoolId }
    if (status && status !== 'ALL') where.status = status
    if (gender) where.gender = gender

    // Filtre par classe (via enrollment)
    const enrollmentWhere: any = { status: 'ACTIVE' }
    if (classroomId) enrollmentWhere.classroomId = classroomId
    if (academicYearId) enrollmentWhere.academicYearId = academicYearId

    if (classroomId || academicYearId) {
      where.enrollments = { some: enrollmentWhere }
    }

    // Recherche par nom ou matricule
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { matricule: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Récupérer les élèves
    const [students, totalCount] = await Promise.all([
      db.student.findMany({
        where,
        include: {
          enrollments: {
            where: enrollmentWhere,
            include: {
              classroom: { include: { directorate: true, section: true, option: true } },
              academicYear: true,
            },
            take: 1,
          },
          financialStatus: true,
          guardianLinks: {
            include: { guardian: { select: { firstName: true, lastName: true, phone: true, email: true } } },
            take: 1,
          },
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.student.count({ where }),
    ])

    // Récupérer les classes pour les filtres
    const classrooms = await db.classroom.findMany({
      where: { directorate: { schoolId } },
      include: { directorate: true },
      orderBy: { name: 'asc' },
    })

    // Récupérer les années académiques
    const academicYears = await db.academicYear.findMany({
      where: { schoolId },
      orderBy: { startDate: 'desc' },
    })

    // Récupérer les directions
    const directorates = await db.directorate.findMany({
      where: { schoolId },
      orderBy: { name: 'asc' },
    })

    // Formater les résultats
    let formattedStudents = students.map((s) => {
      const enrollment = s.enrollments[0]
      const classroom = enrollment?.classroom
      const finStatus = s.financialStatus?.[0]
      const guardian = s.guardianLinks[0]?.guardian

      return {
        id: s.id,
        matricule: s.matricule,
        firstName: s.firstName,
        lastName: s.lastName,
        fullName: `${s.firstName} ${s.lastName}`,
        gender: s.gender,
        birthDate: s.birthDate?.toISOString() || null,
        status: s.status,
        photoUrl: s.photoUrl,
        classroomId: classroom?.id,
        classroomName: classroom?.name || '—',
        directorateName: classroom?.directorate.name || '—',
        sectionName: classroom?.section?.name,
        optionName: classroom?.option?.name,
        academicYearLabel: enrollment?.academicYear?.label,
        financialStatus: finStatus?.status || 'REGULAR',
        financialReason: finStatus?.reason,
        guardianName: guardian ? `${guardian.firstName} ${guardian.lastName}` : null,
        guardianPhone: guardian?.phone,
        guardianEmail: guardian?.email,
      }
    })

    // Filtre par statut financier (post-query car c'est une relation)
    if (financialStatus && financialStatus !== 'ALL') {
      formattedStudents = formattedStudents.filter((s) => s.financialStatus === financialStatus)
    }

    // Stats
    const stats = {
      total: totalCount,
      active: formattedStudents.filter((s) => s.status === 'ACTIVE').length,
      regular: formattedStudents.filter((s) => s.financialStatus === 'REGULAR').length,
      litigation: formattedStudents.filter((s) => s.financialStatus === 'LITIGATION').length,
      blocked: formattedStudents.filter((s) => s.financialStatus === 'BLOCKED').length,
      male: formattedStudents.filter((s) => s.gender === 'M').length,
      female: formattedStudents.filter((s) => s.gender === 'F').length,
    }

    return NextResponse.json({
      ok: true,
      students: formattedStudents,
      stats,
      filters: {
        classrooms: classrooms.map((c) => ({ id: c.id, name: c.name, directorateName: c.directorate.name })),
        directorates: directorates.map((d) => ({ id: d.id, name: d.name, code: d.code })),
        academicYears: academicYears.map((y) => ({ id: y.id, label: y.label, active: y.active })),
      },
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
    })
  } catch (err) {
    console.error('[api/students] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

// POST : générer un matricule automatique
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })

    const body = await req.json()
    const { action } = body

    if (action === 'generate-matricule') {
      const { directorateCode, year } = body
      const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
      if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

      // Format : ANNÉE-CODE_DIRECTION-NUMÉRO_CHRONO
      const yearShort = (year || new Date().getFullYear()).toString().slice(-2)
      const code = directorateCode || 'GEN'

      // Compter les élèves existants pour le numéro chronologique
      const count = await db.student.count({ where: { schoolId } })
      const chrono = String(count + 1).padStart(4, '0')

      const matricule = `${yearShort}${code}${chrono}`

      return NextResponse.json({
        ok: true,
        matricule,
        format: `${yearShort}-${code}-${chrono}`,
      })
    }

    if (action === 'reinscrire') {
      // Réinscription automatique : passer les élèves d'une classe à la suivante
      const { fromClassroomId, toClassroomId, academicYearId } = body
      if (!fromClassroomId || !toClassroomId || !academicYearId) {
        return NextResponse.json({ ok: false, error: 'Classes source/cible et année obligatoires.' }, { status: 400 })
      }

      const enrollments = await db.enrollment.findMany({
        where: { classroomId: fromClassroomId, status: 'ACTIVE' },
      })

      let count = 0
      for (const e of enrollments) {
        // Désactiver l'ancienne inscription
        await db.enrollment.update({
          where: { id: e.id },
          data: { status: 'TRANSFERRED' },
        })
        // Créer la nouvelle
        await db.enrollment.create({
          data: {
            studentId: e.studentId,
            classroomId: toClassroomId,
            academicYearId,
            status: 'ACTIVE',
          },
        })
        count++
      }

      return NextResponse.json({
        ok: true,
        message: `${count} élève(s) réinscrit(s) dans la nouvelle classe`,
        count,
      })
    }

    return NextResponse.json({ ok: false, error: `Action "${action}" inconnue.` }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
