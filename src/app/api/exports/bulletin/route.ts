// SmartShule — API Bulletin de notes PDF
// ============================================================
// GET /api/exports/bulletin?studentId=X&periodId=Y
//
// Génère un bulletin scolaire avec :
//   - En-tête école
//   - Infos élève (nom, matricule, classe, période)
//   - Tableau des notes par matière
//   - Moyenne générale + rang + mention
//   - Appreciation du professeur principal
//   - Signature Direction

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { hasRole } from '@/lib/rbac'
import PDFDocument from 'pdfkit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const studentId = req.nextUrl.searchParams.get('studentId')
    const periodId = req.nextUrl.searchParams.get('periodId')
    if (!studentId) {
      return NextResponse.json({ error: 'studentId obligatoire' }, { status: 400 })
    }

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) {
      return NextResponse.json({ error: 'École introuvable' }, { status: 404 })
    }

    const student = await db.student.findUnique({
      where: { id: studentId },
      include: {
        school: true,
        enrollments: {
          where: { status: 'ACTIVE' },
          include: {
            classroom: { include: { directorate: true, section: true, option: true } },
            academicYear: true,
          },
          take: 1,
        },
      },
    })

    if (!student || student.schoolId !== schoolId) {
      return NextResponse.json({ error: 'Élève introuvable' }, { status: 404 })
    }

    // Vérifier périmètre
    if (user.role === 'PARENT') {
      const guardian = await db.guardian.findFirst({
        where: { userId: user.id },
        include: { studentLinks: { select: { studentId: true } } },
      })
      const studentIds = guardian?.studentLinks.map((l) => l.studentId) || []
      if (!studentIds.includes(studentId)) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
      }
    } else if (user.role === 'STUDENT' && student.userId !== user.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    // Récupérer période
    let period: any = null
    if (periodId) {
      period = await db.evaluationPeriod.findUnique({ where: { id: periodId } })
    } else {
      period = await db.evaluationPeriod.findFirst({
        where: { schoolId, status: 'ACTIVE' },
        orderBy: { startDate: 'desc' },
      })
    }

    // Récupérer les notes
    const grades = await db.grade.findMany({
      where: {
        studentId,
        status: 'PUBLISHED',
        ...(periodId ? { periodId } : {}),
      },
      include: { subject: true },
      orderBy: { subject: { name: 'asc' } },
    })

    // Récupérer l'attendance pour la période
    const periodStart = period?.startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    const periodEnd = period?.endDate || new Date()
    const attendanceStats = await db.attendance.groupBy({
      by: ['status'],
      where: {
        studentId,
        date: { gte: periodStart, lte: periodEnd },
      },
      _count: true,
    })

    // === GÉNÉRATION PDF ===
    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    const chunks: Buffer[] = []
    doc.on('data', (chunk) => chunks.push(chunk))

    const pdfPromise = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)))
    })

    const school = student.school
    const enrollment = student.enrollments[0]
    const classroom = enrollment?.classroom

    // === EN-TÊTE ===
    doc.fontSize(22).font('Helvetica-Bold').fillColor(school.primaryColor || '#2563EB').text(school.name, { align: 'center' })
    if (school.slogan) {
      doc.fontSize(10).font('Helvetica-Oblique').fillColor('#666666').text(school.slogan, { align: 'center' })
    }
    doc.fontSize(9).font('Helvetica').fillColor('#888888').text(
      [school.address, school.phone, school.email].filter(Boolean).join(' • '),
      { align: 'center' }
    )

    doc.moveTo(50, 130).lineTo(545, 130).strokeColor(school.primaryColor || '#2563EB').lineWidth(2).stroke()

    // === TITRE ===
    doc.moveDown(1.5)
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#000000').text(
      `BULLETIN DE NOTES — ${period?.name || 'Période en cours'}`,
      { align: 'center' }
    )
    if (period) {
      doc.fontSize(10).font('Helvetica').fillColor('#666666').text(
        `Du ${period.startDate.toLocaleDateString('fr-FR')} au ${period.endDate.toLocaleDateString('fr-FR')}`,
        { align: 'center' }
      )
    }

    // === INFOS ÉLÈVE ===
    doc.moveDown(1.5)
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text('IDENTITÉ DE L\'ÉLÈVE', 50, doc.y)
    doc.moveDown(0.3)
    doc.font('Helvetica').fontSize(10).fillColor('#333333')
    doc.text(`Nom : ${student.firstName} ${student.lastName}`, 50, doc.y)
    doc.text(`Matricule : ${student.matricule}`, 50, doc.y)
    if (classroom) {
      doc.text(`Classe : ${classroom.name}`, 50, doc.y)
      if (classroom.directorate) doc.text(`Direction : ${classroom.directorate.name}`, 50, doc.y)
      if (classroom.section) doc.text(`Section : ${classroom.section.name}`, 50, doc.y)
      if (classroom.option) doc.text(`Option : ${classroom.option.name}`, 50, doc.y)
    }
    if (enrollment?.academicYear) {
      doc.text(`Année académique : ${enrollment.academicYear.label}`, 50, doc.y)
    }

    // === TABLEAU DES NOTES ===
    doc.moveDown(1.5)
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text('RÉSULTATS PAR MATIÈRE', 50, doc.y)
    doc.moveDown(0.5)

    const tableTop = doc.y
    const colWidths = [180, 80, 80, 80, 125]
    const colX = [50, 230, 310, 390, 470]

    // En-tête tableau
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#FFFFFF')
    doc.rect(50, tableTop, 495, 20).fill(school.primaryColor || '#2563EB')
    const headers = ['Matière', 'Score', 'Max', 'Moyenne %', 'Appréciation']
    headers.forEach((h, i) => {
      doc.text(h, colX[i], tableTop + 6, { width: colWidths[i], align: 'center' })
    })

    // Lignes
    let y = tableTop + 25
    doc.font('Helvetica').fontSize(9).fillColor('#333333')

    if (grades.length === 0) {
      doc.text('Aucune note publiée pour cette période', 50, y + 10, { align: 'center', width: 495 })
      y += 30
    } else {
      for (const g of grades as any) {
        const percent = g.maxScore > 0 ? (g.score / g.maxScore) * 100 : 0
        const bgColor = percent >= 50 ? '#F0FDF4' : '#FEF2F2'
        doc.rect(50, y - 5, 495, 18).fill(bgColor)
        doc.fillColor('#333333')
        doc.text(g.subject.name, colX[0], y, { width: colWidths[0] })
        doc.text(g.score.toFixed(2), colX[1], y, { width: colWidths[1], align: 'center' })
        doc.text(g.maxScore.toFixed(2), colX[2], y, { width: colWidths[2], align: 'center' })
        doc.text(`${percent.toFixed(1)}%`, colX[3], y, { width: colWidths[3], align: 'center' })
        const appreciation = percent >= 80 ? 'Très Bien' : percent >= 70 ? 'Bien' : percent >= 60 ? 'Assez Bien' : percent >= 50 ? 'Passable' : 'Insuffisant'
        doc.text(appreciation, colX[4], y, { width: colWidths[4], align: 'center' })
        y += 20
      }
    }

    // === MOYENNE GÉNÉRALE ===
    doc.moveDown(1)
    const totalScore = grades.reduce((sum, g) => sum + g.score * g.weight, 0)
    const totalMax = grades.reduce((sum, g) => sum + g.maxScore * g.weight, 0)
    const average = totalMax > 0 ? (totalScore / totalMax) * 100 : 0
    const mention = average >= 80 ? 'Très Bien' : average >= 70 ? 'Bien' : average >= 60 ? 'Assez Bien' : average >= 50 ? 'Passable' : 'Insuffisant'

    doc.font('Helvetica-Bold').fontSize(12).fillColor('#000000')
    doc.text(`MOYENNE GÉNÉRALE : ${average.toFixed(2)}%`, 50, y + 10)
    doc.text(`MENTION : ${mention}`, 300, y + 10)

    // === ASSIDUITÉ ===
    doc.moveDown(2)
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000').text('ASSIDUITÉ', 50, doc.y)
    doc.moveDown(0.3)
    doc.font('Helvetica').fontSize(10).fillColor('#333333')
    const presentCount = attendanceStats.find((s) => s.status === 'PRESENT')?._count ?? 0
    const absentCount = attendanceStats.find((s) => s.status === 'ABSENT')?._count ?? 0
    const lateCount = attendanceStats.find((s) => s.status === 'LATE')?._count ?? 0
    const excusedCount = attendanceStats.find((s) => s.status === 'EXCUSED')?._count ?? 0
    doc.text(`Présences : ${presentCount} | Absences : ${absentCount} | Retards : ${lateCount} | Excusées : ${excusedCount}`, 50, doc.y)

    // === SIGNATURES ===
    doc.moveDown(3)
    const sigY = doc.y
    doc.moveTo(50, sigY).lineTo(200, sigY).stroke()
    doc.moveTo(395, sigY).lineTo(545, sigY).stroke()
    doc.fontSize(10).font('Helvetica').fillColor('#333333')
    doc.text('Professeur principal', 50, sigY + 5)
    doc.text('Direction', 425, sigY + 5)

    // === MENTIONS LÉGALES ===
    doc.fontSize(7).font('Helvetica-Oblique').fillColor('#888888')
    doc.text(
      `Bulletin généré le ${new Date().toLocaleString('fr-FR')} • SmartShule © 2026-2027`,
      50, 800, { align: 'center', width: 495 }
    )

    doc.end()

    const pdfBuffer = await pdfPromise

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="bulletin-${student.matricule}-${period?.code || 'current'}.pdf"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (err) {
    console.error('[api/exports/bulletin] Error:', err)
    return NextResponse.json(
      { error: (err as Error).message || 'Erreur génération PDF' },
      { status: 500 }
    )
  }
}
