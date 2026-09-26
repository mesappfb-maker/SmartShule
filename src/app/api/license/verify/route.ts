// SmartShule — API Vérification online de licence
// POST /api/license/verify
// Corps : { licenseKey, deviceId }
// Appelée par les apps locales pour vérifier une licence

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { PLAN_FEATURES, type LicensePlan } from '@/lib/license'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { licenseKey, deviceId, machineName } = body

    if (!licenseKey || !deviceId) {
      return NextResponse.json({ ok: false, error: 'licenseKey et deviceId obligatoires.' }, { status: 400 })
    }

    // Cherche la licence
    const license = await db.license.findUnique({
      where: { licenseKey },
    })

    if (!license) {
      return NextResponse.json({ ok: false, error: 'Clé de licence introuvable.' }, { status: 404 })
    }

    // Vérifie le statut
    if (license.status === 'REVOKED') {
      return NextResponse.json({ ok: false, error: 'Licence révoquée. Contactez le support.' }, { status: 403 })
    }
    if (license.status === 'SUSPENDED') {
      return NextResponse.json({ ok: false, error: 'Licence suspendue. Contactez le support.' }, { status: 403 })
    }

    // Vérifie l'expiration
    if (license.expiresAt && new Date() > license.expiresAt) {
      await db.license.update({
        where: { id: license.id },
        data: { status: 'EXPIRED' },
      })
      return NextResponse.json({ ok: false, error: 'Licence expirée. Renouvelez votre abonnement.' }, { status: 403 })
    }

    // Vérifie le nombre d'activations
    if (license.activationCount >= license.maxActivations && license.machineId !== deviceId) {
      return NextResponse.json({
        ok: false,
        error: `Nombre maximum d'activations atteint (${license.maxActivations}). Contactez le support pour ajouter un appareil.`,
      }, { status: 403 })
    }

    // Détermine le plan basé sur maxStudents
    const plan: LicensePlan = license.maxStudents >= 999999 ? 'ENTERPRISE' : license.maxStudents >= 1000 ? 'PREMIUM' : 'ESSENTIAL'
    const features = PLAN_FEATURES[plan]

    // Si première activation, on enregistre le device
    if (license.status === 'PENDING' || !license.machineId) {
      await db.license.update({
        where: { id: license.id },
        data: {
          status: 'ACTIVE',
          activatedAt: new Date(),
          machineId: deviceId,
          machineName: machineName || 'Unknown',
          activationCount: { increment: 1 },
        },
      })
    }

    return NextResponse.json({
      ok: true,
      license: {
        key: license.licenseKey,
        plan,
        schoolName: license.clientName,
        contactEmail: license.clientEmail,
        issuedAt: license.issuedAt.toISOString(),
        expiresAt: license.expiresAt ? license.expiresAt.toISOString() : null,
        status: 'ACTIVE',
        maxDevices: license.maxActivations,
        activatedDevices: license.activationCount,
      },
      features,
    })
  } catch (err) {
    console.error('[license/verify] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
