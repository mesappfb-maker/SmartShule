// SmartShule — API export facture PDF
// GET /api/exports/invoice?id=<invoiceId>

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateInvoicePDF, logExportAction } from '@/lib/exports'
import { getUserFromSession as getSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  // Direction + parent (si la facture est pour son enfant) + élève (si sa propre facture)
  const invoiceId = req.nextUrl.searchParams.get('id')
  if (!invoiceId) {
    return NextResponse.json({ error: 'Paramètre id obligatoire' }, { status: 400 })
  }

  const audit = await db.auditLog.findFirst({
    where: { userId: user.id, schoolId: { not: null } },
    select: { schoolId: true },
  })
  const schoolId = audit?.schoolId ?? (await db.school.findFirst())?.id
  if (!schoolId) {
    return NextResponse.json({ error: 'École introuvable' }, { status: 404 })
  }

  // Vérifier le périmètre si l'utilisateur est PARENT
  if (user.role === 'PARENT') {
    const guardian = await db.guardian.findFirst({
      where: { userId: user.id },
      include: { studentLinks: true },
    })
    const invoice = await db.invoice.findUnique({ where: { id: invoiceId } })
    if (!invoice || !guardian?.studentLinks.some((l) => l.studentId === invoice.studentId)) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
  } else if (user.role === 'STUDENT') {
    const student = await db.student.findFirst({ where: { userId: user.id } })
    const invoice = await db.invoice.findUnique({ where: { id: invoiceId } })
    if (!invoice || invoice.studentId !== student?.id) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
  } else if (user.role !== 'DIRECTION' && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  }

  try {
    const result = await generateInvoicePDF(invoiceId, schoolId)
    await logExportAction(user.id, user.displayName, user.role, schoolId, 'invoice', result.filename, 'pdf')

    return new NextResponse(result.buffer as any, {
      status: 200,
      headers: {
        'Content-Type': result.mimeType,
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'Content-Length': result.buffer.length.toString(),
      },
    })
  } catch (e) {
    console.error('Export invoice error:', e)
    return NextResponse.json({ error: 'Erreur lors de la génération de la facture' }, { status: 500 })
  }
}
