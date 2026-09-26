// SmartShule — API Export PDF Rapports Premium (avec logo école)
// ============================================================
// GET /api/exports/report?type=<type>
// Types: promoter-monthly, promoter-annual, admin-system, audit-summary
// Design premium : en-tête avec logo, tableaux stylés, pied de page

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { hasRole } from '@/lib/rbac'
import PDFDocument from 'pdfkit'
import { mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import fs from 'fs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface ReportRow {
  label: string
  value: string
  sub?: string
}

interface ReportSection {
  title: string
  rows: ReportRow[]
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (!hasRole(user, ['PROMOTER', 'DIRECTION', 'DIRECTOR', 'ADMIN', 'SCHOOL_ADMIN', 'SYSTEM_ADMIN', 'AUDITOR'])) {
      return NextResponse.json({ ok: false, error: 'Accès réservé.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const reportType = searchParams.get('type') || 'promoter-monthly'

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    const school = schoolId ? await db.school.findUnique({ where: { id: schoolId } }) : null
    const schoolName = school?.name || 'SmartShule'
    const schoolLogo = school?.logoUrl || null
    const primaryColor = school?.primaryColor || '#2563EB'

    // Collecte des données
    const sections: ReportSection[] = []
    const now = new Date()
    const period = reportType === 'promoter-annual' ? `Année ${now.getFullYear()}` : `${now.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}`

    if (reportType.startsWith('promoter')) {
      if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const startOfYear = new Date(now.getFullYear(), 0, 1)

      // Séquentiel (anti EMAXCONNSESSION)
      const totalStudents = await db.student.count({ where: { schoolId } })
      const activeStudents = await db.student.count({ where: { schoolId, status: 'ACTIVE' } })
      const newStudents = await db.student.count({ where: { schoolId, createdAt: { gte: startOfMonth } } })
      const totalEmployees = await db.employee.count({ where: { schoolId, status: 'ACTIVE' } })
      const teachers = await db.employee.count({ where: { schoolId, status: 'ACTIVE', globalRole: 'ENSEIGNANT' } })
      const invoicedAgg = await db.invoice.aggregate({ where: { schoolId, status: { not: 'CANCELLED' } }, _sum: { totalAmountCents: true } })
      const collectedAgg = await db.invoice.aggregate({ where: { schoolId, status: { not: 'CANCELLED' } }, _sum: { paidAmountCents: true } })
      const unpaidAgg = await db.invoice.aggregate({ where: { schoolId, status: { in: ['UNPAID', 'PARTIALLY_PAID'] } }, _sum: { totalAmountCents: true, paidAmountCents: true } })
      const expensesYear = await db.expense.aggregate({ where: { schoolId, status: { in: ['APPROVED', 'PAID'] }, expenseDate: { gte: startOfYear } }, _sum: { amountCents: true } })
      const pendingExpenses = await db.expense.aggregate({ where: { schoolId, status: 'PENDING' }, _sum: { amountCents: true }, _count: true })

      const totalInvoiced = invoicedAgg._sum.totalAmountCents || 0
      const totalCollected = collectedAgg._sum.paidAmountCents || 0
      const totalUnpaid = (unpaidAgg._sum.totalAmountCents || 0) - (unpaidAgg._sum.paidAmountCents || 0)
      const collectionRate = totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0

      sections.push({
        title: 'Effectifs',
        rows: [
          { label: 'Total élèves', value: String(totalStudents) },
          { label: 'Élèves actifs', value: String(activeStudents) },
          { label: 'Nouveaux ce mois', value: String(newStudents) },
          { label: 'Employés actifs', value: String(totalEmployees) },
          { label: 'Enseignants', value: String(teachers) },
        ],
      })

      sections.push({
        title: 'Finances',
        rows: [
          { label: 'Total facturé', value: `${Math.round(totalInvoiced / 100).toLocaleString('fr-FR')} FC` },
          { label: 'Total encaissé', value: `${Math.round(totalCollected / 100).toLocaleString('fr-FR')} FC` },
          { label: 'Impayés', value: `${Math.round(totalUnpaid / 100).toLocaleString('fr-FR')} FC` },
          { label: 'Taux de recouvrement', value: `${collectionRate.toFixed(2)} %` },
          { label: 'Dépenses annuelles', value: `${Math.round((expensesYear._sum.amountCents || 0) / 100).toLocaleString('fr-FR')} FC` },
          { label: 'Dépenses en attente', value: `${pendingExpenses._count} (${Math.round((pendingExpenses._sum.amountCents || 0) / 100).toLocaleString('fr-FR')} FC)` },
        ],
      })
    } else if (reportType === 'admin-system') {
      // Séquentiel (anti EMAXCONNSESSION)
      const totalSchools = await db.school.count()
      const totalUsers = await db.user.count()
      const activeUsers = await db.user.count({ where: { active: true } })
      const blockedUsers = await db.user.count({ where: { active: false } })
      const totalLicenses = await db.license.count().catch(() => 0)
      const activeLicenses = await db.license.count({ where: { status: 'ACTIVE' } }).catch(() => 0)
      const totalDevices = await db.syncDevice.count().catch(() => 0)
      const activeDevices = await db.syncDevice.count({ where: { status: 'ACTIVE' } }).catch(() => 0)
      const syncErrors = await db.syncError.count({ where: { resolvedAt: null } }).catch(() => 0)
      const auditToday = await db.auditLog.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
      const failedLogins = await db.auditLog.count({ where: { action: 'LOGIN_FAILED', createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })

      sections.push({
        title: 'Système',
        rows: [
          { label: 'Écoles enregistrées', value: String(totalSchools) },
          { label: 'Utilisateurs total', value: String(totalUsers) },
          { label: 'Utilisateurs actifs', value: String(activeUsers) },
          { label: 'Comptes bloqués', value: String(blockedUsers) },
          { label: 'Licences totales', value: String(totalLicenses) },
          { label: 'Licences actives', value: String(activeLicenses) },
        ],
      })

      sections.push({
        title: 'Synchronisation',
        rows: [
          { label: 'Appareils totaux', value: String(totalDevices) },
          { label: 'Appareils actifs', value: String(activeDevices) },
          { label: 'Erreurs sync non résolues', value: String(syncErrors) },
          { label: 'Événements audit (24h)', value: String(auditToday) },
          { label: 'Échecs connexion (24h)', value: String(failedLogins) },
        ],
      })
    }

    // Générer le PDF premium
    const pdfDoc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true })
    const pageWidth = pdfDoc.page.width

    // === EN-TÊTE AVEC BANDEAU COLORÉ ===
    pdfDoc.rect(0, 0, pageWidth, 100).fill(primaryColor)

    // Logo (si disponible, on le charge depuis le système de fichiers local)
    let logoLoaded = false
    if (schoolLogo && schoolLogo.startsWith('/uploads/')) {
      const logoPath = path.join(process.cwd(), 'public', schoolLogo)
      if (existsSync(logoPath)) {
        try {
          pdfDoc.image(logoPath, 40, 25, { width: 50, height: 50 })
          logoLoaded = true
        } catch (e) {
          // ignore, on utilise l'icône texte
        }
      }
    }

    if (!logoLoaded) {
      pdfDoc.fillColor('white').font('Helvetica-Bold').fontSize(32).text('🎓', 40, 30, { width: 60, align: 'center' })
    }

    // Titre école à droite
    pdfDoc.fillColor('white').font('Helvetica-Bold').fontSize(20).text(schoolName, 110, 30, { align: 'left' })
    pdfDoc.font('Helvetica').fontSize(10).fillColor('#ffffffcc').text('SmartShule — Rapport Stratégique', 110, 55)
    pdfDoc.fontSize(9).fillColor('#ffffff99').text(`Généré le ${now.toLocaleString('fr-FR')}`, 110, 70)

    pdfDoc.moveDown(3)

    // === SÉPARATEUR PÉRIODE ===
    pdfDoc.fillColor('#666666').font('Helvetica').fontSize(10).text(`Période : `, 50, 130, { continued: true })
    pdfDoc.fillColor('#000000').font('Helvetica-Bold').text(period)
    pdfDoc.moveDown(0.5)
    pdfDoc.fillColor('#666666').font('Helvetica').text(`Généré par : `, { continued: true })
    pdfDoc.fillColor('#000000').font('Helvetica-Bold').text(`${user.displayName} (${user.role})`)
    pdfDoc.moveDown(1)

    // === LIGNE SÉPARATRICE ===
    const sepY = pdfDoc.y
    pdfDoc.moveTo(50, sepY).lineTo(pageWidth - 50, sepY).strokeColor('#e0e0e0').lineWidth(0.5).stroke()
    pdfDoc.moveDown(1)

    // === SECTIONS ===
    for (const section of sections) {
      // Fond coloré pour le titre de section
      const sectionY = pdfDoc.y
      pdfDoc.rect(50, sectionY, pageWidth - 100, 24).fill('#f3f4f6')
      pdfDoc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(13).text(section.title, 60, sectionY + 6)
      pdfDoc.moveDown(2)

      // Tableau
      for (const row of section.rows) {
        const rowY = pdfDoc.y
        // Ligne alternée
        const isEvenRow = section.rows.indexOf(row) % 2 === 0
        if (isEvenRow) {
          pdfDoc.rect(50, rowY - 2, pageWidth - 100, 18).fill('#fafafa')
        }

        pdfDoc.font('Helvetica').fontSize(10).fillColor('#333333').text(`• ${row.label}`, 60, rowY, { width: (pageWidth - 100) / 2 })
        pdfDoc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text(row.value, pageWidth / 2 - 20, rowY, { width: (pageWidth / 2) - 80, align: 'right' })

        if (row.sub) {
          pdfDoc.font('Helvetica-Oblique').fontSize(8).fillColor('#888888').text(`  ${row.sub}`, 60, rowY + 12)
        }

        pdfDoc.y = rowY + 16
      }
      pdfDoc.moveDown(1.5)
    }

    // === PIED DE PAGE ===
    const footerY = pdfDoc.page.height - 60
    pdfDoc.moveTo(50, footerY).lineTo(pageWidth - 50, footerY).strokeColor('#e0e0e0').lineWidth(0.5).stroke()
    pdfDoc.font('Helvetica').fontSize(8).fillColor('#888888').text(
      `SmartShule © ${now.getFullYear()} — Document généré automatiquement par ${user.displayName}`,
      50, footerY + 8, { width: pageWidth - 100, align: 'center' }
    )
    pdfDoc.fontSize(7).fillColor('#aaaaaa').text(
      `Confidentiel — Usage interne uniquement — Non signé électroniquement`,
      50, footerY + 22, { width: pageWidth - 100, align: 'center' }
    )

    // === SAUVEGARDE ===
    const reportDir = path.join(process.cwd(), 'public', 'uploads', 'reports')
    if (!existsSync(reportDir)) await mkdir(reportDir, { recursive: true })
    const filename = `report-${reportType}-${now.getTime()}.pdf`
    const filepath = path.join(reportDir, filename)
    const stream = fs.createWriteStream(filepath)

    await new Promise<void>((resolve, reject) => {
      stream.on('finish', () => resolve())
      stream.on('error', reject)
      pdfDoc.pipe(stream)
      pdfDoc.end()
    })

    return NextResponse.json({ ok: true, url: `/uploads/reports/${filename}`, filename })
  } catch (err) {
    console.error('[exports/report] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
