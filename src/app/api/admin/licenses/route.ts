// SmartShule — API Génération de licence (SYSTEM_ADMIN seulement)
// POST /api/admin/licenses/generate
// Corps : { plan, schoolName, contactEmail, contactPhone?, durationDays? }

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { hasRole } from '@/lib/rbac'
import { logAudit, getClientIP } from '@/lib/audit'
import { createLicenseData, PLAN_FEATURES, type LicensePlan } from '@/lib/license'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (!hasRole(user, ['SYSTEM_ADMIN'])) {
      return NextResponse.json({ ok: false, error: 'Accès réservé au propriétaire.' }, { status: 403 })
    }

    const body = await request.json()
    const { plan, schoolName, contactEmail, contactPhone, contactCity, durationDays, notes } = body

    if (!plan || !schoolName || !contactEmail) {
      return NextResponse.json({ ok: false, error: 'Plan, nom école et email obligatoires.' }, { status: 400 })
    }

    if (!['ESSENTIAL', 'PREMIUM', 'ENTERPRISE'].includes(plan)) {
      return NextResponse.json({ ok: false, error: 'Plan invalide. Utilisez ESSENTIAL, PREMIUM ou ENTERPRISE.' }, { status: 400 })
    }

    const licenseData = createLicenseData({
      plan: plan as LicensePlan,
      schoolName,
      contactEmail,
      contactPhone,
      durationDays,
      notes,
    })

    const features = PLAN_FEATURES[plan as LicensePlan]

    // Sauvegarde en DB
    const license = await db.license.create({
      data: {
        licenseKey: licenseData.key,
        clientName: schoolName,
        clientEmail: contactEmail,
        clientPhone: contactPhone || null,
        clientCity: contactCity || null,
        clientCountry: 'RDC',
        planType: 'ANNUAL',
        maxStudents: features.maxStudents,
        maxDirections: 3,
        modules: features.modules.join(','),
        issuedAt: licenseData.issuedAt,
        expiresAt: licenseData.expiresAt,
        status: 'PENDING',
        maxActivations: licenseData.maxDevices,
        notes: notes || null,
      },
    })

    // Audit
    const h = await headers()
    await logAudit({
      userId: user.id,
      userName: user.displayName,
      userRole: user.role,
      action: 'LICENSE_GENERATED',
      entityType: 'LICENSE',
      entityId: license.id,
      description: `Licence ${plan} générée pour ${schoolName} (${contactEmail})`,
      ipAddress: getClientIP(h),
      metadata: { key: licenseData.key, plan, schoolName } as unknown as Record<string, unknown>,
    })

    return NextResponse.json({
      ok: true,
      license: {
        id: license.id,
        key: licenseData.key,
        plan,
        schoolName,
        contactEmail,
        issuedAt: licenseData.issuedAt.toISOString(),
        expiresAt: licenseData.expiresAt.toISOString(),
        status: 'PENDING',
        maxDevices: licenseData.maxDevices,
        features,
      },
    })
  } catch (err) {
    console.error('[admin/licenses/generate] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

// Liste de toutes les licences
export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (!hasRole(user, ['SYSTEM_ADMIN'])) {
      return NextResponse.json({ ok: false, error: 'Accès réservé.' }, { status: 403 })
    }

    const licenses = await db.license.findMany({
      orderBy: { issuedAt: 'desc' },
      take: 500,
    })

    const rows = licenses.map(l => ({
      id: l.id,
      key: l.licenseKey,
      plan: l.maxStudents >= 999999 ? 'ENTERPRISE' : l.maxStudents >= 1000 ? 'PREMIUM' : 'ESSENTIAL',
      schoolName: l.clientName,
      contactEmail: l.clientEmail,
      contactPhone: l.clientPhone,
      city: l.clientCity,
      country: l.clientCountry,
      issuedAt: l.issuedAt.toISOString(),
      activatedAt: l.activatedAt ? l.activatedAt.toISOString() : null,
      expiresAt: l.expiresAt ? l.expiresAt.toISOString() : null,
      status: l.status,
      maxStudents: l.maxStudents,
      maxActivations: l.maxActivations,
      activationCount: l.activationCount,
      machineName: l.machineName,
    }))

    return NextResponse.json({ ok: true, licenses: rows, total: rows.length })
  } catch (err) {
    console.error('[admin/licenses] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
