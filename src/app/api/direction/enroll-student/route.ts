// SmartShule — API : Inscription d'un nouvel élève
// ============================================================
// Accessible par : DIRECTION, SECRETARY
// Crée : Student + Enrollment + Guardian (optionnel) + User (optionnel)
// Idempotent via matricule unique

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { hasRole } from '@/lib/rbac'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

async function pbkdf2(password: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derived) => {
      if (err) reject(err)
      else resolve(derived.toString('hex'))
    })
  })
}

// Format attendu par verifyPassword : pbkdf2$ITERATIONS$DIGEST$SALT$HASH
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = await pbkdf2(password, salt)
  return `pbkdf2$100000$sha512$${salt}$${hash}`
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    }
    if (!hasRole(user, ['DIRECTION', 'SECRETARY', 'ADMIN'])) {
      return NextResponse.json({ ok: false, error: 'Accès réservé à la Direction ou au Secrétariat.' }, { status: 403 })
    }

    const body = await req.json()
    const {
      firstName,
      lastName,
      matricule,
      birthDate,
      gender,
      classroomId,
      guardianFirstName,
      guardianLastName,
      guardianPhone,
      guardianEmail,
      guardianRelationship,
      createGuardianAccount,
    } = body

    if (!firstName || !lastName || !matricule || !classroomId) {
      return NextResponse.json(
        { ok: false, error: 'Prénom, nom, matricule et classe sont obligatoires.' },
        { status: 400 }
      )
    }

    // Trouver l'école via l'employé ou le user
    let schoolId: string | undefined
    const employee = await db.employee.findFirst({ where: { email: user.email } })
    if (employee?.schoolId) {
      schoolId = employee.schoolId
    } else {
      const school = await db.school.findFirst()
      schoolId = school?.id
    }
    if (!schoolId) {
      return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })
    }

    // Vérifier matricule unique
    const existingMat = await db.student.findUnique({ where: { matricule } })
    if (existingMat) {
      return NextResponse.json(
        { ok: false, error: `Le matricule ${matricule} existe déjà.` },
        { status: 409 }
      )
    }

    // Vérifier la classe
    const classroom = await db.classroom.findUnique({
      where: { id: classroomId },
      include: { academicYear: true },
    })
    if (!classroom) {
      return NextResponse.json({ ok: false, error: 'Classe introuvable.' }, { status: 404 })
    }

    // Créer l'élève
    const student = await db.student.create({
      data: {
        schoolId,
        matricule,
        firstName,
        lastName,
        birthDate: birthDate ? new Date(birthDate) : null,
        gender: gender || null,
        status: 'ACTIVE',
      },
    })

    // Inscrire dans la classe
    await db.enrollment.create({
      data: {
        studentId: student.id,
        classroomId,
        academicYearId: classroom.academicYearId,
        status: 'ACTIVE',
      },
    })

    // Créer le parent (guardian) si info fournie
    let guardianCreated = false
    let guardianUserId: string | undefined
    if (guardianFirstName && guardianLastName) {
      const guardian = await db.guardian.create({
        data: {
          schoolId,
          firstName: guardianFirstName,
          lastName: guardianLastName,
          phone: guardianPhone || null,
          email: guardianEmail || null,
          userId: undefined,
        },
      })

      await db.guardianStudentLink.create({
        data: {
          guardianId: guardian.id,
          studentId: student.id,
          relationship: guardianRelationship || 'TUTEUR',
          isPrimary: true,
        },
      })

      // Créer un compte utilisateur pour le parent si demandé
      if (createGuardianAccount && guardianEmail) {
        const existingUser = await db.user.findUnique({ where: { email: guardianEmail } })
        if (!existingUser) {
          const password = 'SmartShule2026!'
          const hash = await hashPassword(password)
          const guardianUser = await db.user.create({
            data: {
              email: guardianEmail,
              passwordHash: hash,
              role: 'PARENT',
              displayName: `${guardianFirstName} ${guardianLastName}`,
              active: true,
            },
          })
          await db.guardian.update({
            where: { id: guardian.id },
            data: { userId: guardianUser.id },
          })
          guardianUserId = guardianUser.id
          guardianCreated = true
        }
      }
    }

    // Audit
    const h = await headers()
    await logAudit({
      userId: user.id,
      userName: user.displayName,
      userRole: user.role,
      schoolId,
      action: 'CREATE',
      entityType: 'STUDENT',
      entityId: student.id,
      description: `Élève inscrit : ${firstName} ${lastName} (${matricule})`,
      ipAddress: getClientIP(h),
    })

    return NextResponse.json({
      ok: true,
      studentId: student.id,
      matricule: student.matricule,
      message: `Élève ${firstName} ${lastName} inscrit avec succès`,
      guardianCreated,
      guardianEmail: guardianCreated ? guardianEmail : undefined,
      guardianPassword: guardianCreated ? 'SmartShule2026!' : undefined,
    })
  } catch (err) {
    console.error('[api/direction/enroll-student] Error:', err)
    return NextResponse.json(
      { ok: false, error: (err as Error).message || 'Erreur inconnue.' },
      { status: 500 }
    )
  }
}
