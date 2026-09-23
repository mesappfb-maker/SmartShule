// SmartShule — API export reçu PDF
// GET /api/exports/receipt?id=<paymentId>

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generatePaymentReceiptPDF, logExportAction } from '@/lib/exports'
import { getUserFromSession as getSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  const paymentId = req.nextUrl.searchParams.get('id')
  if (!paymentId) {
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

  // Vérifier le périmètre
  if (user.role === 'PARENT') {
    const guardian = await db.guardian.findFirst({
      where: { userId: user.id },
      include: { studentLinks: true },
    })
    const payment = await db.payment.findUnique({
      where: { id: paymentId },
      include: { invoice: true },
    })
    if (!payment || !guardian?.studentLinks.some((l) => l.studentId === payment.invoice.studentId)) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
  } else if (user.role !== 'DIRECTION' && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  }

  try {
    const result = await generatePaymentReceiptPDF(paymentId, schoolId)
    await logExportAction(user.id, user.displayName, user.role, schoolId, 'receipt', result.filename, 'pdf')

    return new NextResponse(result.buffer as any, {
      status: 200,
      headers: {
        'Content-Type': result.mimeType,
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'Content-Length': result.buffer.length.toString(),
      },
    })
  } catch (e) {
    console.error('Export receipt error:', e)
    return NextResponse.json({ error: 'Erreur lors de la génération du reçu' }, { status: 500 })
  }
}
