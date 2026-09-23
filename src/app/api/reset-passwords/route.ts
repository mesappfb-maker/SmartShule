// SmartShule — API : Réinitialisation forcée des mots de passe démo
// ============================================================
// Cette API force la mise à jour des mots de passe des comptes démo
// vers SmartShule2026! — même si la base est déjà seedée avec l'ancien mot de passe.
//
// Usage :
//   GET /api/reset-passwords
//   POST /api/reset-passwords
//
// ⚠️ Sécurité : cette route peut être protégée par SEED_SECRET si besoin
//    (en production, désactivez cette route après usage)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const DEMO_PASSWORD = 'SmartShule2026!'

const DEMO_ACCOUNTS = [
  { email: 'direction@smartshule.demo', role: 'DIRECTION', displayName: 'Directeur Général' },
  { email: 'prof@smartshule.demo', role: 'TEACHER', displayName: 'Professeur Test' },
  { email: 'comptable@smartshule.demo', role: 'ACCOUNTANT', displayName: 'Comptable Test' },
  { email: 'secretaire@smartshule.demo', role: 'SECRETARY', displayName: 'Secrétaire Test' },
  { email: 'parent@smartshule.demo', role: 'PARENT', displayName: 'Parent Test' },
  { email: 'eleve@smartshule.demo', role: 'STUDENT', displayName: 'Élève Test' },
  { email: 'server@smartshule.demo', role: 'SERVER', displayName: 'PromoServeur Admin' },
]

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

export async function GET(req: NextRequest) {
  return POST(req)
}

export async function POST(_req: NextRequest) {
  try {
    console.log('🔐 /api/reset-passwords appelée')

    // Vérification optionnelle de sécurité
    const seedSecret = process.env.SEED_SECRET
    if (seedSecret) {
      const provided = _req.headers.get('x-seed-secret')
      if (provided !== seedSecret) {
        return NextResponse.json(
          { ok: false, error: 'Non autorisé.' },
          { status: 401 }
        )
      }
    }

    const results: Array<{ email: string; status: string }> = []

    for (const acc of DEMO_ACCOUNTS) {
      try {
        const hash = await hashPassword(DEMO_PASSWORD)

        // Essayer update d'abord (si user existe)
        const updated = await db.user.updateMany({
          where: { email: acc.email },
          data: {
            passwordHash: hash,
            role: acc.role,
            displayName: acc.displayName,
            active: true,
          },
        })

        if (updated.count > 0) {
          results.push({ email: acc.email, status: 'updated' })
          console.log(`  ✅ ${acc.email} — mot de passe mis à jour`)
        } else {
          // Si user n'existe pas, le créer
          await db.user.create({
            data: {
              email: acc.email,
              passwordHash: hash,
              role: acc.role,
              displayName: acc.displayName,
              active: true,
            },
          })
          results.push({ email: acc.email, status: 'created' })
          console.log(`  ✅ ${acc.email} — utilisateur créé`)
        }
      } catch (err) {
        console.error(`  ❌ ${acc.email} — erreur:`, (err as Error).message)
        results.push({ email: acc.email, status: `error: ${(err as Error).message}` })
      }
    }

    return NextResponse.json({
      ok: true,
      message: 'Mots de passe réinitialisés avec succès',
      password: DEMO_PASSWORD,
      accounts: results,
      totalAccounts: results.length,
      successCount: results.filter((r) => r.status === 'updated' || r.status === 'created').length,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('❌ Erreur /api/reset-passwords:', err)
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
