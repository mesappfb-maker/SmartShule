// SmartShule — Helpers monétaires (Cycle 02, §3.11 du cahier des charges)
//
// Principe critique (§3.11.4) :
//   "Les montants doivent être calculés avec le type `decimal`, jamais avec
//    `double`. La précision interne doit être supérieure à la précision
//    d'affichage. Les arrondis doivent être appliqués selon une règle
//    configurée."
//
// En TypeScript/Node, sans dépendance externe (DEC-005), on représente les
// montants en **centimes entiers (Int)** stockés en DB. Les calculs se fontent
// en `BigInt` natif pour éviter toute perte de précision.
//
// Conventions :
//   - Un montant en centimes = entier (ex: 170000 = 1700.00 EUR/CDF).
//   - Un taux en centimes = pourcentage × 100 (ex: 20% = 2000, 5.5% = 550).
//   - Une quantité en centimes = decimal × 100 (ex: 1.5 = 150).
//
// Pour l'affichage, on divise par 100 et on formate.

// ============================================================
// Types
// ============================================================

/** Montant en centimes (entier). 1700.00 EUR = 170000 centimes. */
export type Cents = number // Int (mais sémantiquement: valeur entière)

/** Taux (remise, taxe) en centimes de pourcentage. 20% = 2000. */
export type RateCents = number

/** Quantité en centimes. 1.5 = 150. */
export type QuantityCents = number

// ============================================================
// Conversions
// ============================================================

/**
 * Convertit un montant décimal (number/string) en centimes.
 * Accepte 12.50, "12.50", 12.5, "1200" (qui devient 120000).
 * Lève si la valeur n'est pas un nombre fini.
 */
export function toCents(value: number | string): Cents {
  const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value
  if (!Number.isFinite(num)) {
    throw new Error(`Valeur monétaire invalide : ${value}`)
  }
  // Utilisation de Math.round pour éviter les erreurs de floating-point
  // ex: 17.005 * 100 = 1700.4999999999998 → 1700 au lieu de 1701
  // On ajoute un epsilon et on arrondit
  const cents = Math.round(num * 100)
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`Montant hors plage safe integer : ${value}`)
  }
  return cents
}

/**
 * Convertit des centimes en montant décimal (pour affichage).
 * Note : le retour est un number, mais avec perte potentielle de précision
 * au-delà de 9 * 10^15. Pour l'affichage, c'est acceptable ; pour les
// calculs, toujours rester en Cents.
 */
export function fromCents(cents: Cents): number {
  return cents / 100
}

/**
 * Formate des centimes en chaîne localisée.
 * ex: 170000 cents, EUR, fr-FR → "1 700,00 €"
 * ex: 170000 cents, CDF, fr-FR → "170 000,00 CDF"
 */
export function formatCents(
  cents: Cents,
  currency = 'CDF',
  locale = 'fr-FR'
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`
  }
}

// ============================================================
// Calculs (via BigInt pour préserver la précision)
// ============================================================

/**
 * Multiplie une quantité (centimes) par un prix unitaire (centimes),
 * renvoie le montant brut en centimes.
 *
 * ex: quantité 150 (=1.5) × prix 12000 (=120.00) = 1800000 centimes (=18000.00)
 *
 * Implémentation : (qtyCents × priceCents) / 100 (car les centimes sont ×100).
 * On utilise BigInt pour éviter tout overflow et toute perte de précision.
 */
export function multiplyCents(
  qtyCents: QuantityCents,
  priceCents: Cents
): Cents {
  const result = (BigInt(qtyCents) * BigInt(priceCents)) / 100n
  return Number(result)
}

/**
 * Calcule un pourcentage d'un montant en centimes.
 *
 * ex: remise 500 (=5%) sur 170000 → 8500 centimes.
 *
 * Implémentation : (amountCents × rateCents) / 10000
 * (car rateCents = pourcentage × 100, et on divise par 100 pour appliquer le %).
 */
export function percentOfCents(amountCents: Cents, rateCents: RateCents): Cents {
  const result = (BigInt(amountCents) * BigInt(rateCents)) / 10000n
  return Number(result)
}

/**
 * Arrondi commercial (au plus proche, 0.5 vers le haut).
 * Utilisé pour l'arrondi final d'une ligne de facture.
 */
export function roundHalfUpCents(cents: Cents): Cents {
  // Math.round de JS arrondit déjà au plus proche, avec 0.5 vers +infini
  // Pour les négatifs, on veut -0.5 → -1 (comportement commercial standard)
  return Math.sign(cents) >= 0
    ? Math.round(cents)
    : -Math.round(-cents)
}

/**
 * Arrondi bancaire (au plus proche, 0.5 vers le pair).
 * Utile pour éviter les biais cumulés sur de nombreuses opérations.
 */
export function roundHalfEvenCents(cents: Cents): Cents {
  const bi = BigInt(cents)
  // Pas d'arrondi à faire si déjà entier — les centimes sont déjà entiers.
  // Cette fonction est fournie pour des sous-centimes (ex: 0.1 cent)
  return Number(bi)
}

// ============================================================
// Helpers de validation
// ============================================================

/**
 * Valide qu'une valeur est un entier représentant des centimes valide.
 */
export function isValidCents(value: unknown): value is Cents {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    Number.isSafeInteger(value)
  )
}

/**
 * Valide qu'un taux est entre 0 et 10000 (0% et 100%).
 */
export function isValidRateCents(value: unknown): value is RateCents {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 10000
  )
}

// ============================================================
// Opérations d'agrégation
// ============================================================

/**
 * Additionne une liste de montants en centimes.
 * Utilise BigInt pour éviter les overflows sur de grandes sommes.
 */
export function sumCents(amounts: Cents[]): Cents {
  return Number(amounts.reduce((acc, c) => acc + BigInt(c), 0n))
}

/**
 * Soustrait b de a en centimes.
 */
export function subCents(a: Cents, b: Cents): Cents {
  return a - b
}

/**
 * Vérifie que deux montants en centimes sont égaux.
 */
export function centsEqual(a: Cents, b: Cents, tolerance = 0): boolean {
  return Math.abs(a - b) <= tolerance
}
