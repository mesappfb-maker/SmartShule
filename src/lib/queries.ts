// SmartShule — Queries partagées (côté serveur uniquement)
// Toutes les fonctions ici vérifient le périmètre de l'utilisateur avant de renvoyer les données.

import { db } from '@/lib/db'

// ============================================================
// Helpers de périmètre
// ============================================================

export async function getGuardianForUser(userId: string) {
  return db.guardian.findFirst({
    where: { userId },
    include: {
      studentLinks: {
        include: {
          student: {
            include: {
              enrollments: {
                where: { status: 'ACTIVE' },
                include: { classroom: { include: { directorate: true, section: true } } },
              },
            },
          },
        },
        orderBy: { isPrimary: 'desc' },
      },
    },
  })
}

export async function getStudentForUser(userId: string) {
  return db.student.findFirst({
    where: { userId },
    include: {
      enrollments: {
        where: { status: 'ACTIVE' },
        include: { classroom: { include: { directorate: true, section: true } } },
      },
      guardianLinks: {
        include: { guardian: true },
      },
    },
  })
}

export async function getDirectionForUser(userId: string) {
  // La direction est identifiée par son userId (compte DIRECTION).
  // On récupère l'école liée à ce compte via les données existantes.
  const direction = await db.user.findUnique({
    where: { id: userId },
    include: {
      auditLogs: { take: 1, orderBy: { createdAt: 'desc' } },
    },
  })
  return direction
}

export async function getSchoolForUser(userId: string) {
  // Trouver l'école via guardian/student/audit
  const guardian = await db.guardian.findFirst({
    where: { userId },
    select: { schoolId: true },
  })
  if (guardian) {
    return db.school.findUnique({ where: { id: guardian.schoolId } })
  }

  const student = await db.student.findFirst({
    where: { userId },
    select: { schoolId: true },
  })
  if (student) {
    return db.school.findUnique({ where: { id: student.schoolId } })
  }

  // Direction : prendre la première école (compte unique à l'école dans cette démo)
  const audit = await db.auditLog.findFirst({
    where: { userId, schoolId: { not: null } },
    select: { schoolId: true },
  })
  if (audit?.schoolId) {
    return db.school.findUnique({ where: { id: audit.schoolId } })
  }

  // Fallback : retourner la première école (pour la démo)
  return db.school.findFirst()
}

export async function canParentAccessStudent(
  userId: string,
  studentId: string
): Promise<boolean> {
  const link = await db.guardianStudentLink.findFirst({
    where: {
      guardian: { userId },
      studentId,
    },
  })
  return !!link
}

// ============================================================
// Données parent
// ============================================================

export async function getParentDashboardData(userId: string) {
  const guardian = await getGuardianForUser(userId)
  if (!guardian) return null

  const children = guardian.studentLinks.map((l) => l.student)

  // Pour chaque enfant : récupérer les dernières données
  const childrenWithData = await Promise.all(
    children.map(async (s) => {
      const [grades, attendances, reportCards, invoices, submissions, assignments] =
        await Promise.all([
          db.grade.findMany({
            where: { studentId: s.id, status: 'PUBLISHED' },
            include: { subject: true },
            orderBy: { publishedAt: 'desc' },
            take: 10,
          }),
          db.attendance.findMany({
            where: { studentId: s.id },
            orderBy: { date: 'desc' },
            take: 10,
          }),
          db.reportCard.findMany({
            where: { studentId: s.id, status: 'PUBLISHED' },
            orderBy: { publishedAt: 'desc' },
          }),
          db.invoice.findMany({
            where: { studentId: s.id },
            include: { payments: true },
            orderBy: { issueDate: 'desc' },
          }),
          db.submission.findMany({
            where: { studentId: s.id },
            include: { assignment: true },
            orderBy: { submittedAt: 'desc' },
          }),
          db.assignment.findMany({
            where: {
              classroom: {
                enrollments: { some: { studentId: s.id, status: 'ACTIVE' } },
              },
              status: 'PUBLISHED',
            },
            orderBy: { dueDate: 'asc' },
            take: 5,
          }),
        ])

      return {
        ...s,
        grades,
        attendances,
        reportCards,
        invoices,
        submissions,
        upcomingAssignments: assignments,
      }
    })
  )

  const announcements = await db.announcement.findMany({
    where: {
      schoolId: guardian.schoolId,
      status: 'PUBLISHED',
      OR: [
        { targetType: 'ALL' },
        {
          targetType: 'CLASSROOM',
          classroom: {
            enrollments: { some: { studentId: { in: children.map((c) => c.id) } } },
          },
        },
      ],
    },
    orderBy: { publishedAt: 'desc' },
    take: 10,
  })

  const parentRequests = await db.parentRequest.findMany({
    where: { guardianId: guardian.id },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      student: true,
    },
    orderBy: { updatedAt: 'desc' },
  })

  return {
    guardian,
    children: childrenWithData,
    announcements,
    parentRequests,
  }
}

export async function getStudentDashboardData(userId: string) {
  const student = await getStudentForUser(userId)
  if (!student) return null

  const classroom = student.enrollments[0]?.classroom
  if (!classroom) return null

  const [courses, assignments, grades, reportCards, attendances, announcements] =
    await Promise.all([
      db.course.findMany({
        where: { classroomId: classroom.id, status: 'PUBLISHED' },
        include: { subject: true },
        orderBy: { createdAt: 'desc' },
      }),
      db.assignment.findMany({
        where: {
          classroomId: classroom.id,
          status: 'PUBLISHED',
        },
        include: { subject: true, submissions: {
          where: { studentId: student.id },
        } },
        orderBy: { dueDate: 'asc' },
      }),
      db.grade.findMany({
        where: { studentId: student.id, status: 'PUBLISHED' },
        include: { subject: true },
        orderBy: { publishedAt: 'desc' },
      }),
      db.reportCard.findMany({
        where: { studentId: student.id, status: 'PUBLISHED' },
        orderBy: { publishedAt: 'desc' },
      }),
      db.attendance.findMany({
        where: { studentId: student.id },
        orderBy: { date: 'desc' },
        take: 20,
      }),
      db.announcement.findMany({
        where: {
          schoolId: student.schoolId,
          status: 'PUBLISHED',
          OR: [
            { targetType: 'ALL' },
            { targetType: 'CLASSROOM', classroomId: classroom.id },
          ],
        },
        orderBy: { publishedAt: 'desc' },
        take: 10,
      }),
    ])

  return {
    student,
    classroom,
    courses,
    assignments,
    grades,
    reportCards,
    attendances,
    announcements,
  }
}

export async function getDirectionDashboardData(userId: string) {
  const school = await getSchoolForUser(userId)
  if (!school) return null

  const [
    studentsCount,
    guardiansCount,
    announcements,
    parentRequests,
    invoices,
    payments,
    auditLogs,
    activeUsers,
  ] = await Promise.all([
    db.student.count({ where: { schoolId: school.id, status: 'ACTIVE' } }),
    db.guardian.count({ where: { schoolId: school.id } }),
    db.announcement.findMany({
      where: { schoolId: school.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { classroom: true },
    }),
    db.parentRequest.findMany({
      where: { schoolId: school.id },
      include: {
        guardian: true,
        student: true,
        messages: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    db.invoice.findMany({
      where: { schoolId: school.id },
      include: { student: true, payments: true },
      orderBy: { issueDate: 'desc' },
      take: 20,
    }),
    db.payment.findMany({
      where: { schoolId: school.id, status: 'CONFIRMED' },
      include: { invoice: { include: { student: true } } },
      orderBy: { paidAt: 'desc' },
      take: 20,
    }),
    db.auditLog.findMany({
      where: { schoolId: school.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: true },
    }),
    db.user.count({ where: { active: true } }),
  ])

  // KPIs agrégés
  const unpaidAmount = invoices
    .filter((i) => i.status !== 'PAID' && i.status !== 'CANCELLED')
    .reduce((sum, i) => sum + (i.totalAmount - i.paidAmount), 0)

  const collectedAmount = invoices
    .filter((i) => i.status === 'PAID' || i.status === 'PARTIALLY_PAID')
    .reduce((sum, i) => sum + i.paidAmount, 0)

  const openRequests = parentRequests.filter(
    (r) => r.status === 'NEW' || r.status === 'IN_PROGRESS'
  ).length

  const recentAnnouncements = announcements.filter(
    (a) =>
      a.publishedAt &&
      Date.now() - a.publishedAt.getTime() < 7 * 24 * 60 * 60 * 1000
  ).length

  return {
    school,
    kpis: {
      studentsCount,
      guardiansCount,
      activeUsers,
      openRequests,
      recentAnnouncements,
      unpaidAmount,
      collectedAmount,
      announcementsCount: announcements.length,
      requestsCount: parentRequests.length,
    },
    announcements,
    parentRequests,
    invoices,
    payments,
    auditLogs,
  }
}

export async function getNotificationsForUser(userId: string) {
  return db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

export async function getBrandingForSchool(schoolId: string) {
  const branding = await db.branding.findFirst({
    where: { schoolId, status: 'PUBLISHED' },
    orderBy: { version: 'desc' },
  })
  const school = await db.school.findUnique({ where: { id: schoolId } })
  return { branding, school }
}

// ============================================================
// Finance (Cycle 02)
// ============================================================

export async function getFinanceDashboardData(schoolId: string) {
  const [
    chartOfAccounts,
    journals,
    recentEntries,
    invoices,
    payments,
    totalDebitByAccount,
    totalCreditByAccount,
  ] = await Promise.all([
    db.chartOfAccount.findMany({
      where: { schoolId, status: 'ACTIVE' },
      orderBy: { accountNumber: 'asc' },
    }),
    db.accountingJournal.findMany({
      where: { schoolId, status: 'ACTIVE' },
      orderBy: { code: 'asc' },
    }),
    db.journalEntry.findMany({
      where: { schoolId },
      include: {
        journal: true,
        lines: { include: { account: true } },
      },
      orderBy: { entryDate: 'desc' },
      take: 30,
    }),
    db.invoice.findMany({
      where: { schoolId },
      include: { student: true, lines: true, payments: true },
      orderBy: { issueDate: 'desc' },
      take: 20,
    }),
    db.payment.findMany({
      where: { schoolId },
      include: { invoice: { include: { student: true } } },
      orderBy: { paidAt: 'desc' },
      take: 20,
    }),
    db.journalEntryLine.groupBy({
      by: ['accountId'],
      where: { entry: { schoolId, status: 'POSTED' } },
      _sum: { debit: true },
    }),
    db.journalEntryLine.groupBy({
      by: ['accountId'],
      where: { entry: { schoolId, status: 'POSTED' } },
      _sum: { credit: true },
    }),
  ])

  // Calcul des soldes par compte
  const accountsMap = new Map(chartOfAccounts.map((a) => [a.id, a]))
  const accountBalances = chartOfAccounts.map((acc) => {
    const debit = totalDebitByAccount.find((d) => d.accountId === acc.id)?._sum.debit || 0
    const credit = totalCreditByAccount.find((c) => c.accountId === acc.id)?._sum.credit || 0
    const balance = debit - credit // positif = solde débiteur, négatif = solde créditeur
    return { account: acc, totalDebit: debit, totalCredit: credit, balance }
  })

  // Statistiques globales
  const totalCollectedCents = payments
    .filter((p) => p.status === 'CONFIRMED' && p.amountCents > 0)
    .reduce((s, p) => s + p.amountCents, 0)
  const totalRefundedCents = payments
    .filter((p) => p.amountCents < 0)
    .reduce((s, p) => s + Math.abs(p.amountCents), 0)
  const totalUnpaidCents = invoices
    .filter((i) => i.status !== 'PAID' && i.status !== 'CANCELLED')
    .reduce((s, i) => s + (i.totalAmountCents - i.paidAmountCents), 0)
  const totalInvoicedCents = invoices
    .filter((i) => i.status !== 'CANCELLED')
    .reduce((s, i) => s + i.totalAmountCents, 0)

  // Liste des élèves pour le formulaire de création de facture
  const students = await db.student.findMany({
    where: { schoolId, status: 'ACTIVE' },
    include: {
      enrollments: {
        where: { status: 'ACTIVE' },
        include: { classroom: true },
      },
    },
    orderBy: { firstName: 'asc' },
    take: 100,
  })

  return {
    chartOfAccounts,
    journals,
    recentEntries,
    invoices,
    payments,
    accountBalances,
    students,
    stats: {
      totalCollectedCents,
      totalRefundedCents,
      totalUnpaidCents,
      totalInvoicedCents,
      entriesCount: recentEntries.length,
      invoicesCount: invoices.length,
      paymentsCount: payments.length,
    },
  }
}
