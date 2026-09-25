// API : Assistant installation nouvelle école
// ============================================================
// POST : crée une nouvelle école + base locale + premier admin
// {
//   action: 'install-new-school',
//   licenseKey: 'LIC-XXXX',
//   schoolName: 'Complexe Scolaire Horizon',
//   schoolEmail: 'contact@horizon.cd',
//   schoolPhone: '+243...',
//   schoolAddress: '...',
//   schoolCity: 'Lubumbashi',
//   adminEmail: 'director@horizon.cd',
//   adminPassword: '...',
//   adminDisplayName: 'Directeur',
//   academicYearLabel: '2026-2027',
//   startMode: 'offline' | 'online',
// }

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    if (action === 'install-new-school') {
      const {
        licenseKey, schoolName, schoolEmail, schoolPhone, schoolAddress, schoolCity,
        adminEmail, adminPassword, adminDisplayName,
        academicYearLabel, startMode,
      } = body

      // 1. Valider les champs obligatoires
      if (!licenseKey || !schoolName || !adminEmail || !adminPassword) {
        return NextResponse.json({ ok: false, error: 'licence, nom école, email admin et mot de passe sont obligatoires.' }, { status: 400 })
      }

      // 2. Vérifier la licence
      const license = await db.license.findUnique({ where: { licenseKey } })
      if (!license) {
        return NextResponse.json({ ok: false, error: 'Clé de licence invalide.' }, { status: 400 })
      }
      if (license.status !== 'PENDING' && license.status !== 'ACTIVE') {
        return NextResponse.json({ ok: false, error: `Licence ${license.status} — non utilisable.` }, { status: 400 })
      }
      if (license.expiresAt && license.expiresAt < new Date()) {
        return NextResponse.json({ ok: false, error: 'Licence expirée.' }, { status: 400 })
      }
      if (license.schoolId) {
        return NextResponse.json({ ok: false, error: 'Licence déjà utilisée par une autre école.' }, { status: 400 })
      }

      // 3. Générer school_id unique
      const schoolId = `SCH-${String(Date.now()).slice(-6)}`

      // 4. Créer l'école
      const school = await db.school.create({
        data: {
          id: schoolId,
          name: schoolName,
          email: schoolEmail || `${schoolId}@smartshule.com`,
          phone: schoolPhone || null,
          address: schoolAddress || null,
          currency: 'CDF',
          locale: 'fr-FR',
        },
      })

      // 5. Créer le branding par défaut
      await db.branding.create({
        data: {
          schoolId: school.id,
          status: 'PUBLISHED',
          version: 1,
          primaryColor: '#1e40af',
          secondaryColor: '#0e7490',
          tertiaryColor: '#475569',
          schoolName: school.name,
          publishedAt: new Date(),
        },
      })

      // 6. Créer l'année scolaire
      const academicYear = await db.academicYear.create({
        data: {
          schoolId: school.id,
          label: academicYearLabel || '2026-2027',
          startDate: new Date('2026-09-01'),
          endDate: new Date('2027-07-15'),
          active: true,
        },
      })

      // 7. Créer le premier administrateur établissement
      const passwordHash = await hashPassword(adminPassword)
      const adminUser = await db.user.create({
        data: {
          email: adminEmail,
          passwordHash,
          role: 'SCHOOL_ADMIN',
          accountStatus: 'ACTIVE',
          displayName: adminDisplayName || 'Administrateur',
          active: true,
        },
      })

      // 8. Lier la licence à l'école
      await db.license.update({
        where: { id: license.id },
        data: {
          schoolId: school.id,
          status: 'ACTIVE',
          activatedAt: new Date(),
          machineId: crypto.randomBytes(16).toString('hex'),
          machineName: require('os').hostname(),
          activationCount: { increment: 1 },
        },
      })

      // 9. Créer un audit d'installation
      const h = await headers()
      await logAudit({
        userId: adminUser.id,
        userName: adminUser.displayName,
        userRole: 'SCHOOL_ADMIN',
        schoolId: school.id,
        action: 'INSTALL_SCHOOL',
        entityType: 'SCHOOL',
        entityId: school.id,
        description: `Installation école: ${school.name} (${schoolId}) — Licence ${licenseKey.slice(0, 8)}...`,
        ipAddress: getClientIP(h),
        metadata: {
          schoolId, schoolName: school.name, licenseId: license.id,
          academicYear: academicYear.label, startMode,
        },
      })

      return NextResponse.json({
        ok: true,
        schoolId: school.id,
        schoolName: school.name,
        licenseKey: license.licenseKey,
        adminEmail: adminUser.email,
        academicYear: academicYear.label,
        message: `École "${school.name}" installée avec succès. Vous pouvez vous connecter avec ${adminEmail}.`,
      })
    }

    if (action === 'check-license') {
      const { licenseKey } = body
      const license = await db.license.findUnique({ where: { licenseKey } })
      if (!license) {
        return NextResponse.json({ ok: false, error: 'Clé de licence invalide.' }, { status: 400 })
      }
      if (license.schoolId) {
        return NextResponse.json({ ok: false, error: 'Licence déjà utilisée.' }, { status: 400 })
      }
      if (license.expiresAt && license.expiresAt < new Date()) {
        return NextResponse.json({ ok: false, error: 'Licence expirée.' }, { status: 400 })
      }
      return NextResponse.json({
        ok: true,
        license: {
          planType: license.planType,
          maxStudents: license.maxStudents,
          maxActivations: license.maxActivations,
          modules: license.modules,
          expiresAt: license.expiresAt?.toISOString() || null,
        },
      })
    }

    return NextResponse.json({ ok: false, error: `Action "${action}" inconnue.` }, { status: 400 })
  } catch (err) {
    console.error('[api/installation] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
