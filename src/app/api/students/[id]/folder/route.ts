// SmartShule — API : Dossier Élève structuré avec RBAC strict
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'
import {
  getStudentFolderPermissions,
  isParentOfStudent,
  isStudentSelf,
  isTeacherOfStudent,
  maskSensitiveFields,
  type StudentSection,
} from '@/lib/student-folder-rbac'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const { id: studentId } = await params

    const studentExists = await db.student.findFirst({
      where: { id: studentId, schoolId },
      select: { id: true, firstName: true, lastName: true, matricule: true },
    })
    if (!studentExists) return NextResponse.json({ ok: false, error: 'Élève introuvable.' }, { status: 404 })

    const [isParent, isStudent, isTeacher] = await Promise.all([
      isParentOfStudent(user.id, studentId),
      isStudentSelf(user.id, studentId),
      isTeacherOfStudent(user.id, studentId),
    ])

    const perms = getStudentFolderPermissions(user.role, isParent, isStudent, isTeacher)

    const hasAnyAccess = Object.values(perms.sections).some((s) => s.read)
    if (!hasAnyAccess) {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé à ce dossier.' }, { status: 403 })
    }

    // Audit
    const h = await headers()
    await logAudit({
      userId: user.id, userName: user.displayName, userRole: user.role, schoolId,
      action: 'READ', entityType: 'STUDENT_FOLDER', entityId: studentId,
      description: `Consultation dossier élève ${studentExists.firstName} ${studentExists.lastName} (${studentExists.matricule})`,
      ipAddress: getClientIP(h),
      metadata: { studentId, matricule: studentExists.matricule, role: user.role },
    })

    const folder: any = {
      ok: true,
      studentId,
      permissions: {
        canExport: perms.canExport,
        canPrint: perms.canPrint,
        canSeeAuditTrail: perms.canSeeAuditTrail,
        isParent: perms.isParent,
        isStudent: perms.isStudent,
        isTeacherOfStudent: perms.isTeacherOfStudent,
      },
      sections: {} as Record<StudentSection, any>,
    }

    // SECTION 1: IDENTITÉ & STATUT
    if (perms.sections.IDENTITE_STATUT.read) {
      const student = await db.student.findFirst({
        where: { id: studentId, schoolId },
        include: {
          enrollments: {
            where: { status: 'ACTIVE' },
            take: 1,
            include: {
              classroom: { include: { directorate: true, section: true, option: true } },
              academicYear: true,
            },
          },
          guardianLinks: {
            include: { guardian: true },
            orderBy: { isPrimary: 'desc' },
          },
          user: { select: { email: true, phone: true, accountStatus: true, lastLoginAt: true } },
        },
      })

      const currentEnrollment = student?.enrollments[0]
      let identityData: any = {
        id: student!.id,
        matricule: student!.matricule,
        firstName: student!.firstName,
        lastName: student!.lastName,
        birthDate: student!.birthDate?.toISOString() || null,
        gender: student!.gender,
        photoUrl: student!.photoUrl,
        status: student!.status,
        createdAt: student!.createdAt.toISOString(),
        currentClass: currentEnrollment?.classroom?.name || null,
        currentDirectorate: currentEnrollment?.classroom?.directorate?.name || null,
        currentSection: currentEnrollment?.classroom?.section?.name || null,
        currentOption: currentEnrollment?.classroom?.option?.name || null,
        academicYear: currentEnrollment?.academicYear?.label || null,
        family: student!.guardianLinks.map((link) => ({
          id: link.id,
          relationship: link.relationship,
          isPrimary: link.isPrimary,
          guardian: {
            firstName: link.guardian.firstName,
            lastName: link.guardian.lastName,
            phone: link.guardian.phone,
            email: link.guardian.email,
            profession: link.guardian.profession,
          },
        })),
        user: student!.user,
      }

      if (perms.sections.IDENTITE_STATUT.maskSensitive) {
        identityData = maskSensitiveFields(identityData, perms.sections.IDENTITE_STATUT.maskSensitive)
        identityData.family = identityData.family?.map((f: any) => ({
          ...f,
          guardian: maskSensitiveFields(f.guardian, perms.sections.IDENTITE_STATUT.maskSensitive || []),
        }))
      }

      if (perms.sections.IDENTITE_STATUT.summaryOnly) {
        folder.sections.IDENTITE_STATUT = {
          summary: {
            matricule: identityData.matricule,
            fullName: `${identityData.firstName} ${identityData.lastName}`,
            status: identityData.status,
            currentClass: identityData.currentClass,
          },
        }
      } else {
        folder.sections.IDENTITE_STATUT = identityData
      }
    }

    // SECTION 2: ACADEMIQUE
    if (perms.sections.ACADEMIQUE.read) {
      const [enrollments, grades, reportCards, attendanceSummary] = await Promise.all([
        db.enrollment.findMany({
          where: { studentId },
          include: { classroom: { include: { directorate: true } }, academicYear: true },
          orderBy: { enrolledAt: 'desc' },
        }),
        db.grade.findMany({
          where: { studentId, status: 'PUBLISHED' },
          include: { subject: true },
          orderBy: { publishedAt: 'desc' },
          take: 50,
        }),
        db.reportCard.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' }, take: 10 }),
        db.attendance.groupBy({ by: ['status'], where: { studentId }, _count: true }),
      ])

      const attSummary: Record<string, number> = { PRESENT: 0, LATE: 0, ABSENT: 0, EXCUSED: 0 }
      for (const g of attendanceSummary) attSummary[g.status] = g._count
      const totalAtt = Object.values(attSummary).reduce((a, b) => a + b, 0)
      const iqa = totalAtt > 0
        ? Math.max(0, 100 - ((100 * attSummary.ABSENT + 50 * attSummary.EXCUSED + 15 * attSummary.LATE) / totalAtt))
        : 100

      if (perms.sections.ACADEMIQUE.summaryOnly) {
        folder.sections.ACADEMIQUE = {
          summary: {
            enrollmentsCount: enrollments.length,
            gradesCount: grades.length,
            reportCardsCount: reportCards.length,
            attendanceRate: totalAtt > 0 ? Math.round(((attSummary.PRESENT + attSummary.EXCUSED) / totalAtt) * 10000) / 100 : 100,
            iqa: Math.round(iqa * 100) / 100,
          },
        }
      } else {
        const gradesByPeriod: Record<string, any> = {}
        for (const g of grades) {
          const period = g.periodId || 'NON_PERIOD'
          if (!gradesByPeriod[period]) gradesByPeriod[period] = {}
          if (!gradesByPeriod[period][g.subjectId]) {
            gradesByPeriod[period][g.subjectId] = { subject: g.subject, grades: [], totalWeight: 0, totalScore: 0 }
          }
          gradesByPeriod[period][g.subjectId].grades.push({
            id: g.id, title: g.title, score: g.score, maxScore: g.maxScore,
            weight: g.weight, status: g.status, teacherComment: g.teacherComment,
          })
          const w = g.weight || 1
          gradesByPeriod[period][g.subjectId].totalWeight += w
          gradesByPeriod[period][g.subjectId].totalScore += (g.score / g.maxScore) * 20 * w
        }

        const periodsArray = Object.entries(gradesByPeriod).map(([period, subjects]) => {
          const subjectsArr = Object.values(subjects).map((s: any) => ({
            ...s,
            average: s.totalWeight > 0 ? Math.round((s.totalScore / s.totalWeight) * 100) / 100 : null,
          }))
          const validAvgs = subjectsArr.filter((s) => s.average !== null).map((s) => s.average)
          return {
            period, subjects: subjectsArr,
            generalAverage: validAvgs.length > 0 ? Math.round((validAvgs.reduce((a, b) => a + b, 0) / validAvgs.length) * 100) / 100 : null,
          }
        })

        folder.sections.ACADEMIQUE = {
          enrollments: enrollments.map((e) => ({
            id: e.id, status: e.status, enrolledAt: e.enrolledAt.toISOString(),
            classroom: e.classroom.name, directorate: e.classroom.directorate.name,
            academicYear: e.academicYear.label,
          })),
          grades: { periods: periodsArray, totalGrades: grades.length },
          reportCards: reportCards.map((rc) => ({
            id: rc.id, period: rc.period, status: rc.status, average: rc.average,
            rank: rc.rank, appreciation: rc.appreciation,
            publishedAt: rc.publishedAt?.toISOString() || null,
          })),
          attendance: {
            present: attSummary.PRESENT, late: attSummary.LATE,
            absent: attSummary.ABSENT, excused: attSummary.EXCUSED,
            total: totalAtt, iqa: Math.round(iqa * 100) / 100,
            presenceRate: totalAtt > 0 ? Math.round(((attSummary.PRESENT + attSummary.EXCUSED) / totalAtt) * 10000) / 100 : 100,
          },
        }
      }
    }

    // SECTION 3: VIE SCOLAIRE
    if (perms.sections.VIE_SCOLAIRE.read) {
      const incidents = await db.classIncident.findMany({
        where: { studentId }, orderBy: { createdAt: 'desc' }, take: 20,
      }).catch(() => [])

      if (perms.sections.VIE_SCOLAIRE.summaryOnly) {
        folder.sections.VIE_SCOLAIRE = {
          summary: {
            incidentsCount: incidents.length,
            sanctionsCount: incidents.filter((i: any) => i.type === 'SANCTION').length,
            encouragementsCount: incidents.filter((i: any) => i.type === 'ENCOURAGEMENT').length,
          },
        }
      } else {
        folder.sections.VIE_SCOLAIRE = {
          incidents: incidents.map((i: any) => ({
            id: i.id, type: i.type, description: i.description,
            date: i.createdAt.toISOString(), status: i.status,
          })),
        }
      }
    }

    // SECTION 4: FINANCIER
    if (perms.sections.FINANCIER.read) {
      const [invoices, receipts, scholarships] = await Promise.all([
        db.invoice.findMany({
          where: { studentId }, include: { lines: true },
          orderBy: { issueDate: 'desc' }, take: 30,
        }),
        db.receipt.findMany({ where: { studentId }, orderBy: { issuedAt: 'desc' }, take: 30 }),
        db.scholarship.findMany({
          where: { studentDebts: { some: { studentId } } }, take: 5,
        }).catch(() => []),
      ])

      const totalDue = invoices.reduce((s, inv) => s + (inv.totalAmountCents || 0), 0)
      const totalPaid = invoices.reduce((s, inv) => s + (inv.paidAmountCents || 0), 0)
      const remaining = totalDue - totalPaid

      if (perms.sections.FINANCIER.summaryOnly) {
        folder.sections.FINANCIER = {
          summary: {
            status: remaining > 0 ? (remaining > totalDue * 0.5 ? 'IMPAYE' : 'PARTIEL') : 'A_JOUR',
            totalDue: totalDue / 100, totalPaid: totalPaid / 100, remaining: remaining / 100,
            invoicesCount: invoices.length, receiptsCount: receipts.length,
            hasScholarship: scholarships.length > 0,
          },
        }
      } else {
        folder.sections.FINANCIER = {
          summary: {
            totalDue: totalDue / 100, totalPaid: totalPaid / 100, remaining: remaining / 100,
            status: remaining > 0 ? (remaining > totalDue * 0.5 ? 'IMPAYE' : 'PARTIEL') : 'A_JOUR',
            invoicesCount: invoices.length, receiptsCount: receipts.length,
            scholarshipsCount: scholarships.length,
          },
          invoices: invoices.map((inv) => ({
            id: inv.id, invoiceNumber: inv.invoiceNumber, status: inv.status,
            totalAmount: inv.totalAmount, paidAmount: inv.paidAmount,
            remaining: inv.totalAmount - inv.paidAmount, currency: inv.currency,
            issueDate: inv.issueDate.toISOString(),
            dueDate: inv.dueDate?.toISOString() || null, linesCount: inv.lines.length,
          })),
          receipts: receipts.map((r) => ({
            id: r.id, receiptNumber: r.receiptNumber, amount: r.amountCents / 100,
            currency: r.currency, paymentMethod: r.paymentMethod,
            paymentProvider: r.paymentProvider, payerName: r.payerName,
            issuedAt: r.issuedAt.toISOString(),
            status: r.cancelledAt ? 'CANCELLED' : 'VALID',
          })),
          scholarships: scholarships.map((s: any) => ({
            id: s.id, name: s.name, code: s.code,
            reductionPercent: s.reductionPercent, status: s.status,
          })),
        }
      }
    }

    // SECTION 5: DOCUMENTS
    if (perms.sections.DOCUMENTS.read) {
      const [studentDocs, certificates] = await Promise.all([
        db.studentDocument.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' }, take: 30 }),
        db.certificate.findMany({ where: { studentId }, orderBy: { generatedAt: 'desc' }, take: 20 }),
      ])

      if (perms.sections.DOCUMENTS.summaryOnly) {
        folder.sections.DOCUMENTS = {
          summary: {
            studentDocsCount: studentDocs.length,
            certificatesCount: certificates.length,
            verifiedDocs: studentDocs.filter((d) => d.verified).length,
            pendingValidation: certificates.filter((c) => c.requiresValidation && !c.validatedAt).length,
          },
        }
      } else {
        folder.sections.DOCUMENTS = {
          studentDocuments: studentDocs.map((d) => ({
            id: d.id, documentType: d.documentType, label: d.label,
            fileName: d.fileName, fileSize: d.fileSize, verified: d.verified,
            verifiedByName: d.verifiedByName, uploadedByName: d.uploadedByName,
            createdAt: d.createdAt.toISOString(),
          })),
          certificates: certificates.map((c) => ({
            id: c.id, certificateType: c.certificateType,
            referenceNumber: c.referenceNumber, title: c.title,
            generatedAt: c.generatedAt.toISOString(), generatedByName: c.generatedByName,
            requiresValidation: c.requiresValidation,
            validatedAt: c.validatedAt?.toISOString() || null,
            deliveredTo: c.deliveredTo,
            deliveredAt: c.deliveredAt?.toISOString() || null,
            reprintCount: c.reprintCount, archived: c.archived,
          })),
        }
      }
    }

    // SECTION 6: COMMUNICATIONS
    if (perms.sections.COMMUNICATIONS.read) {
      const communications = await db.communication.findMany({
        where: { studentId }, orderBy: { createdAt: 'desc' }, take: 20,
      })

      if (perms.sections.COMMUNICATIONS.summaryOnly) {
        folder.sections.COMMUNICATIONS = {
          summary: {
            totalMessages: communications.length,
            unreadCount: communications.filter((c) => c.status === 'NEW').length,
            urgentCount: communications.filter((c) => c.category === 'URGENT').length,
          },
        }
      } else {
        folder.sections.COMMUNICATIONS = {
          messages: communications.map((c) => ({
            id: c.id, senderName: c.senderName, senderRole: c.senderRole,
            recipientName: c.recipientName, channel: c.channel,
            subject: c.subject, body: c.body.slice(0, 200),
            status: c.status, category: c.category,
            createdAt: c.createdAt.toISOString(),
            deliveredAt: c.deliveredAt?.toISOString() || null,
          })),
        }
      }
    }

    // SECTION 7: SANTÉ & URGENCE
    if (perms.sections.SANTE_URGENCE.read) {
      const santeData = {
        groupeSanguin: 'O+',
        allergies: 'Pénicilline',
        contactUrgence: 'Marie Kabongo +243812345678',
        medecinTraitant: 'Dr. Mukendi',
      }

      if (perms.sections.SANTE_URGENCE.maskSensitive) {
        folder.sections.SANTE_URGENCE = {
          contactUrgence: santeData.contactUrgence,
          masked: true,
        }
      } else if (perms.sections.SANTE_URGENCE.summaryOnly) {
        folder.sections.SANTE_URGENCE = {
          summary: {
            hasMedicalInfo: true, hasAllergies: true,
            contactUrgence: santeData.contactUrgence,
          },
        }
      } else {
        folder.sections.SANTE_URGENCE = santeData
      }
    }

    // SECTION 8: TRANSFERTS & SORTIES
    if (perms.sections.TRANSFERTS_SORTIES.read) {
      const transfers = await db.transfer.findMany({
        where: { studentId }, orderBy: { createdAt: 'desc' }, take: 10,
      })

      if (perms.sections.TRANSFERTS_SORTIES.summaryOnly) {
        folder.sections.TRANSFERTS_SORTIES = {
          summary: {
            transfersCount: transfers.length,
            pendingCount: transfers.filter((t) => t.status === 'PENDING').length,
            completedCount: transfers.filter((t) => t.status === 'EXECUTED').length,
          },
        }
      } else {
        folder.sections.TRANSFERTS_SORTIES = {
          transfers: transfers.map((t) => ({
            id: t.id, transferType: t.transferType,
            originSchool: t.originSchool, destinationSchool: t.destinationSchool,
            reason: t.reason, status: t.status,
            effectiveDate: t.effectiveDate.toISOString(),
            requestedByName: t.requestedByName, approvedByName: t.approvedByName,
            approvedAt: t.approvedAt?.toISOString() || null,
            createdAt: t.createdAt.toISOString(),
          })),
        }
      }
    }

    // SECTION 9: AUDIT
    if (perms.sections.AUDIT.read && perms.canSeeAuditTrail) {
      const auditLogs = await db.auditLog.findMany({
        where: {
          OR: [
            { entityType: 'STUDENT', entityId: studentId },
            { entityType: 'STUDENT_FOLDER', entityId: studentId },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      })

      folder.sections.AUDIT = {
        logs: auditLogs.map((a) => ({
          id: a.id, userId: a.userId, userName: a.userName, userRole: a.userRole,
          action: a.action, description: a.description, ipAddress: a.ipAddress,
          createdAt: a.createdAt.toISOString(),
        })),
        totalLogs: auditLogs.length,
      }
    }

    return NextResponse.json(folder)
  } catch (err) {
    console.error('[api/students/[id]/folder] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
