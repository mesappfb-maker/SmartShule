// SmartShule — Service académique professionnel
// ============================================================
// Implémente :
//   1. Calcul des moyennes pondérées par matière
//   2. Calcul de la moyenne générale avec coefficients
//   3. Détection de conflits d'horaires
//   4. Validation des notes (barème, pondérations)
//   5. Gestion des 3 niveaux : catalogue → matière-classe → séance
//
// Formules :
//   Note normalisée = (note obtenue / note max évaluation) × note max matière
//   Moyenne matière = Σ(note normalisée × poids catégorie)
//   Moyenne générale = Σ(moyenne matière × coefficient) / Σ(coefficients)

import { db } from '@/lib/db'

// ============================================================
// Types
// ============================================================

export interface GradeCalculationResult {
  subjectId: string
  subjectName: string
  coefficient: number
  maxScore: number
  average: number | null
  status: 'COMPLETE' | 'INCOMPLETE' | 'NO_GRADES'
  gradesUsed: number
  gradesMissing: number
  details: Array<{
    category: string
    weightPercent: number
    grades: Array<{ title: string; score: number; maxScore: number; normalizedScore: number }>
    categoryAverage: number | null
  }>
}

export interface GeneralAverageResult {
  generalAverage: number | null
  totalCoefficients: number
  subjectsCount: number
  subjectsWithGrades: number
  details: Array<{
    subjectName: string
    coefficient: number
    average: number | null
    weightedContribution: number | null
  }>
}

export interface ConflictDetectionResult {
  conflicts: Array<{
    type: string
    severity: 'CRITICAL' | 'WARNING' | 'INFO'
    description: string
    timetableId1?: string
    timetableId2?: string
    classroomId?: string
    teacherId?: string
    room?: string
    dayOfWeek?: number
    startTime?: string
    endTime?: string
  }>
  totalConflicts: number
  criticalCount: number
  warningCount: number
}

// ============================================================
// 1. Calcul moyenne matière (pondérée par catégories)
// ============================================================

export async function calculateSubjectAverage(
  studentId: string,
  subjectClassConfigId: string
): Promise<GradeCalculationResult> {
  const config = await db.subjectClassConfig.findUnique({
    where: { id: subjectClassConfigId },
    include: {
      subject: true,
      evaluationCategories: { where: { isActive: true } },
    },
  })

  if (!config) throw new Error('Configuration matière-classe introuvable')

  const grades = await db.grade.findMany({
    where: {
      studentId,
      subjectId: config.subjectId,
      classroomId: config.classroomId,
      status: 'PUBLISHED',
    },
  })

  const maxScoreMatiere = config.maxScore
  const details: GradeCalculationResult['details'] = []
  let totalWeightedScore = 0
  let totalWeight = 0
  let gradesUsed = 0
  let gradesMissing = 0

  if (config.evaluationCategories.length === 0) {
    // Pas de catégories configurées → moyenne simple
    if (grades.length === 0) {
      return {
        subjectId: config.subjectId,
        subjectName: config.subject.name,
        coefficient: config.coefficient,
        maxScore: maxScoreMatiere,
        average: null,
        status: 'NO_GRADES',
        gradesUsed: 0,
        gradesMissing: 0,
        details: [],
      }
    }

    const sumScores = grades.reduce((sum, g) => {
      const normalized = (g.score / g.maxScore) * maxScoreMatiere
      return sum + normalized * (g.weight || 1)
    }, 0)
    const sumWeights = grades.reduce((sum, g) => sum + (g.weight || 1), 0)
    const avg = sumWeights > 0 ? sumScores / sumWeights : null

    return {
      subjectId: config.subjectId,
      subjectName: config.subject.name,
      coefficient: config.coefficient,
      maxScore: maxScoreMatiere,
      average: avg ? Math.round(avg * 100) / 100 : null,
      status: 'COMPLETE',
      gradesUsed: grades.length,
      gradesMissing: 0,
      details: [],
    }
  }

  // Calcul par catégorie
  for (const category of config.evaluationCategories) {
    const categoryGrades = grades.filter((g) => {
      // Associer grade à catégorie par titre ou par convention
      // Pour l'instant, on utilise tous les grades pour toutes les catégories
      // (à affiner quand EvaluationCategory sera liée aux Grade)
      return true
    })

    if (categoryGrades.length < category.minEvaluations) {
      gradesMissing += category.minEvaluations - categoryGrades.length
    }

    const gradesDetail = categoryGrades.map((g) => ({
      title: g.title,
      score: g.score,
      maxScore: g.maxScore,
      normalizedScore: (g.score / g.maxScore) * maxScoreMatiere,
    }))

    let categoryAvg: number | null = null
    if (categoryGrades.length > 0) {
      switch (category.calculationRule) {
        case 'BEST':
          categoryAvg = Math.max(...gradesDetail.map((g) => g.normalizedScore))
          break
        case 'SUM':
          categoryAvg = gradesDetail.reduce((s, g) => s + g.normalizedScore, 0)
          break
        case 'UNIQUE':
          categoryAvg = gradesDetail[0]?.normalizedScore || null
          break
        case 'AVERAGE':
        default:
          categoryAvg = gradesDetail.reduce((s, g) => s + g.normalizedScore, 0) / gradesDetail.length
      }
    }

    if (categoryAvg !== null) {
      totalWeightedScore += categoryAvg * category.weightPercent
      totalWeight += category.weightPercent
      gradesUsed += categoryGrades.length
    }

    details.push({
      category: category.name,
      weightPercent: category.weightPercent,
      grades: gradesDetail,
      categoryAverage: categoryAvg ? Math.round(categoryAvg * 100) / 100 : null,
    })
  }

  const average = totalWeight > 0 ? totalWeightedScore / totalWeight : null

  return {
    subjectId: config.subjectId,
    subjectName: config.subject.name,
    coefficient: config.coefficient,
    maxScore: maxScoreMatiere,
    average: average ? Math.round(average * 100) / 100 : null,
    status: gradesMissing > 0 ? 'INCOMPLETE' : 'COMPLETE',
    gradesUsed,
    gradesMissing,
    details,
  }
}

// ============================================================
// 2. Calcul moyenne générale (avec coefficients matières)
// ============================================================

export async function calculateGeneralAverage(
  studentId: string,
  classroomId: string,
  period: string = 'T1'
): Promise<GeneralAverageResult> {
  const configs = await db.subjectClassConfig.findMany({
    where: { classroomId, period, status: 'ACTIVE' },
    include: { subject: true },
  })

  const details: GeneralAverageResult['details'] = []
  let totalWeightedAverage = 0
  let totalCoefficients = 0
  let subjectsWithGrades = 0

  for (const config of configs) {
    const result = await calculateSubjectAverage(studentId, config.id)

    if (result.average !== null) {
      totalWeightedAverage += result.average * config.coefficient
      totalCoefficients += config.coefficient
      subjectsWithGrades++
    }

    details.push({
      subjectName: config.subject.name,
      coefficient: config.coefficient,
      average: result.average,
      weightedContribution: result.average !== null ? result.average * config.coefficient : null,
    })
  }

  const generalAverage = totalCoefficients > 0 ? totalWeightedAverage / totalCoefficients : null

  return {
    generalAverage: generalAverage ? Math.round(generalAverage * 100) / 100 : null,
    totalCoefficients,
    subjectsCount: configs.length,
    subjectsWithGrades,
    details,
  }
}

// ============================================================
// 3. Détection de conflits d'horaires
// ============================================================

export async function detectScheduleConflicts(schoolId: string): Promise<ConflictDetectionResult> {
  const timetables = await db.timetable.findMany({
    where: { schoolId },
  })

  // Récupérer les cours séparément
  const courseIds = [...new Set(timetables.map((t) => t.courseId))]
  const courses = await db.course.findMany({
    where: { id: { in: courseIds } },
    include: { classroom: true, teacher: true, subject: true },
  })
  const courseMap = new Map(courses.map((c) => [c.id, c]))

  const conflicts: ConflictDetectionResult['conflicts'] = []
  const seen = new Set<string>()

  for (let i = 0; i < timetables.length; i++) {
    for (let j = i + 1; j < timetables.length; j++) {
      const t1 = timetables[i]
      const t2 = timetables[j]
      const c1 = courseMap.get(t1.courseId)
      const c2 = courseMap.get(t2.courseId)

      // Même jour + chevauchement horaire
      if (t1.dayOfWeek !== t2.dayOfWeek) continue
      if (t1.startTime >= t2.endTime || t2.startTime >= t1.endTime) continue

      const overlapKey = `${t1.id}-${t2.id}`
      if (seen.has(overlapKey)) continue
      seen.add(overlapKey)

      // Conflit classe
      if (c1?.classroomId === c2?.classroomId) {
        conflicts.push({
          type: 'CLASS_DOUBLE_BOOKED',
          severity: 'CRITICAL',
          description: `Classe ${c1?.classroom?.name || '—'} a deux cours le même créneau (${t1.startTime}-${t1.endTime})`,
          timetableId1: t1.id,
          timetableId2: t2.id,
          classroomId: c1?.classroomId,
          dayOfWeek: t1.dayOfWeek,
          startTime: t1.startTime,
          endTime: t1.endTime,
        })
      }

      // Conflit enseignant
      if (c1?.teacherId && c1.teacherId === c2?.teacherId) {
        conflicts.push({
          type: 'TEACHER_DOUBLE_BOOKED',
          severity: 'CRITICAL',
          description: `Enseignant ${c1?.teacher?.firstName || ''} ${c1?.teacher?.lastName || ''} a deux cours au même moment`,
          timetableId1: t1.id,
          timetableId2: t2.id,
          teacherId: c1.teacherId,
          dayOfWeek: t1.dayOfWeek,
          startTime: t1.startTime,
          endTime: t1.endTime,
        })
      }

      // Conflit salle
      if (t1.room && t1.room === t2.room) {
        conflicts.push({
          type: 'ROOM_DOUBLE_BOOKED',
          severity: 'CRITICAL',
          description: `Salle ${t1.room} réservée par deux cours au même moment`,
          timetableId1: t1.id,
          timetableId2: t2.id,
          room: t1.room,
          dayOfWeek: t1.dayOfWeek,
          startTime: t1.startTime,
          endTime: t1.endTime,
        })
      }
    }
  }

  return {
    conflicts,
    totalConflicts: conflicts.length,
    criticalCount: conflicts.filter((c) => c.severity === 'CRITICAL').length,
    warningCount: conflicts.filter((c) => c.severity === 'WARNING').length,
  }
}

// ============================================================
// 4. Validation des notes
// ============================================================

export function validateGrade(
  score: number,
  maxScore: number
): { ok: boolean; error?: string } {
  if (score < 0) {
    return { ok: false, error: 'La note ne peut pas être négative' }
  }
  if (score > maxScore) {
    return { ok: false, error: `La note ${score} dépasse le barème maximum ${maxScore}` }
  }
  return { ok: true }
}

// ============================================================
// 5. Validation des pondérations (somme = 100%)
// ============================================================

export function validateCategoryWeights(
  categories: Array<{ name: string; weightPercent: number; isActive: boolean }>
): { ok: boolean; total: number; error?: string } {
  const activeCategories = categories.filter((c) => c.isActive)
  const total = activeCategories.reduce((sum, c) => sum + c.weightPercent, 0)

  if (Math.abs(total - 100) > 0.01) {
    return {
      ok: false,
      total,
      error: `La somme des pondérations actives doit être 100% (actuellement ${total}%)`,
    }
  }

  return { ok: true, total }
}

// ============================================================
// 6. Vérifier si un enseignant est habilité pour une matière
// ============================================================

export async function isTeacherQualified(
  teacherId: string,
  subjectId: string
): Promise<boolean> {
  const assignment = await db.teacherAssignment.findFirst({
    where: { employeeId: teacherId, subjectId },
  })
  return !!assignment
}

// ============================================================
// 7. Vérifier l'unicité d'une matière-classe
// ============================================================

export async function isSubjectClassConfigUnique(
  schoolId: string,
  classroomId: string,
  subjectId: string,
  academicYearId: string,
  period: string
): Promise<boolean> {
  const existing = await db.subjectClassConfig.findFirst({
    where: { schoolId, classroomId, subjectId, academicYearId, period },
  })
  return !existing
}

// ============================================================
// 8. Normalisation d'une note
// ============================================================

export function normalizeScore(
  score: number,
  evaluationMaxScore: number,
  subjectMaxScore: number
): number {
  if (evaluationMaxScore <= 0) return 0
  return Math.round(((score / evaluationMaxScore) * subjectMaxScore) * 100) / 100
}
