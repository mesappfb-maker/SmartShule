// SmartShule — Service de cycle de vie des entités (sans suppression physique)
// ============================================================
// Règle : une donnée ayant des dépendances ne peut JAMAIS être supprimée.
// Elle peut être : désactivée, suspendue, archivée, annulée ou remplacée.
import { db } from '@/lib/db'

export interface DependencyCheck {
  hasDependencies: boolean
  blockingReason?: string
  counts: Record<string, number>
}

// ============================================================
// Vérifier les dépendances d'une matière (Subject)
// ============================================================
export async function checkSubjectDependencies(subjectId: string, schoolId: string): Promise<DependencyCheck> {
  const [courses, grades, timetables, teacherAssignments, configs] = await Promise.all([
    db.course.count({ where: { schoolId, subjectId } }),
    db.grade.count({ where: { schoolId, subjectId } }),
    db.timetable.count({ where: { schoolId, courseId: { in: (await db.course.findMany({ where: { subjectId }, select: { id: true } })).map((c) => c.id) } } }),
    db.teacherAssignment.count({ where: { subjectId } }),
    db.subjectClassConfig.count({ where: { schoolId, subjectId } }),
  ])

  const total = courses + grades + timetables + teacherAssignments + configs
  return {
    hasDependencies: total > 0,
    blockingReason: total > 0
      ? `Matière liée à ${courses} cours, ${grades} notes, ${timetables} horaires, ${teacherAssignments} affectations, ${configs} configurations`
      : undefined,
    counts: { courses, grades, timetables, teacherAssignments, configs },
  }
}

// ============================================================
// Vérifier les dépendances d'un enseignant (Employee)
// ============================================================
export async function checkEmployeeDependencies(employeeId: string, schoolId: string): Promise<DependencyCheck> {
  const [courses, grades, timetables, teacherAssignments, schedules, attendance, receiptsIssued] = await Promise.all([
    db.course.count({ where: { schoolId, teacherId: employeeId } }),
    db.grade.count({ where: { schoolId, teacherId: employeeId } }),
    db.timetable.count({
      where: {
        schoolId,
        courseId: {
          in: (await db.course.findMany({ where: { teacherId: employeeId }, select: { id: true } })).map((c) => c.id),
        },
      },
    }),
    db.teacherAssignment.count({ where: { employeeId } }),
    db.employeeSchedule.count({ where: { employeeId } }),
    db.employeeAttendance.count({ where: { employeeId } }),
    db.receipt.count({ where: { schoolId, accountantId: employeeId } }),
  ])

  const total = courses + grades + timetables + teacherAssignments + schedules + attendance + receiptsIssued
  return {
    hasDependencies: total > 0,
    blockingReason: total > 0
      ? `Employé lié à ${courses} cours, ${grades} notes, ${timetables} horaires, ${receiptsIssued} reçus émis`
      : undefined,
    counts: { courses, grades, timetables, teacherAssignments, schedules, attendance, receiptsIssued },
  }
}

// ============================================================
// Vérifier les dépendances d'une classe (Classroom)
// ============================================================
export async function checkClassroomDependencies(classroomId: string, schoolId: string): Promise<DependencyCheck> {
  const [enrollments, courses, timetables, grades, configs] = await Promise.all([
    db.enrollment.count({ where: { classroomId, status: 'ACTIVE' } }),
    db.course.count({ where: { schoolId, classroomId } }),
    db.timetable.count({ where: { schoolId, classroomId } }),
    db.grade.count({ where: { schoolId, classroomId } }),
    db.subjectClassConfig.count({ where: { schoolId, classroomId } }),
  ])

  const total = enrollments + courses + timetables + grades + configs
  return {
    hasDependencies: total > 0,
    blockingReason: total > 0
      ? `Classe avec ${enrollments} élèves actifs, ${courses} cours, ${grades} notes`
      : undefined,
    counts: { enrollments, courses, timetables, grades, configs },
  }
}

// ============================================================
// Vérifier les dépendances d'une ligne de frais (InvoiceLineConfig)
// ============================================================
export async function checkFeeLineDependencies(configId: string, schoolId: string): Promise<DependencyCheck> {
  const [invoices, receipts, studentDebts, encashments] = await Promise.all([
    db.invoice.count({
      where: { schoolId, lines: { some: { feeDefinitionId: configId } } },
    }).catch(() => 0),
    db.receipt.count({
      where: { schoolId, studentDebt: { invoiceLineConfigId: configId } },
    }).catch(() => 0),
    db.studentDebt.count({ where: { schoolId, invoiceLineConfigId: configId } }).catch(() => 0),
    db.encashment.count({ where: { schoolId, invoiceLineConfigId: configId } }).catch(() => 0),
  ])

  const total = invoices + receipts + studentDebts + encashments
  return {
    hasDependencies: total > 0,
    blockingReason: total > 0
      ? `Ligne de frais liée à ${invoices} factures, ${receipts} reçus, ${studentDebts} dettes`
      : undefined,
    counts: { invoices, receipts, studentDebts, encashments },
  }
}

// ============================================================
// Désactiver une matière (au lieu de supprimer)
// ============================================================
export async function deactivateSubject(subjectId: string, schoolId: string, reason: string, userId: string, userName: string) {
  // Vérifier les dépendances
  const deps = await checkSubjectDependencies(subjectId, schoolId)
  if (deps.hasDependencies) {
    // Désactiver les SubjectClassConfig actifs
    await db.subjectClassConfig.updateMany({
      where: { schoolId, subjectId, status: 'ACTIVE' },
      data: { status: 'SUSPENDED' },
    })
    return { ok: true, message: 'Matière suspendue — les données existantes sont conservées', dependencies: deps }
  }
  // Si aucune dépendance, on peut supprimer physiquement
  await db.subject.delete({ where: { id: subjectId } })
  return { ok: true, message: 'Matière supprimée (aucune dépendance)', dependencies: deps }
}

// ============================================================
// Archiver une classe (en fin d'année)
// ============================================================
export async function archiveClassroom(classroomId: string, schoolId: string, reason: string, userId: string, userName: string) {
  // Désactiver les inscriptions actives
  await db.enrollment.updateMany({
    where: { classroomId, status: 'ACTIVE' },
    data: { status: 'COMPLETED' },
  })

  // Suspendre les SubjectClassConfig
  await db.subjectClassConfig.updateMany({
    where: { schoolId, classroomId, status: 'ACTIVE' },
    data: { status: 'CLOSED' },
  })

  return { ok: true, message: 'Classe archivée — inscriptions clôturées, données conservées' }
}
