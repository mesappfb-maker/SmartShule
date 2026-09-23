// API : Centre Documents & Certificats — Secrétariat
// ============================================================
// GET : liste certificats, documents élève, modèles
// POST : générer certificat, uploader document, valider document, remettre certificat

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Types de certificats disponibles
const CERTIFICATE_TYPES = [
  { value: 'SCHOOL_CERTIFICATE', label: 'Certificat de scolarité' },
  { value: 'ENROLLMENT_ATTESTATION', label: 'Attestation d\'inscription' },
  { value: 'ATTENDANCE_ATTESTATION', label: 'Attestation de fréquentation' },
  { value: 'STUDENT_CARD', label: 'Carte élève' },
  { value: 'PARENT_CONVOCATION', label: 'Convocation parent' },
  { value: 'ABSENCE_LETTER', label: 'Lettre d\'absence' },
  { value: 'CLASS_LIST', label: 'Liste de classe' },
  { value: 'TRANSFER_ATTESTATION', label: 'Attestation de transfert' },
  { value: 'ENROLLMENT_FORM', label: 'Fiche d\'inscription' },
  { value: 'LABEL_QR', label: 'Étiquette QR/Code-barres' },
] as const

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (user.role !== 'SECRETARY' && user.role !== 'DIRECTION' && user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
    }

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const url = new URL(req.url)
    const sub = url.searchParams.get('sub') || 'certificates' // certificates | student-docs | templates | types
    const studentId = url.searchParams.get('studentId')
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = parseInt(url.searchParams.get('limit') || '50', 10)

    if (sub === 'types') {
      return NextResponse.json({ ok: true, types: CERTIFICATE_TYPES })
    }

    if (sub === 'templates') {
      const templates = await db.certificateTemplate.findMany({
        where: { schoolId, isActive: true },
        orderBy: [{ name: 'asc' }],
      })
      return NextResponse.json({
        ok: true,
        templates: templates.map((t) => ({
          id: t.id,
          name: t.name,
          certificateType: t.certificateType,
          requiresValidation: t.requiresValidation,
          createdByName: t.createdByName,
        })),
      })
    }

    if (sub === 'student-docs') {
      if (!studentId) return NextResponse.json({ ok: false, error: 'studentId requis.' }, { status: 400 })

      const docs = await db.studentDocument.findMany({
        where: { schoolId, studentId },
        orderBy: [{ createdAt: 'desc' }],
      })

      return NextResponse.json({
        ok: true,
        documents: docs.map((d) => ({
          id: d.id,
          documentType: d.documentType,
          label: d.label,
          fileName: d.fileName,
          fileSize: d.fileSize,
          mimeType: d.mimeType,
          verified: d.verified,
          verifiedByName: d.verifiedByName,
          verifiedAt: d.verifiedAt?.toISOString() || null,
          uploadedByName: d.uploadedByName,
          createdAt: d.createdAt.toISOString(),
        })),
      })
    }

    // Certificats (défaut)
    const where: any = { schoolId, archived: false }
    if (studentId) where.studentId = studentId

    const certificateType = url.searchParams.get('certificateType')
    if (certificateType) where.certificateType = certificateType

    const [certificates, total] = await Promise.all([
      db.certificate.findMany({
        where,
        include: {
          student: { select: { firstName: true, lastName: true, matricule: true } },
        },
        orderBy: [{ generatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.certificate.count({ where }),
    ])

    // Stats
    const [totalGenerated, pendingValidation, deliveredThisMonth] = await Promise.all([
      db.certificate.count({ where: { schoolId } }),
      db.certificate.count({ where: { schoolId, requiresValidation: true, validatedAt: null } }),
      db.certificate.count({
        where: {
          schoolId,
          deliveredAt: { not: null },
          generatedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
    ])

    return NextResponse.json({
      ok: true,
      certificates: certificates.map((c) => ({
        id: c.id,
        studentId: c.studentId,
        studentName: `${c.student.firstName} ${c.student.lastName}`,
        matricule: c.student.matricule,
        certificateType: c.certificateType,
        referenceNumber: c.referenceNumber,
        title: c.title,
        generatedAt: c.generatedAt.toISOString(),
        generatedByName: c.generatedByName,
        pdfUrl: c.pdfUrl,
        requiresValidation: c.requiresValidation,
        validatedByName: c.validatedByName,
        validatedAt: c.validatedAt?.toISOString() || null,
        deliveredTo: c.deliveredTo,
        deliveredAt: c.deliveredAt?.toISOString() || null,
        reprintCount: c.reprintCount,
        reason: c.reason,
      })),
      stats: { totalGenerated, pendingValidation, deliveredThisMonth },
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error('[api/secretariat/documents] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (user.role !== 'SECRETARY' && user.role !== 'DIRECTION' && user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
    }

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const body = await req.json()
    const { action } = body

    // Générer un certificat
    if (action === 'generate-certificate') {
      const { studentId, certificateType, reason, templateId } = body
      if (!studentId || !certificateType) {
        return NextResponse.json({ ok: false, error: 'studentId et certificateType requis.' }, { status: 400 })
      }

      const student = await db.student.findUnique({
        where: { id: studentId },
        include: {
          school: true,
          enrollments: { where: { status: 'ACTIVE' }, take: 1, include: { classroom: { include: { directorate: true } }, academicYear: true } },
          guardianLinks: { take: 1, include: { guardian: true } },
        },
      })
      if (!student || student.schoolId !== schoolId) {
        return NextResponse.json({ ok: false, error: 'Élève introuvable.' }, { status: 404 })
      }

      // Générer le numéro de référence chronologique
      const year = new Date().getFullYear()
      const count = await db.certificate.count({ where: { schoolId } })
      const referenceNumber = `CERT-${year}-${String(count + 1).padStart(6, '0')}`

      // Trouver le type label
      const typeInfo = CERTIFICATE_TYPES.find((t) => t.value === certificateType)
      const title = typeInfo ? typeInfo.label : certificateType

      // Vérifier si le type nécessite une validation direction
      const template = templateId ? await db.certificateTemplate.findUnique({ where: { id: templateId } }) : null
      const requiresValidation = template?.requiresValidation || ['SCHOOL_CERTIFICATE', 'TRANSFER_ATTESTATION'].includes(certificateType)

      const certificate = await db.certificate.create({
        data: {
          schoolId,
          studentId,
          certificateType,
          referenceNumber,
          title,
          templateId: templateId || null,
          reason: reason || null,
          generatedById: user.id,
          generatedByName: user.displayName,
          requiresValidation,
        },
      })

      // Créer une tâche admin si validation requise
      if (requiresValidation) {
        await db.adminTask.create({
          data: {
            schoolId,
            studentId,
            title: `Validation certificat: ${title}`,
            description: `Réf: ${referenceNumber} — ${student.firstName} ${student.lastName}`,
            category: 'DOCUMENT',
            priority: 'NORMAL',
            status: 'WAITING_DIRECTION',
            createdById: user.id,
            createdByName: user.displayName,
          },
        })
      }

      // Données pour génération PDF (renvoyées au client)
      const pdfData = {
        referenceNumber,
        schoolName: student.school.name,
        schoolAddress: student.school.address,
        schoolPhone: student.school.phone,
        schoolEmail: student.school.email,
        schoolLogo: student.school.logoUrl,
        studentName: `${student.firstName} ${student.lastName}`,
        matricule: student.matricule,
        birthDate: student.birthDate?.toISOString() || null,
        gender: student.gender,
        classroomName: student.enrollments[0]?.classroom?.name || '—',
        directorateName: student.enrollments[0]?.classroom?.directorate?.name || '—',
        academicYearLabel: student.enrollments[0]?.academicYear?.label || '—',
        guardianName: student.guardianLinks[0]?.guardian ? `${student.guardianLinks[0].guardian.firstName} ${student.guardianLinks[0].guardian.lastName}` : '—',
        generatedAt: new Date().toISOString(),
        certificateType,
        title,
      }

      return NextResponse.json({
        ok: true,
        id: certificate.id,
        referenceNumber,
        requiresValidation,
        pdfData,
        message: requiresValidation ? 'Certificat créé, en attente de validation direction' : 'Certificat prêt',
      })
    }

    // Valider un certificat (Direction)
    if (action === 'validate-certificate') {
      if (user.role !== 'DIRECTION' && user.role !== 'ADMIN') {
        return NextResponse.json({ ok: false, error: 'Seul le directeur peut valider un certificat.' }, { status: 403 })
      }

      const { certificateId } = body
      if (!certificateId) return NextResponse.json({ ok: false, error: 'certificateId requis.' }, { status: 400 })

      await db.certificate.update({
        where: { id: certificateId },
        data: { validatedById: user.id, validatedByName: user.displayName, validatedAt: new Date() },
      })

      // Marquer la tâche admin
      await db.adminTask.updateMany({
        where: { schoolId, category: 'DOCUMENT', status: 'WAITING_DIRECTION' },
        data: { status: 'DONE', completedAt: new Date() },
      })

      return NextResponse.json({ ok: true, message: 'Certificat validé' })
    }

    // Enregistrer la remise d'un certificat
    if (action === 'deliver-certificate') {
      const { certificateId, deliveredTo } = body
      if (!certificateId) return NextResponse.json({ ok: false, error: 'certificateId requis.' }, { status: 400 })

      await db.certificate.update({
        where: { id: certificateId },
        data: { deliveredTo: deliveredTo || null, deliveredAt: new Date(), deliveredById: user.id },
      })

      return NextResponse.json({ ok: true, message: 'Remise enregistrée' })
    }

    // Réimpression
    if (action === 'reprint-certificate') {
      const { certificateId } = body
      if (!certificateId) return NextResponse.json({ ok: false, error: 'certificateId requis.' }, { status: 400 })

      const cert = await db.certificate.findUnique({ where: { id: certificateId } })
      if (!cert) return NextResponse.json({ ok: false, error: 'Certificat introuvable.' }, { status: 404 })

      await db.certificate.update({
        where: { id: certificateId },
        data: { reprintCount: cert.reprintCount + 1, lastReprintAt: new Date(), lastReprintById: user.id },
      })

      return NextResponse.json({ ok: true, message: 'Réimpression enregistrée', reprintCount: cert.reprintCount + 1 })
    }

    // Uploader un document dans le dossier élève
    if (action === 'upload-document') {
      const { studentId, documentType, label, fileName, systemFileName, fileUrl, fileSize, mimeType } = body
      if (!studentId || !documentType || !fileName || !fileUrl) {
        return NextResponse.json({ ok: false, error: 'studentId, documentType, fileName et fileUrl requis.' }, { status: 400 })
      }

      const doc = await db.studentDocument.create({
        data: {
          schoolId,
          studentId,
          documentType,
          label: label || fileName,
          fileName,
          systemFileName: systemFileName || fileName,
          fileUrl,
          fileSize: fileSize || 0,
          mimeType: mimeType || 'application/octet-stream',
          uploadedById: user.id,
          uploadedByName: user.displayName,
        },
      })

      return NextResponse.json({ ok: true, id: doc.id, message: 'Document ajouté' })
    }

    // Vérifier un document
    if (action === 'verify-document') {
      const { documentId } = body
      if (!documentId) return NextResponse.json({ ok: false, error: 'documentId requis.' }, { status: 400 })

      await db.studentDocument.update({
        where: { id: documentId },
        data: { verified: true, verifiedById: user.id, verifiedByName: user.displayName, verifiedAt: new Date() },
      })

      return NextResponse.json({ ok: true, message: 'Document vérifié' })
    }

    return NextResponse.json({ ok: false, error: `Action "${action}" inconnue.` }, { status: 400 })
  } catch (err) {
    console.error('[api/secretariat/documents POST] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
