// SmartShule — API Attestation de fréquentation PDF
// ============================================================
// GET /api/exports/attestation?studentId=X
// Génère une attestation de fréquentation scolaire officielle

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { hasRole } from '@/lib/rbac'
import PDFDocument from 'pdfkit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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
          include: { classroom: { include: { directorate: true, section: true, option: true } }, academicYear: true },
          take: 1,
        },
        guardianLinks: { include: { guardian: true }, take: 1 },
      },
    })

    if (!student || student.schoolId !== schoolId) {
      return NextResponse.json({ error: 'Élève introuvable' }, { status: 404 })
    }

    const school = student.school
    const enrollment = student.enrollments[0]
    const classroom = enrollment?.classroom
    const guardian = student.guardianLinks[0]?.guardian

    // === GÉNÉRATION PDF ===
    const doc = new PDFDocument({ size: 'A4', margin: 60 })
    const chunks: Buffer[] = []
    doc.on('data', (c) => chunks.push(c))
    const pdfPromise = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))))

    // En-tête école
    doc.fontSize(22).font('Helvetica-Bold').fillColor(school.primaryColor || '#2563EB')
    doc.text(school.name, { align: 'center' })
    if (school.slogan) {
      doc.fontSize(10).font('Helvetica-Oblique').fillColor('#666').text(school.slogan, { align: 'center' })
    }
    if (school.address || school.phone) {
      doc.fontSize(9).font('Helvetica').fillColor('#888')
      doc.text([school.address, school.phone, school.email].filter(Boolean).join(' · '), { align: 'center' })
    }

    // Ligne décorative
    doc.moveTo(60, 130).lineTo(535, 130).strokeColor(school.primaryColor || '#2563EB').lineWidth(2).stroke()

    // Titre
    doc.moveDown(2)
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#000').text('ATTESTATION DE FRÉQUENTATION SCOLAIRE', { align: 'center' })
    doc.moveDown(1)

    // Corps
    doc.fontSize(11).font('Helvetica').fillColor('#333')
    const yearLabel = enrollment?.academicYear?.label || new Date().getFullYear().toString()
    const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

    doc.text(
      `Je soussigné(e), Directeur(trice) de ${school.name}, atteste par la présente que :`,
      { align: 'justify', indent: 20 }
    )
    doc.moveDown(0.5)

    doc.fontSize(14).font('Helvetica-Bold').fillColor(school.primaryColor || '#2563EB')
    doc.text(`${student.firstName} ${student.lastName}`, { align: 'center' })
    doc.moveDown(0.3)

    doc.fontSize(11).font('Helvetica').fillColor('#333')
    doc.text(`Matricule : ${student.matricule}`, { align: 'center' })
    doc.moveDown(0.5)

    doc.fontSize(11).font('Helvetica').fillColor('#333')
    if (classroom) {
      let classInfo = `est régulièrement inscrit(e) en ${classroom.name}`
      if (classroom.directorate) classInfo += ` (Direction: ${classroom.directorate.name})`
      if (classroom.option) classInfo += ` - Option: ${classroom.option.name}`
      classInfo += ` pour l'année académique ${yearLabel}.`
      doc.text(classInfo, { align: 'justify', indent: 20 })
    }

    doc.moveDown(0.5)
    doc.text(
      `L'élève est en règle avec l'administration et fréquente régulièrement les cours dans notre établissement.`,
      { align: 'justify', indent: 20 }
    )

    doc.moveDown(0.5)
    if (guardian) {
      doc.text(`Parent/Tuteur : ${guardian.firstName} ${guardian.lastName}`, { align: 'justify', indent: 20 })
    }

    doc.moveDown(1)
    doc.text(`En foi de quoi, la présente attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit.`)

    doc.moveDown(1.5)
    doc.text(`Fait à ${school.address?.split(',')[0] || 'Kinshasa'}, le ${today}`, { align: 'right' })

    // Signatures
    doc.moveDown(2)
    const sigY = doc.y
    doc.moveTo(60, sigY).lineTo(220, sigY).stroke()
    doc.moveTo(380, sigY).lineTo(535, sigY).stroke()
    doc.fontSize(10).font('Helvetica').fillColor('#333')
    doc.text('Le Secrétaire', 60, sigY + 5)
    doc.text('Le Directeur (Cachet)', 400, sigY + 5)

    // Pied de page
    doc.fontSize(7).font('Helvetica-Oblique').fillColor('#AAA')
    doc.text(`Attestation générée le ${today} · SmartShule © 2026-2027 · Document officiel`, 60, 800, { align: 'center', width: 475 })

    doc.end()
    const pdfBuffer = await pdfPromise

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="attestation-${student.matricule}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[attestation] Error:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
