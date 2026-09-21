// SmartShule — Queries : Portail PromoServeur (Étape RDC)
// Vue centralisée : instances, sync, santé système, supervision

import { db } from '@/lib/db'

export async function getServerPortalData(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) return null

  const schoolId = await getSchoolIdForServer(userId)
  if (!schoolId) return null

  const [
    instanceConfigs,
    syncDevices,
    syncOperations,
    syncConflicts,
    staffReports,
    schoolStats,
  ] = await Promise.all([
    // Configurations d'instances (rôles des machines)
    db.instanceConfig.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
    }),

    // Devices synchronisés
    db.syncDevice.findMany({
      where: { schoolId },
      orderBy: { lastSeenAtUtc: 'desc' },
      take: 20,
    }),

    // Dernières opérations de sync
    db.syncOperation.findMany({
      where: { schoolId },
      orderBy: { receivedAtUtc: 'desc' },
      take: 30,
    }),

    // Conflits ouverts
    db.syncConflict.findMany({
      where: { schoolId, status: 'OPEN' },
      orderBy: { createdAtUtc: 'desc' },
      take: 20,
    }),

    // Rapports de présence personnel
    db.staffAttendanceReport.findMany({
      where: { schoolId },
      orderBy: { generatedAt: 'desc' },
      take: 10,
    }),

    // Stats globales école
    Promise.all([
      db.student.count({ where: { schoolId, status: 'ACTIVE' } }),
      db.employee.count({ where: { schoolId, status: 'ACTIVE' } }),
      db.guardian.count({ where: { schoolId } }),
      db.invoice.count({ where: { schoolId } }),
      db.payment.count({ where: { schoolId, status: 'CONFIRMED' } }),
      db.encashment.count({ where: { schoolId, status: 'CONFIRMED' } }),
      db.grade.count({ where: { schoolId } }),
      db.attendance.count({ where: { schoolId } }),
      db.journalEntry.count({ where: { schoolId } }),
    ]),
  ])

  const [
    studentsCount,
    employeesCount,
    guardiansCount,
    invoicesCount,
    paymentsCount,
    encashmentsCount,
    gradesCount,
    attendancesCount,
    journalEntriesCount,
  ] = schoolStats

  return {
    instances: instanceConfigs.map((i) => ({
      id: i.id,
      role: i.instanceRole,
      syncTarget: i.syncTarget,
      serverIp: i.serverIp,
      isActive: i.isActive,
      createdAt: i.createdAt,
    })),
    syncDevices: syncDevices.map((d) => ({
      id: d.id,
      deviceId: d.deviceId,
      deviceType: d.deviceType,
      appVersion: d.appVersion,
      lastSeen: d.lastSeenAtUtc,
      status: d.status,
    })),
    recentSyncOps: syncOperations.map((op) => ({
      id: op.id,
      operationId: op.operationId,
      aggregateType: op.aggregateType,
      status: op.status,
      receivedAt: op.receivedAtUtc,
      errorCode: op.errorCode,
    })),
    openConflicts: syncConflicts.map((c) => ({
      id: c.id,
      conflictId: c.conflictId,
      aggregateType: c.aggregateType,
      conflictType: c.conflictType,
      createdAt: c.createdAtUtc,
    })),
    staffReports: staffReports.map((r) => ({
      id: r.id,
      period: r.period,
      periodType: r.periodType,
      totalStaff: r.totalStaff,
      presentCount: r.presentCount,
      absentCount: r.absentCount,
      attendanceRate: r.attendanceRate,
    })),
    schoolStats: {
      studentsCount,
      employeesCount,
      guardiansCount,
      invoicesCount,
      paymentsCount,
      encashmentsCount,
      gradesCount,
      attendancesCount,
      journalEntriesCount,
      activeInstances: instanceConfigs.filter((i) => i.isActive).length,
      openConflictsCount: syncConflicts.length,
    },
  }
}

async function getSchoolIdForServer(userId: string): Promise<string | null> {
  const audit = await db.auditLog.findFirst({
    where: { userId, schoolId: { not: null } },
    select: { schoolId: true },
  })
  if (audit?.schoolId) return audit.schoolId
  const school = await db.school.findFirst()
  return school?.id || null
}
