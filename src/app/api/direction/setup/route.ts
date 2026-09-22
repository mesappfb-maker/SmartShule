// SmartShule — API : Configuration complète de l'école
// ============================================================
// Permet à la Direction de créer :
//   - Nouvelle direction (Maternelle, Primaire, Secondaire...)
//   - Nouvelle section (Lettres, Sciences...)
//   - Nouvelle option (Coupe-Couture, Commerciale, Scientifique...)
//   - Nouvelle matière (Mathématiques, Français...)
//   - Nouvelle classe (6ème A, 5ème B...)
//   - Nouvelle ligne de frais (Minerval, Frais inscription...)
//
// Toutes les actions sont auditées.

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

async function getSchoolId(userEmail: string): Promise<string | null> {
  const employee = await db.employee.findFirst({
    where: { email: userEmail },
    select: { schoolId: true },
  })
  if (employee?.schoolId) return employee.schoolId
  const school = await db.school.findFirst()
  return school?.id || null
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    }
    if (user.role !== 'DIRECTION' && user.role !== 'ADMIN') {
      return NextResponse.json(
        { ok: false, error: 'Accès réservé à la Direction.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { action } = body

    const schoolId = await getSchoolId(user.email || '')
    if (!schoolId) {
      return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })
    }

    const h = await headers()
    const ip = getClientIP(h)

    switch (action) {
      // ============================================================
      // 1. CRÉER UNE DIRECTION (Maternelle, Primaire, Secondaire)
      // ============================================================
      case 'create-directorate': {
        const { name, code } = body
        if (!name || !code) {
          return NextResponse.json(
            { ok: false, error: 'Nom et code de la direction sont obligatoires.' },
            { status: 400 }
          )
        }
        const existing = await db.directorate.findFirst({
          where: { schoolId, OR: [{ name }, { code }] },
        })
        if (existing) {
          return NextResponse.json(
            { ok: false, error: `Direction "${name}" ou code "${code}" existe déjà.` },
            { status: 409 }
          )
        }
        const directorate = await db.directorate.create({
          data: { schoolId, name, code },
        })
        await logAudit({
          userId: user.id,
          userName: user.displayName,
          userRole: user.role,
          schoolId,
          action: 'CREATE',
          entityType: 'OTHER',
          entityId: directorate.id,
          description: `Direction créée : ${name} (${code})`,
          ipAddress: ip,
        })
        return NextResponse.json({
          ok: true,
          id: directorate.id,
          message: `Direction "${name}" créée avec succès`,
        })
      }

      // ============================================================
      // 2. CRÉER UNE SECTION (Lettres, Sciences...)
      // ============================================================
      case 'create-section': {
        const { name, code, directorateId } = body
        if (!name || !code || !directorateId) {
          return NextResponse.json(
            { ok: false, error: 'Nom, code et direction sont obligatoires.' },
            { status: 400 }
          )
        }
        const section = await db.section.create({
          data: { directorateId, name, code },
        })
        await logAudit({
          userId: user.id,
          userName: user.displayName,
          userRole: user.role,
          schoolId,
          action: 'CREATE',
          entityType: 'OTHER',
          entityId: section.id,
          description: `Section créée : ${name} (${code})`,
          ipAddress: ip,
        })
        return NextResponse.json({
          ok: true,
          id: section.id,
          message: `Section "${name}" créée avec succès`,
        })
      }

      // ============================================================
      // 3. CRÉER UNE OPTION (Coupe-Couture, Commerciale, Scientifique)
      // ============================================================
      case 'create-option': {
        const { name, code, sectionId } = body
        if (!name || !code || !sectionId) {
          return NextResponse.json(
            { ok: false, error: 'Nom, code et section sont obligatoires.' },
            { status: 400 }
          )
        }
        const option = await db.option.create({
          data: { schoolId, sectionId, name, code },
        })
        await logAudit({
          userId: user.id,
          userName: user.displayName,
          userRole: user.role,
          schoolId,
          action: 'CREATE',
          entityType: 'OTHER',
          entityId: option.id,
          description: `Option créée : ${name} (${code})`,
          ipAddress: ip,
        })
        return NextResponse.json({
          ok: true,
          id: option.id,
          message: `Option "${name}" créée avec succès`,
        })
      }

      // ============================================================
      // 4. CRÉER UNE MATIÈRE (Mathématiques, Français...)
      // ============================================================
      case 'create-subject': {
        const { name, code } = body
        if (!name || !code) {
          return NextResponse.json(
            { ok: false, error: 'Nom et code de la matière sont obligatoires.' },
            { status: 400 }
          )
        }
        const existing = await db.subject.findFirst({
          where: { schoolId, OR: [{ name }, { code }] },
        })
        if (existing) {
          return NextResponse.json(
            { ok: false, error: `Matière "${name}" ou code "${code}" existe déjà.` },
            { status: 409 }
          )
        }
        const subject = await db.subject.create({
          data: { schoolId, name, code },
        })
        await logAudit({
          userId: user.id,
          userName: user.displayName,
          userRole: user.role,
          schoolId,
          action: 'CREATE',
          entityType: 'OTHER',
          entityId: subject.id,
          description: `Matière créée : ${name} (${code})`,
          ipAddress: ip,
        })
        return NextResponse.json({
          ok: true,
          id: subject.id,
          message: `Matière "${name}" créée avec succès`,
        })
      }

      // ============================================================
      // 5. CRÉER UNE CLASSE (6ème A, 5ème B...)
      // ============================================================
      case 'create-classroom': {
        const {
          name,
          capacity,
          directorateId,
          sectionId,
          optionId,
          academicYearId,
        } = body

        if (!name || !directorateId || !academicYearId) {
          return NextResponse.json(
            { ok: false, error: 'Nom, direction et année académique sont obligatoires.' },
            { status: 400 }
          )
        }

        // Vérifier doublon dans la même direction
        const existing = await db.classroom.findFirst({
          where: { directorateId, name, academicYearId },
        })
        if (existing) {
          return NextResponse.json(
            { ok: false, error: `La classe "${name}" existe déjà dans cette direction.` },
            { status: 409 }
          )
        }

        // Récupérer le label de l'année académique pour le champ dénormalisé
        const year = await db.academicYear.findUnique({
          where: { id: academicYearId },
          select: { label: true },
        })

        const classroom = await db.classroom.create({
          data: {
            directorateId,
            sectionId: sectionId || null,
            optionId: optionId || null,
            academicYearId,
            name,
            capacity: capacity || 40,
            academicYearLabel: year?.label,
          },
        })
        await logAudit({
          userId: user.id,
          userName: user.displayName,
          userRole: user.role,
          schoolId,
          action: 'CREATE',
          entityType: 'OTHER',
          entityId: classroom.id,
          description: `Classe créée : ${name} (capacité ${capacity || 40})`,
          ipAddress: ip,
        })
        return NextResponse.json({
          ok: true,
          id: classroom.id,
          message: `Classe "${name}" créée avec succès`,
        })
      }

      // ============================================================
      // 6. CRÉER UNE LIGNE DE FRAIS (Minerval, Frais inscription...)
      // ============================================================
      case 'create-fee-line': {
        const {
          name,
          code,
          description,
          amountCents,
          currency,
          isMandatory,
          isRecurring,
          frequency,
          period,
          directorateId,
        } = body

        if (!name || !code || !amountCents) {
          return NextResponse.json(
            { ok: false, error: 'Nom, code et montant sont obligatoires.' },
            { status: 400 }
          )
        }

        if (amountCents <= 0) {
          return NextResponse.json(
            { ok: false, error: 'Le montant doit être supérieur à 0.' },
            { status: 400 }
          )
        }

        // Vérifier doublon de code
        const existing = await db.invoiceLineConfig.findFirst({
          where: { schoolId, code },
        })
        if (existing) {
          return NextResponse.json(
            { ok: false, error: `Le code "${code}" existe déjà. Choisissez un autre code.` },
            { status: 409 }
          )
        }

        const feeLine = await db.invoiceLineConfig.create({
          data: {
            schoolId,
            directorateId: directorateId || null,
            name,
            code,
            description: description || null,
            amountCents,
            currency: currency || 'CDF',
            isMandatory: isMandatory !== false,
            isRecurring: isRecurring || false,
            frequency: frequency || null,
            period: period || null,
            status: 'ACTIVE',
            createdById: user.id,
          },
        })
        await logAudit({
          userId: user.id,
          userName: user.displayName,
          userRole: user.role,
          schoolId,
          action: 'CREATE',
          entityType: 'OTHER',
          entityId: feeLine.id,
          description: `Ligne de frais créée : ${name} (${code}) — ${amountCents} ${currency || 'CDF'}`,
          ipAddress: ip,
        })
        return NextResponse.json({
          ok: true,
          id: feeLine.id,
          message: `Ligne de frais "${name}" créée avec succès`,
        })
      }

      default:
        return NextResponse.json(
          { ok: false, error: `Action "${action}" inconnue.` },
          { status: 400 }
        )
    }
  } catch (err) {
    console.error('[api/direction/setup] Error:', err)
    return NextResponse.json(
      { ok: false, error: (err as Error).message || 'Erreur inconnue.' },
      { status: 500 }
    )
  }
}

// GET : récupère toutes les données de configuration de l'école
export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    }

    const schoolId = await getSchoolId(user.email || '')
    if (!schoolId) {
      return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })
    }

    const [
      directorates,
      sections,
      options,
      subjects,
      classrooms,
      academicYears,
      feeLines,
    ] = await Promise.all([
      db.directorate.findMany({
        where: { schoolId },
        orderBy: { name: 'asc' },
      }),
      db.section.findMany({
        where: { directorate: { schoolId } },
        include: { directorate: true },
        orderBy: { name: 'asc' },
      }),
      db.option.findMany({
        where: { schoolId },
        include: { section: true },
        orderBy: { name: 'asc' },
      }),
      db.subject.findMany({
        where: { schoolId },
        orderBy: { name: 'asc' },
      }),
      db.classroom.findMany({
        where: { directorate: { schoolId } },
        include: {
          directorate: true,
          section: true,
          option: true,
          academicYear: true,
          _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } },
        },
        orderBy: [{ academicYearLabel: 'desc' }, { name: 'asc' }],
      }),
      db.academicYear.findMany({
        where: { schoolId },
        orderBy: { startDate: 'desc' },
      }),
      db.invoiceLineConfig.findMany({
        where: { schoolId },
        include: { directorate: true },
        orderBy: [{ directorateId: 'asc' }, { name: 'asc' }],
      }),
    ])

    return NextResponse.json({
      ok: true,
      directorates,
      sections,
      options,
      subjects,
      classrooms,
      academicYears,
      feeLines,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    )
  }
}
