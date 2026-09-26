// SmartShule — API Upload Logo École (DIRECTION, ADMIN, SYSTEM_ADMIN)
// ============================================================
// POST multipart/form-data avec champ "logo" (fichier image)
// Sauvegarde dans /public/uploads/logos/<schoolId>-<timestamp>.<ext>
// Met à jour school.logoUrl

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { hasRole } from '@/lib/rbac'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
const ALLOWED_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.svg']
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (!hasRole(user, ['DIRECTION', 'DIRECTOR', 'ADMIN', 'SCHOOL_ADMIN', 'SYSTEM_ADMIN'])) {
      return NextResponse.json({ ok: false, error: 'Accès réservé à la direction.' }, { status: 403 })
    }

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const formData = await request.formData()
    const file = formData.get('logo')
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'Aucun fichier reçu.' }, { status: 400 })
    }

    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json({ ok: false, error: `Type de fichier non supporté: ${file.type}. Formats acceptés: PNG, JPG, WebP, SVG.` }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ ok: false, error: `Fichier trop volumineux: ${(file.size / 1024 / 1024).toFixed(2)} MB. Maximum: 5 MB.` }, { status: 400 })
    }

    // Déterminer l'extension
    const ext = path.extname(file.name).toLowerCase() || (file.type === 'image/png' ? '.png' : file.type === 'image/jpeg' ? '.jpg' : file.type === 'image/webp' ? '.webp' : file.type === 'image/svg+xml' ? '.svg' : '.png')
    if (!ALLOWED_EXT.includes(ext)) {
      return NextResponse.json({ ok: false, error: `Extension non supportée: ${ext}` }, { status: 400 })
    }

    // Préparer le dossier
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'logos')
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Nom de fichier unique
    const filename = `${schoolId}-${Date.now()}${ext}`
    const filepath = path.join(uploadDir, filename)

    // Écrire le fichier
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filepath, buffer)

    // URL publique
    const logoUrl = `/uploads/logos/${filename}`

    // Mettre à jour l'école
    await db.school.update({
      where: { id: schoolId },
      data: { logoUrl },
    })

    // Audit
    const h = await headers()
    await logAudit({
      userId: user.id,
      userName: user.displayName,
      userRole: user.role,
      schoolId,
      action: 'BRANDING_LOGO_UPDATED',
      entityType: 'SCHOOL',
      entityId: schoolId,
      description: `Logo de l'école mis à jour — ${filename} (${file.size} bytes)`,
      ipAddress: getClientIP(h),
      metadata: { filename, size: file.size, mime: file.type } as unknown as Record<string, unknown>,
    })

    return NextResponse.json({ ok: true, logoUrl })
  } catch (err) {
    console.error('[schools/logo] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
