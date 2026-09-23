// SmartShule — API : Détail complet d'un élève (dossier centralisé)
// ============================================================
// GET /api/students/[id]
// Retourne TOUTES les données de l'élève :
//   - Identité (nom, matricule, naissance, photo, statut)
//   - Dossier familial (parents, tuteurs, contacts, profession)
//   - Scolarité (inscriptions historiques + actuelle)
//   - Finances (dettes, reçus, factures, bourses, restes à payer)
//   - Notes & Bulletins (par période, par matière, moyennes)
//   - Présences (résumé IQA, absences, retards, justificatifs)
//   - Documents (attestations, cartes, bulletins générés)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    }

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) {
      return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })
    }

    const { id: studentId } = await params

    // ---------------------------------------------------------------
    // 1. IDENTITÉ — Student core + statut financier
    // ---------------------------------------------------------------
    const student = await db.student.findFirst({
      where: { id: studentId, schoolId },
      include: {
        enrollments: {
          include: {
            classroom: {
              include: {
                directorate: true,
                section: true,
                option: true,
              },
            },
            academicYear: true,
            studentDebts: true,
          },
          orderBy: { enrolledAt: 'desc' },
        },
        financialStatus: true,
        guardianLinks: {
          include: {
            guardian: true,
          },
          orderBy: { isPrimary: 'desc' },
        },
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            accountStatus: true,
            lastLoginAt: true,
          },
        },
      },
    })

    if (!student) {
      return NextResponse.json({ ok: false, error: 'Élève introuvable.' }, { status: 404 })
    }

    // ---------------------------------------------------------------
    // 2. FINANCES — Dettes + Reçus + Factures
    // ---------------------------------------------------------------
    const [studentDebts, receipts, invoices] = await Promise.all([
      // Toutes les dettes (toutes périodes confondues) — inclut les bourses via scholarship
      db.studentDebt.findMany({
        where: { studentId, schoolId },
        include: {
          invoiceLineConfig: { select: { id: true, name: true, description: true, code: true } },
          directorate: { select: { id: true, name: true, code: true } },
          classroom: { select: { id: true, name: true } },
          academicYear: { select: { id: true, label: true } },
          scholarship: { select: { id: true, name: true, code: true, reductionPercent: true, appliesToCategory: true, status: true } },
          receipts: {
            orderBy: { issuedAt: 'desc' },
            take: 5,
            select: {
              id: true,
              receiptNumber: true,
              amountCents: true,
              currency: true,
              paymentMethod: true,
              payerName: true,
              issuedAt: true,
              cancelledAt: true,
            },
          },
        },
        orderBy: [{ academicYearId: 'desc' }, { period: 'asc' }],
      }),

      // Tous les reçus émis pour cet élève
      db.receipt.findMany({
        where: { studentId, schoolId },
        orderBy: { issuedAt: 'desc' },
        take: 50,
        include: {
          mobileMoneyPayment: { select: { id: true, provider: true, providerTransactionId: true, status: true } },
        },
      }),

      // Factures classiques (legacy)
      db.invoice.findMany({
        where: { studentId, schoolId },
        include: {
          lines: true,
          payments: { orderBy: { paidAt: 'desc' } },
          academicYear: { select: { id: true, label: true } },
        },
        orderBy: { issueDate: 'desc' },
        take: 30,
      }),
    ])

    // ---------------------------------------------------------------
    // 3. NOTES & BULLETINS
    // ---------------------------------------------------------------
    const [grades, reportCards] = await Promise.all([
      db.grade.findMany({
        where: { studentId, schoolId, status: 'PUBLISHED' },
        include: {
          subject: { select: { id: true, name: true, code: true } },
          classroom: { select: { id: true, name: true } },
        },
        orderBy: { publishedAt: 'desc' },
        take: 100,
      }),
      db.reportCard.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ])

    // ---------------------------------------------------------------
    // 4. PRÉSENCES — Résumé + dernières absences
    // ---------------------------------------------------------------
    const [attendanceSummary, recentAttendances] = await Promise.all([
      // Comptages groupés par statut
      db.attendance.groupBy({
        by: ['status'],
        where: { studentId, schoolId },
        _count: true,
      }),
      // 30 dernières absences/retards
      db.attendance.findMany({
        where: {
          studentId,
          schoolId,
          status: { in: ['ABSENT', 'LATE'] },
        },
        include: {
          course: {
            select: {
              id: true,
              title: true,
              subject: { select: { id: true, name: true } },
              teacher: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { date: 'desc' },
        take: 30,
      }),
    ])

    // Convertir le groupBy en objet simple
    const attSummary: Record<string, number> = {
      PRESENT: 0,
      LATE: 0,
      ABSENT: 0,
      EXCUSED: 0,
    }
    for (const g of attendanceSummary) {
      attSummary[g.status] = g._count
    }
    const totalAttendance = attSummary.PRESENT + attSummary.LATE + attSummary.ABSENT + attSummary.EXCUSED
    const totalNonExcused = attSummary.ABSENT
    const totalExcused = attSummary.EXCUSED
    const totalLate = attSummary.LATE
    // IQA = MAX(0, 100 - ((100*A_non_exc + 50*A_exc + 15*R) / Total))
    const iqa = totalAttendance > 0
      ? Math.max(0, 100 - ((100 * totalNonExcused + 50 * totalExcused + 15 * totalLate) / totalAttendance))
      : 100

    // ---------------------------------------------------------------
    // 5. FORMATAGE FINANCIER — Calcul des totaux
    // ---------------------------------------------------------------
    const totalDueCents = studentDebts.reduce((sum, d) => sum + (d.amountDueCents || 0), 0)
    const totalPaidCents = studentDebts.reduce((sum, d) => sum + (d.amountPaidCents || 0), 0)
    const totalCancelledCents = studentDebts.reduce((sum, d) => sum + (d.amountCancelledCents || 0), 0)
    const totalReductionCents = studentDebts.reduce((sum, d) => sum + (d.reductionAmountCents || 0), 0)
    const currency = studentDebts[0]?.currency || 'CDF'
    const remainingCents = totalDueCents - totalPaidCents - totalCancelledCents

    // Bourses appliquées (uniques, via studentDebts)
    const scholarshipMap = new Map<string, any>()
    for (const d of studentDebts) {
      if (d.scholarship && !scholarshipMap.has(d.scholarship.id)) {
        scholarshipMap.set(d.scholarship.id, d.scholarship)
      }
    }
    const scholarships = Array.from(scholarshipMap.values())

    // ---------------------------------------------------------------
    // 6. FORMATAGE NOTES — Grouper par période puis par matière
    // ---------------------------------------------------------------
    const gradesByPeriod: Record<string, Record<string, any>> = {}
    for (const g of grades) {
      const period = g.periodId || 'NON_PERIOD'
      if (!gradesByPeriod[period]) gradesByPeriod[period] = {}
      const subjectKey = g.subjectId
      if (!gradesByPeriod[period][subjectKey]) {
        gradesByPeriod[period][subjectKey] = {
          subject: g.subject,
          grades: [],
          average: null,
          totalWeight: 0,
          totalScore: 0,
        }
      }
      gradesByPeriod[period][subjectKey].grades.push({
        id: g.id,
        title: g.title,
        score: g.score,
        maxScore: g.maxScore,
        weight: g.weight,
        status: g.status,
        publishedAt: g.publishedAt,
        teacherComment: g.teacherComment,
        scorePercent: g.maxScore > 0 ? (g.score / g.maxScore) * 100 : null,
      })
      const w = g.weight || 1
      gradesByPeriod[period][subjectKey].totalWeight += w
      gradesByPeriod[period][subjectKey].totalScore += (g.score / g.maxScore) * 20 * w
    }
    // Calcul moyenne par matière
    const gradesByPeriodArray = Object.entries(gradesByPeriod).map(([period, subjects]) => {
      const subjectsArray = Object.values(subjects).map((s: any) => {
        const avg = s.totalWeight > 0 ? s.totalScore / s.totalWeight : null
        return { ...s, average: avg ? Math.round(avg * 100) / 100 : null }
      })
      // Moyenne générale = moyenne des moyennes de matières
      const validAverages = subjectsArray.filter((s) => s.average !== null).map((s) => s.average)
      const generalAvg = validAverages.length > 0
        ? validAverages.reduce((a, b) => a + b, 0) / validAverages.length
        : null
      return {
        period,
        subjects: subjectsArray,
        generalAverage: generalAvg ? Math.round(generalAvg * 100) / 100 : null,
        gradesCount: subjectsArray.reduce((sum, s) => sum + s.grades.length, 0),
      }
    })

    // ---------------------------------------------------------------
    // 7. RÉPONSE FINALE
    // ---------------------------------------------------------------
    const currentEnrollment = student.enrollments.find((e) => e.status === 'ACTIVE') || student.enrollments[0]
    const finStatus = student.financialStatus?.[0]

    const response = {
      ok: true,
      student: {
        id: student.id,
        matricule: student.matricule,
        firstName: student.firstName,
        lastName: student.lastName,
        fullName: `${student.firstName} ${student.lastName}`,
        birthDate: student.birthDate?.toISOString() || null,
        gender: student.gender,
        photoUrl: student.photoUrl,
        status: student.status,
        createdAt: student.createdAt.toISOString(),
        user: student.user,
      },
      family: student.guardianLinks.map((link) => ({
        id: link.id,
        relationship: link.relationship,
        isPrimary: link.isPrimary,
        guardian: {
          id: link.guardian.id,
          firstName: link.guardian.firstName,
          lastName: link.guardian.lastName,
          fullName: `${link.guardian.firstName} ${link.guardian.lastName}`,
          phone: link.guardian.phone,
          email: link.guardian.email,
          address: link.guardian.address,
          profession: link.guardian.profession,
        },
      })),
      enrollments: student.enrollments.map((e) => ({
        id: e.id,
        status: e.status,
        enrolledAt: e.enrolledAt.toISOString(),
        classroom: {
          id: e.classroom.id,
          name: e.classroom.name,
          directorate: e.classroom.directorate,
          section: e.classroom.section?.name || null,
          option: e.classroom.option?.name || null,
        },
        academicYear: e.academicYear,
      })),
      currentEnrollment: currentEnrollment
        ? {
            id: currentEnrollment.id,
            classroom: currentEnrollment.classroom,
            academicYear: currentEnrollment.academicYear,
          }
        : null,
      financialStatus: finStatus
        ? {
            status: finStatus.status,
            reason: finStatus.reason,
            updatedAt: finStatus.updatedAt?.toISOString(),
          }
        : { status: 'REGULAR', reason: null, updatedAt: null },
      finances: {
        summary: {
          totalDueCents,
          totalPaidCents,
          totalCancelledCents,
          totalReductionCents,
          currency,
          debtsCount: studentDebts.length,
          debtsOpen: studentDebts.filter((d) => d.status === 'OPEN').length,
          debtsPartiallyPaid: studentDebts.filter((d) => d.status === 'PARTIALLY_PAID').length,
          debtsPaid: studentDebts.filter((d) => d.status === 'PAID').length,
          debtsCancelled: studentDebts.filter((d) => d.status === 'CANCELLED').length,
          receiptsCount: receipts.length,
          invoicesCount: invoices.length,
          scholarshipsCount: scholarships.length,
          remainingCents,
          totalDue: totalDueCents / 100,
          totalPaid: totalPaidCents / 100,
          remaining: remainingCents / 100,
          totalReduction: totalReductionCents / 100,
        },
        debts: studentDebts.map((d) => ({
          id: d.id,
          status: d.status,
          period: d.period,
          currency: d.currency,
          amountDue: (d.amountDueCents || 0) / 100,
          amountPaid: (d.amountPaidCents || 0) / 100,
          amountCancelled: (d.amountCancelledCents || 0) / 100,
          remaining: ((d.amountDueCents || 0) - (d.amountPaidCents || 0) - (d.amountCancelledCents || 0)) / 100,
          reductionPercent: d.reductionPercent,
          reductionAmount: (d.reductionAmountCents || 0) / 100,
          feeLabel: d.invoiceLineConfig?.name || 'Frais',
          feeDescription: d.invoiceLineConfig?.description,
          directorateName: d.directorate?.name,
          classroomName: d.classroom?.name,
          academicYearLabel: d.academicYear?.label,
          scholarshipName: d.scholarship?.name,
          generatedAt: d.generatedAt.toISOString(),
          lastPaymentAt: d.lastPaymentAt?.toISOString() || null,
          closedAt: d.closedAt?.toISOString() || null,
          recentReceipts: d.receipts.map((r) => ({
            id: r.id,
            receiptNumber: r.receiptNumber,
            amountCents: r.amountCents,
            currency: r.currency,
            paymentMethod: r.paymentMethod,
            payerName: r.payerName,
            issuedAt: r.issuedAt.toISOString(),
            status: r.cancelledAt ? 'CANCELLED' : 'VALID',
          })),
        })),
        receipts: receipts.map((r) => ({
          id: r.id,
          receiptNumber: r.receiptNumber,
          receiptType: r.receiptType,
          amount: r.amountCents / 100,
          currency: r.currency,
          paymentMethod: r.paymentMethod,
          paymentProvider: r.paymentProvider,
          transactionReference: r.transactionReference,
          payerName: r.payerName,
          payerPhone: r.payerPhone,
          status: r.cancelledAt ? 'CANCELLED' : 'VALID',
          cancelledAt: r.cancelledAt?.toISOString() || null,
          cancellationReason: r.cancellationReason,
          issuedAt: r.issuedAt.toISOString(),
          debtLabel: null, // pas d'include sur studentDebt car receipts est query séparée
          debtPeriod: null,
          mobileMoney: r.mobileMoneyPayment
            ? {
                provider: r.mobileMoneyPayment.provider,
                transactionId: r.mobileMoneyPayment.providerTransactionId,
                status: r.mobileMoneyPayment.status,
              }
            : null,
        })),
        invoices: invoices.map((inv) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          status: inv.status,
          totalAmount: inv.totalAmount,
          paidAmount: inv.paidAmount,
          remaining: inv.totalAmount - inv.paidAmount,
          currency: inv.currency,
          issueDate: inv.issueDate.toISOString(),
          dueDate: inv.dueDate?.toISOString() || null,
          academicYearLabel: inv.academicYear?.label,
          linesCount: inv.lines.length,
          paymentsCount: inv.payments.length,
        })),
        scholarships: scholarships.map((s) => ({
          id: s.id,
          name: s.name,
          code: s.code,
          reductionPercent: s.reductionPercent,
          appliesToCategory: s.appliesToCategory,
          status: s.status,
        })),
      },
      grades: {
        periods: gradesByPeriodArray,
        reportCards: reportCards.map((rc) => ({
          id: rc.id,
          period: rc.period,
          status: rc.status,
          average: rc.average,
          rank: rc.rank,
          appreciation: rc.appreciation,
          publishedAt: rc.publishedAt?.toISOString() || null,
          academicYearId: rc.academicYearId,
        })),
        totalGrades: grades.length,
        subjectsCount: new Set(grades.map((g) => g.subjectId)).size,
      },
      attendance: {
        summary: {
          present: attSummary.PRESENT,
          late: attSummary.LATE,
          absent: attSummary.ABSENT,
          excused: attSummary.EXCUSED,
          total: totalAttendance,
          iqa: Math.round(iqa * 100) / 100,
          presenceRate: totalAttendance > 0
            ? Math.round(((attSummary.PRESENT + attSummary.EXCUSED) / totalAttendance) * 10000) / 100
            : 100,
        },
        recent: recentAttendances.map((a) => ({
          id: a.id,
          date: a.date.toISOString(),
          status: a.status,
          justified: a.justified,
          justification: a.justification,
          subjectName: a.course?.subject?.name || a.course?.title || '—',
          teacherName: a.course?.teacher
            ? `${a.course.teacher.firstName} ${a.course.teacher.lastName}`
            : null,
        })),
      },
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[api/students/[id]] Error:', err)
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    )
  }
}
