// SmartShule — API Carte d'élève PDF avec QR code
// ============================================================
// GET /api/exports/student-card?studentId=X
// Génère une carte d'élève format carte de visite (90mm x 55mm)
// avec : photo, matricule, nom, classe, année, QR code de vérification

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
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const studentId = req.nextUrl.searchParams.get('studentId')
    if (!studentId) return NextResponse.json({ error: 'studentId obligatoire' }, { status: 400 })

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ error: 'École introuvable' }, { status: 404 })

    const student = await db.student.findUnique({
      where: { id: studentId },
      include: {
        school: true,
        enrollments: {
          where: { status: 'ACTIVE' },
          include: { classroom: { include: { directorate: true } }, academicYear: true },
          take: 1,
        },
      },
    })

    if (!student || student.schoolId !== schoolId) {
      return NextResponse.json({ error: 'Élève introuvable' }, { status: 404 })
    }

    const school = student.school
    const enrollment = student.enrollments[0]
    const classroom = enrollment?.classroom

    // Données pour le QR code
    const qrData = JSON.stringify({
      type: 'STUDENT_CARD',
      mat: student.matricule,
      name: `${student.firstName} ${student.lastName}`,
      school: school.name,
      year: enrollment?.academicYear?.label || '',
    })
    const qrDataUrl = await QRCode.toDataURL(qrData, { width: 150, margin: 1 })

    // === GÉNÉRATION PDF ===
    // Format carte : 90mm x 55mm = ~255pt x 156pt (à 72 DPI)
    // On utilise A4 horizontal et on place la carte au centre
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 })
    const chunks: Buffer[] = []
    doc.on('data', (chunk) => chunks.push(chunk))
    const pdfPromise = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)))
    })

    // Positionner la carte au centre de la page A4 paysage
    const cardW = 280
    const cardH = 180
    const cardX = (doc.page.width - cardW) / 2
    const cardY = (doc.page.height - cardH) / 2

    // === FOND DE LA CARTE ===
    doc.roundedRect(cardX, cardY, cardW, cardH, 12)
    doc.fillAndStroke('#FFFFFF', school.primaryColor || '#2563EB')

    // Bandeau supérieur (couleur école)
    doc.roundedRect(cardX, cardY, cardW, 40, 12)
    doc.fill(school.primaryColor || '#2563EB')
    // Masquer le bas du bandeau pour ne pas arrondir le bas
    doc.rect(cardX, cardY + 20, cardW, 20).fill(school.primaryColor || '#2563EB')

    // Nom de l'école
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#FFFFFF')
    doc.text(school.name, cardX + 10, cardY + 8, { width: cardW - 20, align: 'center' })
    if (school.slogan) {
      doc.fontSize(6).font('Helvetica-Oblique')
      doc.text(school.slogan, cardX + 10, cardY + 24, { width: cardW - 20, align: 'center' })
    }

    // === SECTION INFOS ÉLÈVE ===
    const infoY = cardY + 50

    // Matricule (en haut à gauche)
    doc.fontSize(8).font('Helvetica-Bold').fillColor(school.primaryColor || '#2563EB')
    doc.text('CARTE D\'ÉLÈVE', cardX + 10, infoY)
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000')
    doc.text(student.matricule, cardX + 10, infoY + 12)

    // Nom
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000')
    doc.text(`${student.firstName} ${student.lastName}`, cardX + 10, infoY + 30)

    // Classe
    if (classroom) {
      doc.fontSize(8).font('Helvetica').fillColor('#666666')
      doc.text(`Classe: ${classroom.name}`, cardX + 10, infoY + 48)
      doc.text(`Direction: ${classroom.directorate.name}`, cardX + 10, infoY + 60)
    }

    // Année académique
    if (enrollment?.academicYear) {
      doc.text(`Année: ${enrollment.academicYear.label}`, cardX + 10, infoY + 72)
    }

    // === QR CODE (à droite) ===
    const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64')
    doc.image(qrBuffer, cardX + cardW - 80, infoY + 5, { width: 70, height: 70 })

    doc.fontSize(6).font('Helvetica-Oblique').fillColor('#999999')
    doc.text('Scannez pour vérifier', cardX + cardW - 80, infoY + 78, { width: 70, align: 'center' })

    // === PIED DE CARTE ===
    doc.fontSize(6).font('Helvetica').fillColor('#AAAAAA')
    doc.text(`Émis le ${new Date().toLocaleDateString('fr-FR')} · SmartShule © 2026-2027`, cardX + 10, cardY + cardH - 15, { width: cardW - 20, align: 'center' })

    // Ligne de sécurité
    doc.moveTo(cardX + 10, cardY + cardH - 20)
    doc.lineTo(cardX + cardW - 10, cardY + cardH - 20)
    doc.strokeColor('#E0E0E0').lineWidth(0.5).stroke()

    doc.end()
    const pdfBuffer = await pdfPromise

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="carte-${student.matricule}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[student-card] Error:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
