// API : Upload + parsing d'un fichier d'import
// ============================================================
// POST (multipart/form-data) : upload CSV/XLSX + parsing + création ImportJob

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'
import { parseCsv, parseXlsx, IMPORT_CONFIGS, ImportType } from '@/lib/import-engine'
import crypto from 'crypto'
import path from 'path'
import fs from 'fs/promises'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const STORAGE_ROOT = process.env.STORAGE_ROOT || '/home/z/my-project/storage/imports'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 Mo

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const formData = await req.formData()
    const file = formData.get('file') as File
    const importType = formData.get('importType') as ImportType

    if (!file || !importType) {
      return NextResponse.json({ ok: false, error: 'Fichier et importType requis.' }, { status: 400 })
    }

    // Vérifier RBAC pour ce type d'import
    const config = IMPORT_CONFIGS[importType]
    if (!config) return NextResponse.json({ ok: false, error: 'Type d\'import inconnu.' }, { status: 400 })
    if (!config.allowedRoles.includes(user.role) && user.role !== 'ADMIN') {
      return NextResponse.json({
        ok: false,
        error: `Rôle ${user.role} non autorisé pour l'import ${importType}.`,
      }, { status: 403 })
    }

    // Vérifier taille fichier
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ ok: false, error: `Fichier trop volumineux (max ${MAX_FILE_SIZE / 1024 / 1024} Mo).` }, { status: 400 })
    }

    // Vérifier extension
    const fileName = file.name.toLowerCase()
    const isCsv = fileName.endsWith('.csv')
    const isXlsx = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')
    if (!isCsv && !isXlsx) {
      return NextResponse.json({ ok: false, error: 'Format non supporté. Utilisez CSV ou XLSX.' }, { status: 400 })
    }

    // Lire le fichier
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Parser
    let parsed: { headers: string[]; rows: Record<string, any>[]; warnings: string[] }
    if (isCsv) {
      const content = buffer.toString('utf-8')
      parsed = parseCsv(content)
    } else {
      parsed = await parseXlsx(buffer)
    }

    if (parsed.rows.length === 0) {
      return NextResponse.json({ ok: false, error: 'Aucune ligne de données trouvée.' }, { status: 400 })
    }
    if (parsed.rows.length > config.maxRows) {
      return NextResponse.json({
        ok: false,
        error: `Trop de lignes: ${parsed.rows.length} > ${config.maxRows} maximum.`,
      }, { status: 400 })
    }

    // Générer référence unique d'import
    const year = new Date().getFullYear()
    const count = await db.importJob.count({ where: { schoolId } })
    const importReference = `IMP-${year}-${String(count + 1).padStart(6, '0')}`

    // Sauvegarder le fichier source
    const dir = path.join(STORAGE_ROOT, schoolId, year.toString())
    await fs.mkdir(dir, { recursive: true })
    const systemFileName = `${importReference}-${file.name}`
    const fileUrl = path.join(dir, systemFileName)
    await fs.writeFile(fileUrl, buffer)

    // Créer le job
    const job = await db.importJob.create({
      data: {
        schoolId,
        importReference,
        importType,
        originalFileName: file.name,
        systemFileName,
        fileUrl: `/api/imports/template?action=download&file=${importReference}`,
        fileSize: file.size,
        mimeType: file.type || (isCsv ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
        columnMapping: JSON.stringify(parsed.headers.reduce((acc, h) => { acc[h] = h; return acc }, {} as Record<string, string>)),
        totalRows: parsed.rows.length,
        status: 'UPLOADED',
        createdById: user.id,
        createdByName: user.displayName,
      },
    })

    // Audit
    const h = await headers()
    await logAudit({
      userId: user.id, userName: user.displayName, userRole: user.role, schoolId,
      action: 'IMPORT_UPLOAD',
      entityType: 'IMPORT',
      entityId: job.id,
      description: `Upload ${importType}: ${file.name} (${parsed.rows.length} lignes, ${file.size} octets)`,
      ipAddress: getClientIP(h),
      metadata: { importReference, importType, fileName: file.name, rows: parsed.rows.length, warnings: parsed.warnings.length },
    })

    return NextResponse.json({
      ok: true,
      importJobId: job.id,
      importReference,
      headers: parsed.headers,
      rowCount: parsed.rows.length,
      warnings: parsed.warnings,
      preview: parsed.rows.slice(0, 5), // 5 premières lignes pour preview
      message: 'Fichier uploadé et parsé avec succès',
    })
  } catch (err) {
    console.error('[api/imports/upload] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
