// SmartShule — API Reçu PDF V2 sécurisé (avec QR code + signature)
// ============================================================
// GET /api/exports/receipt-v2?id=<receiptId>
//
// Génère un PDF avec :
//   - En-tête école (logo, nom, slogan, adresse)
//   - Numéro de reçu chronologique
//   - Élève (nom, matricule, classe)
//   - Détails du paiement (montant, moyen, date)
//   - QR code de vérification (signature HMAC)
//   - Tampon et signature du comptable (placeholders)
//   - Mention légale (reçu infalsifiable, annulation via avoir)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { hasRole } from '@/lib/rbac'
import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const receiptId = req.nextUrl.searchParams.get('id')
    if (!receiptId) {
      return NextResponse.json({ error: 'ID reçu obligatoire' }, { status: 400 })
    }

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) {
      return NextResponse.json({ error: 'École introuvable' }, { status: 404 })
    }

    const receipt = await db.receipt.findUnique({
      where: { id: receiptId },
      include: {
        school: true,
        student: true,
        accountant: true,
      },
    })

    if (!receipt || receipt.schoolId !== schoolId) {
      return NextResponse.json({ error: 'Reçu introuvable' }, { status: 404 })
    }

    // Vérifier périmètre
    if (user.role === 'PARENT') {
      const guardian = await db.guardian.findFirst({
        where: { userId: user.id },
        include: { studentLinks: { select: { studentId: true } } },
      })
      const studentIds = guardian?.studentLinks.map((l) => l.studentId) || []
      if (!studentIds.includes(receipt.studentId)) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
      }
    } else if (user.role === 'STUDENT' && receipt.student.userId !== user.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    // Récupérer classe de l'élève
    const enrollment = await db.enrollment.findFirst({
      where: { studentId: receipt.studentId, status: 'ACTIVE' },
      include: { classroom: { include: { directorate: true } } },
    })

    // Récupérer la dette liée (si applicable)
    let debtInfo: any = null
    if (receipt.studentDebtId) {
      debtInfo = await db.studentDebt.findUnique({
        where: { id: receipt.studentDebtId },
        include: { invoiceLineConfig: true },
      })
    }

    // Générer le QR code
    const qrCodeDataUrl = await QRCode.toDataURL(receipt.qrCodeData, {
      width: 200,
      margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' },
    })

    // Générer le PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    const chunks: Buffer[] = []
    doc.on('data', (chunk) => chunks.push(chunk))

    const pdfPromise = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)))
    })

    // === EN-TÊTE ÉCOLE ===
    const school = receipt.school
    doc.fontSize(22).font('Helvetica-Bold').fillColor(school.primaryColor || '#2563EB').text(school.name, { align: 'center' })
    if (school.slogan) {
      doc.fontSize(10).font('Helvetica-Oblique').fillColor('#666666').text(school.slogan, { align: 'center' })
    }
    if (school.address || school.phone || school.email) {
      doc.fontSize(9).font('Helvetica').fillColor('#888888').text(
        [school.address, school.phone, school.email].filter(Boolean).join(' • '),
        { align: 'center' }
      )
    }

    // Ligne décorative
    doc.moveTo(50, 130).lineTo(545, 130).strokeColor(school.primaryColor || '#2563EB').lineWidth(2).stroke()

    // === TITRE REÇU ===
    doc.moveDown(1.5)
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#000000').text(
      receipt.receiptType === 'CREDIT_NOTE' ? 'AVOIR' : 'REÇU DE PAIEMENT',
      { align: 'center' }
    )
    doc.moveDown(0.5)
    doc.fontSize(11).font('Helvetica').fillColor('#666666').text(
      `N° ${receipt.receiptNumber}`,
      { align: 'center' }
    )

    // === INFO ÉLÈVE ===
    doc.moveDown(1.5)
    const studentName = `${receipt.student.firstName} ${receipt.student.lastName}`
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text('ÉLÈVE', 50, doc.y)
    doc.moveDown(0.3)
    doc.font('Helvetica').fontSize(10).fillColor('#333333')
    doc.text(`Nom : ${studentName}`, 50, doc.y)
    doc.text(`Matricule : ${receipt.student.matricule}`, 50, doc.y)
    if (enrollment?.classroom) {
      doc.text(`Classe : ${enrollment.classroom.name} (${enrollment.classroom.directorate.name})`, 50, doc.y)
    }

    // === DÉTAILS PAIEMENT ===
    doc.moveDown(1)
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text('DÉTAILS DU PAIEMENT', 50, doc.y)
    doc.moveDown(0.3)
    doc.font('Helvetica').fontSize(10).fillColor('#333333')

    const amount = receipt.amountCents / 100
    const formattedAmount = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: receipt.currency,
      maximumFractionDigits: 2,
    }).format(amount)

    doc.text(`Montant : ${formattedAmount}`, 50, doc.y)
    const methodLabel: Record<string, string> = {
      CASH: '💵 Espèces (Caisse)',
      BANK: '🏦 Banque (Virement)',
      MOBILE_MONEY: '📱 Mobile Money',
      CARD: '💳 Carte bancaire',
    }
    doc.text(`Moyen de paiement : ${methodLabel[receipt.paymentMethod] || receipt.paymentMethod}`, 50, doc.y)
    if (receipt.paymentProvider) {
      doc.text(`Provider : ${receipt.paymentProvider}`, 50, doc.y)
    }
    if (receipt.transactionReference) {
      doc.text(`Référence transaction : ${receipt.transactionReference}`, 50, doc.y)
    }
    if (receipt.payerName) {
      doc.text(`Payeur : ${receipt.payerName}`, 50, doc.y)
    }
    if (receipt.payerPhone) {
      doc.text(`Téléphone : ${receipt.payerPhone}`, 50, doc.y)
    }
    doc.text(`Date d'émission : ${receipt.issuedAt.toLocaleString('fr-FR')}`, 50, doc.y)
    doc.text(`Comptable : ${receipt.accountant.firstName} ${receipt.accountant.lastName}`, 50, doc.y)

    // === DETTE LIÉE ===
    if (debtInfo) {
      doc.moveDown(1)
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text('FRAIS CONCERNÉ', 50, doc.y)
      doc.moveDown(0.3)
      doc.font('Helvetica').fontSize(10).fillColor('#333333')
      doc.text(`Libellé : ${debtInfo.invoiceLineConfig.name}`, 50, doc.y)
      if (debtInfo.period) doc.text(`Période : ${debtInfo.period}`, 50, doc.y)
      doc.text(`Montant dû : ${(debtInfo.amountDueCents / 100).toLocaleString('fr-FR')} ${debtInfo.currency}`, 50, doc.y)
      doc.text(`Total payé : ${(debtInfo.amountPaidCents / 100).toLocaleString('fr-FR')} ${debtInfo.currency}`, 50, doc.y)
      const remaining = (debtInfo.amountDueCents - debtInfo.reductionAmountCents - debtInfo.amountPaidCents) / 100
      doc.text(`Solde restant : ${remaining.toLocaleString('fr-FR')} ${debtInfo.currency}`, 50, doc.y)
    }

    // === ANNULATION ===
    if (receipt.cancelledAt) {
      doc.moveDown(1.5)
      doc.fillColor('#DC2626').font('Helvetica-Bold').fontSize(14).text('⚠️ REÇU ANNULÉ', 50, doc.y, { align: 'center' })
      doc.font('Helvetica').fontSize(10).fillColor('#DC2626')
      doc.text(`Date d'annulation : ${receipt.cancelledAt.toLocaleString('fr-FR')}`, 50, doc.y, { align: 'center' })
      if (receipt.cancellationReason) {
        doc.text(`Motif : ${receipt.cancellationReason}`, 50, doc.y, { align: 'center' })
      }
    }

    // === QR CODE ===
    doc.moveDown(1.5)
    const qrImageBuffer = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64')
    doc.image(qrImageBuffer, 50, doc.y, { width: 100, height: 100 })

    // Texte à droite du QR
    doc.fontSize(9).font('Helvetica').fillColor('#666666')
    const qrTextY = doc.y + 5
    doc.text('Scannez pour vérifier', 170, qrTextY)
    doc.text("l'authenticité du reçu", 170, qrTextY + 12)
    doc.moveDown(2)

    // === SIGNATURE ===
    doc.moveDown(2)
    doc.moveTo(50, doc.y).lineTo(200, doc.y).strokeColor('#000000').lineWidth(1).stroke()
    doc.fontSize(10).font('Helvetica').fillColor('#333333').text('Signature & Cachet du Comptable', 50, doc.y + 5)

    doc.moveTo(395, doc.y - 15).lineTo(545, doc.y - 15).stroke()
    doc.text('Tampon officiel', 425, doc.y + 5)

    // === MENTIONS LÉGALES ===
    doc.moveDown(3)
    doc.fontSize(7).font('Helvetica-Oblique').fillColor('#888888')
    doc.text(
      'Ce reçu est infalsifiable. Numérotation chronologique stricte. Signature HMAC-SHA256 intégrée au QR code. ' +
      'En cas d\'erreur, une annulation via avoir (CREDIT_NOTE) sera émise — aucune suppression possible.',
      50, doc.y, { align: 'center', width: 495 }
    )
    doc.text(
      `Signature numérique : ${receipt.signature.substring(0, 32)}...`,
      50, doc.y + 10, { align: 'center', width: 495 }
    )

    // === PIED DE PAGE ===
    doc.fontSize(8).font('Helvetica').fillColor('#AAAAAA').text(
      `Généré le ${new Date().toLocaleString('fr-FR')} • SmartShule © 2026-2027`,
      50, 800, { align: 'center', width: 495 }
    )

    doc.end()

    const pdfBuffer = await pdfPromise

    // Incrémenter le compteur d'impressions
    await db.receipt.update({
      where: { id: receiptId },
      data: { printedCount: { increment: 1 } },
    })

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="recu-${receipt.receiptNumber}.pdf"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (err) {
    console.error('[api/exports/receipt-v2] Error:', err)
    return NextResponse.json(
      { error: (err as Error).message || 'Erreur génération PDF' },
      { status: 500 }
    )
  }
}
