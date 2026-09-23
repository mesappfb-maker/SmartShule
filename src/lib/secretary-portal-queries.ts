// SmartShule — Queries : Portail Secrétariat
// ============================================================
// Le secrétariat gère : inscriptions, listes élèves, demandes parents, annonces

import { db } from '@/lib/db'

export async function getSecretaryPortalData(userId: string, userEmail?: string) {
  // Trouver l'école
  let schoolId: string | undefined
  if (userEmail) {
    const employee = await db.employee.findFirst({
      where: { email: userEmail },
      select: { schoolId: true, id: true, firstName: true, lastName: true },
    })
    if (employee?.schoolId) schoolId = employee.schoolId
  }
  if (!schoolId) {
    const school = await db.school.findFirst()
    schoolId = school?.id
  }
  if (!schoolId) return null

  // Stats rapides
  const [
    totalStudents,
    activeStudents,
    totalGuardians,
    totalClasses,
    totalDirections,
    pendingParentRequests,
    todayReceptions,
    recentEnrollments,
    academicYears,
    classrooms,
  ] = await Promise.all([
    db.student.count({ where: { schoolId } }),
    db.student.count({ where: { schoolId, status: 'ACTIVE' } }),
    db.guardian.count({ where: { schoolId } }),
    db.classroom.count({ where: { directorate: { schoolId } } }),
    db.directorate.count({ where: { schoolId } }),
    db.parentRequest.count({ where: { schoolId, status: 'OPEN' } }),
    db.reception.count({
      where: {
        schoolId,
        scheduledDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        status: 'SCHEDULED',
      },
    }),
    db.enrollment.findMany({
      where: { student: { schoolId }, enrolledAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      include: {
        student: { select: { firstName: true, lastName: true, matricule: true } },
        classroom: { select: { name: true } },
      },
      orderBy: { enrolledAt: 'desc' },
      take: 10,
    }),
    db.academicYear.findMany({ where: { schoolId }, orderBy: { startDate: 'desc' } }),
    db.classroom.findMany({
      where: { directorate: { schoolId } },
      include: {
        directorate: true,
        section: true,
        option: true,
        _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } },
      },
      orderBy: { name: 'asc' },
    }),
  ])

  // Récupérer l'employé
  let secretary: { id: string; name: string; function: string } | null = null
  if (userEmail) {
    const emp = await db.employee.findFirst({
      where: { email: userEmail },
      select: { id: true, firstName: true, lastName: true, function: true },
    })
    if (emp) {
      secretary = {
        id: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        function: emp.function,
      }
    }
  }

  return {
    secretary,
    stats: {
      totalStudents,
      activeStudents,
      totalGuardians,
      totalClasses,
      totalDirections,
      pendingParentRequests,
      todayReceptions,
    },
    recentEnrollments: recentEnrollments.map((e) => ({
      studentName: `${e.student.firstName} ${e.student.lastName}`,
      matricule: e.student.matricule,
      classroomName: e.classroom.name,
      enrolledAt: e.enrolledAt,
    })),
    academicYears: academicYears.map((y) => ({
      id: y.id,
      label: y.label,
      active: y.active,
    })),
    classrooms: classrooms.map((c) => ({
      id: c.id,
      name: c.name,
      directorateName: c.directorate.name,
      sectionName: c.section?.name,
      optionName: c.option?.name,
      enrolledCount: c._count.enrollments,
      capacity: c.capacity,
    })),
  }
}
