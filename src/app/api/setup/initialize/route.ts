// SmartShule — API Setup Initialize (premier lancement après activation licence)
// ============================================================
// POST /api/setup/initialize
// Corps : {
//   licenseKey,
//   school: { name, slogan, address, phone, email },
//   supabase: { url, anonKey, serviceRoleKey },
//   admin: { displayName, email, password }
// }
//
// Crée :
// 1. Un fichier .env.local avec les credentials Supabase
// 2. L'école dans la DB (qui sera désormais Supabase après redémarrage)
// 3. Le compte admin

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import path from 'path'

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
    const { licenseKey, school, supabase, admin } = body

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

    if (!supabase?.url || !supabase?.anonKey || !supabase?.serviceRoleKey) {
      return NextResponse.json({
        ok: false,
        error: 'Les 3 champs Supabase (url, anonKey, serviceRoleKey) sont obligatoires',
      }, { status: 400 })
    }

    // =============================================
    // 1. Écrire le fichier .env.local avec les credentials Supabase
    // =============================================
    const envContent = `# SmartShule — Configuration locale (générée par le wizard d'activation)
# Date : ${new Date().toISOString()}
# Licence : ${licenseKey}

# Base de données Supabase de l'école
DATABASE_URL="${supabase.url.replace('.co', '.pooler.supabase.com:5432/postgres')}"
DIRECT_URL="${supabase.url.replace('.co', '.pooler.supabase.com:5432/postgres')}"
SUPABASE_URL="${supabase.url}"
SUPABASE_ANON_KEY="${supabase.anonKey}"
SUPABASE_SERVICE_ROLE_KEY="${supabase.serviceRoleKey}"

# Application
NODE_ENV=production
NEXTAUTH_URL=http://127.0.0.1:3000
NEXTAUTH_SECRET="${Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)}"

# Licence
LICENSE_KEY="${licenseKey}"
LICENSE_SERVER_URL="https://smart-shule-seven.vercel.app"
`

    const envPath = path.join(process.cwd(), '.env.local')
    writeFileSync(envPath, envContent, { encoding: 'utf-8' })
    console.log('[setup] .env.local créé avec credentials Supabase')

    // =============================================
    // 2. Créer l'école dans la DB actuelle (SQLite temporaire)
    //    L'utilisateur devra redémarrer l'app pour que Prisma se reconnecte à Supabase
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
    // 3. Créer l'année scolaire active
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
    // 4. Créer le compte admin (SYSTEM_ADMIN)
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
    // 5. Audit log
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
      description: `Configuration initiale — École: ${school.name}, Admin: ${admin.email}, Supabase: ${supabase.url}`,
      ipAddress: getClientIP(h),
      metadata: {
        schoolName: school.name,
        academicYear: academicYear.label,
        licenseKey,
        supabaseUrl: supabase.url,
        version: '2.1.0-commercial',
        timestamp: new Date().toISOString(),
      } as unknown as Record<string, unknown>,
    })

    return NextResponse.json({
      ok: true,
      message: 'Configuration terminée. Redémarrez l\'application pour activer la connexion Supabase.',
      school: { id: schoolRecord.id, name: schoolRecord.name },
      admin: { email: adminUser.email, role: adminUser.role },
      supabase: { url: supabase.url },
      mustRestart: true,
    })
  } catch (err) {
    console.error('[api/setup/initialize] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
