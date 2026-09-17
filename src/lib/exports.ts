// SmartShule — Moteur d'exports (Cycle 04, §3.12 + §14.2.18)
//
// Implémente :
//   - Génération PDF : reçus de paiement, factures, bulletins (via pdfkit) ;
//   - Génération XLSX : listes d'élèves, écritures comptables (via exceljs) ;
//   - Génération CSV : listes et écritures (UTF-8 BOM pour Excel FR) ;
//   - Tous les exports incluent le branding de l'école (logo, couleurs, nom) ;
//   - Chaque export est journalisé dans l'audit.

import PDFDocument from 'pdfkit'
import ExcelJS from 'exceljs'
import { db } from '@/lib/db'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'
import { formatCents, formatDate } from '@/lib/format'

// ============================================================
// Types
// ============================================================

export type ExportFormat = 'pdf' | 'xlsx' | 'csv'

export interface ExportResult {
  buffer: Buffer
  mimeType: string
  filename: string
}

interface SchoolBranding {
  name: string
  slogan: string | null
  primaryColor: string
  secondaryColor: string
  tertiaryColor: string
  currency: string
  locale: string
  address?: string | null
  phone?: string | null
  email?: string | null
}

// ============================================================
// Helper : récupérer le branding
// ============================================================

async function getSchoolBranding(schoolId: string): Promise<SchoolBranding> {
  const school = await db.school.findUnique({ where: { id: schoolId } })
  if (!school) throw new Error('École introuvable')
  return {
    name: school.name,
    slogan: school.slogan,
    primaryColor: school.primaryColor,
    secondaryColor: school.secondaryColor,
    tertiaryColor: school.tertiaryColor,
    currency: school.currency,
    locale: school.locale,
    address: school.address,
    phone: school.phone,
    email: school.email,
  }
}

// ============================================================
// PDF : Reçu de paiement
// ============================================================

export async function generatePaymentReceiptPDF(
  paymentId: string,
  schoolId: string
): Promise<ExportResult> {
  const [branding, payment] = await Promise.all([
    getSchoolBranding(schoolId),
    db.payment.findUnique({
      where: { id: paymentId },
      include: {
        invoice: {
          include: {
            student: true,
            lines: true,
          },
        },
      },
    }),
  ])

  if (!payment) throw new Error('Paiement introuvable')
  if (payment.schoolId !== schoolId) throw new Error('Paiement hors périmètre')

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 })
      const buffers: Buffer[] = []
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => {
        const buffer = Buffer.concat(buffers)
        resolve({
          buffer,
          mimeType: 'application/pdf',
          filename: `recu-${payment.receiptNumber}.pdf`,
        })
      })

      // En-tête : nom de l'école
      doc
        .fontSize(20)
        .fillColor(branding.primaryColor)
        .font('Helvetica-Bold')
        .text(branding.name, { align: 'center' })
      if (branding.slogan) {
        doc
          .fontSize(9)
          .fillColor('#666')
          .font('Helvetica-Oblique')
          .text(branding.slogan, { align: 'center' })
      }
      if (branding.address) {
        doc
          .fontSize(9)
          .font('Helvetica')
          .text(`${branding.address} • ${branding.phone || ''} • ${branding.email || ''}`, { align: 'center' })
      }
      doc.moveDown()

      // Titre
      doc
        .fontSize(16)
        .fillColor('#000')
        .font('Helvetica-Bold')
        .text('REÇU DE PAIEMENT', { align: 'center', underline: true })
      doc.moveDown(0.5)

      // N° de reçu + date
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(`Reçu N° : `, { continued: true })
        .font('Helvetica')
        .text(payment.receiptNumber)
      doc
        .font('Helvetica-Bold')
        .text(`Date : `, { continued: true })
        .font('Helvetica')
        .text(formatDate(payment.paidAt))
      doc
        .font('Helvetica-Bold')
        .text(`Facture : `, { continued: true })
        .font('Helvetica')
        .text(payment.invoice.invoiceNumber)

      doc.moveDown()

      // Infos payeur
      doc
        .font('Helvetica-Bold')
        .text('Payeur : ', { continued: true })
        .font('Helvetica')
        .text(payment.payerName || '—')

      // Infos élève
      doc
        .font('Helvetica-Bold')
        .text('Élève : ', { continued: true })
        .font('Helvetica')
        .text(`${payment.invoice.student.firstName} ${payment.invoice.student.lastName}`)

      // Méthode
      doc
        .font('Helvetica-Bold')
        .text('Méthode de paiement : ', { continued: true })
        .font('Helvetica')
        .text(
          payment.method === 'CASH' ? 'Espèces' :
          payment.method === 'BANK' ? 'Virement bancaire' :
          payment.method === 'MOBILE_MONEY' ? 'Mobile Money' :
          payment.method === 'CARD' ? 'Carte bancaire' : payment.method
        )

      doc.moveDown()

      // Montant en évidence
      const amount = (payment.amountCents / 100).toLocaleString(branding.locale, {
        style: 'currency',
        currency: branding.currency,
      })
      doc
        .fontSize(14)
        .fillColor(branding.primaryColor)
        .font('Helvetica-Bold')
        .text(`Montant encaissé : ${amount}`, { align: 'center' })

      doc.moveDown()

      // Tableau des lignes de facture
      doc
        .fontSize(10)
        .fillColor('#000')
        .font('Helvetica-Bold')
        .text('Détail de la facture', { underline: true })
      doc.moveDown(0.3)

      // En-tête de tableau
      const tableTop = doc.y
      doc.font('Helvetica-Bold').fontSize(9)
      doc.text('Description', 50, tableTop, { width: 250 })
      doc.text('Montant', 350, tableTop, { width: 100, align: 'right' })
      doc.moveDown(0.3)
      doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#ccc').stroke()

      doc.font('Helvetica').fontSize(9)
      for (const line of payment.invoice.lines) {
        doc.text(line.description, 50, doc.y, { width: 250 })
        doc.text(
          (line.totalAmountCents / 100).toLocaleString(branding.locale, {
            style: 'currency',
            currency: branding.currency,
          }),
          350, doc.y - 12, { width: 100, align: 'right' }
        )
        doc.moveDown(0.3)
      }

      doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#000').stroke()

      // Total
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .text('Total payé : ', 50, doc.y + 10, { continued: true, width: 250 })
        .text(amount, 350, doc.y, { width: 100, align: 'right' })

      doc.moveDown(2)

      // Pied de page
      doc
        .fontSize(8)
        .fillColor('#666')
        .font('Helvetica-Oblique')
        .text(
          `Document généré le ${formatDate(new Date())} — SmartShule. ` +
          `Ce reçu est immuable. Toute correction se fait par un avoir référencé.`,
          { align: 'center' }
        )

      doc.end()
    } catch (e) {
      reject(e)
    }
  })
}

// ============================================================
// PDF : Facture
// ============================================================

export async function generateInvoicePDF(
  invoiceId: string,
  schoolId: string
): Promise<ExportResult> {
  const [branding, invoice] = await Promise.all([
    getSchoolBranding(schoolId),
    db.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        student: true,
        lines: true,
        payments: true,
      },
    }),
  ])

  if (!invoice) throw new Error('Facture introuvable')
  if (invoice.schoolId !== schoolId) throw new Error('Facture hors périmètre')

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 })
      const buffers: Buffer[] = []
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => {
        resolve({
          buffer: Buffer.concat(buffers),
          mimeType: 'application/pdf',
          filename: `facture-${invoice.invoiceNumber}.pdf`,
        })
      })

      // En-tête
      doc
        .fontSize(20)
        .fillColor(branding.primaryColor)
        .font('Helvetica-Bold')
        .text(branding.name, { align: 'center' })
      if (branding.slogan) {
        doc.fontSize(9).fillColor('#666').font('Helvetica-Oblique').text(branding.slogan, { align: 'center' })
      }
      doc.moveDown(0.5)
      doc
        .fontSize(16)
        .fillColor('#000')
        .font('Helvetica-Bold')
        .text('FACTURE', { align: 'center', underline: true })
      doc.moveDown(0.5)

      // Infos facture
      doc.fontSize(10).font('Helvetica-Bold').text(`N° : `, { continued: true }).font('Helvetica').text(invoice.invoiceNumber)
      doc.font('Helvetica-Bold').text(`Date d'émission : `, { continued: true }).font('Helvetica').text(formatDate(invoice.issueDate))
      if (invoice.dueDate) {
        doc.font('Helvetica-Bold').text(`Échéance : `, { continued: true }).font('Helvetica').text(formatDate(invoice.dueDate))
      }
      doc.moveDown()

      // Client
      doc.font('Helvetica-Bold').text('Facturé à :', { underline: true })
      doc.font('Helvetica').text(`${invoice.student.firstName} ${invoice.student.lastName}`)
      doc.text(`Matricule : ${invoice.student.matricule}`)
      doc.moveDown()

      // Tableau des lignes
      doc.font('Helvetica-Bold').fontSize(9)
      doc.text('Description', 50, doc.y, { width: 200 })
      doc.text('Qté', 280, doc.y, { width: 50, align: 'right' })
      doc.text('P.U.', 340, doc.y, { width: 80, align: 'right' })
      doc.text('Total', 440, doc.y, { width: 90, align: 'right' })
      doc.moveDown(0.3)
      doc.moveTo(50, doc.y).lineTo(540, doc.y).stroke()

      doc.font('Helvetica').fontSize(9)
      for (const line of invoice.lines) {
        const y = doc.y
        doc.text(line.description, 50, y, { width: 200 })
        doc.text((line.quantityCents / 100).toString(), 280, y, { width: 50, align: 'right' })
        doc.text((line.unitPriceCents / 100).toLocaleString(branding.locale), 340, y, { width: 80, align: 'right' })
        doc.text((line.totalAmountCents / 100).toLocaleString(branding.locale), 440, y, { width: 90, align: 'right' })
        doc.moveDown(0.3)
      }
      doc.moveTo(50, doc.y).lineTo(540, doc.y).stroke()
      doc.moveDown(0.5)

      // Totaux
      const totalAmount = formatCents(invoice.totalAmountCents, branding.currency, branding.locale)
      const paidAmount = formatCents(invoice.paidAmountCents, branding.currency, branding.locale)
      const remaining = formatCents(
        invoice.totalAmountCents - invoice.paidAmountCents,
        branding.currency,
        branding.locale
      )

      doc.font('Helvetica').fontSize(10)
      doc.text('Total TTC :', 350, doc.y, { width: 140, align: 'right' })
      doc.font('Helvetica-Bold').text(totalAmount, 440, doc.y - 12, { width: 90, align: 'right' })
      doc.font('Helvetica').text('Déjà payé :', 350, doc.y, { width: 140, align: 'right' })
      doc.font('Helvetica').fillColor('green').text(paidAmount, 440, doc.y - 12, { width: 90, align: 'right' })
      doc.fillColor('#000')
      if (invoice.totalAmountCents - invoice.paidAmountCents > 0) {
        doc.font('Helvetica-Bold').fillColor('red').text('Reste à payer :', 350, doc.y, { width: 140, align: 'right' })
        doc.text(remaining, 440, doc.y - 12, { width: 90, align: 'right' })
      } else {
        doc.font('Helvetica-Bold').fillColor('green').text('FACTURE PAYÉE', { align: 'center' })
      }
      doc.fillColor('#000')

      doc.moveDown(2)
      doc.fontSize(8).fillColor('#666').font('Helvetica-Oblique')
      doc.text(
        `Document généré le ${formatDate(new Date())} — SmartShule. ` +
        `Cette facture est associée à l'écriture comptable N° ${invoice.accountingEntryId?.slice(-8) || '—'}.`,
        { align: 'center' }
      )

      doc.end()
    } catch (e) {
      reject(e)
    }
  })
}

// ============================================================
// XLSX : Liste d'élèves
// ============================================================

export async function generateStudentsXLSX(
  schoolId: string
): Promise<ExportResult> {
  const [branding, students] = await Promise.all([
    getSchoolBranding(schoolId),
    db.student.findMany({
      where: { schoolId },
      include: {
        enrollments: {
          where: { status: 'ACTIVE' },
          include: { classroom: { include: { directorate: true } } },
        },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    }),
  ])

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'SmartShule'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Élèves', {
    properties: { tabColor: { argb: branding.primaryColor.replace('#', 'FF') } },
  })

  // En-tête
  sheet.columns = [
    { header: 'Matricule', key: 'matricule', width: 18 },
    { header: 'Prénom', key: 'firstName', width: 18 },
    { header: 'Nom', key: 'lastName', width: 20 },
    { header: 'Sexe', key: 'gender', width: 8 },
    { header: 'Date naissance', key: 'birthDate', width: 14 },
    { header: 'Classe', key: 'classroom', width: 12 },
    { header: 'Direction', key: 'directorate', width: 18 },
    { header: 'Statut', key: 'status', width: 12 },
  ]

  // Style de l'en-tête
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: branding.primaryColor.replace('#', 'FF') },
  }
  sheet.getRow(1).alignment = { horizontal: 'center' }

  // Données
  for (const s of students) {
    const enr = s.enrollments[0]
    sheet.addRow({
      matricule: s.matricule,
      firstName: s.firstName,
      lastName: s.lastName,
      gender: s.gender || '—',
      birthDate: s.birthDate ? formatDate(s.birthDate) : '—',
      classroom: enr?.classroom.name || '—',
      directorate: enr?.classroom.directorate.name || '—',
      status: s.status,
    })
  }

  // Bordures
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      }
    })
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return {
    buffer: Buffer.from(buffer),
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `eleves-${new Date().toISOString().slice(0, 10)}.xlsx`,
  }
}

// ============================================================
// XLSX : Écritures comptables
// ============================================================

export async function generateJournalEntriesXLSX(
  schoolId: string,
  filters?: { from?: Date; to?: Date }
): Promise<ExportResult> {
  const [branding, entries] = await Promise.all([
    getSchoolBranding(schoolId),
    db.journalEntry.findMany({
      where: {
        schoolId,
        ...(filters?.from || filters?.to
          ? { entryDate: { gte: filters.from, lte: filters.to } }
          : {}),
      },
      include: {
        journal: true,
        lines: { include: { account: true } },
      },
      orderBy: { entryDate: 'desc' },
    }),
  ])

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'SmartShule'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Écritures', {
    properties: { tabColor: { argb: branding.secondaryColor.replace('#', 'FF') } },
  })

  sheet.columns = [
    { header: 'N° écriture', key: 'entryNumber', width: 18 },
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Journal', key: 'journal', width: 10 },
    { header: 'Description', key: 'description', width: 40 },
    { header: 'N° compte', key: 'accountNumber', width: 12 },
    { header: 'Libellé compte', key: 'accountLabel', width: 25 },
    { header: 'Débit', key: 'debit', width: 14 },
    { header: 'Crédit', key: 'credit', width: 14 },
    { header: 'Équilibrée', key: 'balanced', width: 12 },
  ]

  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sheet.getRow(1).fill = {
    type: 'pattern', pattern: 'solid',
    fgColor: { argb: branding.secondaryColor.replace('#', 'FF') },
  }
  sheet.getRow(1).alignment = { horizontal: 'center' }

  for (const entry of entries) {
    for (const line of entry.lines) {
      sheet.addRow({
        entryNumber: entry.entryNumber,
        date: formatDate(entry.entryDate),
        journal: entry.journal.code,
        description: entry.description,
        accountNumber: line.account.accountNumber,
        accountLabel: line.account.accountLabel,
        debit: line.debit / 100,
        credit: line.credit / 100,
        balanced: entry.isBalanced ? 'OUI' : 'NON',
      })
    }
  }

  // Format monétaire sur D et C
  sheet.getColumn('debit').numFmt = '#,##0.00'
  sheet.getColumn('credit').numFmt = '#,##0.00'

  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' },
      }
    })
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return {
    buffer: Buffer.from(buffer),
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `ecritures-comptables-${new Date().toISOString().slice(0, 10)}.xlsx`,
  }
}

// ============================================================
// CSV : Liste ou écritures (UTF-8 BOM pour Excel FR)
// ============================================================

function toCsv(rows: Array<Record<string, unknown>>, columns: Array<{ key: string; label: string }>): string {
  const escape = (v: unknown): string => {
    const s = v === null || v === undefined ? '' : String(v)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }
  const header = columns.map((c) => escape(c.label)).join(',')
  const body = rows.map((r) => columns.map((c) => escape(r[c.key])).join(',')).join('\n')
  return header + '\n' + body
}

export async function generateStudentsCSV(schoolId: string): Promise<ExportResult> {
  const students = await db.student.findMany({
    where: { schoolId },
    include: {
      enrollments: {
        where: { status: 'ACTIVE' },
        include: { classroom: { include: { directorate: true } } },
      },
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  })

  const rows = students.map((s) => {
    const enr = s.enrollments[0]
    return {
      matricule: s.matricule,
      firstName: s.firstName,
      lastName: s.lastName,
      gender: s.gender || '',
      birthDate: s.birthDate ? formatDate(s.birthDate) : '',
      classroom: enr?.classroom.name || '',
      directorate: enr?.classroom.directorate.name || '',
      status: s.status,
    }
  })

  const csv = toCsv(rows, [
    { key: 'matricule', label: 'Matricule' },
    { key: 'firstName', label: 'Prénom' },
    { key: 'lastName', label: 'Nom' },
    { key: 'gender', label: 'Sexe' },
    { key: 'birthDate', label: 'Date naissance' },
    { key: 'classroom', label: 'Classe' },
    { key: 'directorate', label: 'Direction' },
    { key: 'status', label: 'Statut' },
  ])

  // BOM UTF-8 pour Excel
  return {
    buffer: Buffer.from('\uFEFF' + csv, 'utf-8'),
    mimeType: 'text/csv; charset=utf-8',
    filename: `eleves-${new Date().toISOString().slice(0, 10)}.csv`,
  }
}

export async function generateJournalEntriesCSV(
  schoolId: string,
  filters?: { from?: Date; to?: Date }
): Promise<ExportResult> {
  const entries = await db.journalEntry.findMany({
    where: {
      schoolId,
      ...(filters?.from || filters?.to
        ? { entryDate: { gte: filters.from, lte: filters.to } }
        : {}),
    },
    include: {
      journal: true,
      lines: { include: { account: true } },
    },
    orderBy: { entryDate: 'desc' },
  })

  const rows: Array<Record<string, unknown>> = []
  for (const entry of entries) {
    for (const line of entry.lines) {
      rows.push({
        entryNumber: entry.entryNumber,
        date: formatDate(entry.entryDate),
        journal: entry.journal.code,
        description: entry.description,
        accountNumber: line.account.accountNumber,
        accountLabel: line.account.accountLabel,
        debit: line.debit / 100,
        credit: line.credit / 100,
        balanced: entry.isBalanced ? 'OUI' : 'NON',
      })
    }
  }

  const csv = toCsv(rows, [
    { key: 'entryNumber', label: 'N° écriture' },
    { key: 'date', label: 'Date' },
    { key: 'journal', label: 'Journal' },
    { key: 'description', label: 'Description' },
    { key: 'accountNumber', label: 'N° compte' },
    { key: 'accountLabel', label: 'Libellé compte' },
    { key: 'debit', label: 'Débit' },
    { key: 'credit', label: 'Crédit' },
    { key: 'balanced', label: 'Équilibrée' },
  ])

  return {
    buffer: Buffer.from('\uFEFF' + csv, 'utf-8'),
    mimeType: 'text/csv; charset=utf-8',
    filename: `ecritures-comptables-${new Date().toISOString().slice(0, 10)}.csv`,
  }
}

// ============================================================
// Audit des exports
// ============================================================

export async function logExportAction(
  userId: string,
  userName: string,
  userRole: string,
  schoolId: string,
  exportType: string,
  filename: string,
  format: ExportFormat
): Promise<void> {
  const h = await headers()
  await logAudit({
    userId,
    userName,
    userRole,
    schoolId,
    action: 'EXPORT',
    entityType: 'EXPORT',
    description: `Export ${format.toUpperCase()} — ${exportType} → ${filename}`,
    ipAddress: getClientIP(h),
    metadata: { exportType, filename, format },
  })
}
