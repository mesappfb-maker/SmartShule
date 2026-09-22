// SmartShule — API : Affectation prof → matière + classe
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'
import { getSchoolIdForUser } from '@/lib/school-context'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST : créer une affectation
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (user.role !== 'DIRECTION' && user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'Accès réservé à la Direction.' }, { status: 403 })
    }
    const body = await req.json()
    const { employeeId, subjectId, classroomId } = body
    if (!employeeId || !subjectId || !classroomId) {
      return NextResponse.json({ ok: false, error: 'Professeur, matière et classe obligatoires.' }, { status: 400 })
    }
    const existing = await db.teacherAssignment.findFirst({
      where: { employeeId, subjectId, classroomId },
    })
    if (existing) {
      return NextResponse.json({ ok: false, error: 'Affectation déjà existante.' }, { status: 409 })
    }
    const assignment = await db.teacherAssignment.create({
      data: { employeeId, subjectId, classroomId },
    })
    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (schoolId) {
      const h = await headers()
      await logAudit({
        userId: user.id, userName: user.displayName, userRole: user.role, schoolId,
        action: 'CREATE', entityType: 'OTHER', entityId: assignment.id,
        description: `Affectation créée : prof ${employeeId} → matière ${subjectId} / classe ${classroomId}`,
        ipAddress: getClientIP(h),
      })
    }
    return NextResponse.json({ ok: true, id: assignment.id, message: 'Affectation créée avec succès' })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

// DELETE : supprimer une affectation
export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (user.role !== 'DIRECTION' && user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'Accès réservé à la Direction.' }, { status: 403 })
    }
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    if (!id) return NextResponse.json({ ok: false, error: 'ID manquant.' }, { status: 400 })
    await db.teacherAssignment.delete({ where: { id } })
    return NextResponse.json({ ok: true, message: 'Affectation supprimée' })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

// GET : liste des affectations + employees + subjects + classrooms
export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const [assignments, employees, subjects, classrooms] = await Promise.all([
      db.teacherAssignment.findMany({
        where: { employee: { schoolId } },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, email: true } },
          subject: true,
          classroom: { include: { directorate: true } },
        },
        orderBy: [{ employee: { firstName: 'asc' } }, { subject: { name: 'asc' } }],
      }),
      db.employee.findMany({
        where: { schoolId, function: 'ENSEIGNANT', status: 'ACTIVE' },
        select: { id: true, firstName: true, lastName: true, email: true },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      }),
      db.subject.findMany({ where: { schoolId }, orderBy: { name: 'asc' } }),
      db.classroom.findMany({
        where: { directorate: { schoolId } },
        include: { directorate: true, section: true, option: true },
        orderBy: { name: 'asc' },
      }),
    ])

    return NextResponse.json({
      ok: true,
      assignments: assignments.map((a) => ({
        id: a.id,
        employeeId: a.employeeId,
        employeeName: `${a.employee.firstName} ${a.employee.lastName}`,
        employeeEmail: a.employee.email,
        subjectId: a.subjectId,
        subjectName: a.subject.name,
        classroomId: a.classroomId,
        classroomName: a.classroom?.name || '—',
        directorateName: a.classroom?.directorate.name,
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
