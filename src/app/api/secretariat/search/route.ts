// API : Recherche universelle secrétariat
// ============================================================
// GET /api/secretariat/search?q=xxx
// Cherche parmi : élèves, admissions, parents, classes, matricules
// Tolérant aux fautes de frappe (contains + insensitive)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (user.role !== 'SECRETARY' && user.role !== 'DIRECTION' && user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
    }

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const url = new URL(req.url)
    const q = (url.searchParams.get('q') || '').trim()
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50)

    if (!q || q.length < 2) {
      return NextResponse.json({ ok: true, results: [], total: 0 })
    }

    // Recherche parallèle dans 4 catégories
    const [students, admissions, guardians, classrooms] = await Promise.all([
      // Élèves (matricule, nom, prénom)
      db.student.findMany({
        where: {
          schoolId,
          OR: [
            { matricule: { contains: q } },
            { firstName: { contains: q } },
            { lastName: { contains: q } },
          ],
        },
        select: {
          id: true, matricule: true, firstName: true, lastName: true,
          status: true, gender: true, birthDate: true,
          enrollments: { where: { status: 'ACTIVE' }, take: 1, select: { classroom: { select: { id: true, name: true } } } },
          guardianLinks: { take: 1, select: { guardian: { select: { firstName: true, lastName: true, phone: true } } } },
        },
        take: limit,
        orderBy: [{ firstName: 'asc' }],
      }),
      // Admissions (référence, nom parent, nom enfant)
      db.admissionApplication.findMany({
        where: {
          schoolId,
          OR: [
            { referenceNumber: { contains: q } },
            { parentFirstName: { contains: q } },
            { parentLastName: { contains: q } },
            { parentEmail: { contains: q } },
            { parentPhone: { contains: q } },
            { children: { some: { OR: [{ childFirstName: { contains: q } }, { childLastName: { contains: q } }] } } },
          ],
        },
        select: {
          id: true, referenceNumber: true, status: true,
          parentFirstName: true, parentLastName: true, parentPhone: true, parentEmail: true,
          submittedAt: true,
          children: { select: { childFirstName: true, childLastName: true, status: true } },
        },
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
      }),
      // Parents/Tuteurs (nom, téléphone, email)
      db.guardian.findMany({
        where: {
          schoolId,
          OR: [
            { firstName: { contains: q } },
            { lastName: { contains: q } },
            { phone: { contains: q } },
            { email: { contains: q } },
          ],
        },
        select: {
          id: true, firstName: true, lastName: true, phone: true, email: true, profession: true,
          studentLinks: { take: 3, select: { student: { select: { id: true, firstName: true, lastName: true, matricule: true } } } },
        },
        take: limit,
        orderBy: [{ firstName: 'asc' }],
      }),
      // Classes (nom)
      db.classroom.findMany({
        where: {
          directorate: { schoolId },
          name: { contains: q },
        },
        select: {
          id: true, name: true, capacity: true,
          directorate: { select: { name: true } },
          section: { select: { name: true } },
          option: { select: { name: true } },
          academicYearLabel: true,
          _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } },
        },
        take: limit,
        orderBy: [{ name: 'asc' }],
      }),
    ])

    // Formater les résultats
    const results = [
      ...students.map((s) => ({
        type: 'STUDENT' as const,
        id: s.id,
        title: `${s.firstName} ${s.lastName}`,
        subtitle: `${s.matricule} · ${s.enrollments[0]?.classroom?.name || 'Sans classe'}`,
        badge: s.status,
        meta: {
          guardian: s.guardianLinks[0]?.guardian ? `${s.guardianLinks[0].guardian.firstName} ${s.guardianLinks[0].guardian.lastName}` : null,
          phone: s.guardianLinks[0]?.guardian?.phone || null,
          classroomId: s.enrollments[0]?.classroom?.id || null,
        },
      })),
      ...admissions.map((a) => ({
        type: 'ADMISSION' as const,
        id: a.id,
        title: `${a.parentFirstName} ${a.parentLastName}`,
        subtitle: `${a.referenceNumber} · ${a.children.length} enfant(s)`,
        badge: a.status,
        meta: {
          children: a.children.map((c) => `${c.childFirstName} ${c.childLastName}`),
          phone: a.parentPhone,
          email: a.parentEmail,
        },
      })),
      ...guardians.map((g) => ({
        type: 'GUARDIAN' as const,
        id: g.id,
        title: `${g.firstName} ${g.lastName}`,
        subtitle: g.phone || g.email || 'Sans contact',
        badge: 'PARENT',
        meta: {
          children: g.studentLinks.map((l) => `${l.student.firstName} ${l.student.lastName} (${l.student.matricule})`),
          phone: g.phone,
          email: g.email,
        },
      })),
      ...classrooms.map((c) => ({
        type: 'CLASSROOM' as const,
        id: c.id,
        title: c.name,
        subtitle: `${c.directorate.name}${c.section ? ` · ${c.section.name}` : ''} — ${c._count.enrollments}/${c.capacity || '∞'}`,
        badge: c.academicYearLabel || '—',
        meta: { enrolled: c._count.enrollments, capacity: c.capacity },
      })),
    ]

    return NextResponse.json({
      ok: true,
      results,
      total: results.length,
      breakdown: {
        students: students.length,
        admissions: admissions.length,
        guardians: guardians.length,
        classrooms: classrooms.length,
      },
    })
  } catch (err) {
    console.error('[api/secretariat/search] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
