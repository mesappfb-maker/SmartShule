// SmartShule — API Route : Données d'audit pour la Direction
// Étape 4 RDC — Portail Prof complet
//
// Retourne :
//   - lessonLogs : cahier de textes filtrable
//   - liveClasses : profs actuellement en cours
//   - incidents : incidents non résolus
//   - emargementsToday : émargements du jour
//   - stats : statistiques temps réel
//   - teachers / subjects : pour les filtres

import { NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { getSchoolIdForUser } from '@/lib/school-context'
import { hasRole } from '@/lib/rbac'
import {
  getDirectionLessonLogs,
  getDirectionLiveClasses,
  getDirectionOpenIncidents,
  getDirectionTodayEmargements,
  getDirectionRealtimeStats,
} from '@/lib/teacher-portal-queries-v2'

export async function GET(req: Request) {
  const user = await getUserFromSession()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
  }
  if (!hasRole(user, ['DIRECTION', 'ADMIN'])) {
    return NextResponse.json({ ok: false, error: 'Accès réservé à la Direction.' }, { status: 403 })
  }

  // Trouver l'école de l'utilisateur (helper robuste)
  const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
  if (!schoolId) {
    return NextResponse.json({ ok: false, error: 'École introuvable. Veuillez visitez /api/seed pour initialiser la base.' }, { status: 404 })
  }

  // Filtres optionnels
  const url = new URL(req.url)
  const teacherId = url.searchParams.get('teacherId') || undefined
  const subjectId = url.searchParams.get('subjectId') || undefined
  const startDateStr = url.searchParams.get('startDate')
  const endDateStr = url.searchParams.get('endDate')
  const startDate = startDateStr ? new Date(startDateStr) : undefined
  const endDate = endDateStr ? new Date(endDateStr) : undefined

  const filters = { teacherId, subjectId, startDate, endDate }

  // Récupération parallèle de toutes les données
  const [lessonLogs, liveClasses, incidents, emargementsToday, stats] = await Promise.all([
    getDirectionLessonLogs(schoolId, filters),
    getDirectionLiveClasses(schoolId),
    getDirectionOpenIncidents(schoolId),
    getDirectionTodayEmargements(schoolId),
    getDirectionRealtimeStats(schoolId),
  ])

  // Listes pour filtres
  const teachers = await db.employee.findMany({
    where: {
      schoolId,
      function: { in: ['ENSEIGNANT', 'DIRECTION'] },
      status: 'ACTIVE',
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  })

  const subjects = await db.subject.findMany({
    where: { schoolId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  // Convertir les dates en ISO pour sérialisation JSON
  const serialized = {
    lessonLogs: lessonLogs.map((l) => ({
      ...l,
      sessionDate: l.sessionDate.toISOString(),
      auditedAt: l.auditedAt?.toISOString() || null,
    })),
    liveClasses: liveClasses.map((c) => ({
      ...c,
      startDateTime: c.startDateTime.toISOString(),
      endDateTime: c.endDateTime.toISOString(),
      signatureAt: c.signatureAt?.toISOString() || null,
      directorNotifiedAt: c.directorNotifiedAt?.toISOString() || null,
    })),
    incidents: incidents.map((i) => ({
      ...i,
      createdAt: i.createdAt.toISOString(),
    })),
    emargementsToday: emargementsToday.map((e) => ({
      ...e,
      signatureAt: e.signatureAt.toISOString(),
      startDateTime: e.startDateTime.toISOString(),
      endDateTime: e.endDateTime.toISOString(),
    })),
    stats: {
      ...stats,
      timestamp: stats.timestamp.toISOString(),
    },
    teachers: teachers.map((t) => ({
      id: t.id,
      name: `${t.firstName} ${t.lastName}`,
    })),
    subjects: subjects.map((s) => ({ id: s.id, name: s.name })),
  }

  return NextResponse.json({ ok: true, ...serialized })
}
