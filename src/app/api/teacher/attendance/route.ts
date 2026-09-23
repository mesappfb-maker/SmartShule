// SmartShule — API : Appel de présence par le professeur
// ============================================================
// Le prof :
//   1. GET /api/teacher/attendance?scheduleId=X → récupère liste élèves du créneau
//   2. POST /api/teacher/attendance → enregistre l'appel (status par élève)
//
// Statuts : PRESENT | ABSENT | LATE | EXCUSED

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function getSchoolId(email: string) {
  const emp = await db.employee.findFirst({ where: { email }, select: { schoolId: true } })
  if (emp?.schoolId) return emp.schoolId
  const school = await db.school.findFirst()
  return school?.id || null
}

// GET : récupère les élèves d'un créneau + l'appel existant (si déjà fait)
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })

    const url = new URL(req.url)
    const scheduleId = url.searchParams.get('scheduleId')
    if (!scheduleId) {
      return NextResponse.json({ ok: false, error: 'scheduleId manquant.' }, { status: 400 })
    }

    const schedule = await db.employeeSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        employee: true,
        subject: true,
        classroom: {
          include: {
            enrollments: {
              where: { status: 'ACTIVE' },
              include: {
                student: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    matricule: true,
                    financialStatus: true,
                  },
                },
              },
            },
          },
        },
      },
    })
    if (!schedule) {
      return NextResponse.json({ ok: false, error: 'Créneau introuvable.' }, { status: 404 })
    }

    // Vérifier que c'est bien le prof du créneau (ou Direction)
    if (user.role === 'TEACHER') {
      const emp = await db.employee.findFirst({ where: { email: user.email } })
      if (emp?.id !== schedule.employeeId) {
        return NextResponse.json({ ok: false, error: 'Vous n\'êtes pas assigné à ce cours.' }, { status: 403 })
      }
    }

    // Chercher un AttendanceSession existant pour aujourd'hui
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    let attendanceSession = await db.attendanceSession.findFirst({
      where: {
        schoolId: schedule.schoolId,
        teacherId: schedule.employeeId,
        date: { gte: today, lt: tomorrow },
      },
      include: {
        attendances: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true, matricule: true } },
          },
        },
      },
    })

    // Si pas de session, en créer une (ouverte) — uniquement si la requête vient avec ?start=true
    const shouldStart = url.searchParams.get('start') === 'true'
    if (!attendanceSession && shouldStart && schedule.subjectId) {
      const subjectId: string = schedule.subjectId
      const course = await db.course.findFirst({
        where: { classroomId: schedule.classroomId, subjectId: subjectId as string },
      })
      let courseId: string | undefined = course?.id
      if (!courseId) {
        const newCourse = await db.course.create({
          data: {
            schoolId: schedule.schoolId,
            classroomId: schedule.classroomId,
            subjectId: subjectId as string,
            teacherId: schedule.employeeId,
            title: schedule.subject?.name || 'Cours',
            status: 'PUBLISHED',
            publishedAt: new Date(),
          },
        })
        courseId = newCourse.id
      }
      const created = await db.attendanceSession.create({
        data: {
          schoolId: schedule.schoolId,
          courseId: courseId as string,
          classroomId: schedule.classroomId,
          teacherId: schedule.employeeId,
          date: new Date(),
          status: 'OPEN',
        },
        include: { attendances: { include: { student: true } } },
      })
      attendanceSession = created as any

      const h = await headers()
      await logAudit({
        userId: user.id, userName: user.displayName, userRole: user.role,
        schoolId: schedule.schoolId,
        action: 'CREATE', entityType: 'OTHER', entityId: created.id,
        description: `Appel démarré pour ${schedule.subject?.name} en ${schedule.classroom?.name}`,
        ipAddress: getClientIP(h),
      })
    }

    // Liste des élèves avec leur statut (si déjà appelés)
    const studentStatusMap = new Map<string, string>()
    if (attendanceSession) {
      for (const att of attendanceSession.attendances) {
        studentStatusMap.set(att.studentId, att.status)
      }
    }

    return NextResponse.json({
      ok: true,
      schedule: {
        id: schedule.id,
        subjectName: schedule.subject?.name || '—',
        classroomName: schedule.classroom?.name || '—',
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        room: schedule.room,
      },
      attendanceSession: attendanceSession ? {
        id: attendanceSession.id,
        status: attendanceSession.status,
        lockedAt: attendanceSession.lockedAt,
        date: attendanceSession.date,
      } : null,
      students: schedule.classroom?.enrollments.map((e) => ({
        studentId: e.student.id,
        name: `${e.student.firstName} ${e.student.lastName}`,
        matricule: e.student.matricule,
        financialStatus: e.student.financialStatus?.[0]?.status || 'REGULAR',
        callStatus: studentStatusMap.get(e.student.id) || null,
      })) || [],
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

// POST : enregistrer l'appel (1 élève à la fois)
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })

    const body = await req.json()
    const { sessionId, studentId, status, justification, lateMinutes } = body

    if (!sessionId || !studentId || !status) {
      return NextResponse.json({ ok: false, error: 'sessionId, studentId, status obligatoires.' }, { status: 400 })
    }
    if (!['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].includes(status)) {
      return NextResponse.json({ ok: false, error: 'Statut invalide.' }, { status: 400 })
    }

    // Vérifier session ouverte
    const session = await db.attendanceSession.findUnique({ where: { id: sessionId } })
    if (!session) return NextResponse.json({ ok: false, error: 'Session introuvable.' }, { status: 404 })
    if (session.status !== 'OPEN') {
      return NextResponse.json({ ok: false, error: `Session verrouillée (${session.status}).` }, { status: 400 })
    }

    // Upsert présence (anti-doublon via schoolId + attendanceSessionId + studentId)
    const existing = await db.attendance.findUnique({
      where: {
        schoolId_attendanceSessionId_studentId: {
          schoolId: session.schoolId,
          attendanceSessionId: sessionId,
          studentId,
        },
      },
    })

    if (existing) {
      await db.attendance.update({
        where: { id: existing.id },
        data: {
          status,
          justification: justification || null,
          recordedById: user.id,
          recordedAt: new Date(),
        },
      })
    } else {
      await db.attendance.create({
        data: {
          schoolId: session.schoolId,
          attendanceSessionId: sessionId,
          studentId,
          courseId: session.courseId,
          date: session.date,
          status,
          justification: justification || null,
          recordedById: user.id,
        },
      })
    }

    return NextResponse.json({ ok: true, message: `Présence enregistrée : ${status}` })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

// PATCH : verrouiller la session (plus de modifications possibles)
export async function PATCH(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })

    const url = new URL(req.url)
    const sessionId = url.searchParams.get('sessionId')
    if (!sessionId) return NextResponse.json({ ok: false, error: 'sessionId manquant.' }, { status: 400 })

    const session = await db.attendanceSession.findUnique({ where: { id: sessionId } })
    if (!session) return NextResponse.json({ ok: false, error: 'Session introuvable.' }, { status: 404 })
    if (session.status !== 'OPEN') {
      return NextResponse.json({ ok: false, error: 'Session déjà verrouillée.' }, { status: 400 })
    }

    await db.attendanceSession.update({
      where: { id: sessionId },
      data: { status: 'LOCKED', lockedAt: new Date(), lockedById: user.id },
    })

    const h = await headers()
    await logAudit({
      userId: user.id, userName: user.displayName, userRole: user.role,
      schoolId: session.schoolId,
      action: 'UPDATE', entityType: 'OTHER', entityId: sessionId,
      description: `Appel verrouillé`,
      ipAddress: getClientIP(h),
    })

    return NextResponse.json({ ok: true, message: 'Appel verrouillé' })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
