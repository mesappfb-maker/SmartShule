// SmartShule — API Export PDF Rapports (PROMOTER, DIRECTION, SYSTEM_ADMIN, AUDITOR)
// ============================================================
// GET /api/exports/report?type=<type>
// Types: promoter-monthly, promoter-annual, admin-system, audit-summary
// Génère un PDF format A4 avec en-tête école, statistiques, graphiques (data table)

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

    // Collecte des données selon le type de rapport
    const sections: ReportSection[] = []
    const now = new Date()
    const period = reportType === 'promoter-annual' ? `Année ${now.getFullYear()}` : `${now.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}`

    if (reportType.startsWith('promoter')) {
      if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const startOfYear = new Date(now.getFullYear(), 0, 1)

      const [totalStudents, activeStudents, newStudents, totalEmployees, teachers,
        invoicedAgg, collectedAgg, unpaidAgg, expensesYear, pendingExpenses,
      ] = await Promise.all([
        db.student.count({ where: { schoolId } }),
        db.student.count({ where: { schoolId, status: 'ACTIVE' } }),
        db.student.count({ where: { schoolId, createdAt: { gte: startOfMonth } } }),
        db.employee.count({ where: { schoolId, status: 'ACTIVE' } }),
        db.employee.count({ where: { schoolId, status: 'ACTIVE', globalRole: 'ENSEIGNANT' } }),
        db.invoice.aggregate({ where: { schoolId, status: { not: 'CANCELLED' } }, _sum: { totalAmountCents: true } }),
        db.invoice.aggregate({ where: { schoolId, status: { not: 'CANCELLED' } }, _sum: { paidAmountCents: true } }),
        db.invoice.aggregate({ where: { schoolId, status: { in: ['UNPAID', 'PARTIALLY_PAID'] } }, _sum: { totalAmountCents: true, paidAmountCents: true } }),
        db.expense.aggregate({ where: { schoolId, status: { in: ['APPROVED', 'PAID'] }, expenseDate: { gte: startOfYear } }, _sum: { amountCents: true } }),
        db.expense.aggregate({ where: { schoolId, status: 'PENDING' }, _sum: { amountCents: true }, _count: true }),
      ])

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
      const [totalSchools, totalUsers, activeUsers, blockedUsers, totalLicenses, activeLicenses,
        totalDevices, activeDevices, syncErrors, auditToday, failedLogins,
      ] = await Promise.all([
        db.school.count(),
        db.user.count(),
        db.user.count({ where: { active: true } }),
        db.user.count({ where: { active: false } }),
        db.license.count().catch(() => 0),
        db.license.count({ where: { status: 'ACTIVE' } }).catch(() => 0),
        db.syncDevice.count().catch(() => 0),
        db.syncDevice.count({ where: { status: 'ACTIVE' } }).catch(() => 0),
        db.syncError.count({ where: { resolvedAt: null } }).catch(() => 0),
        db.auditLog.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
        db.auditLog.count({ where: { action: 'LOGIN_FAILED', createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
      ])

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

    // Générer le PDF
    const pdfDoc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true })

    // En-tête
    pdfDoc.font('Helvetica-Bold').fontSize(20).fillColor('black').text(schoolName, { align: 'center' })
    pdfDoc.font('Helvetica').fontSize(10).fillColor('#666666').text('SmartShule — Rapport Stratégique', { align: 'center' })
    pdfDoc.moveDown(0.5)
    pdfDoc.fontSize(10).fillColor('black').text(`Période : ${period}`, { align: 'center' })
    pdfDoc.text(`Généré par : ${user.displayName} (${user.role})`, { align: 'center' })
    pdfDoc.text(`Date : ${now.toLocaleString('fr-FR')}`, { align: 'center' })
    pdfDoc.moveDown(1)

    // Ligne séparatrice
    pdfDoc.moveTo(50, pdfDoc.y).lineTo(pdfDoc.page.width - 50, pdfDoc.y).strokeColor('#cccccc').lineWidth(1).stroke()
    pdfDoc.moveDown(1)

    // Sections
    for (const section of sections) {
      pdfDoc.font('Helvetica-Bold').fontSize(14).fillColor('#1a4ba8').text(section.title)
      pdfDoc.moveDown(0.3)

      for (const row of section.rows) {
        const startY = pdfDoc.y
        pdfDoc.font('Helvetica').fontSize(11).fillColor('#333333').text(`• ${row.label}`, 60, startY, { width: pdfDoc.page.width - 120 })
        pdfDoc.font('Helvetica-Bold').fillColor('black').text(row.value, 60, startY, { width: pdfDoc.page.width - 120, align: 'right' })
        if (row.sub) {
          pdfDoc.font('Helvetica').fontSize(9).fillColor('#888888').text(`  ${row.sub}`, 60, pdfDoc.y)
        }
      }
      pdfDoc.moveDown(1)
    }

    // Pied de page
    pdfDoc.font('Helvetica').fontSize(8).fillColor('#888888').text(
      `SmartShule © ${now.getFullYear()} — Document généré automatiquement, non signé électroniquement.`,
      50, pdfDoc.page.height - 50, { align: 'center' }
    )

    // Sauvegarder le PDF
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
