// SmartShule — API : Inscription d'un nouvel enseignant
// ============================================================
// Accessible par : DIRECTION
// Crée : Employee + User + TeacherAssignment (optionnel)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
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

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    }
    if (user.role !== 'DIRECTION' && user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'Accès réservé à la Direction.' }, { status: 403 })
    }

    const body = await req.json()
    const {
      firstName,
      lastName,
      email,
      phone,
      function: employeeFunction,
      directorateId,
      classroomIds,
      subjectId,
    } = body

    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { ok: false, error: 'Prénom, nom et email sont obligatoires.' },
        { status: 400 }
      )
    }

    // Trouver l'école
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

    // Vérifier email unique
    const existingUser = await db.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json(
        { ok: false, error: `L'email ${email} existe déjà.` },
        { status: 409 }
      )
    }

    // Créer l'employé
    const newEmployee = await db.employee.create({
      data: {
        schoolId,
        directorateId: directorateId || null,
        firstName,
        lastName,
        email,
        phone: phone || null,
        function: employeeFunction || 'ENSEIGNANT',
        status: 'ACTIVE',
        globalRole: 'ENSEIGNANT',
      },
    })

    // Créer le compte utilisateur
    const salt = crypto.randomBytes(16).toString('hex')
    const password = 'SmartShule2026!'
    const passwordHash = await pbkdf2(password, salt)
    const newUser = await db.user.create({
      data: {
        email,
        passwordHash: `${salt}:${passwordHash}`,
        role: 'TEACHER',
        displayName: `${firstName} ${lastName}`,
        active: true,
      },
    })

    // Créer les TeacherAssignment (si classes et matière fournies)
    const assignmentsCreated: string[] = []
    if (subjectId && classroomIds && Array.isArray(classroomIds) && classroomIds.length > 0) {
      for (const classroomId of classroomIds) {
        const assignment = await db.teacherAssignment.create({
          data: {
            employeeId: newEmployee.id,
            subjectId,
            classroomId,
          },
        })
        assignmentsCreated.push(assignment.id)
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
      entityType: 'STUDENT', // pas un STUDENT mais on réutilise le type
      entityId: newEmployee.id,
      description: `Enseignant inscrit : ${firstName} ${lastName} (${email})`,
      ipAddress: getClientIP(h),
    })

    return NextResponse.json({
      ok: true,
      employeeId: newEmployee.id,
      userId: newUser.id,
      email,
      password,
      message: `Enseignant ${firstName} ${lastName} créé avec succès`,
      assignmentsCreated: assignmentsCreated.length,
    })
  } catch (err) {
    console.error('[api/direction/enroll-teacher] Error:', err)
    return NextResponse.json(
      { ok: false, error: (err as Error).message || 'Erreur inconnue.' },
      { status: 500 }
    )
  }
}
