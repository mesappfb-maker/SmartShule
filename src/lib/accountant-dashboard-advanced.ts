// SmartShule — Queries : Dashboard Comptable avancé (DataGrid Excel-style)
// Vue par ligne de frais avec : total dû, total payé, %, liste des élèves
// + recherche intelligente multi-critères

import { db } from '@/lib/db'

export interface EncashmentGridRow {
  receiptNumber: string
  studentName: string
  studentMatricule: string
  classroomName: string
  directorateName: string
  lineName: string
  lineCode: string
  amountCents: number
  expectedCents: number
  paymentMethod: string
  payerName: string
  period: string
  status: string
  encashedAt: Date
  encashedByName: string
}

export interface LineSummary {
  id: string
  name: string
  code: string
  amountCents: number
  directorateName: string
  period: string
  isMandatory: boolean
  expectedTotalCents: number // montant × nombre d'élèves
  collectedTotalCents: number
  collectionRate: number // pourcentage
  encashmentCount: number
  studentCount: number
  fullyPaidCount: number
  partiallyPaidCount: number
  unpaidCount: number
}

export async function getAccountantDashboardAdvanced(schoolId: string, filters?: {
  lineId?: string
  directorateId?: string
  classroomId?: string
  search?: string
  dateFrom?: Date
  dateTo?: Date
}) {
  // 1. Lignes de frais avec statistiques de recouvrement
  const lines = await db.invoiceLineConfig.findMany({
    where: { schoolId, status: 'ACTIVE' },
    include: {
      directorate: true,
      encashments: {
        where: { status: 'CONFIRMED' },
        select: { amountCents: true, studentId: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  // Compter les élèves par direction
  const allStudents = await db.student.count({
    where: { schoolId, status: 'ACTIVE' },
  })

  const lineSummaries: LineSummary[] = lines.map((line) => {
    const encashments = line.encashments
    const collected = encashments.reduce((sum, e) => sum + e.amountCents, 0)
    const uniqueStudents = new Set(encashments.map((e) => e.studentId).filter(Boolean)).size
    const expected = line.amountCents * allStudents

    return {
      id: line.id,
      name: line.name,
      code: line.code,
      amountCents: line.amountCents,
      directorateName: line.directorate?.name || 'Toutes',
      period: line.period || '—',
      isMandatory: line.isMandatory,
      expectedTotalCents: expected,
      collectedTotalCents: collected,
      collectionRate: expected > 0 ? Math.round((collected / expected) * 1000) / 10 : 0,
      encashmentCount: encashments.length,
      studentCount: allStudents,
      fullyPaidCount: encashments.filter((e) => e.amountCents >= line.amountCents).length,
      partiallyPaidCount: encashments.filter((e) => e.amountCents > 0 && e.amountCents < line.amountCents).length,
      unpaidCount: allStudents - uniqueStudents,
    }
  })

  // 2. DataGrid des encaissements (filtrable)
  const encashments = await db.encashment.findMany({
    where: {
      schoolId,
      status: 'CONFIRMED',
      ...(filters?.lineId ? { invoiceLineConfigId: filters.lineId } : {}),
      ...(filters?.dateFrom || filters?.dateTo
        ? { encashedAt: { gte: filters.dateFrom, lte: filters.dateTo } }
        : {}),
    },
    include: {
      invoiceLineConfig: true,
      student: {
        include: {
          enrollments: {
            where: { status: 'ACTIVE' },
            include: { classroom: { include: { directorate: true } } },
          },
        },
      },
    },
    orderBy: { encashedAt: 'desc' },
    take: 500, // Limite pour performance (3000+ élèves)
  })

  // Appliquer les filtres additionnels en mémoire (SQLite limitation)
  let gridRows: EncashmentGridRow[] = encashments.map((e) => {
    const enr = e.student?.enrollments[0]
    return {
      receiptNumber: e.receiptNumber,
      studentName: e.student ? `${e.student.firstName} ${e.student.lastName}` : '—',
      studentMatricule: e.student?.matricule || '—',
      classroomName: enr?.classroom.name || '—',
      directorateName: enr?.classroom.directorate.name || '—',
      lineName: e.invoiceLineConfig.name,
      lineCode: e.invoiceLineConfig.code,
      amountCents: e.amountCents,
      expectedCents: e.invoiceLineConfig.amountCents,
      paymentMethod: e.paymentMethod,
      payerName: e.payerName || '—',
      period: e.period || '—',
      status: e.status,
      encashedAt: e.encashedAt,
      encashedByName: 'Comptable',
    }
  })

  // Filtre par direction
  if (filters?.directorateId) {
    gridRows = gridRows.filter((r) => r.directorateName !== '—')
  }

  // Filtre par classe
  if (filters?.classroomId) {
    gridRows = gridRows.filter((r) => r.classroomName !== '—')
  }

  // Recherche intelligente
  if (filters?.search) {
    const search = filters.search.toLowerCase()
    gridRows = gridRows.filter((r) =>
      r.studentName.toLowerCase().includes(search) ||
      r.studentMatricule.toLowerCase().includes(search) ||
      r.receiptNumber.toLowerCase().includes(search) ||
      r.lineName.toLowerCase().includes(search) ||
      r.payerName.toLowerCase().includes(search)
    )
  }

  // 3. Statistiques globales
  const totalCollected = gridRows.reduce((sum, r) => sum + r.amountCents, 0)
  const totalExpected = lineSummaries.reduce((sum, l) => sum + l.expectedTotalCents, 0)

  return {
    lineSummaries,
    gridRows,
    stats: {
      totalCollectedCents: totalCollected,
      totalExpectedCents: totalExpected,
      collectionRate: totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 1000) / 10 : 0,
      totalEncashments: gridRows.length,
      totalLines: lineSummaries.length,
    },
  }
}

// ============================================================
// Recherche globale multi-rôles
// ============================================================

export async function globalSearch(schoolId: string, query: string, role: string) {
  if (!query || query.length < 2) return { results: [] }

  const search = query.toLowerCase()
  const results: Array<{
    type: string
    title: string
    subtitle: string
    id: string
  }> = []

  // Recherche d'élèves (tous les rôles sauf élève)
  if (role !== 'STUDENT') {
    const students = await db.student.findMany({
      where: {
        schoolId,
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { matricule: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 10,
      include: {
        enrollments: {
          where: { status: 'ACTIVE' },
          include: { classroom: true },
        },
      },
    })
    students.forEach((s) => {
      results.push({
        type: 'ÉLÈVE',
        title: `${s.firstName} ${s.lastName}`,
        subtitle: `${s.matricule} · ${s.enrollments[0]?.classroom.name || '—'}`,
        id: s.id,
      })
    })
  }

  // Recherche d'encaissements (comptable + direction + serveur)
  if (role === 'ACCOUNTANT' || role === 'DIRECTION' || role === 'SERVER' || role === 'ADMIN') {
    const encashments = await db.encashment.findMany({
      where: {
        schoolId,
        OR: [
          { receiptNumber: { contains: query, mode: 'insensitive' } },
          { payerName: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 10,
      include: { invoiceLineConfig: true, student: true },
    })
    encashments.forEach((e) => {
      results.push({
        type: 'ENCAISSEMENT',
        title: e.receiptNumber,
        subtitle: `${e.invoiceLineConfig.name} · ${e.student ? e.student.firstName + ' ' + e.student.lastName : e.payerName || '—'}`,
        id: e.id,
      })
    })
  }

  // Recherche de professeurs (direction + serveur)
  if (role === 'DIRECTION' || role === 'SERVER' || role === 'ADMIN') {
    const teachers = await db.employee.findMany({
      where: {
        schoolId,
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 5,
    })
    teachers.forEach((t) => {
      results.push({
        type: 'PROFESSEUR',
        title: `${t.firstName} ${t.lastName}`,
        subtitle: t.function,
        id: t.id,
      })
    })
  }

  return { results }
}
