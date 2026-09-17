// SmartShule — API export écritures comptables (XLSX ou CSV)
// GET /api/exports/journal-entries?format=xlsx|csv&from=YYYY-MM-DD&to=YYYY-MM-DD

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  generateJournalEntriesXLSX,
  generateJournalEntriesCSV,
  logExportAction,
  type ExportFormat,
} from '@/lib/exports'
import { getUserFromSession as getSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  if (user.role !== 'DIRECTION' && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Action réservée à la direction' }, { status: 403 })
  }

  const audit = await db.auditLog.findFirst({
    where: { userId: user.id, schoolId: { not: null } },
    select: { schoolId: true },
  })
  const schoolId = audit?.schoolId ?? (await db.school.findFirst())?.id
  if (!schoolId) {
    return NextResponse.json({ error: 'École introuvable' }, { status: 404 })
  }

  const format = (req.nextUrl.searchParams.get('format') || 'xlsx') as ExportFormat
  const fromStr = req.nextUrl.searchParams.get('from')
  const toStr = req.nextUrl.searchParams.get('to')
  const filters = {
    from: fromStr ? new Date(fromStr) : undefined,
    to: toStr ? new Date(toStr) : undefined,
  }

  try {
    let result
    if (format === 'csv') {
      result = await generateJournalEntriesCSV(schoolId, filters)
    } else {
      result = await generateJournalEntriesXLSX(schoolId, filters)
    }

    await logExportAction(user.id, user.displayName, user.role, schoolId, 'journal-entries', result.filename, format)

    return new NextResponse(result.buffer as any, {
      status: 200,
      headers: {
        'Content-Type': result.mimeType,
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'Content-Length': result.buffer.length.toString(),
      },
    })
  } catch (e) {
    console.error('Export journal entries error:', e)
    return NextResponse.json({ error: 'Erreur lors de l\'export' }, { status: 500 })
  }
}
