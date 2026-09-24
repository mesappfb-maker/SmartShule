// SmartShule — API : Génération PDF du Dossier complet d'un élève
// ============================================================
// GET /api/exports/student-dossier?studentId=X
//
// Génère un PDF synthèse de 4-6 pages contenant :
//   - Page 1 : En-tête école + Identité élève + Photo + Affectation
//   - Page 2 : Dossier familial (parents, tuteurs, contacts)
//   - Page 3 : Synthèse financière (Dû, Payé, Reste, Dettes détaillées, Reçus)
//   - Page 4 : Notes par matière et bulletins
//   - Page 5 : Présences (IQA, absences, retards)
//   - Pied de page avec signature numérique + date de génération

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { logAudit } from '@/lib/audit'
import PDFDocument from 'pdfkit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ============================================================
// Helpers de formatage
// ============================================================
function fmtDate(iso: Date | string | null): string {
  if (!iso) return '—'
  try {
    const d = typeof iso === 'string' ? new Date(iso) : iso
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return '—'
  }
}

function fmtDateTime(iso: Date | string | null): string {
  if (!iso) return '—'
  try {
    const d = typeof iso === 'string' ? new Date(iso) : iso
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function fmtMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency || 'CDF',
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

function getRelLabel(rel: string): string {
  const map: Record<string, string> = {
    PERE: 'Père',
    MERE: 'Mère',
    TUTEUR: 'Tuteur légal',
    AUTRE: 'Autre',
  }
  return map[rel] || rel
}

function getStatusLabel(s: string): string {
  const map: Record<string, string> = {
    ACTIVE: 'Actif',
    ARCHIVED: 'Archivé',
    TRANSFERRED: 'Transféré',
  }
  return map[s] || s
}

function getFinStatusLabel(s: string): string {
  const map: Record<string, string> = {
    REGULAR: 'Régulier',
    LITIGATION: 'En litige',
    BLOCKED: 'Bloqué',
  }
  return map[s] || s
}

function getPaymentMethodLabel(method: string): string {
  const map: Record<string, string> = {
    CASH: 'Espèces',
    BANK: 'Banque',
    MOBILE_MONEY: 'Mobile Money',
    CARD: 'Carte',
  }
  return map[method] || method
}

function getDebtStatusLabel(s: string): string {
  const map: Record<string, string> = {
    OPEN: 'À payer',
    PARTIALLY_PAID: 'Partiel',
    PAID: 'Soldé',
    CANCELLED: 'Annulé',
  }
  return map[s] || s
}

function getPeriodLabel(period: string): string {
  if (period === 'T1') return '1er Trimestre'
  if (period === 'T2') return '2ème Trimestre'
  if (period === 'T3') return '3ème Trimestre'
  if (period === 'NON_PERIOD') return 'Hors période'
  return period
}

function getAttendanceLabel(s: string): string {
  const map: Record<string, string> = {
    PRESENT: 'Présent',
    LATE: 'Retard',
    ABSENT: 'Absent',
    EXCUSED: 'Excusé',
  }
  return map[s] || s
}

// ============================================================
// Route principale
// ============================================================
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const allowedRoles = ['DIRECTION', 'SECRETAIRE', 'ADMIN', 'ACCOUNTANT', 'TEACHER']
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { error: 'Action réservée au personnel autorisé.' },
        { status: 403 }
      )
    }

    const studentId = req.nextUrl.searchParams.get('studentId')
    if (!studentId) {
      return NextResponse.json({ error: 'studentId obligatoire' }, { status: 400 })
    }

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) {
      return NextResponse.json({ error: 'École introuvable' }, { status: 404 })
    }

    // -------------------------------------------------------
    // Récupérer TOUTES les données de l'élève
    // -------------------------------------------------------
    const student = await db.student.findFirst({
      where: { id: studentId, schoolId },
      include: {
        school: true,
        enrollments: {
          include: {
            classroom: { include: { directorate: true, section: true, option: true } },
            academicYear: true,
          },
          orderBy: { enrolledAt: 'desc' },
        },
        financialStatus: true,
        guardianLinks: { include: { guardian: true }, orderBy: { isPrimary: 'desc' } },
        user: { select: { email: true, phone: true, accountStatus: true, lastLoginAt: true } },
      },
    })

    if (!student) {
      return NextResponse.json({ error: 'Élève introuvable' }, { status: 404 })
    }

    const school = student.school
    const currentEnrollment = student.enrollments.find((e) => e.status === 'ACTIVE') || student.enrollments[0]
    const finStatus = student.financialStatus?.[0]

    // Récupérer les dettes + reçus + notes + présences en parallèle
    const [studentDebts, receipts, grades, reportCards, attendanceSummary, recentAttendances] = await Promise.all([
      db.studentDebt.findMany({
        where: { studentId, schoolId },
        include: {
          invoiceLineConfig: { select: { name: true, description: true } },
          directorate: { select: { name: true } },
          academicYear: { select: { label: true } },
          scholarship: { select: { name: true, reductionPercent: true } },
        },
        orderBy: [{ academicYearId: 'desc' }, { period: 'asc' }],
      }),
      db.receipt.findMany({
        where: { studentId, schoolId },
        orderBy: { issuedAt: 'desc' },
        take: 30,
        select: {
          id: true,
          receiptNumber: true,
          receiptType: true,
          amountCents: true,
          currency: true,
          paymentMethod: true,
          paymentProvider: true,
          payerName: true,
          issuedAt: true,
          cancelledAt: true,
        },
      }),
      db.grade.findMany({
        where: { studentId, schoolId, status: 'PUBLISHED' },
        include: { subject: { select: { name: true } } },
        orderBy: { publishedAt: 'desc' },
        take: 50,
      }),
      db.reportCard.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      db.attendance.groupBy({
        by: ['status'],
        where: { studentId, schoolId },
        _count: true,
      }),
      db.attendance.findMany({
        where: { studentId, schoolId, status: { in: ['ABSENT', 'LATE'] } },
        include: {
          course: {
            select: {
              title: true,
              subject: { select: { name: true } },
            },
          },
        },
        orderBy: { date: 'desc' },
        take: 15,
      }),
    ])

    // Calculs financiers
    const totalDueCents = studentDebts.reduce((s, d) => s + (d.amountDueCents || 0), 0)
    const totalPaidCents = studentDebts.reduce((s, d) => s + (d.amountPaidCents || 0), 0)
    const totalCancelledCents = studentDebts.reduce((s, d) => s + (d.amountCancelledCents || 0), 0)
    const currency = studentDebts[0]?.currency || school.currency || 'CDF'
    const remainingCents = totalDueCents - totalPaidCents - totalCancelledCents

    // Calculs assiduité
    const attSummary: Record<string, number> = { PRESENT: 0, LATE: 0, ABSENT: 0, EXCUSED: 0 }
    for (const g of attendanceSummary) attSummary[g.status] = g._count
    const totalAtt = attSummary.PRESENT + attSummary.LATE + attSummary.ABSENT + attSummary.EXCUSED
    const iqa = totalAtt > 0
      ? Math.max(0, 100 - ((100 * attSummary.ABSENT + 50 * attSummary.EXCUSED + 15 * attSummary.LATE) / totalAtt))
      : 100

    // Groupage des notes par période
    const gradesByPeriod: Record<string, Record<string, any>> = {}
    for (const g of grades) {
      const period = g.periodId || 'NON_PERIOD'
      if (!gradesByPeriod[period]) gradesByPeriod[period] = {}
      if (!gradesByPeriod[period][g.subjectId]) {
        gradesByPeriod[period][g.subjectId] = {
          subjectName: g.subject?.name || '—',
          grades: [],
          totalScore: 0,
          totalWeight: 0,
        }
      }
      gradesByPeriod[period][g.subjectId].grades.push({
        title: g.title,
        score: g.score,
        maxScore: g.maxScore,
        weight: g.weight,
      })
      const w = g.weight || 1
      gradesByPeriod[period][g.subjectId].totalScore += (g.score / g.maxScore) * 20 * w
      gradesByPeriod[period][g.subjectId].totalWeight += w
    }

    // -------------------------------------------------------
    // Génération PDF
    // -------------------------------------------------------
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true })
    const chunks: Buffer[] = []
    doc.on('data', (c) => chunks.push(c))
    const pdfPromise = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))))

    // Couleurs
    const primary = school.primaryColor || '#2563EB'
    const secondary = school.secondaryColor || '#0F766E'
    const accent = school.tertiaryColor || '#F59E0B'

    // ==========================================
    // PAGE 1 — IDENTITÉ
    // ==========================================
    // En-tête école
    doc.fontSize(20).font('Helvetica-Bold').fillColor(primary)
    doc.text(school.name, { align: 'center' })
    if (school.slogan) {
      doc.fontSize(9).font('Helvetica-Oblique').fillColor('#666')
      doc.text(school.slogan, { align: 'center' })
    }
    if (school.address || school.phone) {
      doc.fontSize(8).font('Helvetica').fillColor('#888')
      doc.text([school.address, school.phone, school.email].filter(Boolean).join(' · '), { align: 'center' })
    }
    // Ligne décorative
    doc.moveTo(50, 120).lineTo(545, 120).strokeColor(primary).lineWidth(2).stroke()
    doc.moveDown(1.5)

    // Titre
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#000')
    doc.text('DOSSIER ÉLÈVE — SYNTHÈSE COMPLÈTE', { align: 'center', underline: true })
    doc.moveDown(0.5)
    doc.fontSize(9).font('Helvetica-Oblique').fillColor('#666')
    doc.text(`Généré le ${fmtDateTime(new Date())} par ${user.displayName} (${user.role})`, { align: 'center' })
    doc.moveDown(1)

    // Cadre identité
    doc.fontSize(13).font('Helvetica-Bold').fillColor(primary)
    doc.text('1. IDENTITÉ', { underline: true })
    doc.moveDown(0.3)

    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000')
    doc.text(`${student.firstName} ${student.lastName}`, { align: 'left' })
    doc.fontSize(10).font('Helvetica').fillColor('#333')
    doc.text(`Matricule : ${student.matricule}`)
    doc.text(`Genre : ${student.gender === 'M' ? 'Masculin' : student.gender === 'F' ? 'Féminin' : '—'}`)
    doc.text(`Date de naissance : ${fmtDate(student.birthDate)}`)
    doc.text(`Statut : ${getStatusLabel(student.status)}`)
    doc.text(`Inscrit le : ${fmtDate(student.createdAt)}`)
    if (student.user) {
      doc.text(`Compte utilisateur : ${student.user.email || '—'}`)
      doc.text(`Téléphone : ${student.user.phone || '—'}`)
    }
    doc.moveDown(0.5)

    // Affectation actuelle
    doc.fontSize(12).font('Helvetica-Bold').fillColor(secondary)
    doc.text('Affectation actuelle', { underline: true })
    doc.moveDown(0.2)
    doc.fontSize(10).font('Helvetica').fillColor('#333')
    if (currentEnrollment) {
      const c = currentEnrollment.classroom
      doc.text(`Classe : ${c.name}`)
      doc.text(`Direction : ${c.directorate.name}`)
      if (c.section?.name) doc.text(`Section : ${c.section.name}`)
      if (c.option?.name) doc.text(`Option : ${c.option.name}`)
      doc.text(`Année académique : ${currentEnrollment.academicYear?.label || '—'}`)
    } else {
      doc.text('Aucune inscription active.')
    }
    doc.moveDown(0.5)

    // Statut financier
    if (finStatus && finStatus.status !== 'REGULAR') {
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#B91C1C')
      doc.text('⚠ Statut financier à risque', { underline: true })
      doc.moveDown(0.2)
      doc.fontSize(10).font('Helvetica').fillColor('#333')
      doc.text(`Statut : ${getFinStatusLabel(finStatus.status)}`)
      if (finStatus.reason) doc.text(`Motif : ${finStatus.reason}`)
      if (finStatus.updatedAt) doc.text(`Mis à jour le : ${fmtDate(finStatus.updatedAt)}`)
    }

    // ==========================================
    // PAGE 2 — DOSSIER FAMILIAL
    // ==========================================
    doc.addPage()
    doc.fontSize(13).font('Helvetica-Bold').fillColor(primary)
    doc.text('2. DOSSIER FAMILIAL', { underline: true })
    doc.moveDown(0.5)

    if (student.guardianLinks.length === 0) {
      doc.fontSize(10).font('Helvetica-Oblique').fillColor('#666')
      doc.text('Aucun parent ou tuteur enregistré.')
    } else {
      for (const link of student.guardianLinks) {
        const g = link.guardian
        doc.fontSize(11).font('Helvetica-Bold').fillColor(secondary)
        doc.text(`${g.firstName} ${g.lastName} (${getRelLabel(link.relationship)})${link.isPrimary ? ' — Principal' : ''}`)
        doc.fontSize(10).font('Helvetica').fillColor('#333')
        if (g.phone) doc.text(`  Téléphone : ${g.phone}`)
        if (g.email) doc.text(`  Email : ${g.email}`)
        if (g.profession) doc.text(`  Profession : ${g.profession}`)
        if (g.address) doc.text(`  Adresse : ${g.address}`)
        doc.moveDown(0.4)
      }
    }

    // ==========================================
    // PAGE 3 — FINANCES
    // ==========================================
    doc.addPage()
    doc.fontSize(13).font('Helvetica-Bold').fillColor(primary)
    doc.text('3. SYNTHÈSE FINANCIÈRE', { underline: true })
    doc.moveDown(0.3)

    // Cartes synthèse
    const summaryY = doc.y
    const cardW = 145
    const cardH = 50

    function drawCard(x: number, y: number, label: string, value: string, color: string) {
      doc.rect(x, y, cardW, cardH).fillColor(color).fill()
      doc.fontSize(8).font('Helvetica').fillColor('#FFF')
      doc.text(label, x + 8, y + 8, { width: cardW - 16 })
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#FFF')
      doc.text(value, x + 8, y + 22, { width: cardW - 16 })
    }

    drawCard(50, summaryY, 'TOTAL DÛ', fmtMoney(totalDueCents / 100, currency), '#2563EB')
    drawCard(50 + cardW + 8, summaryY, 'TOTAL PAYÉ', fmtMoney(totalPaidCents / 100, currency), '#059669')
    drawCard(50 + (cardW + 8) * 2, summaryY, 'RESTE À PAYER', fmtMoney(remainingCents / 100, currency), remainingCents > 0 ? '#DC2626' : '#059669')
    drawCard(50 + (cardW + 8) * 3, summaryY, 'ANNULATIONS', fmtMoney(totalCancelledCents / 100, currency), '#7C3AED')

    doc.y = summaryY + cardH + 20

    // Tableau des dettes
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000')
    doc.text('Décomposition des frais', { underline: true })
    doc.moveDown(0.3)

    if (studentDebts.length === 0) {
      doc.fontSize(10).font('Helvetica-Oblique').fillColor('#666')
      doc.text('Aucune dette enregistrée.')
    } else {
      // En-tête de table
      const tY = doc.y
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFF')
      doc.rect(50, tY, 495, 16).fillColor('#374151').fill()
      doc.fillColor('#FFF')
      doc.text('Frais', 55, tY + 4, { width: 130 })
      doc.text('Période', 190, tY + 4, { width: 60 })
      doc.text('Dû', 255, tY + 4, { width: 75, align: 'right' })
      doc.text('Payé', 330, tY + 4, { width: 75, align: 'right' })
      doc.text('Reste', 410, tY + 4, { width: 75, align: 'right' })
      doc.text('Statut', 490, tY + 4, { width: 55 })

      doc.y = tY + 16
      let rowY = doc.y

      for (const d of studentDebts.slice(0, 20)) {
        if (rowY > 750) {
          doc.addPage()
          rowY = doc.y
        }
        const remaining = ((d.amountDueCents || 0) - (d.amountPaidCents || 0) - (d.amountCancelledCents || 0)) / 100
        doc.rect(50, rowY, 495, 20).fillColor(rowY % 2 === 0 ? '#F9FAFB' : '#FFFFFF').fill()
        doc.fontSize(7).font('Helvetica').fillColor('#000')
        const feeName = d.invoiceLineConfig?.name || 'Frais'
        doc.text(feeName.length > 35 ? feeName.slice(0, 33) + '…' : feeName, 55, rowY + 6, { width: 130 })
        doc.text(d.period || '—', 190, rowY + 6, { width: 60 })
        doc.text(fmtMoney((d.amountDueCents || 0) / 100, d.currency), 255, rowY + 6, { width: 75, align: 'right' })
        doc.text(fmtMoney((d.amountPaidCents || 0) / 100, d.currency), 330, rowY + 6, { width: 75, align: 'right' })
        doc.fillColor(remaining > 0 ? '#DC2626' : '#059669')
        doc.text(fmtMoney(remaining, d.currency), 410, rowY + 6, { width: 75, align: 'right' })
        doc.fillColor('#000')
        doc.text(getDebtStatusLabel(d.status), 490, rowY + 6, { width: 55 })
        rowY += 20
      }
      doc.y = rowY + 5
    }

    // Reçus récents
    if (receipts.length > 0) {
      doc.moveDown(0.5)
      if (doc.y > 720) doc.addPage()
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#000')
      doc.text(`Reçus émis (${receipts.length} au total, ${Math.min(receipts.length, 10)} affichés)`, { underline: true })
      doc.moveDown(0.3)
      for (const r of receipts.slice(0, 10)) {
        if (doc.y > 760) { doc.addPage(); }
        const y = doc.y
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#000')
        doc.text(`${r.receiptNumber}`, 55, y, { continued: true })
        doc.font('Helvetica').fillColor('#666')
        doc.text(`  ·  ${fmtDate(r.issuedAt)}  ·  ${getPaymentMethodLabel(r.paymentMethod)}`)
        doc.text(`    ${fmtMoney(r.amountCents / 100, r.currency)}  ${r.cancelledAt ? '(ANNULÉ)' : ''}  ${r.payerName ? '— ' + r.payerName : ''}`, { indent: 0 })
        doc.y = y + 18
      }
    }

    // ==========================================
    // PAGE 4 — NOTES
    // ==========================================
    doc.addPage()
    doc.fontSize(13).font('Helvetica-Bold').fillColor(primary)
    doc.text('4. NOTES & BULLETINS', { underline: true })
    doc.moveDown(0.3)

    // Bulletins
    if (reportCards.length > 0) {
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#000')
      doc.text('Bulletins officiels', { underline: true })
      doc.moveDown(0.2)
      for (const rc of reportCards) {
        doc.fontSize(9).font('Helvetica').fillColor('#333')
        const avg = rc.average !== null ? `Moyenne: ${rc.average.toFixed(2)}/20` : 'Moyenne: —'
        const rank = rc.rank ? `Rang: ${rc.rank}` : ''
        doc.text(`• ${rc.period} — ${rc.status} — ${avg} ${rank}`)
        if (rc.appreciation) doc.text(`  Appréciation : ${rc.appreciation}`)
      }
      doc.moveDown(0.3)
    }

    // Notes par période
    const periodEntries = Object.entries(gradesByPeriod)
    if (periodEntries.length === 0) {
      doc.fontSize(10).font('Helvetica-Oblique').fillColor('#666')
      doc.text('Aucune note publiée.')
    } else {
      for (const [period, subjects] of periodEntries.slice(0, 3)) {
        if (doc.y > 720) doc.addPage()
        doc.fontSize(11).font('Helvetica-Bold').fillColor(secondary)
        doc.text(getPeriodLabel(period), { underline: true })
        doc.moveDown(0.2)
        const subjectsArr = Object.values(subjects)
        for (const s of subjectsArr) {
          if (doc.y > 770) doc.addPage()
          const avg = s.totalWeight > 0 ? (s.totalScore / s.totalWeight).toFixed(2) : '—'
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#000')
          doc.text(`${s.subjectName}`, { continued: true })
          doc.font('Helvetica').fillColor('#666')
          doc.text(`  —  Moyenne: ${avg}/20  (${s.grades.length} note(s))`)
        }
        doc.moveDown(0.3)
      }
    }

    // ==========================================
    // PAGE 5 — PRÉSENCES
    // ==========================================
    doc.addPage()
    doc.fontSize(13).font('Helvetica-Bold').fillColor(primary)
    doc.text('5. PRÉSENCES & ASSIDUITÉ', { underline: true })
    doc.moveDown(0.3)

    // IQA en évidence
    const iqaColor = iqa >= 90 ? '#059669' : iqa >= 75 ? '#D97706' : iqa >= 50 ? '#EA580C' : '#DC2626'
    doc.rect(50, doc.y, 495, 60).fillColor('#F3F4F6').fill()
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#666')
    doc.text('INDICATEUR QUALITÉ D\'ASSIDUITÉ (IQA)', 60, doc.y + 8, { width: 475, align: 'center' })
    doc.moveDown(0.5)
    doc.fontSize(28).font('Helvetica-Bold').fillColor(iqaColor)
    doc.text(`${iqa.toFixed(1)} / 100`, { align: 'center' })
    doc.y += 70

    doc.moveDown(0.3)
    doc.fontSize(10).font('Helvetica').fillColor('#333')
    doc.text(`Présences : ${attSummary.PRESENT}`)
    doc.text(`Retards : ${attSummary.LATE}`)
    doc.text(`Absences non excusées : ${attSummary.ABSENT}`)
    doc.text(`Absences excusées : ${attSummary.EXCUSED}`)
    doc.text(`Total séances : ${totalAtt}`)
    if (totalAtt > 0) {
      const rate = ((attSummary.PRESENT + attSummary.EXCUSED) / totalAtt) * 100
      doc.text(`Taux de présence : ${rate.toFixed(1)}%`)
    }
    doc.moveDown(0.5)

    // Dernières absences
    if (recentAttendances.length > 0) {
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#000')
      doc.text('Dernières absences et retards', { underline: true })
      doc.moveDown(0.2)
      for (const a of recentAttendances.slice(0, 12)) {
        if (doc.y > 770) doc.addPage()
        const subjectName = a.course?.subject?.name || a.course?.title || '—'
        doc.fontSize(8).font('Helvetica').fillColor('#333')
        doc.text(`• ${fmtDate(a.date)} — ${subjectName} — ${getAttendanceLabel(a.status)}${a.justified ? ' (justifié)' : ''}`)
      }
    }

    // ==========================================
    // PIED DE PAGE — sur toutes les pages
    // ==========================================
    const pages = doc.bufferedPageRange()
    for (let i = pages.start; i < pages.start + pages.count; i++) {
      doc.switchToPage(i)
      const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      doc.fontSize(7).font('Helvetica-Oblique').fillColor('#AAA')
      doc.text(
        `Dossier générétique de ${student.firstName} ${student.lastName} (${student.matricule}) · ${school.name} · ${today} · Page ${i + 1}/${pages.count} · SmartShule © 2026-2027`,
        50,
        815,
        { align: 'center', width: 495 }
      )
    }

    doc.end()
    const pdfBuffer = await pdfPromise

    // Journaliser la génération
    await logAudit({
      userId: user.id,
      userName: user.displayName,
      userRole: user.role,
      schoolId,
      action: 'EXPORT',
      entityType: 'STUDENT',
      entityId: studentId,
      description: `Génération du dossier complet PDF de ${student.firstName} ${student.lastName} (${student.matricule})`,
      metadata: {
        pages: pages.count,
        studentId,
        studentMatricule: student.matricule,
      },
    })

    const filename = `dossier-${student.matricule}-${Date.now()}.pdf`
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (err) {
    console.error('[api/exports/student-dossier] Error:', err)
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    )
  }
}
