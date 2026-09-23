// SmartShule — API Secrétariat unifiée
// ============================================================
// GET : récupère les données détaillées d'une classe (élèves + profs + horaires)
// POST : actions dispatch (absences, documents, etc.)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET : détails d'une classe (élèves + profs + horaires)
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const url = new URL(req.url)
    const classroomId = url.searchParams.get('classroomId')

    if (classroomId) {
      // === DÉTAILS D'UNE CLASSE SPÉCIFIQUE ===
      const classroom = await db.classroom.findUnique({
        where: { id: classroomId },
        include: {
          directorate: true,
          section: true,
          option: true,
          academicYear: true,
          enrollments: {
            where: { status: 'ACTIVE' },
            include: {
              student: {
                select: {
                  id: true, firstName: true, lastName: true, matricule: true,
                  gender: true, birthDate: true, status: true, photoUrl: true,
                  financialStatus: { select: { status: true } },
                  attendances: {
                    where: { date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
                    select: { status: true },
                  },
                  guardianLinks: {
                    include: { guardian: { select: { firstName: true, lastName: true, phone: true, email: true } } },
                    take: 1,
                  },
                },
              },
            },
            orderBy: [{ student: { firstName: 'asc' } }, { student: { lastName: 'asc' } }],
          },
        },
      })

      if (!classroom) return NextResponse.json({ ok: false, error: 'Classe introuvable.' }, { status: 404 })

      // Profs affectés à cette classe (TeacherAssignment)
      const assignments = await db.teacherAssignment.findMany({
        where: { classroomId },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          subject: true,
        },
      })

      // Emploi du temps de cette classe
      const schedule = await db.employeeSchedule.findMany({
        where: { classroomId, status: 'ACTIVE' },
        include: {
          employee: { select: { firstName: true, lastName: true } },
          subject: true,
        },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      })

      // Stats de présence (30 derniers jours)
      const students = classroom.enrollments.map((e) => e.student)
      let totalAbsences = 0
      let totalLates = 0
      let totalExcused = 0
      students.forEach((s) => {
        s.attendances.forEach((a) => {
          if (a.status === 'ABSENT') totalAbsences++
          if (a.status === 'LATE') totalLates++
          if (a.status === 'EXCUSED') totalExcused++
        })
      })

      const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

      return NextResponse.json({
        ok: true,
        classroom: {
          id: classroom.id,
          name: classroom.name,
          capacity: classroom.capacity,
          directorateName: classroom.directorate.name,
          sectionName: classroom.section?.name,
          optionName: classroom.option?.name,
          academicYearLabel: classroom.academicYearLabel,
        },
        students: students.map((s) => {
          const guardian = s.guardianLinks[0]?.guardian
          const absences = s.attendances.filter((a) => a.status === 'ABSENT').length
          const lates = s.attendances.filter((a) => a.status === 'LATE').length
          return {
            id: s.id,
            firstName: s.firstName,
            lastName: s.lastName,
            fullName: `${s.firstName} ${s.lastName}`,
            matricule: s.matricule,
            gender: s.gender,
            birthDate: s.birthDate?.toISOString() || null,
            status: s.status,
            financialStatus: s.financialStatus?.[0]?.status || 'REGULAR',
            guardianName: guardian ? `${guardian.firstName} ${guardian.lastName}` : null,
            guardianPhone: guardian?.phone,
            guardianEmail: guardian?.email,
            absencesCount: absences,
            latesCount: lates,
          }
        }),
        teachers: assignments.map((a) => ({
          id: a.employee.id,
          name: `${a.employee.firstName} ${a.employee.lastName}`,
          email: a.employee.email,
          phone: a.employee.phone,
          subjectName: a.subject.name,
          subjectCode: a.subject.code,
        })),
        schedule: schedule.map((s) => ({
          id: s.id,
          dayOfWeek: s.dayOfWeek,
          dayName: DAYS[s.dayOfWeek] || '—',
          startTime: s.startTime,
          endTime: s.endTime,
          room: s.room,
          teacherName: `${s.employee.firstName} ${s.employee.lastName}`,
          subjectName: s.subject?.name || '—',
        })),
        stats: {
          totalStudents: students.length,
          capacity: classroom.capacity,
          fillRate: classroom.capacity > 0 ? Math.round((students.length / classroom.capacity) * 100) : 0,
          absences30d: totalAbsences,
          lates30d: totalLates,
          excused30d: totalExcused,
          regular: students.filter((s) => (s.financialStatus?.[0]?.status || 'REGULAR') === 'REGULAR').length,
          litigation: students.filter((s) => s.financialStatus?.[0]?.status === 'LITIGATION').length,
          blocked: students.filter((s) => s.financialStatus?.[0]?.status === 'BLOCKED').length,
        },
      })
    }

    // === LISTE DE TOUTES LES CLASSES (vue par défaut) ===
    const classrooms = await db.classroom.findMany({
      where: { directorate: { schoolId } },
      include: {
        directorate: true,
        section: true,
        option: true,
        _count: {
          select: {
            enrollments: { where: { status: 'ACTIVE' } },
            teacherAssignments: true,
          },
        },
      },
      orderBy: [{ academicYearLabel: 'desc' }, { name: 'asc' }],
    })

    return NextResponse.json({
      ok: true,
      classrooms: classrooms.map((c) => ({
        id: c.id,
        name: c.name,
        capacity: c.capacity,
        directorateName: c.directorate.name,
        sectionName: c.section?.name,
        optionName: c.option?.name,
        academicYearLabel: c.academicYearLabel,
        enrolledCount: c._count.enrollments,
        teacherCount: c._count.teacherAssignments,
        fillRate: c.capacity > 0 ? Math.round((c._count.enrollments / c.capacity) * 100) : 0,
      })),
    })
  } catch (err) {
    console.error('[api/secretariat] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
