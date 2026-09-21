// SmartShule — Queries : Portail Comptable (Étape RDC)
// Gestion des encaissements, lignes de frais et alertes

import { db } from '@/lib/db'

export async function getAccountantPortalData(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) return null

  // Trouver l'école
  const schoolId = await getSchoolIdForUser(userId)
  if (!schoolId) return null

  const [
    invoiceLineConfigs,
    recentEncashments,
    pendingStudents,
    stats,
    directorateStats,
  ] = await Promise.all([
    // Lignes de frais configurées par le directeur
    db.invoiceLineConfig.findMany({
      where: { schoolId, status: 'ACTIVE' },
      include: { directorate: true },
      orderBy: { createdAt: 'desc' },
    }),

    // Derniers encaissements
    db.encashment.findMany({
      where: { schoolId },
      include: {
        invoiceLineConfig: true,
        student: true,
        guardian: true,
      },
      orderBy: { encashedAt: 'desc' },
      take: 30,
    }),

    // Élèves avec statut financier problématique
    db.studentFinancialStatus.findMany({
      where: { schoolId, status: { in: ['LITIGATION', 'BLOCKED'] } },
      include: {
        student: {
          include: {
            enrollments: {
              where: { status: 'ACTIVE' },
              include: { classroom: { include: { directorate: true } } },
            },
          },
        },
      },
    }),

    // Statistiques globales
    db.encashment.aggregate({
      where: { schoolId, status: 'CONFIRMED' },
      _sum: { amountCents: true },
      _count: true,
    }),

    // Stats par direction
    db.invoiceLineConfig.findMany({
      where: { schoolId, status: 'ACTIVE' },
      include: {
        directorate: true,
        encashments: {
          where: { status: 'CONFIRMED' },
          select: { amountCents: true },
        },
      },
    }),
  ])

  const totalCollected = stats._sum.amountCents || 0
  const totalEncashments = stats._count

  // Stats par ligne de frais
  const lineStats = invoiceLineConfigs.map((line) => {
    const lineEncashments = recentEncashments.filter(
      (e) => e.invoiceLineConfigId === line.id
    )
    const lineTotal = lineEncashments.reduce((sum, e) => sum + e.amountCents, 0)
    return {
      id: line.id,
      name: line.name,
      code: line.code,
      amountCents: line.amountCents,
      directorateName: line.directorate?.name || 'Toutes',
      collectedCents: lineTotal,
      count: lineEncashments.length,
      isMandatory: line.isMandatory,
      period: line.period,
    }
  })

  return {
    invoiceLineConfigs: invoiceLineConfigs.map((l) => ({
      id: l.id,
      name: l.name,
      code: l.code,
      amountCents: l.amountCents,
      currency: l.currency,
      isMandatory: l.isMandatory,
      isRecurring: l.isRecurring,
      period: l.period,
      directorateName: l.directorate?.name || 'Toutes',
    })),
    recentEncashments: recentEncashments.map((e) => ({
      id: e.id,
      receiptNumber: e.receiptNumber,
      lineName: e.invoiceLineConfig.name,
      studentName: e.student
        ? `${e.student.firstName} ${e.student.lastName}`
        : e.guardian
        ? `${e.guardian.firstName} ${e.guardian.lastName}`
        : '—',
      amountCents: e.amountCents,
      paymentMethod: e.paymentMethod,
      payerName: e.payerName,
      status: e.status,
      encashedAt: e.encashedAt,
      directorNotified: !!e.directorNotifiedAt,
    })),
    pendingStudents: pendingStudents.map((p) => ({
      studentId: p.studentId,
      studentName: `${p.student.firstName} ${p.student.lastName}`,
      classroomName: p.student.enrollments[0]?.classroom.name || '—',
      directorateName: p.student.enrollments[0]?.classroom.directorate.name || '—',
      status: p.status,
      reason: p.reason,
    })),
    stats: {
      totalCollectedCents: totalCollected,
      totalEncashments,
      pendingCount: pendingStudents.length,
    },
    lineStats,
  }
}

async function getSchoolIdForUser(userId: string): Promise<string | null> {
  const audit = await db.auditLog.findFirst({
    where: { userId, schoolId: { not: null } },
    select: { schoolId: true },
  })
  if (audit?.schoolId) return audit.schoolId
  const school = await db.school.findFirst()
  return school?.id || null
}
