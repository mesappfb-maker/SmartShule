// API : Validation d'un import (mapping + prévisualisation)
// ============================================================
// GET : récupérer le job + headers + preview
// POST : valider avec mapping + prévisualisation détaillée

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { validateImportRows, IMPORT_CONFIGS, ImportType } from '@/lib/import-engine'
import fs from 'fs/promises'
import { parseCsv, parseXlsx } from '@/lib/import-engine'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const STORAGE_ROOT = process.env.STORAGE_ROOT || '/home/z/my-project/storage/imports'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })

    const url = new URL(req.url)
    const jobId = url.searchParams.get('jobId')
    if (!jobId) return NextResponse.json({ ok: false, error: 'jobId requis.' }, { status: 400 })

    const job = await db.importJob.findUnique({ where: { id: jobId } })
    if (!job) return NextResponse.json({ ok: false, error: 'Import introuvable.' }, { status: 404 })

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId || job.schoolId !== schoolId) {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
    }

    return NextResponse.json({
      ok: true,
      job: {
        id: job.id,
        importReference: job.importReference,
        importType: job.importType,
        originalFileName: job.originalFileName,
        status: job.status,
        totalRows: job.totalRows,
        validRows: job.validRows,
        warningRows: job.warningRows,
        errorRows: job.errorRows,
        duplicateRows: job.duplicateRows,
        createdCount: job.createdCount,
        updatedCount: job.updatedCount,
        rejectedCount: job.rejectedCount,
        progressPct: job.progressPct,
        isRollbackable: job.isRollbackable,
        rolledBackAt: job.rolledBackAt?.toISOString() || null,
        createdAt: job.createdAt.toISOString(),
        completedAt: job.completedAt?.toISOString() || null,
        createdByName: job.createdByName,
        confirmedByName: job.confirmedByName,
      },
    })
  } catch (err) {
    console.error('[api/imports/validate GET] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })

    const body = await req.json()
    const { action, jobId, columnMapping } = body

    if (action === 'validate') {
      if (!jobId) return NextResponse.json({ ok: false, error: 'jobId requis.' }, { status: 400 })

      const job = await db.importJob.findUnique({ where: { id: jobId } })
      if (!job) return NextResponse.json({ ok: false, error: 'Import introuvable.' }, { status: 404 })

      const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
      if (!schoolId || job.schoolId !== schoolId) {
        return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
      }

      // Vérifier RBAC
      const config = IMPORT_CONFIGS[job.importType as ImportType]
      if (!config.allowedRoles.includes(user.role) && user.role !== 'ADMIN') {
        return NextResponse.json({ ok: false, error: 'Rôle non autorisé pour cet import.' }, { status: 403 })
      }

      // Recharger le fichier source
      const filePath = `${STORAGE_ROOT}/${job.schoolId}/${new Date(job.createdAt).getFullYear()}/${job.systemFileName}`
      const buffer = await fs.readFile(filePath)
      let parsed: { headers: string[]; rows: Record<string, any>[]; warnings: string[] }
      if (job.mimeType.includes('csv')) {
        parsed = parseCsv(buffer.toString('utf-8'))
      } else {
        parsed = await parseXlsx(buffer)
      }

      // Mettre à jour le mapping si fourni
      if (columnMapping) {
        await db.importJob.update({
          where: { id: jobId },
          data: {
            columnMapping: JSON.stringify(columnMapping),
            status: 'MAPPED',
          },
        })
      }

      // Valider
      const result = await validateImportRows(schoolId, job.importType as ImportType, parsed.rows, columnMapping)

      // Mettre à jour les compteurs du job
      await db.importJob.update({
        where: { id: jobId },
        data: {
          status: 'VALIDATED',
          totalRows: result.totalRows,
          validRows: result.validRows,
          warningRows: result.warningRows,
          errorRows: result.errorRows,
          duplicateRows: result.duplicateRows,
          ignoredRows: result.ignoredRows,
        },
      })

      return NextResponse.json({
        ok: true,
        result: {
          totalRows: result.totalRows,
          validRows: result.validRows,
          warningRows: result.warningRows,
          errorRows: result.errorRows,
          duplicateRows: result.duplicateRows,
          ignoredRows: result.ignoredRows,
          // Retourner les 50 premières lignes pour prévisualisation
          preview: result.rows.slice(0, 50).map((r) => ({
            rowNumber: r.rowNumber,
            status: r.status,
            errors: r.errors,
            mappedData: r.mappedData,
          })),
        },
        message: result.errorRows > 0
          ? `${result.errorRows} ligne(s) en erreur — corrigez avant import`
          : `${result.validRows} ligne(s) prêtes à importer`,
      })
    }

    return NextResponse.json({ ok: false, error: `Action "${action}" inconnue.` }, { status: 400 })
  } catch (err) {
    console.error('[api/imports/validate POST] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
