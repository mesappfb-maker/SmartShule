// API : File d'attente administrative (CRUD)
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (user.role !== 'SECRETARY' && user.role !== 'DIRECTION' && user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
    }

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const tasks = await db.adminTask.findMany({
      where: { schoolId, status: { not: 'DONE' } },
      include: {
        student: { select: { firstName: true, lastName: true, matricule: true } },
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
      take: 100,
    })

    return NextResponse.json({
      ok: true,
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        category: t.category,
        priority: t.priority,
        status: t.status,
        dueDate: t.dueDate?.toISOString() || null,
        assignedToName: t.assignedToName,
        studentName: t.student ? `${t.student.firstName} ${t.student.lastName}` : null,
        studentMatricule: t.student?.matricule || null,
        createdAt: t.createdAt.toISOString(),
      })),
    })
  } catch (err) {
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
    const { action, taskId, title, description, category, priority, dueDate, studentId, status } = body

    if (action === 'create') {
      const task = await db.adminTask.create({
        data: {
          schoolId,
          title, description, category: category || 'OTHER',
          priority: priority || 'NORMAL',
          dueDate: dueDate ? new Date(dueDate) : null,
          studentId: studentId || null,
          status: 'PENDING',
          createdById: user.id,
          createdByName: user.displayName,
        },
      })
      return NextResponse.json({ ok: true, id: task.id, message: 'Tâche créée' })
    }

    if (action === 'update-status') {
      await db.adminTask.update({
        where: { id: taskId },
        data: { status, completedAt: status === 'DONE' ? new Date() : null, assignedToId: user.id, assignedToName: user.displayName },
      })
      return NextResponse.json({ ok: true, message: 'Statut mis à jour' })
    }

    if (action === 'delete') {
      await db.adminTask.delete({ where: { id: taskId } })
      return NextResponse.json({ ok: true, message: 'Tâche supprimée' })
    }

    return NextResponse.json({ ok: false, error: `Action "${action}" inconnue.` }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
