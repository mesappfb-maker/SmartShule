// SmartShule — Service de rattachement parent-élève sécurisé
// ============================================================
import { db } from '@/lib/db'
import crypto from 'crypto'

// Génère un code LNK-XXXX-XXXX (8 caractères alphanumériques)
export function generateLinkCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // pas de 0,1,O,I pour lisibilité
  const part = (n: number) => Array.from(crypto.randomBytes(n), (b) => chars[b % chars.length]).join('')
  return `LNK-${part(4)}-${part(4)}`
}

// Crée un code de liaison pour un élève
export async function createLinkCode(studentId: string, schoolId: string, createdById: string, createdByName: string, validityDays = 90) {
  // Révoquer les anciens codes actifs pour cet élève
  await db.parentLinkCode.updateMany({
    where: { studentId, status: 'ACTIVE' },
    data: { status: 'REVOKED' },
  })

  const code = generateLinkCode()
  const expiresAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000)

  const linkCode = await db.parentLinkCode.create({
    data: {
      schoolId,
      studentId,
      code,
      status: 'ACTIVE',
      expiresAt,
      createdById,
      createdByName,
    },
  })

  return linkCode
}

// Vérifie un code de liaison
export async function verifyLinkCode(code: string, studentId: string) {
  const linkCode = await db.parentLinkCode.findUnique({ where: { code: code.toUpperCase().trim() } })
  if (!linkCode) return { valid: false, reason: 'Code introuvable' }
  if (linkCode.studentId !== studentId) return { valid: false, reason: 'Code ne correspond pas à cet élève' }
  if (linkCode.status === 'USED') return { valid: false, reason: 'Code déjà utilisé' }
  if (linkCode.status === 'EXPIRED' || linkCode.expiresAt < new Date()) return { valid: false, reason: 'Code expiré' }
  if (linkCode.status === 'REVOKED') return { valid: false, reason: 'Code révoqué' }
  return { valid: true, linkCode }
}

// Marque un code comme utilisé
export async function markCodeUsed(codeId: string, userId: string) {
  await db.parentLinkCode.update({
    where: { id: codeId },
    data: { status: 'USED', usedById: userId, usedAt: new Date() },
  })
}

// Vérifie si le nom de l'enfant correspond (sans révéler l'existence)
export function childNameMatches(providedName: string, actualFirstName: string, actualLastName: string): boolean {
  const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const provided = normalize(providedName)
  const fullActual = normalize(`${actualFirstName} ${actualLastName}`)
  const reverseActual = normalize(`${actualLastName} ${actualFirstName}`)
  // Vérifie si le nom fourni contient ou correspond au nom réel
  return provided === fullActual || provided === reverseActual ||
         fullActual.includes(provided) || provided.includes(actualFirstName.toLowerCase())
}
