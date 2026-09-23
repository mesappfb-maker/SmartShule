// SmartShule — API Route : Seed initial (comptes démo)
// ============================================================
// Utilisé sur Vercel car il n'y a pas de phase "post-build"
// comme Render/Railway pour exécuter scripts/auto-seed.js
//
// Usage :
//   GET /api/seed
//   ou POST /api/seed (avec X-Seed-Secret header si configuré)
//
// Cette route :
//   - Vérifie si l'école existe déjà (idempotente)
//   - Si non, crée l'école + 7 comptes démo + année académique + classe + élève
//   - Retourne le récapitulatif
//
// ⚠️ Sécurité : cette route peut être protégée par SEED_SECRET si besoin
//    (en production, désactivez cette route après usage)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

async function pbkdf2(password: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derived) => {
      if (err) reject(err)
      else resolve(derived.toString('hex'))
    })
  })
}

// Format attendu par verifyPassword : pbkdf2$ITERATIONS$DIGEST$SALT$HASH
async function hashPasswordForSeed(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = await pbkdf2(password, salt)
  return `pbkdf2$100000$sha512$${salt}$${hash}`
}

export async function GET(req: NextRequest) {
  return POST(req)
}

export async function POST(_req: NextRequest) {
  try {
    console.log('🌱 API /api/seed appelée')

    // Vérification optionnelle de sécurité
    const seedSecret = process.env.SEED_SECRET
    if (seedSecret) {
      const provided = _req.headers.get('x-seed-secret')
      if (provided !== seedSecret) {
        return NextResponse.json(
          { ok: false, error: 'Non autorisé. SEED_SECRET configuré mais header manquant.' },
          { status: 401 }
        )
      }
    }

    // 1. Vérifier si l'école existe déjà
    const existingSchool = await db.school.findFirst()
    if (existingSchool) {
      // Mise à jour des mots de passe des comptes démo existants
      const password = 'SmartShule2026!'
      const demoEmails = [
        'direction@smartshule.demo',
        'prof@smartshule.demo',
        'comptable@smartshule.demo',
        'secretaire@smartshule.demo',
        'parent@smartshule.demo',
        'eleve@smartshule.demo',
        'server@smartshule.demo',
      ]
      for (const email of demoEmails) {
        const hash = await hashPasswordForSeed(password)
        await db.user.updateMany({
          where: { email },
          data: { passwordHash: hash, active: true },
        })
      }
      return NextResponse.json({
        ok: true,
        message: 'Base déjà seedée — mots de passe réinitialisés',
        schoolName: existingSchool.name,
        alreadySeeded: true,
        defaultPassword: 'SmartShule2026!',
        demoAccounts: demoEmails,
      })
    }

    console.log('🏗️ Création de l\'école et des comptes démo...')

    // 2. Créer l'école
    const school = await db.school.create({
      data: {
        name: 'Institution SmartShule',
        slogan: 'L\'intelligence qui rapproche l\'école et la famille',
        primaryColor: '#2563EB',
        secondaryColor: '#0F766E',
        tertiaryColor: '#F59E0B',
        currency: 'CDF',
        locale: 'fr-FR',
        address: 'Kinshasa, RDC',
      },
    })

    // 3. Année académique
    const year = await db.academicYear.create({
      data: {
        schoolId: school.id,
        label: '2025-2026',
        startDate: new Date('2025-09-01'),
        endDate: new Date('2026-07-31'),
        active: true,
      },
    })

    // 4. Direction
    const direction = await db.directorate.create({
      data: { schoolId: school.id, name: 'Secondaire', code: 'SEC' },
    })

    // 5. Classe
    const classroom = await db.classroom.create({
      data: {
        directorateId: direction.id,
        academicYearId: year.id,
        name: '6ème A',
        capacity: 40,
        academicYearLabel: '2025-2026',
      },
    })

    // 6. Comptes utilisateurs (mot de passe commun : SmartShule2026!)
    const password = 'SmartShule2026!'
    const users = [
      { email: 'direction@smartshule.demo', role: 'DIRECTION', displayName: 'Directeur Général' },
      { email: 'prof@smartshule.demo', role: 'TEACHER', displayName: 'Professeur Test' },
      { email: 'comptable@smartshule.demo', role: 'ACCOUNTANT', displayName: 'Comptable Test' },
      { email: 'secretaire@smartshule.demo', role: 'SECRETARY', displayName: 'Secrétaire Test' },
      { email: 'parent@smartshule.demo', role: 'PARENT', displayName: 'Parent Test' },
      { email: 'eleve@smartshule.demo', role: 'STUDENT', displayName: 'Élève Test' },
      { email: 'server@smartshule.demo', role: 'SERVER', displayName: 'PromoServeur Admin' },
    ]

    const createdUsers: Array<{ email: string; role: string; id: string }> = []
    for (const u of users) {
      const hash = await hashPasswordForSeed(password)
      const user = await db.user.create({
        data: {
          email: u.email,
          passwordHash: hash,
          role: u.role,
          displayName: u.displayName,
          active: true,
        },
      })
      createdUsers.push({ email: u.email, role: u.role, id: user.id })
      console.log(`  ✅ User: ${u.email} (${u.role})`)
    }

    // 7. Employé prof
    const profUser = createdUsers.find((u) => u.email === 'prof@smartshule.demo')
    if (profUser) {
      await db.employee.create({
        data: {
          schoolId: school.id,
          directorateId: direction.id,
          firstName: 'Professeur',
          lastName: 'Test',
          email: 'prof@smartshule.demo',
          function: 'ENSEIGNANT',
          status: 'ACTIVE',
          globalRole: 'ENSEIGNANT',
        },
      })
    }

    // 8. Élève de démo
    const student = await db.student.create({
      data: {
        schoolId: school.id,
        matricule: 'ELV-001',
        firstName: 'Jean',
        lastName: 'Dupont',
        status: 'ACTIVE',
      },
    })
    await db.enrollment.create({
      data: {
        studentId: student.id,
        classroomId: classroom.id,
        academicYearId: year.id,
        status: 'ACTIVE',
      },
    })

    // 9. Parent lié à l'élève
    const parentUser = createdUsers.find((u) => u.email === 'parent@smartshule.demo')
    if (parentUser) {
      const guardian = await db.guardian.create({
        data: {
          schoolId: school.id,
          firstName: 'Marie',
          lastName: 'Dupont',
          phone: '+243 800 000 000',
          email: 'parent@smartshule.demo',
          userId: parentUser.id,
        },
      })
      await db.guardianStudentLink.create({
        data: {
          guardianId: guardian.id,
          studentId: student.id,
          relationship: 'MERE',
          isPrimary: true,
        },
      })
    }

    console.log('🎉 Seed terminé avec succès !')

    return NextResponse.json({
      ok: true,
      message: 'Base seedée avec succès',
      schoolName: school.name,
      users: createdUsers.map((u) => ({ email: u.email, role: u.role })),
      defaultPassword: 'SmartShule2026!',
      alreadySeeded: false,
    })
  } catch (err) {
    console.error('❌ Erreur de seed:', err)
    return NextResponse.json(
      {
        ok: false,
        error: (err as Error).message || 'Erreur inconnue',
        stack: process.env.NODE_ENV === 'development' ? (err as Error).stack : undefined,
      },
      { status: 500 }
    )
  }
}
