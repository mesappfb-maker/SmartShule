// SmartShule — Authentification par cookie + Session DB
// Pas de NextAuth pour éviter les routes API dédiées ; tout passe par Server Actions.

import { db } from './db'
import { cookies } from 'next/headers'
import crypto from 'crypto'

const SESSION_COOKIE = 'ss_session'
const SESSION_TTL_HOURS = 12

// ============================================================
// Hashing des mots de passe (PBKDF2, pas de dépendance externe)
// ============================================================

export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex')
    const iterations = 100000
    const keylen = 64
    const digest = 'sha512'

    crypto.pbkdf2(password, salt, iterations, keylen, digest, (err, derivedKey) => {
      if (err) return reject(err)
      resolve(`pbkdf2$${iterations}$${digest}$${salt}$${derivedKey.toString('hex')}`)
    })
  })
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const [algo, iterStr, digest, salt, storedKey] = hash.split('$')
    if (algo !== 'pbkdf2') return false
    const iterations = parseInt(iterStr, 10)
    const keylen = Buffer.from(storedKey, 'hex').length

    return new Promise((resolve) => {
      crypto.pbkdf2(password, salt, iterations, keylen, digest, (err, derivedKey) => {
        if (err) return resolve(false)
        resolve(crypto.timingSafeEqual(derivedKey, Buffer.from(storedKey, 'hex')))
      })
    })
  } catch {
    return false
  }
}

// ============================================================
// Sessions
// ============================================================

export function generateSessionToken(): string {
  return crypto.randomBytes(48).toString('base64url')
}

export async function createSession(opts: {
  userId: string
  ipAddress?: string
  userAgent?: string
}): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000)

  await db.session.create({
    data: {
      userId: opts.userId,
      token,
      expiresAt,
      ipAddress: opts.ipAddress,
      userAgent: opts.userAgent,
    },
  })

  await db.user.update({
    where: { id: opts.userId },
    data: { lastLoginAt: new Date() },
  })

  return { token, expiresAt }
}

export async function revokeSession(token: string): Promise<void> {
  await db.session.updateMany({
    where: { token },
    data: { revokedAt: new Date() },
  })
}

export async function getUserFromSession(): Promise<{
  id: string
  email: string
  role: string
  displayName: string
} | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  })

  if (!session) return null
  if (session.revokedAt) return null
  if (session.expiresAt < new Date()) return null
  if (!session.user.active) return null

  return {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
    displayName: session.user.displayName,
  }
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  })
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE
