// SmartShule — API : Test de connexion (debug)
// ============================================================
// Permet de tester si un compte démo peut se connecter
// sans passer par le formulaire UI.
//
// Usage :
//   GET /api/test-login?email=direction@smartshule.demo&password=SmartShule2026!
//
// ⚠️ Debug seulement — à désactiver en production

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const email = url.searchParams.get('email')
  const password = url.searchParams.get('password')

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: 'Email et password requis en paramètres query' },
      { status: 400 }
    )
  }

  try {
    // 1. Trouver l'utilisateur
    const user = await db.user.findUnique({ where: { email } })

    if (!user) {
      return NextResponse.json({
        ok: false,
        error: `Utilisateur ${email} introuvable dans la base`,
        debug: {
          email,
          userExists: false,
        }
      }, { status: 404 })
    }

    // 2. Vérifier le mot de passe
    const [salt, storedHash] = user.passwordHash.split(':')

    if (!salt || !storedHash) {
      return NextResponse.json({
        ok: false,
        error: 'Format de passwordHash invalide en base',
        debug: {
          email,
          userExists: true,
          passwordHashFormat: 'invalid',
          storedHashPreview: user.passwordHash.substring(0, 30) + '...',
        }
      }, { status: 500 })
    }

    const computedHash = await new Promise<string>((resolve, reject) => {
      crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derived) => {
        if (err) reject(err)
        else resolve(derived.toString('hex'))
      })
    })

    const passwordMatches = computedHash === storedHash

    return NextResponse.json({
      ok: passwordMatches,
      message: passwordMatches
        ? '✅ Connexion OK — le mot de passe est correct'
        : '❌ Mot de passe incorrect',
      debug: {
        email,
        userId: user.id,
        role: user.role,
        active: user.active,
        userExists: true,
        passwordHashFormat: 'valid',
        saltPreview: salt.substring(0, 16) + '...',
        storedHashPreview: storedHash.substring(0, 30) + '...',
        computedHashPreview: computedHash.substring(0, 30) + '...',
        passwordMatches,
        providedPassword: password,
      },
      nextStep: passwordMatches
        ? 'Le mot de passe est correct — essayez de vous connecter via le formulaire'
        : 'Appelez /api/reset-passwords pour réinitialiser les mots de passe',
    })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: (err as Error).message,
    }, { status: 500 })
  }
}
