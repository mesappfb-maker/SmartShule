// SmartShule — Générateur de licences commercial
// ============================================================
// Format : SMART-XXXX-XXXX-XXXX-XXXX (20 chars + tirets)
// Plans : ESSENTIAL / PREMIUM / ENTERPRISE
// Validation : 1 an (365 jours)
// Vérification : online via API centrale

import crypto from 'crypto'

export type LicensePlan = 'ESSENTIAL' | 'PREMIUM' | 'ENTERPRISE'
export type LicenseStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'REVOKED'

export interface LicenseData {
  key: string
  plan: LicensePlan
  schoolName: string
  contactEmail: string
  contactPhone?: string
  issuedAt: Date
  expiresAt: Date
  status: LicenseStatus
  maxDevices: number
  activatedDevices: number
  notes?: string
}

export interface LicenseFeatures {
  maxStudents: number
  maxEmployees: number
  modules: string[]
  support: 'EMAIL' | 'PHONE' | 'PRIORITY'
  customBranding: boolean
  cloudSync: boolean
  pdfExport: boolean
  smsNotifications: boolean
}

// Features par plan
export const PLAN_FEATURES: Record<LicensePlan, LicenseFeatures> = {
  ESSENTIAL: {
    maxStudents: 200,
    maxEmployees: 20,
    modules: ['STUDENTS', 'INVOICES', 'ATTENDANCE', 'GRADES'],
    support: 'EMAIL',
    customBranding: false,
    cloudSync: false,
    pdfExport: true,
    smsNotifications: false,
  },
  PREMIUM: {
    maxStudents: 1000,
    maxEmployees: 50,
    modules: ['STUDENTS', 'INVOICES', 'ATTENDANCE', 'GRADES', 'DOCUMENTS', 'NOTIFICATIONS', 'IMPORTS'],
    support: 'PHONE',
    customBranding: true,
    cloudSync: true,
    pdfExport: true,
    smsNotifications: true,
  },
  ENTERPRISE: {
    maxStudents: 999999, // illimité
    maxEmployees: 999999,
    modules: ['*'], // tous
    support: 'PRIORITY',
    customBranding: true,
    cloudSync: true,
    pdfExport: true,
    smsNotifications: true,
  },
}

export const PLAN_PRICES: Record<LicensePlan, { monthly: number; annual: number; currency: string }> = {
  ESSENTIAL: { monthly: 25000, annual: 250000, currency: 'CDF' }, // ~$15/mois
  PREMIUM: { monthly: 50000, annual: 500000, currency: 'CDF' },   // ~$30/mois
  ENTERPRISE: { monthly: 100000, annual: 1000000, currency: 'CDF' }, // ~$60/mois
}

// ============================================================
// Génération de clé de licence
// ============================================================

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // pas de I, O, 0, 1 (confus)

export function generateLicenseKey(): string {
  const bytes = crypto.randomBytes(16)
  const groups: string[] = []
  for (let g = 0; g < 4; g++) {
    let group = ''
    for (let i = 0; i < 4; i++) {
      const idx = bytes[g * 4 + i] % ALPHABET.length
      group += ALPHABET[idx]
    }
    groups.push(group)
  }
  return `SMART-${groups.join('-')}`
}

// ============================================================
// Création d'une licence
// ============================================================

export function createLicenseData(params: {
  plan: LicensePlan
  schoolName: string
  contactEmail: string
  contactPhone?: string
  durationDays?: number
  notes?: string
}): LicenseData {
  const now = new Date()
  const durationDays = params.durationDays || 365
  const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)

  const maxDevices = params.plan === 'ESSENTIAL' ? 1 : params.plan === 'PREMIUM' ? 3 : 10

  return {
    key: generateLicenseKey(),
    plan: params.plan,
    schoolName: params.schoolName,
    contactEmail: params.contactEmail,
    contactPhone: params.contactPhone,
    issuedAt: now,
    expiresAt,
    status: 'PENDING',
    maxDevices,
    activatedDevices: 0,
    notes: params.notes,
  }
}

// ============================================================
// Validation d'une clé de licence (format)
// ============================================================

export function isValidLicenseKeyFormat(key: string): boolean {
  return /^SMART-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(key)
}

// ============================================================
// Vérification online (appel au serveur central)
// ============================================================

export async function verifyLicenseOnline(
  licenseKey: string,
  deviceId: string
): Promise<{ valid: boolean; license?: LicenseData; features?: LicenseFeatures; error?: string }> {
  try {
    // Le serveur central de vérification (à configurer)
    const VERIFY_URL = process.env.LICENSE_SERVER_URL || 'https://smartshule-seven.vercel.app/api/license/verify'

    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey, deviceId }),
    })

    const data = await res.json()

    if (!data.ok) {
      return { valid: false, error: data.error || 'Licence invalide' }
    }

    return {
      valid: true,
      license: data.license,
      features: data.features,
    }
  } catch (err) {
    return { valid: false, error: 'Serveur de licence injoignable. Vérifiez votre connexion internet.' }
  }
}

// ============================================================
// Vérification locale (offline fallback — pas recommandé)
// ============================================================

export function verifyLicenseLocally(license: LicenseData, deviceId: string): { valid: boolean; error?: string } {
  if (license.status === 'REVOKED') return { valid: false, error: 'Licence révoquée' }
  if (license.status === 'SUSPENDED') return { valid: false, error: 'Licence suspendue' }
  if (new Date() > license.expiresAt) return { valid: false, error: 'Licence expirée' }
  if (license.activatedDevices >= license.maxDevices) return { valid: false, error: 'Nombre maximum d\'appareils atteint' }
  return { valid: true }
}
