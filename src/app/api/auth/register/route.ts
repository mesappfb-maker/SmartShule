// API : Inscription self-service parent
// ============================================================
// POST /api/auth/register
// Body : { firstName, lastName, email, password, phone, studentMatricule, relationship }
// Crée : User (PARENT) + Guardian + lien vers l'élève (si matricule trouvé)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex')
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derived) => {
      if (err) reject(err)
      else resolve(`pbkdf2$100000$sha512$${salt}$${derived.toString('hex')}`)
    })
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { firstName, lastName, email, password, phone, studentMatricule, relationship } = body

    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json({ ok: false, error: 'Tous les champs obligatoires doivent être remplis.' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ ok: false, error: 'Le mot de passe doit contenir au moins 8 caractères.' }, { status: 400 })
    }
    if (!email.includes('@')) {
      return NextResponse.json({ ok: false, error: 'Email invalide.' }, { status: 400 })
    }

    // Vérifier email unique
    const existingUser = await db.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json({ ok: false, error: 'Cet email est déjà utilisé. Essayez de vous connecter.' }, { status: 409 })
    }

    // Trouver la première école (default)
    const school = await db.school.findFirst()
    if (!school) {
      return NextResponse.json({ ok: false, error: 'Aucune école configurée. Contactez l\'administrateur.' }, { status: 500 })
    }

    // Hasher le mot de passe
    const passwordHash = await hashPassword(password)

    // Transaction : User + Guardian + (lien élève si matricule fourni)
    const result = await db.$transaction(async (tx) => {
      // 1. Créer l'utilisateur
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          role: 'PARENT',
          displayName: `${firstName} ${lastName}`,
          active: true,
        },
      })

      // 2. Créer le Guardian
      const guardian = await tx.guardian.create({
        data: {
          schoolId: school.id,
          firstName,
          lastName,
          phone: phone || null,
          email,
          userId: user.id,
        },
      })

      // 3. Si matricule élève fourni, créer le lien
      let linkedStudent: { matricule: string; name: string } | null = null
      if (studentMatricule) {
        const student = await tx.student.findFirst({
          where: { matricule: studentMatricule, schoolId: school.id },
        })
        if (student) {
          await tx.guardianStudentLink.create({
            data: {
              guardianId: guardian.id,
              studentId: student.id,
              relationship: relationship || 'TUTEUR',
              isPrimary: true,
            },
          })
          linkedStudent = {
            matricule: student.matricule,
            name: `${student.firstName} ${student.lastName}`,
          }
        }
      }

      return { user, guardian, linkedStudent }
    })

    // Audit
    const h = await headers()
    await logAudit({
      userId: result.user.id,
      userName: result.user.displayName,
      userRole: 'PARENT',
      schoolId: school.id,
      action: 'CREATE',
      entityType: 'USER',
      entityId: result.user.id,
      description: `Inscription parent self-service : ${email}${result.linkedStudent ? ` → élève ${result.linkedStudent.matricule}` : ''}`,
      ipAddress: getClientIP(h),
    })

    return NextResponse.json({
      ok: true,
      message: result.linkedStudent
        ? `Compte créé avec succès. Vous êtes maintenant associé à l'élève ${result.linkedStudent.name}.`
        : 'Compte créé avec succès. Contactez l\'école pour être associé à votre enfant.',
      email,
      linkedStudent: result.linkedStudent,
    })
  } catch (err) {
    console.error('[api/auth/register] Error:', err)
    return NextResponse.json(
      { ok: false, error: (err as Error).message || 'Erreur inconnue.' },
      { status: 500 }
    )
  }
}
