// SmartShule — Module IQA (Indicateur Qualité d'Assiduité) — Partie PURE
// Étape 4 RDC — Portail Prof complet
//
// Formule officielle (RDC) :
//   IQA = MAX(0, 100 - ((100 * A_non_exc) + (50 * A_exc) + (15 * R)) / Total_Heures_Cours)
//
// Ce fichier ne contient QUE des fonctions pures (sans DB, sans effets de bord),
// utilisables côté client ET serveur.

export type IqaLevel = 'EXCELLENT' | 'WARNING' | 'CRITICAL'

export interface IqaInput {
  totalSessions: number
  absencesUnexcused: number
  absencesExcused: number
  lateCount: number
}

export interface IqaResult {
  iqa: number
  level: IqaLevel
  totalSessions: number
  absencesUnexcused: number
  absencesExcused: number
  lateCount: number
  formula: string
}

/**
 * Calcule l'IQA selon la formule officielle RDC.
 *
 * IQA = MAX(0, 100 - ((100 * A_non_exc) + (50 * A_exc) + (15 * R)) / Total)
 *
 * Si total = 0, retourne 100 (par convention : élève sans cours enregistré = assidu).
 */
export function computeIqa(input: IqaInput): IqaResult {
  const { totalSessions, absencesUnexcused, absencesExcused, lateCount } = input

  if (totalSessions <= 0) {
    return {
      iqa: 100,
      level: 'EXCELLENT',
      totalSessions: 0,
      absencesUnexcused,
      absencesExcused,
      lateCount,
      formula: 'MAX(0, 100 - 0/0) → 100 (par défaut : aucune séance enregistrée)',
    }
  }

  const penalty =
    (100 * absencesUnexcused + 50 * absencesExcused + 15 * lateCount) / totalSessions
  const iqa = Math.max(0, 100 - penalty)

  const formula = `MAX(0, 100 - ((100 × ${absencesUnexcused}) + (50 × ${absencesExcused}) + (15 × ${lateCount})) / ${totalSessions}) = ${iqa.toFixed(2)}`

  return {
    iqa: Math.round(iqa * 100) / 100,
    level: getIqaLevel(iqa),
    totalSessions,
    absencesUnexcused,
    absencesExcused,
    lateCount,
    formula,
  }
}

/**
 * Classifie l'IQA en niveau seuil.
 */
export function getIqaLevel(iqa: number): IqaLevel {
  if (iqa >= 90) return 'EXCELLENT'
  if (iqa >= 75) return 'WARNING'
  return 'CRITICAL'
}

/**
 * Couleur associée au niveau IQA (palette SmartShule).
 */
export function getIqaColor(level: IqaLevel): {
  bg: string
  text: string
  border: string
  dot: string
  label: string
  emoji: string
} {
  switch (level) {
    case 'EXCELLENT':
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-950/30',
        text: 'text-emerald-700 dark:text-emerald-300',
        border: 'border-emerald-200 dark:border-emerald-800',
        dot: 'bg-emerald-500',
        label: 'Excellent',
        emoji: '🟢',
      }
    case 'WARNING':
      return {
        bg: 'bg-amber-50 dark:bg-amber-950/30',
        text: 'text-amber-700 dark:text-amber-300',
        border: 'border-amber-200 dark:border-amber-800',
        dot: 'bg-amber-500',
        label: 'À surveiller',
        emoji: '🟡',
      }
    case 'CRITICAL':
      return {
        bg: 'bg-red-50 dark:bg-red-950/30',
        text: 'text-red-700 dark:text-red-300',
        border: 'border-red-200 dark:border-red-800',
        dot: 'bg-red-500',
        label: 'Critique',
        emoji: '🔴',
      }
  }
}

/**
 * Tooltip au survol de la pastille IQA.
 * Format : "[X Abs | Y Ret | Z Exc]"
 */
export function formatIqaTooltip(iqa: IqaResult): string {
  return `[${iqa.absencesUnexcused} Abs | ${iqa.lateCount} Ret | ${iqa.absencesExcused} Exc] · IQA ${iqa.iqa.toFixed(1)}%`
}
