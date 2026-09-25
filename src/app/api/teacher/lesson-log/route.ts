// API : Sauvegarder le cahier de textes (LessonLog)
// POST FormData: emargementId, lessonTitle, summary, homeworkPublished, resourcesUrl, publish
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (user.role !== 'TEACHER' && user.role !== 'DIRECTION' && user.role !== 'ADMIN' && user.role !== 'DIRECTOR' && user.role !== 'SCHOOL_ADMIN') {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
    }

    const formData = await req.formData()
    const emargementId = String(formData.get('emargementId') || '')
    const lessonTitle = String(formData.get('lessonTitle') || '')
    const summary = String(formData.get('summary') || '')
    const homeworkPublished = String(formData.get('homeworkPublished') || '')
    const resourcesUrl = String(formData.get('resourcesUrl') || '')
    const publish = formData.get('publish') === 'true'

    if (!emargementId || !lessonTitle.trim() || !summary.trim()) {
      return NextResponse.json({ ok: false, error: 'emargementId, lessonTitle et summary requis.' }, { status: 400 })
    }

    // Vérifier l'émargement
    const emargement = await db.teacherEmargement.findUnique({
      where: { id: emargementId },
      include: { teacher: true, classroom: true, agenda: true },
    })
    if (!emargement) {
      return NextResponse.json({ ok: false, error: 'Émargement introuvable.' }, { status: 404 })
    }
    if (!emargement.agenda) {
      return NextResponse.json({ ok: false, error: 'Agenda introuvable pour cet émargement.' }, { status: 404 })
    }

    const lessonLogData = {
      schoolId: emargement.schoolId,
      emargementId,
      agendaId: emargement.agendaId,
      teacherId: emargement.teacherId,
      classroomId: emargement.classroomId,
      sessionDate: emargement.agenda.startDateTime,
      lessonTitle,
      summary,
      homeworkPublished: homeworkPublished || null,
      resourcesUrl: resourcesUrl || null,
      status: publish ? 'PUBLISHED' : 'DRAFT',
      publishedAt: publish ? new Date() : null,
    }

    // Vérifier si un LessonLog existe déjà
    const existing = await db.lessonLog.findUnique({
      where: { emargementId },
    })

    let lessonLogId: string
    if (existing) {
      await db.lessonLog.update({
        where: { id: existing.id },
        data: lessonLogData,
      })
      lessonLogId = existing.id
    } else {
      const created = await db.lessonLog.create({
        data: lessonLogData,
      })
      lessonLogId = created.id
    }

    // Audit
    const h = await headers()
    await logAudit({
      userId: user.id,
      userName: user.displayName,
      userRole: user.role,
      schoolId: emargement.schoolId,
      action: publish ? 'PUBLISH' : 'UPDATE',
      entityType: 'LESSON_LOG',
      entityId: lessonLogId,
      description: `Cahier de textes ${publish ? 'publié' : 'sauvegardé'} : ${lessonTitle}`,
      ipAddress: getClientIP(h),
      metadata: { emargementId, lessonTitle, status: publish ? 'PUBLISHED' : 'DRAFT' },
    })

    // Notifier la direction si publié
    if (publish) {
      try {
        const director = await db.user.findFirst({
          where: { role: { in: ['DIRECTOR', 'DIRECTION'] } },
        })
        if (director) {
          await db.notification.create({
            data: {
              userId: director.id,
              type: 'ANNOUNCEMENT',
              title: `Cahier de textes publié — ${emargement.classroom?.name || 'Classe'}`,
              message: `Le cahier de textes pour "${lessonTitle}" a été publié par ${user.displayName}.`,
              link: '/',
            },
          })
        }
      } catch {}
    }

    return NextResponse.json({
      ok: true,
      lessonLogId,
      status: publish ? 'PUBLISHED' : 'DRAFT',
    })
  } catch (err) {
    console.error('[api/teacher/lesson-log] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
