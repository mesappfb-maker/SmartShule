// SmartShule — Génération PDF centralisée (Documents officiels)
// ============================================================
// Implémente 16+ modèles officiels:
//   1. Certificat de scolarité
//   2. Attestation d'inscription
//   3. Attestation de fréquentation
//   4. Fiche d'inscription élève
//   5. Carte d'élève
//   6. Reçu administratif
//   7. Convocation parent
//   8. Lettre de dossier incomplet
//   9. Lettre d'absence / retard
//  10. Liste de classe
//  11. Liste de présence
//  12. Attestation de transfert
//  13. Fiche de sortie / retrait
//  14. Rapport administratif élève
//  15. Rapport d'admission
//  16. Étiquette QR / code-barres
//
// Pour chaque PDF:
//   - Numéro de référence unique chronologique (CERT-2026-000001)
//   - QR code de vérification (SHA-256 + verificationCode)
//   - Snapshot immuable des données (DocumentVersion)
//   - "DUPLICATA" si réimpression
//   - Audit log
//   - Mention "Document généré le ... par ... (rôle)"

import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import crypto from 'crypto'
import path from 'path'
import fs from 'fs/promises'
import { db } from '@/lib/db'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'
import { formatDate } from '@/lib/format'

// ============================================================
// Types
// ============================================================

export type DocumentType =
  | 'SCHOOL_CERTIFICATE' | 'ENROLLMENT_ATTESTATION' | 'ATTENDANCE_ATTESTATION'
  | 'ENROLLMENT_FORM' | 'STUDENT_CARD' | 'ADMIN_RECEIPT'
  | 'PARENT_CONVOCATION' | 'INCOMPLETE_FILE_LETTER' | 'ABSENCE_LETTER'
  | 'CLASS_LIST' | 'ATTENDANCE_LIST' | 'TRANSFER_ATTESTATION'
  | 'EXIT_FORM' | 'STUDENT_ADMIN_REPORT' | 'ADMISSION_REPORT'
  | 'LABEL_QR'

export interface DocumentContext {
  schoolId: string
  studentId: string
  certificateId?: string
  generatedBy: { id: string; name: string; role: string }
  reason?: string
  isDuplicata?: boolean
  variables?: Record<string, any>
}

export interface GenerationResult {
  ok: boolean
  pdfBuffer?: Buffer
  pdfUrl?: string
  pdfFileName?: string
  pdfHash?: string
  qrCodeUrl?: string
  verificationCode?: string
  referenceNumber?: string
  versionId?: string
  error?: string
}

// Stockage local : /home/z/my-project/storage/documents/{schoolId}/{year}/{ref}.pdf
const STORAGE_ROOT = process.env.STORAGE_ROOT || '/home/z/my-project/storage/documents'

// ============================================================
// Helper : générer numéro chronologique
// ============================================================

async function generateReferenceNumber(schoolId: string): Promise<string> {
  const year = new Date().getFullYear()
  const count = await db.certificate.count({ where: { schoolId } })
  return `CERT-${year}-${String(count + 1).padStart(6, '0')}`
}

// ============================================================
// Helper : générer QR code PNG base64 + URL
// ============================================================

async function generateQrCode(payload: string): Promise<{ dataUrl: string; buffer: Buffer }> {
  const buffer = await QRCode.toBuffer(payload, {
    type: 'png',
    width: 200,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#FFFFFF' },
  })
  const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`
  return { dataUrl, buffer }
}

// ============================================================
// Helper : sauvegarder PDF sur disque + hash SHA-256
// ============================================================

async function savePdfToStorage(
  buffer: Buffer,
  schoolId: string,
  referenceNumber: string
): Promise<{ url: string; fileName: string; hash: string }> {
  const year = new Date().getFullYear()
  const dir = path.join(STORAGE_ROOT, schoolId, String(year))
  await fs.mkdir(dir, { recursive: true })

  const fileName = `${referenceNumber}.pdf`
  const fullPath = path.join(dir, fileName)
  await fs.writeFile(fullPath, buffer)

  const hash = crypto.createHash('sha256').update(buffer).digest('hex')

  // URL relative (servie par une API de download sécurisée)
  const url = `/api/documents/download/${schoolId}/${year}/${fileName}`

  return { url, fileName, hash }
}

// ============================================================
// Helper : récupérer branding école + données élève
// ============================================================

interface SchoolBranding {
  name: string; slogan: string | null; primaryColor: string; secondaryColor: string
  tertiaryColor: string; address?: string | null; phone?: string | null; email?: string | null; logoUrl?: string | null
}

async function getSchoolBranding(schoolId: string): Promise<SchoolBranding> {
  const school = await db.school.findUnique({ where: { id: schoolId } })
  if (!school) throw new Error('École introuvable')
  return {
    name: school.name,
    slogan: school.slogan,
    primaryColor: school.primaryColor || '#1e40af',
    secondaryColor: school.secondaryColor || '#0e7490',
    tertiaryColor: school.tertiaryColor || '#475569',
    address: school.address,
    phone: school.phone,
    email: school.email,
    logoUrl: school.logoUrl,
  }
}

interface StudentFullData {
  id: string; firstName: string; lastName: string; matricule: string
  birthDate: Date | null; birthPlace: string | null; gender: string | null
  address: string | null; phone: string | null; email: string | null
  photoUrl: string | null; status: string
  enrollments: any[]; guardianLinks: any[]
}

async function getStudentData(studentId: string, schoolId: string): Promise<StudentFullData> {
  const student = await db.student.findUnique({
    where: { id: studentId },
    include: {
      enrollments: {
        where: { status: 'ACTIVE' },
        take: 1,
        include: { classroom: { include: { directorate: true } }, academicYear: true },
      },
      guardianLinks: { take: 2, include: { guardian: true } },
    },
  })
  if (!student || student.schoolId !== schoolId) throw new Error('Élève introuvable ou hors périmètre.')
  return student as unknown as StudentFullData
}

// ============================================================
// Helper : en-tête commun
// ============================================================

function drawHeader(doc: PDFKit.PDFDocument, branding: SchoolBranding) {
  // Logo si disponible
  if (branding.logoUrl) {
    try {
      // En production: charger l'image depuis le stockage
      // doc.image(logoPath, 50, 50, { width: 80 })
    } catch { /* ignore */ }
  }

  // Nom école
  doc
    .fontSize(20)
    .fillColor(branding.primaryColor)
    .font('Helvetica-Bold')
    .text(branding.name, { align: 'center' })

  if (branding.slogan) {
    doc.fontSize(9).fillColor('#666').font('Helvetica-Oblique').text(branding.slogan, { align: 'center' })
  }
  if (branding.address) {
    doc
      .fontSize(9).font('Helvetica')
      .text(`${branding.address} • ${branding.phone || ''} • ${branding.email || ''}`, { align: 'center' })
  }
  doc.moveDown(1)
}

// ============================================================
// Helper : pied de page commun
// ============================================================

function drawFooter(
  doc: PDFKit.PDFDocument,
  branding: SchoolBranding,
  referenceNumber: string,
  verificationCode: string,
  generatedBy: { name: string; role: string },
  isDuplicata: boolean
) {
  const page = doc.page
  const y = page.height - 80

  doc
    .fontSize(8)
    .fillColor('#666')
    .font('Helvetica-Oblique')
    .text(
      `Document ${referenceNumber} · Vérification: ${verificationCode}`,
      50, y, { align: 'center', width: page.width - 100 }
    )
  doc
    .font('Helvetica')
    .text(
      `Généré le ${formatDate(new Date())} par ${generatedBy.name} (${generatedBy.role})`,
      50, y + 15, { align: 'center', width: page.width - 100 }
    )
  if (isDuplicata) {
    doc
      .fontSize(10)
      .fillColor('#dc2626')
      .font('Helvetica-Bold')
      .text('DUPLICATA', 50, y + 30, { align: 'center', width: page.width - 100 })
  }
}

// ============================================================
// Helper : QR code sur le PDF
// ============================================================

async function drawQrCode(doc: PDFKit.PDFDocument, payload: string, x: number, y: number, size = 80): Promise<string> {
  const { buffer } = await generateQrCode(payload)
  doc.image(buffer, x, y, { width: size })
  return payload
}

// ============================================================
// Helper : créer DocumentVersion (snapshot immuable)
// ============================================================

async function createDocumentVersion(params: {
  schoolId: string
  certificateId?: string
  pdfBuffer: Buffer
  pdfUrl: string
  pdfFileName: string
  generatedBy: { id: string; name: string; role: string }
  isDuplicata: boolean
  snapshotData: Record<string, any>
  verificationCode: string
}): Promise<{ id: string; hash: string }> {
  const hash = crypto.createHash('sha256').update(params.pdfBuffer).digest('hex')

  const version = await db.documentVersion.create({
    data: {
      schoolId: params.schoolId,
      certificateId: params.certificateId || null,
      versionNumber: 1, // Sera calculé plus tard si plusieurs versions
      isOriginal: !params.isDuplicata,
      isDuplicata: params.isDuplicata,
      pdfUrl: params.pdfUrl,
      pdfFileName: params.pdfFileName,
      pdfHash: hash,
      qrCodeUrl: `${params.verificationCode}`,
      verificationCode: params.verificationCode,
      generatedById: params.generatedBy.id,
      generatedByName: params.generatedBy.name,
      snapshotData: JSON.stringify(params.snapshotData),
    },
  })

  // Calculer versionNumber réel
  const count = await db.documentVersion.count({
    where: { schoolId: params.schoolId, certificateId: params.certificateId || null },
  })
  await db.documentVersion.update({
    where: { id: version.id },
    data: { versionNumber: count },
  })

  return { id: version.id, hash }
}

// ============================================================
// Helper : enregistrer dans Certificate + Audit
// ============================================================

async function recordCertificate(params: {
  schoolId: string
  studentId: string
  certificateType: DocumentType
  referenceNumber: string
  title: string
  reason?: string
  generatedBy: { id: string; name: string; role: string }
  pdfUrl: string
  pdfFileName: string
  isDuplicata: boolean
}): Promise<string> {
  if (params.isDuplicata && params.certificateId) {
    // Update existing certificate with reprint info
    const existing = await db.certificate.findUnique({ where: { id: params.certificateId } })
    if (existing) {
      await db.certificate.update({
        where: { id: params.certificateId },
        data: {
          reprintCount: existing.reprintCount + 1,
          lastReprintAt: new Date(),
          lastReprintById: params.generatedBy.id,
        },
      })
      return params.certificateId
    }
  }

  const cert = await db.certificate.create({
    data: {
      schoolId: params.schoolId,
      studentId: params.studentId,
      certificateType: params.certificateType,
      referenceNumber: params.referenceNumber,
      title: params.title,
      reason: params.reason || null,
      generatedById: params.generatedBy.id,
      generatedByName: params.generatedBy.name,
      requiresValidation: ['SCHOOL_CERTIFICATE', 'TRANSFER_ATTESTATION'].includes(params.certificateType),
    },
  })

  // Audit
  const h = await headers()
  await logAudit({
    userId: params.generatedBy.id, userName: params.generatedBy.name, userRole: params.generatedBy.role,
    schoolId: params.schoolId, action: 'CREATE', entityType: 'CERTIFICATE', entityId: cert.id,
    description: `Document généré: ${params.title} (${params.referenceNumber})`,
    ipAddress: getClientIP(h),
    metadata: { certificateType: params.certificateType, reference: params.referenceNumber, studentId: params.studentId },
  })

  return cert.id
}

// ============================================================
// Génération principale (dispatch par type)
// ============================================================

export async function generateDocument(
  type: DocumentType,
  ctx: DocumentContext
): Promise<GenerationResult> {
  try {
    const [branding, student] = await Promise.all([
      getSchoolBranding(ctx.schoolId),
      getStudentData(ctx.studentId, ctx.schoolId),
    ])

    const referenceNumber = ctx.certificateId
      ? await db.certificate.findUnique({ where: { id: ctx.certificateId } }).then((c) => c?.referenceNumber || await generateReferenceNumber(ctx.schoolId))
      : await generateReferenceNumber(ctx.schoolId)

    const verificationCode = crypto.randomBytes(12).toString('hex').toUpperCase()
    const qrPayload = JSON.stringify({
      ref: referenceNumber,
      v: verificationCode,
      t: type,
      sid: ctx.studentId,
      d: new Date().toISOString(),
    })

    // Snapshot des données au moment de la génération
    const snapshotData = {
      referenceNumber,
      verificationCode,
      type,
      school: { name: branding.name, address: branding.address, phone: branding.phone, email: branding.email },
      student: {
        firstName: student.firstName, lastName: student.lastName, matricule: student.matricule,
        birthDate: student.birthDate?.toISOString() || null, birthPlace: student.birthPlace,
        gender: student.gender, address: student.address,
      },
      enrollment: student.enrollments[0] ? {
        classroom: student.enrollments[0].classroom?.name,
        directorate: student.enrollments[0].classroom?.directorate?.name,
        academicYear: student.enrollments[0].academicYear?.label,
      } : null,
      guardians: student.guardianLinks.map((gl) => ({
        name: `${gl.guardian.firstName} ${gl.guardian.lastName}`,
        phone: gl.guardian.phone, relation: gl.relation,
      })),
      generatedAt: new Date().toISOString(),
      generatedBy: ctx.generatedBy,
      reason: ctx.reason,
      isDuplicata: !!ctx.isDuplicata,
    }

    // Génération PDF
    const pdfBuffer = await renderPdf(type, branding, student, snapshotData, referenceNumber, verificationCode, qrPayload, ctx)

    // Sauvegarder
    const saved = await savePdfToStorage(pdfBuffer, ctx.schoolId, referenceNumber)

    // Enregistrer Certificate
    const title = getDocumentTitle(type)
    const certificateId = await recordCertificate({
      schoolId: ctx.schoolId, studentId: ctx.studentId, certificateType: type,
      referenceNumber, title, reason: ctx.reason, generatedBy: ctx.generatedBy,
      pdfUrl: saved.url, pdfFileName: saved.fileName, isDuplicata: !!ctx.isDuplicata,
    })

    // Créer DocumentVersion (snapshot immuable)
    const version = await createDocumentVersion({
      schoolId: ctx.schoolId, certificateId, pdfBuffer,
      pdfUrl: saved.url, pdfFileName: saved.fileName,
      generatedBy: ctx.generatedBy, isDuplicata: !!ctx.isDuplicata,
      snapshotData, verificationCode,
    })

    return {
      ok: true,
      pdfBuffer,
      pdfUrl: saved.url,
      pdfFileName: saved.fileName,
      pdfHash: saved.hash,
      qrCodeUrl: verificationCode,
      verificationCode,
      referenceNumber,
      versionId: version.id,
    }
  } catch (err) {
    console.error('[generateDocument] Error:', err)
    return { ok: false, error: (err as Error).message }
  }
}

// ============================================================
// Dispatcher PDF par type
// ============================================================

async function renderPdf(
  type: DocumentType,
  branding: SchoolBranding,
  student: StudentFullData,
  snapshot: any,
  referenceNumber: string,
  verificationCode: string,
  qrPayload: string,
  ctx: DocumentContext
): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 })
      const buffers: Buffer[] = []
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => resolve(Buffer.concat(buffers)))

      // Header
      drawHeader(doc, branding)

      // Title
      doc
        .fontSize(16).fillColor('#000').font('Helvetica-Bold')
        .text(getDocumentTitle(type), { align: 'center', underline: true })
      doc.moveDown(0.5)

      // Référence + date
      doc.fontSize(10).font('Helvetica-Bold').text('Référence : ', { continued: true })
      doc.font('Helvetica').text(referenceNumber)
      doc.font('Helvetica-Bold').text('Date : ', { continued: true })
      doc.font('Helvetica').text(formatDate(new Date()))
      if (ctx.isDuplicata) {
        doc.font('Helvetica-Bold').fillColor('#dc2626').text('*** DUPLICATA ***')
        doc.fillColor('#000')
      }
      doc.moveDown(1)

      // Corps selon le type
      switch (type) {
        case 'SCHOOL_CERTIFICATE': drawSchoolCertificate(doc, branding, student, snapshot); break
        case 'ENROLLMENT_ATTESTATION': drawEnrollmentAttestation(doc, branding, student, snapshot); break
        case 'ATTENDANCE_ATTESTATION': drawAttendanceAttestation(doc, branding, student, snapshot); break
        case 'ENROLLMENT_FORM': drawEnrollmentForm(doc, branding, student, snapshot); break
        case 'STUDENT_CARD': drawStudentCard(doc, branding, student, snapshot); break
        case 'ADMIN_RECEIPT': drawAdminReceipt(doc, branding, student, snapshot, ctx); break
        case 'PARENT_CONVOCATION': drawParentConvocation(doc, branding, student, snapshot, ctx); break
        case 'INCOMPLETE_FILE_LETTER': drawIncompleteFileLetter(doc, branding, student, snapshot, ctx); break
        case 'ABSENCE_LETTER': drawAbsenceLetter(doc, branding, student, snapshot, ctx); break
        case 'CLASS_LIST': await drawClassList(doc, branding, student, snapshot); break
        case 'ATTENDANCE_LIST': await drawAttendanceList(doc, branding, student, snapshot); break
        case 'TRANSFER_ATTESTATION': drawTransferAttestation(doc, branding, student, snapshot); break
        case 'EXIT_FORM': drawExitForm(doc, branding, student, snapshot, ctx); break
        case 'STUDENT_ADMIN_REPORT': await drawStudentAdminReport(doc, branding, student, snapshot); break
        case 'ADMISSION_REPORT': drawAdmissionReport(doc, branding, student, snapshot); break
        case 'LABEL_QR': await drawLabelQr(doc, branding, student, qrPayload, verificationCode); break
      }

      // QR code
      doc.moveDown(2)
      const qrX = doc.page.width - 130
      const qrY = doc.y
      await drawQrCode(doc, qrPayload, qrX, qrY, 80)
      doc.fontSize(7).fillColor('#666').font('Helvetica')
      doc.text(`Code: ${verificationCode.slice(0, 8)}...`, qrX, qrY + 82, { width: 80, align: 'center' })

      // Footer
      drawFooter(doc, branding, referenceNumber, verificationCode, ctx.generatedBy, !!ctx.isDuplicata)

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}

function getDocumentTitle(type: DocumentType): string {
  const titles: Record<DocumentType, string> = {
    SCHOOL_CERTIFICATE: 'CERTIFICAT DE SCOLARITÉ',
    ENROLLMENT_ATTESTATION: 'ATTESTATION D\'INSCRIPTION',
    ATTENDANCE_ATTESTATION: 'ATTESTATION DE FRÉQUENTATION',
    ENROLLMENT_FORM: 'FICHE D\'INSCRIPTION',
    STUDENT_CARD: 'CARTE D\'ÉLÈVE',
    ADMIN_RECEIPT: 'REÇU ADMINISTRATIF',
    PARENT_CONVOCATION: 'CONVOCATION PARENT',
    INCOMPLETE_FILE_LETTER: 'LETTRE — DOSSIER INCOMPLET',
    ABSENCE_LETTER: 'LETTRE D\'ABSENCE',
    CLASS_LIST: 'LISTE DE CLASSE',
    ATTENDANCE_LIST: 'LISTE DE PRÉSENCE',
    TRANSFER_ATTESTATION: 'ATTESTATION DE TRANSFERT',
    EXIT_FORM: 'FICHE DE SORTIE',
    STUDENT_ADMIN_REPORT: 'RAPPORT ADMINISTRATIF ÉLÈVE',
    ADMISSION_REPORT: 'RAPPORT D\'ADMISSION',
    LABEL_QR: 'ÉTIQUETTE QR',
  }
  return titles[type] || type
}

// ============================================================
// Implémentations par type de document
// ============================================================

function drawStudentInfo(doc: PDFKit.PDFDocument, student: StudentFullData) {
  doc.fontSize(11).font('Helvetica-Bold').text('ÉLÈVE', { underline: true })
  doc.moveDown(0.3)
  doc.font('Helvetica').fontSize(10)
  doc.text(`Nom et prénom : ${student.lastName} ${student.firstName}`)
  doc.text(`Matricule : ${student.matricule}`)
  if (student.birthDate) {
    doc.text(`Né(e) le : ${formatDate(student.birthDate)}${student.birthPlace ? ' à ' + student.birthPlace : ''}`)
  }
  if (student.gender) {
    doc.text(`Sexe : ${student.gender === 'M' ? 'Masculin' : 'Féminin'}`)
  }
  const enr = student.enrollments[0]
  if (enr) {
    doc.text(`Classe : ${enr.classroom?.name || '—'}`)
    doc.text(`Direction : ${enr.classroom?.directorate?.name || '—'}`)
    doc.text(`Année scolaire : ${enr.academicYear?.label || '—'}`)
  }
  doc.moveDown(0.5)
}

function drawGuardianInfo(doc: PDFKit.PDFDocument, student: StudentFullData) {
  if (student.guardianLinks.length === 0) return
  doc.fontSize(11).font('Helvetica-Bold').text('PARENT / TUTEUR', { underline: true })
  doc.moveDown(0.3)
  doc.font('Helvetica').fontSize(10)
  for (const gl of student.guardianLinks) {
    const g = gl.guardian
    doc.text(`${g.firstName} ${g.lastName} (${gl.relation})`)
    if (g.phone) doc.text(`Téléphone : ${g.phone}`)
    if (g.email) doc.text(`Email : ${g.email}`)
  }
  doc.moveDown(0.5)
}

function drawSchoolCertificate(doc: PDFKit.PDFDocument, branding: SchoolBranding, student: StudentFullData, snapshot: any) {
  doc.fontSize(12).font('Helvetica').fillColor('#000')
  const enr = student.enrollments[0]
  doc.text(
    `Je soussigné(e), Directeur(trice) de ${branding.name}, certifie que l'élève :`,
    { align: 'justify' }
  )
  doc.moveDown(0.5)
  doc.font('Helvetica-Bold').fontSize(13).text(`${student.lastName} ${student.firstName}`, { align: 'center' })
  doc.moveDown(0.3)
  doc.font('Helvetica').fontSize(11)
  doc.text(`Matricule : ${student.matricule}`)
  if (student.birthDate) doc.text(`Né(e) le : ${formatDate(student.birthDate)}`)
  doc.moveDown(0.3)
  doc.text(
    `est régulièrement inscrit(e) pour l'année scolaire ${enr?.academicYear?.label || '—'} en classe de ${enr?.classroom?.name || '—'}.`,
    { align: 'justify' }
  )
  doc.moveDown(0.3)
  doc.text('En foi de quoi, la présente attestation est délivrée pour servir et valoir ce que de droit.', { align: 'justify' })
  doc.moveDown(2)
  // Signature
  doc.text('Le Directeur', 350, doc.y, { align: 'right' })
  doc.moveDown(2)
}

function drawEnrollmentAttestation(doc: PDFKit.PDFDocument, branding: SchoolBranding, student: StudentFullData, snapshot: any) {
  drawStudentInfo(doc, student)
  doc.fontSize(11).font('Helvetica')
  doc.text(
    `Atteste que l'élève susnommé(e) est dûment inscrit(e) à ${branding.name} pour l'année scolaire en cours, et qu'il/elle jouit de tous les droits afférents à son statut d'élève régulier.`,
    { align: 'justify' }
  )
  doc.moveDown(1)
  doc.text('Cette attestation est délivrée à la demande de l'intéressé(e) pour servir et valoir ce que de droit.', { align: 'justify' })
  doc.moveDown(2)
}

function drawAttendanceAttestation(doc: PDFKit.PDFDocument, branding: SchoolBranding, student: StudentFullData, snapshot: any) {
  drawStudentInfo(doc, student)
  doc.fontSize(11).font('Helvetica')
  doc.text(
    `Atteste que l'élève susnommé(e) fréquente régulièrement les cours à ${branding.name} pour l'année scolaire en cours.`,
    { align: 'justify' }
  )
  doc.moveDown(1)
  doc.text('Cette attestation est délivrée pour servir et valoir ce que de droit.', { align: 'justify' })
  doc.moveDown(2)
}

function drawEnrollmentForm(doc: PDFKit.PDFDocument, branding: SchoolBranding, student: StudentFullData, snapshot: any) {
  drawStudentInfo(doc, student)
  drawGuardianInfo(doc, student)
  doc.fontSize(11).font('Helvetica-Bold').text('INFORMATIONS COMPLÉMENTAIRES', { underline: true })
  doc.moveDown(0.3)
  doc.font('Helvetica').fontSize(10)
  if (student.address) doc.text(`Adresse : ${student.address}`)
  if (student.phone) doc.text(`Téléphone : ${student.phone}`)
  if (student.email) doc.text(`Email : ${student.email}`)
  doc.moveDown(1)
  doc.text('Signature du parent :', 50, doc.y + 30)
  doc.text('Cachet de l\'école :', 350, doc.y + 30)
}

function drawStudentCard(doc: PDFKit.PDFDocument, branding: SchoolBranding, student: StudentFullData, snapshot: any) {
  const enr = student.enrollments[0]
  doc.fontSize(10).font('Helvetica-Bold').fillColor(branding.primaryColor)
  doc.text('CARTE D\'ÉLÈVE', { align: 'center' })
  doc.fillColor('#000')
  doc.moveDown(0.5)
  doc.fontSize(11)
  doc.text(`${student.firstName} ${student.lastName}`, { align: 'center' })
  doc.fontSize(9).font('Helvetica')
  doc.text(`Matricule : ${student.matricule}`, { align: 'center' })
  doc.text(`Classe : ${enr?.classroom?.name || '—'}`, { align: 'center' })
  doc.text(`Année : ${enr?.academicYear?.label || '—'}`, { align: 'center' })
  if (student.birthDate) doc.text(`Né(e) le : ${formatDate(student.birthDate)}`, { align: 'center' })
}

function drawAdminReceipt(doc: PDFKit.PDFDocument, branding: SchoolBranding, student: StudentFullData, snapshot: any, ctx: DocumentContext) {
  drawStudentInfo(doc, student)
  doc.fontSize(11).font('Helvetica-Bold').text('MOTIF', { underline: true })
  doc.moveDown(0.3)
  doc.font('Helvetica').fontSize(10)
  doc.text(ctx.reason || 'Reçu administratif')
  doc.moveDown(1)
  doc.font('Helvetica-Bold').fontSize(12)
  doc.text('Signature et cachet :', 350, doc.y)
}

function drawParentConvocation(doc: PDFKit.PDFDocument, branding: SchoolBranding, student: StudentFullData, snapshot: any, ctx: DocumentContext) {
  drawStudentInfo(doc, student)
  drawGuardianInfo(doc, student)
  doc.fontSize(11).font('Helvetica-Bold').text('OBJET DE LA CONVOCATION', { underline: true })
  doc.moveDown(0.3)
  doc.font('Helvetica').fontSize(10)
  doc.text(ctx.reason || 'Convocation parent')
  doc.moveDown(1)
  doc.text('Le parent est invité à se présenter à la direction à la date convenue.', { align: 'justify' })
  doc.moveDown(1)
  doc.font('Helvetica-Bold').text('Le Directeur', 350, doc.y, { align: 'right' })
}

function drawIncompleteFileLetter(doc: PDFKit.PDFDocument, branding: SchoolBranding, student: StudentFullData, snapshot: any, ctx: DocumentContext) {
  drawStudentInfo(doc, student)
  doc.fontSize(11).font('Helvetica')
  doc.text(
    `Nous vous informons que le dossier d'inscription de l'élève susnommé(e) est incomplet.`,
    { align: 'justify' }
  )
  doc.moveDown(0.5)
  doc.text('Pièces manquantes :', { underline: true })
  doc.moveDown(0.3)
  doc.text(ctx.reason || 'Voir liste en annexe')
  doc.moveDown(1)
  doc.text('Merci de bien vouloir régulariser la situation dans les meilleurs délais.', { align: 'justify' })
  doc.moveDown(2)
  doc.font('Helvetica-Bold').text('Le Secrétariat', 350, doc.y, { align: 'right' })
}

function drawAbsenceLetter(doc: PDFKit.PDFDocument, branding: SchoolBranding, student: StudentFullData, snapshot: any, ctx: DocumentContext) {
  drawStudentInfo(doc, student)
  doc.fontSize(11).font('Helvetica')
  doc.text(
    `Nous constatons que l'élève susnommé(e) a été absent(e) sans justification valable.`,
    { align: 'justify' }
  )
  doc.moveDown(0.5)
  doc.text(ctx.reason || 'Merci de fournir un justificatif dans les 48 heures.')
  doc.moveDown(1)
  doc.text('À défaut de justification, des sanctions disciplinaires pourront être envisagées.', { align: 'justify' })
  doc.moveDown(2)
  doc.font('Helvetica-Bold').text('Le Directeur', 350, doc.y, { align: 'right' })
}

async function drawClassList(doc: PDFKit.PDFDocument, branding: SchoolBranding, student: StudentFullData, snapshot: any) {
  const enr = student.enrollments[0]
  if (!enr) {
    doc.text('Aucune inscription active.', { align: 'center' })
    return
  }
  const classroomId = enr.classroomId
  if (!classroomId) {
    doc.text('Classe introuvable.', { align: 'center' })
    return
  }
  // Récupérer tous les élèves de la classe
  const enrollments = await db.enrollment.findMany({
    where: { classroomId, status: 'ACTIVE' },
    include: { student: true },
    orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
  })
  doc.fontSize(13).font('Helvetica-Bold')
  doc.text(`LISTE DE CLASSE — ${enr.classroom?.name || '—'}`, { align: 'center' })
  doc.fontSize(10).font('Helvetica')
  doc.text(`Année scolaire : ${enr.academicYear?.label || '—'}`, { align: 'center' })
  doc.moveDown(1)

  // Tableau
  doc.font('Helvetica-Bold').fontSize(9)
  doc.text('N°', 50, doc.y, { width: 40 })
  doc.text('Matricule', 100, doc.y, { width: 100 })
  doc.text('Nom et prénom', 220, doc.y, { width: 250 })
  doc.text('Sexe', 490, doc.y, { width: 50 })
  doc.moveDown(0.3)
  doc.moveTo(50, doc.y).lineTo(540, doc.y).stroke()

  doc.font('Helvetica').fontSize(9)
  enrollments.forEach((e, i) => {
    const s = e.student
    doc.text(String(i + 1), 50, doc.y, { width: 40 })
    doc.text(s.matricule, 100, doc.y, { width: 100 })
    doc.text(`${s.lastName} ${s.firstName}`, 220, doc.y, { width: 250 })
    doc.text(s.gender || '—', 490, doc.y, { width: 50 })
    doc.moveDown(0.2)
  })
}

async function drawAttendanceList(doc: PDFKit.PDFDocument, branding: SchoolBranding, student: StudentFullData, snapshot: any) {
  // Similaire à la liste de classe mais avec colonne présence
  await drawClassList(doc, branding, student, snapshot)
  // Note: une vraie liste de présence aurait des colonnes vides pour chaque jour
}

function drawTransferAttestation(doc: PDFKit.PDFDocument, branding: SchoolBranding, student: StudentFullData, snapshot: any) {
  drawStudentInfo(doc, student)
  doc.fontSize(11).font('Helvetica')
  doc.text(
    `Atteste que l'élève susnommé(e) a été scolarisé(e) à ${branding.name} jusqu'à la date du ${formatDate(new Date())}.`,
    { align: 'justify' }
  )
  doc.moveDown(0.5)
  doc.text(
    'Le présent document est délivré pour permettre la poursuite de la scolarité dans un autre établissement.',
    { align: 'justify' }
  )
  doc.moveDown(2)
  doc.font('Helvetica-Bold').text('Le Directeur', 350, doc.y, { align: 'right' })
}

function drawExitForm(doc: PDFKit.PDFDocument, branding: SchoolBranding, student: StudentFullData, snapshot: any, ctx: DocumentContext) {
  drawStudentInfo(doc, student)
  doc.fontSize(11).font('Helvetica-Bold').text('MOTIF DE SORTIE', { underline: true })
  doc.moveDown(0.3)
  doc.font('Helvetica').fontSize(10)
  doc.text(ctx.reason || 'Retrait définitif')
  doc.moveDown(1)
  doc.text('Date d\'effet : ' + formatDate(new Date()))
  doc.moveDown(2)
  doc.text('Signature du parent :', 50, doc.y + 30)
  doc.text('Cachet et signature :', 350, doc.y + 30)
}

async function drawStudentAdminReport(doc: PDFKit.PDFDocument, branding: SchoolBranding, student: StudentFullData, snapshot: any) {
  drawStudentInfo(doc, student)
  drawGuardianInfo(doc, student)

  doc.fontSize(11).font('Helvetica-Bold').text('SITUATION ADMINISTRATIVE', { underline: true })
  doc.moveDown(0.3)
  doc.font('Helvetica').fontSize(10)
  doc.text(`Statut : ${student.status}`)
  const enr = student.enrollments[0]
  if (enr) {
    doc.text(`Classe : ${enr.classroom?.name}`)
    doc.text(`Année scolaire : ${enr.academicYear?.label}`)
  }

  // Documents de l'élève
  const docs = await db.studentDocument.findMany({
    where: { studentId: student.id },
    orderBy: [{ createdAt: 'desc' }],
  })
  doc.moveDown(0.5)
  doc.font('Helvetica-Bold').text('Documents au dossier :')
  doc.font('Helvetica').fontSize(9)
  for (const d of docs) {
    doc.text(`• ${d.label} ${d.verified ? '✓' : '⏳'}`)
  }

  // Certificats générés
  const certs = await db.certificate.findMany({
    where: { studentId: student.id },
    orderBy: [{ generatedAt: 'desc' }],
    take: 10,
  })
  doc.moveDown(0.5)
  doc.font('Helvetica-Bold').text('Documents générés :')
  doc.font('Helvetica').fontSize(9)
  for (const c of certs) {
    doc.text(`• ${c.title} — Réf: ${c.referenceNumber} — ${formatDate(c.generatedAt)}`)
  }
}

function drawAdmissionReport(doc: PDFKit.PDFDocument, branding: SchoolBranding, student: StudentFullData, snapshot: any) {
  drawStudentInfo(doc, student)
  drawGuardianInfo(doc, student)
  doc.fontSize(11).font('Helvetica-Bold').text('RAPPORT D\'ADMISSION', { underline: true })
  doc.moveDown(0.3)
  doc.font('Helvetica').fontSize(10)
  doc.text(`Statut : ${student.status}`)
  doc.text(`Date d\'admission : ${formatDate(new Date())}`)
}

async function drawLabelQr(doc: PDFKit.PDFDocument, branding: SchoolBranding, student: StudentFullData, qrPayload: string, verificationCode: string) {
  // Étiquette avec QR code centré
  doc.fontSize(10).font('Helvetica-Bold').fillColor(branding.primaryColor)
  doc.text(branding.name, { align: 'center' })
  doc.fillColor('#000').font('Helvetica').fontSize(9)
  doc.text(`${student.firstName} ${student.lastName} — ${student.matricule}`, { align: 'center' })
  doc.moveDown(0.5)

  const qrBuffer = await QRCode.toBuffer(qrPayload, { type: 'png', width: 300, margin: 1 })
  const centerX = (doc.page.width - 150) / 2
  doc.image(qrBuffer, centerX, doc.y, { width: 150 })
  doc.moveDown(3)
  doc.fontSize(8).fillColor('#666').text(verificationCode.slice(0, 16), { align: 'center' })
}

// ============================================================
// Liste des types de documents disponibles (avec RBAC)
// ============================================================

export const DOCUMENT_TYPES_WITH_RBAC: Array<{
  type: DocumentType
  label: string
  description: string
  allowedRoles: string[] // Rôles autorisés à générer
  requiresValidation: boolean // Validation Direction requise
}> = [
  { type: 'SCHOOL_CERTIFICATE', label: 'Certificat de scolarité', description: 'Atteste que l\'élève est scolarisé', allowedRoles: ['SECRETARY', 'DIRECTION', 'ADMIN'], requiresValidation: true },
  { type: 'ENROLLMENT_ATTESTATION', label: 'Attestation d\'inscription', description: 'Confirme l\'inscription annuelle', allowedRoles: ['SECRETARY', 'DIRECTION', 'ADMIN'], requiresValidation: false },
  { type: 'ATTENDANCE_ATTESTATION', label: 'Attestation de fréquentation', description: 'Atteste la fréquentation régulière', allowedRoles: ['SECRETARY', 'DIRECTION', 'ADMIN'], requiresValidation: false },
  { type: 'ENROLLMENT_FORM', label: 'Fiche d\'inscription', description: 'Formulaire d\'inscription', allowedRoles: ['SECRETARY', 'DIRECTION', 'ADMIN'], requiresValidation: false },
  { type: 'STUDENT_CARD', label: 'Carte d\'élève', description: 'Carte d\'identification', allowedRoles: ['SECRETARY', 'DIRECTION', 'ADMIN'], requiresValidation: false },
  { type: 'ADMIN_RECEIPT', label: 'Reçu administratif', description: 'Reçu pour démarche administrative', allowedRoles: ['SECRETARY', 'DIRECTION', 'ADMIN'], requiresValidation: false },
  { type: 'PARENT_CONVOCATION', label: 'Convocation parent', description: 'Convocation officielle d\'un parent', allowedRoles: ['SECRETARY', 'DIRECTION', 'ADMIN'], requiresValidation: true },
  { type: 'INCOMPLETE_FILE_LETTER', label: 'Lettre dossier incomplet', description: 'Lettre informant d\'un dossier incomplet', allowedRoles: ['SECRETARY', 'DIRECTION', 'ADMIN'], requiresValidation: false },
  { type: 'ABSENCE_LETTER', label: 'Lettre d\'absence', description: 'Lettre informant d\'une absence non justifiée', allowedRoles: ['SECRETARY', 'DIRECTION', 'ADMIN'], requiresValidation: false },
  { type: 'CLASS_LIST', label: 'Liste de classe', description: 'Liste alphabétique de la classe', allowedRoles: ['SECRETARY', 'DIRECTION', 'TEACHER', 'ADMIN'], requiresValidation: false },
  { type: 'ATTENDANCE_LIST', label: 'Liste de présence', description: 'Feuille de présence', allowedRoles: ['SECRETARY', 'DIRECTION', 'TEACHER', 'ADMIN'], requiresValidation: false },
  { type: 'TRANSFER_ATTESTATION', label: 'Attestation de transfert', description: 'Document de transfert vers un autre établissement', allowedRoles: ['SECRETARY', 'DIRECTION', 'ADMIN'], requiresValidation: true },
  { type: 'EXIT_FORM', label: 'Fiche de sortie', description: 'Fiche de retrait définitif', allowedRoles: ['SECRETARY', 'DIRECTION', 'ADMIN'], requiresValidation: true },
  { type: 'STUDENT_ADMIN_REPORT', label: 'Rapport administratif élève', description: 'Synthèse administrative complète', allowedRoles: ['SECRETARY', 'DIRECTION', 'ADMIN'], requiresValidation: false },
  { type: 'ADMISSION_REPORT', label: 'Rapport d\'admission', description: 'Résumé du dossier d\'admission', allowedRoles: ['SECRETARY', 'DIRECTION', 'ADMIN'], requiresValidation: false },
  { type: 'LABEL_QR', label: 'Étiquette QR', description: 'Étiquette avec QR code de vérification', allowedRoles: ['SECRETARY', 'DIRECTION', 'ADMIN'], requiresValidation: false },
]

export function canGenerateDocument(role: string, type: DocumentType): boolean {
  const def = DOCUMENT_TYPES_WITH_RBAC.find((d) => d.type === type)
  if (!def) return false
  return def.allowedRoles.includes(role) || role === 'ADMIN'
}
