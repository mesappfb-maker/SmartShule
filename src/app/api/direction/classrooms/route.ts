// SmartShule — API : Liste des classes pour le portail Direction
// ============================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getUserFromSession()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
  }

  const employee = await db.employee.findFirst({ where: { email: user.email } })
  const schoolId = employee?.schoolId
  if (!schoolId) {
    const school = await db.school.findFirst()
    if (!school) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })
    return getClassrooms(school.id)
  }
  return getClassrooms(schoolId)
}

async function getClassrooms(schoolId: string) {
  const classrooms = await db.classroom.findMany({
    where: { directorate: { schoolId } },
    include: {
      directorate: true,
      section: true,
      option: true,
      academicYear: true,
      _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } },
    },
    orderBy: [{ academicYearLabel: 'desc' }, { name: 'asc' }],
  })

  return NextResponse.json({
    ok: true,
    classrooms: classrooms.map((c) => ({
      id: c.id,
      name: c.name,
      directorateName: c.directorate.name,
      sectionName: c.section?.name,
      optionName: c.option?.name,
      academicYearLabel: c.academicYearLabel,
      capacity: c.capacity,
      enrolledCount: c._count.enrollments,
    })),
  })
}
