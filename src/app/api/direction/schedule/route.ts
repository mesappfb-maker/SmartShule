// SmartShule — API : Emploi du temps hebdomadaire (schedule)
// ============================================================
// Créneaux horaires : jour de la semaine + heure début/fin + salle

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'
import { getSchoolIdForUser } from '@/lib/school-context'
import { hasRole } from '@/lib/rbac'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

// POST : créer un créneau horaire
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (!hasRole(user, ['DIRECTION', 'ADMIN'])) {
      return NextResponse.json({ ok: false, error: 'Accès réservé à la Direction.' }, { status: 403 })
    }
    const body = await req.json()
    const { employeeId, classroomId, subjectId, dayOfWeek, startTime, endTime, room } = body

    if (!employeeId || !classroomId || !subjectId || dayOfWeek === undefined || !startTime || !endTime) {
      return NextResponse.json({ ok: false, error: 'Tous les champs sont obligatoires.' }, { status: 400 })
    }
    if (dayOfWeek < 0 || dayOfWeek > 6) {
      return NextResponse.json({ ok: false, error: 'Jour de la semaine invalide (0-6).' }, { status: 400 })
    }
    if (startTime >= endTime) {
      return NextResponse.json({ ok: false, error: 'Heure de début doit être avant l\'heure de fin.' }, { status: 400 })
    }

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    // Vérifier chevauchement (même prof, même jour, même heure)
    const conflict = await db.employeeSchedule.findFirst({
      where: {
        schoolId,
        employeeId,
        dayOfWeek,
        status: 'ACTIVE',
        OR: [
          { startTime: { gte: startTime, lt: endTime } },
          { endTime: { gt: startTime, lte: endTime } },
          { AND: [{ startTime: { lte: startTime } }, { endTime: { gte: endTime } }] },
        ],
      },
    })
    if (conflict) {
      return NextResponse.json({
        ok: false,
        error: `Conflit : ce prof a déjà un cours le ${DAYS[dayOfWeek]} à ${conflict.startTime}-${conflict.endTime}`,
      }, { status: 409 })
    }

    const schedule = await db.employeeSchedule.create({
      data: {
        schoolId,
        employeeId,
        classroomId,
        subjectId,
        dayOfWeek,
        startTime,
        endTime,
        room: room || null,
        status: 'ACTIVE',
      },
    })

    const h = await headers()
    await logAudit({
      userId: user.id, userName: user.displayName, userRole: user.role, schoolId,
      action: 'CREATE', entityType: 'OTHER', entityId: schedule.id,
      description: `Créneau créé : ${DAYS[dayOfWeek]} ${startTime}-${endTime}${room ? ` (${room})` : ''}`,
      ipAddress: getClientIP(h),
    })

    return NextResponse.json({ ok: true, id: schedule.id, message: 'Créneau créé avec succès' })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

// DELETE : supprimer un créneau
export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (!hasRole(user, ['DIRECTION', 'ADMIN'])) {
      return NextResponse.json({ ok: false, error: 'Accès réservé à la Direction.' }, { status: 403 })
    }
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    if (!id) return NextResponse.json({ ok: false, error: 'ID manquant.' }, { status: 400 })
    await db.employeeSchedule.delete({ where: { id } })
    return NextResponse.json({ ok: true, message: 'Créneau supprimé' })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

// GET : liste des créneaux + profs + classes + matières
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const url = new URL(req.url)
    const classroomId = url.searchParams.get('classroomId')
    const employeeId = url.searchParams.get('employeeId')

    const where: any = { schoolId, status: 'ACTIVE' }
    if (classroomId) where.classroomId = classroomId
    if (employeeId) where.employeeId = employeeId

    const [schedules, employees, subjects, classrooms] = await Promise.all([
      db.employeeSchedule.findMany({
        where,
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, email: true } },
          subject: true,
          classroom: { include: { directorate: true } },
          course: { include: { subject: true } },
        },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      }),
      db.employee.findMany({
        where: { schoolId, function: 'ENSEIGNANT', status: 'ACTIVE' },
        select: { id: true, firstName: true, lastName: true, email: true },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      }),
      db.subject.findMany({ where: { schoolId }, orderBy: { name: 'asc' } }),
      db.classroom.findMany({
        where: { directorate: { schoolId } },
        include: { directorate: true },
        orderBy: { name: 'asc' },
      }),
    ])

    return NextResponse.json({
      ok: true,
      days: DAYS,
      schedules: schedules.map((s) => ({
        id: s.id,
        employeeId: s.employeeId,
        employeeName: `${s.employee.firstName} ${s.employee.lastName}`,
        classroomId: s.classroomId,
        classroomName: s.classroom?.name || '—',
        directorateName: s.classroom?.directorate.name,
        subjectId: s.subjectId,
        subjectName: s.subject?.name || s.course?.subject?.name || '—',
        dayOfWeek: s.dayOfWeek,
        dayName: DAYS[s.dayOfWeek],
        startTime: s.startTime,
        endTime: s.endTime,
        room: s.room,
      })),
      employees: employees.map((e) => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        email: e.email,
      })),
      subjects,
      classrooms: classrooms.map((c) => ({
        id: c.id,
        name: c.name,
        directorateName: c.directorate.name,
      })),
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
