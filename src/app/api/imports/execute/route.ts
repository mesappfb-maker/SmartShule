// API : Exécution de l'import (background) + Liste des jobs
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'
import { executeImport, validateImportRows, IMPORT_CONFIGS, ImportType, parseCsv, parseXlsx } from '@/lib/import-engine'
import fs from 'fs/promises'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const STORAGE_ROOT = process.env.STORAGE_ROOT || '/home/z/my-project/storage/imports'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (!['SECRETARY', 'DIRECTION', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
    }
    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = parseInt(url.searchParams.get('limit') || '20', 10)
    const status = url.searchParams.get('status')

    const where: any = { schoolId }
    if (status) where.status = status

    const [jobs, total] = await Promise.all([
      db.importJob.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.importJob.count({ where }),
    ])

    return NextResponse.json({
      ok: true,
      jobs: jobs.map((j) => ({
        id: j.id,
        importReference: j.importReference,
        importType: j.importType,
        originalFileName: j.originalFileName,
        status: j.status,
        progressPct: j.progressPct,
        totalRows: j.totalRows,
        validRows: j.validRows,
        errorRows: j.errorRows,
        duplicateRows: j.duplicateRows,
        createdCount: j.createdCount,
        updatedCount: j.updatedCount,
        rejectedCount: j.rejectedCount,
        isRollbackable: j.isRollbackable,
        rolledBackAt: j.rolledBackAt?.toISOString() || null,
        createdAt: j.createdAt.toISOString(),
        completedAt: j.completedAt?.toISOString() || null,
        createdByName: j.createdByName,
        confirmedByName: j.confirmedByName,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error('[api/imports/execute GET] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })

    const body = await req.json()
    const { action, jobId, confirmation } = body

    if (action === 'execute') {
      if (!jobId) return NextResponse.json({ ok: false, error: 'jobId requis.' }, { status: 400 })
      if (!confirmation) return NextResponse.json({ ok: false, error: 'Confirmation explicite requise.' }, { status: 400 })

      const job = await db.importJob.findUnique({ where: { id: jobId } })
      if (!job) return NextResponse.json({ ok: false, error: 'Import introuvable.' }, { status: 404 })

      const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
      if (!schoolId || job.schoolId !== schoolId) {
        return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
      }

      // Vérifier RBAC
      const config = IMPORT_CONFIGS[job.importType as ImportType]
      if (!config.allowedRoles.includes(user.role) && user.role !== 'ADMIN') {
        return NextResponse.json({ ok: false, error: 'Rôle non autorisé.' }, { status: 403 })
      }

      // Vérifier qu'il n'y a pas d'erreurs bloquantes
      if (job.errorRows > 0) {
        return NextResponse.json({
          ok: false,
          error: `${job.errorRows} ligne(s) en erreur. Corrigez le fichier avant import.`,
        }, { status: 400 })
      }

      // Marquer comme confirmé
      await db.importJob.update({
        where: { id: jobId },
        data: {
          status: 'CONFIRMED',
          confirmedById: user.id,
          confirmedByName: user.displayName,
          confirmedAt: new Date(),
        },
      })

      // Audit confirmation
      const h = await headers()
      await logAudit({
        userId: user.id, userName: user.displayName, userRole: user.role, schoolId,
        action: 'IMPORT_CONFIRM',
        entityType: 'IMPORT',
        entityId: jobId,
        description: `Import ${job.importType} confirmé pour exécution (${job.validRows} lignes)`,
        ipAddress: getClientIP(h),
        metadata: { importReference: job.importReference, validRows: job.validRows },
      })

      // Recharger fichier + parser + valider + exécuter
      const filePath = `${STORAGE_ROOT}/${job.schoolId}/${new Date(job.createdAt).getFullYear()}/${job.systemFileName}`
      const buffer = await fs.readFile(filePath)
      const parsed = job.mimeType.includes('csv')
        ? parseCsv(buffer.toString('utf-8'))
        : await parseXlsx(buffer)

      const columnMapping = JSON.parse(job.columnMapping || '{}')
      const result = await validateImportRows(schoolId, job.importType as ImportType, parsed.rows, columnMapping)

      // Exécuter (en synchrone pour l'instant — peut être déplacé en tâche de fond via cron)
      // Pour ne pas bloquer: on lance l'import en async non attendu
      executeImport(jobId, schoolId, job.importType as ImportType, result.rows, user.id, user.displayName, user.role)
        .catch((err) => console.error('[import-execute] Erreur asynchrone:', err))

      return NextResponse.json({
        ok: true,
        message: 'Import lancé en arrière-plan. Vous pouvez suivre la progression.',
        importReference: job.importReference,
      })
    }

    return NextResponse.json({ ok: false, error: `Action "${action}" inconnue.` }, { status: 400 })
  } catch (err) {
    console.error('[api/imports/execute POST] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
