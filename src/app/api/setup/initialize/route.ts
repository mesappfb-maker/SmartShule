// SmartShule — API Setup Initialize (premier lancement après activation licence)
// ============================================================
// POST /api/setup/initialize
// Corps : { licenseKey, school: { name, slogan, address, phone, email }, admin: { displayName, email, password } }
// Crée l'école + le compte admin dans la base locale.
// Idempotent : ne fait rien si la base a déjà une école.

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    // Vérifier que la base est vide (anti-rejeu)
    const existingSchool = await db.school.count().catch(() => 0)
    if (existingSchool > 0) {
      return NextResponse.json({
        ok: false,
        error: 'La base est déjà initialisée. Cette action n\'est plus disponible.',
      }, { status: 400 })
    }

    const body = await request.json()
    const { licenseKey, school, admin } = body

    if (!licenseKey || !school?.name || !admin?.email || !admin?.password) {
      return NextResponse.json({
        ok: false,
        error: 'licenseKey, school.name, admin.email et admin.password obligatoires',
      }, { status: 400 })
    }

    if (admin.password.length < 8) {
      return NextResponse.json({
        ok: false,
        error: 'Le mot de passe doit faire au moins 8 caractères',
      }, { status: 400 })
    }

    // =============================================
    // 1. Créer l'école
    // =============================================
    const schoolRecord = await db.school.create({
      data: {
        name: school.name,
        slogan: school.slogan || null,
        address: school.address || null,
        phone: school.phone || null,
        email: school.email || null,
        currency: 'CDF',
        locale: 'fr-FR',
        primaryColor: '#2563EB',
        secondaryColor: '#0F766E',
        tertiaryColor: '#F59E0B',
      },
    })

    // Branding initial
    await db.branding.create({
      data: {
        schoolId: schoolRecord.id,
        status: 'PUBLISHED',
        version: 1,
        primaryColor: '#2563EB',
        secondaryColor: '#0F766E',
        tertiaryColor: '#F59E0B',
        schoolName: school.name,
        slogan: school.slogan || 'Bienvenue',
        publishedAt: new Date(),
      },
    }).catch(() => {})

    // =============================================
    // 2. Créer l'année scolaire active
    // =============================================
    const now = new Date()
    const academicYear = await db.academicYear.create({
      data: {
        schoolId: schoolRecord.id,
        label: `${now.getFullYear()}-${now.getFullYear() + 1}`,
        startDate: new Date(now.getFullYear(), 8, 1),
        endDate: new Date(now.getFullYear() + 1, 6, 15),
        active: true,
      },
    })

    // =============================================
    // 3. Créer le compte admin (SYSTEM_ADMIN)
    // =============================================
    const passwordHash = await hashPassword(admin.password)
    const adminUser = await db.user.create({
      data: {
        email: admin.email,
        passwordHash,
        role: 'SYSTEM_ADMIN',
        accountStatus: 'ACTIVE',
        displayName: admin.displayName || 'Administrateur',
        active: true,
        isDemoAccount: false,
      },
    })

    // =============================================
    // 4. Audit log
    // =============================================
    const h = await headers()
    await logAudit({
      userId: adminUser.id,
      userName: adminUser.displayName,
      userRole: adminUser.role,
      schoolId: schoolRecord.id,
      action: 'SYSTEM_SETUP_COMPLETE',
      entityType: 'SCHOOL',
      entityId: schoolRecord.id,
      description: `Configuration initiale — École: ${school.name}, Admin: ${admin.email}`,
      ipAddress: getClientIP(h),
      metadata: {
        schoolName: school.name,
        academicYear: academicYear.label,
        licenseKey,
        version: '2.0.0-commercial',
        timestamp: new Date().toISOString(),
      } as unknown as Record<string, unknown>,
    })

    return NextResponse.json({
      ok: true,
      message: 'Configuration terminée avec succès',
      school: { id: schoolRecord.id, name: schoolRecord.name },
      admin: { email: adminUser.email, role: adminUser.role },
    })
  } catch (err) {
    console.error('[api/setup/initialize] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
