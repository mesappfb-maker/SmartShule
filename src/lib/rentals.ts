// SmartShule — Module Locations (Cycle 05, §3.13 + §3.14)
//
// Implémente :
//   - La détection de conflit de réservation (atomicité serveur) ;
//   - Le workflow : DRAFT → QUOTE → CONFIRMED → ACTIVE → COMPLETED → INVOICED → CLOSED ;
//   - Les acomptes et cautions (séparation produit / dette d'avance) ;
//   - Les états des lieux (entrée + sortie) avec constatation des dommages ;
//   - La comptabilité analytique dédiée (activité LOCATION_SALLE | LOCATION_VEHICULE) ;
//   - Le verrouillage de la ressource sur la période confirmée.
//
// Toutes les mutations sont conçues pour être appelées dans une transaction Prisma.

import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import {
  computeInvoice,
  generateInvoiceEntryDraft,
  postJournalEntry,
  type InvoiceLineInput,
  type JournalEntryDraft,
} from '@/lib/accounting'

// ============================================================
// Types
// ============================================================

export type ResourceType = 'ROOM' | 'VEHICLE'
export type ContractStatus =
  | 'DRAFT'
  | 'QUOTE'
  | 'CONFIRMED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'INVOICED'
  | 'CLOSED'
  | 'CANCELLED'

export interface RentalConflict {
  contractId: string
  contractNumber: string
  startDate: Date
  endDate: Date
  customerName: string
}

// ============================================================
// Erreurs typées
// ============================================================

export class RentalError extends Error {
  constructor(
    public readonly code:
      | 'RESOURCE_NOT_FOUND'
      | 'RESOURCE_UNAVAILABLE'
      | 'CONFLICT'
      | 'INVALID_STATUS'
      | 'INVALID_DATES'
      | 'INVALID_AMOUNT'
      | 'CONTRACT_NOT_FOUND'
      | 'ALREADY_CONFIRMED'
      | 'NOT_AUTHORIZED',
    message: string
  ) {
    super(message)
    this.name = 'RentalError'
  }
}

// ============================================================
// Détection de conflit de réservation (§3.13, §3.14)
// ============================================================

/**
 * Détecte les conflits de réservation pour une ressource sur une période donnée.
 *
 * Un conflit existe si un contrat CONFIRMED, ACTIVE ou COMPLETED chevauche
 * la période demandée. Les contrats DRAFT, QUOTE, CANCELLED ou CLOSED sont ignorés.
 *
 * @returns La liste des contrats conflictuels (vide si pas de conflit).
 */
export async function findRentalConflicts(
  input: {
    schoolId: string
    resourceId: string
    startDate: Date
    endDate: Date
    excludeContractId?: string // pour les mises à jour
  },
  tx?: Prisma.TransactionClient
): Promise<RentalConflict[]> {
  const client = tx || db

  const blockingStatuses = ['CONFIRMED', 'ACTIVE', 'COMPLETED']
  const where: Prisma.RentalContractWhereInput = {
    schoolId: input.schoolId,
    resourceId: input.resourceId,
    status: { in: blockingStatuses },
    // Chevauchement : startDate < existingEndDate AND endDate > existingStartDate
    AND: [
      { startDate: { lt: input.endDate } },
      { endDate: { gt: input.startDate } },
    ],
  }
  if (input.excludeContractId) {
    where.id = { not: input.excludeContractId }
  }

  const conflicts = await client.rentalContract.findMany({
    where,
    orderBy: { startDate: 'asc' },
  })

  return conflicts.map((c) => ({
    contractId: c.id,
    contractNumber: c.contractNumber,
    startDate: c.startDate,
    endDate: c.endDate,
    customerName: c.customerName,
  }))
}

/**
 * Vérifie qu'une ressource est disponible sur la période demandée.
 * Lève une RentalError si un conflit existe.
 *
 * Cette fonction doit être appelée DANS une transaction pour garantir
 * l'atomicité du contrôle (§3.13 : empêcher les chevauchements confirmés
 * par une transaction serveur atomique).
 */
export async function assertResourceAvailable(
  input: {
    schoolId: string
    resourceId: string
    startDate: Date
    endDate: Date
    excludeContractId?: string
  },
  tx?: Prisma.TransactionClient
): Promise<void> {
  const conflicts = await findRentalConflicts(input, tx)
  if (conflicts.length > 0) {
    const c = conflicts[0]
    throw new RentalError(
      'CONFLICT',
      `Conflit de réservation : la ressource est déjà réservée par ${c.customerName} ` +
        `du ${c.startDate.toLocaleDateString('fr-FR')} au ${c.endDate.toLocaleDateString('fr-FR')} ` +
        `(contrat ${c.contractNumber}).`
    )
  }
}

// ============================================================
// Création d'un contrat de location
// ============================================================

export async function createRentalContract(
  input: {
    schoolId: string
    resourceId: string
    resourceType: ResourceType
    customerName: string
    customerPhone?: string
    customerEmail?: string
    customerType?: 'INDIVIDUAL' | 'ORGANIZATION'
    startDate: Date
    endDate: Date
    rentalAmountCents: number
    depositAmountCents?: number
    cautionAmountCents?: number
    createdById?: string
  },
  tx?: Prisma.TransactionClient
): Promise<{ id: string; contractNumber: string }> {
  const client = tx || db

  // Validation des dates
  if (input.endDate <= input.startDate) {
    throw new RentalError('INVALID_DATES', 'La date de fin doit être postérieure à la date de début.')
  }
  if (input.rentalAmountCents <= 0) {
    throw new RentalError('INVALID_AMOUNT', 'Le montant de la location doit être positif.')
  }

  // Vérifier la ressource
  const resource = await client.rentalResource.findUnique({
    where: { id: input.resourceId },
  })
  if (!resource) {
    throw new RentalError('RESOURCE_NOT_FOUND', `Ressource ${input.resourceId} introuvable.`)
  }
  if (resource.status !== 'ACTIVE') {
    throw new RentalError(
      'RESOURCE_UNAVAILABLE',
      `Ressource indisponible (statut: ${resource.status}).`
    )
  }

  // Vérifier la disponibilité (dans la transaction pour atomicité)
  await assertResourceAvailable({
    schoolId: input.schoolId,
    resourceId: input.resourceId,
    startDate: input.startDate,
    endDate: input.endDate,
  }, tx)

  // Générer le numéro de contrat
  const count = await client.rentalContract.count({ where: { schoolId: input.schoolId } })
  const year = new Date().getFullYear()
  const contractNumber = `LOC-${year}-${String(count + 1).padStart(5, '0')}`

  // Calculer le total TTC (location + pénalité éventuelle + acompte + caution)
  const totalAmountCents =
    input.rentalAmountCents +
    (input.cautionAmountCents || 0)

  const contract = await client.rentalContract.create({
    data: {
      schoolId: input.schoolId,
      contractNumber,
      resourceId: input.resourceId,
      resourceType: input.resourceType,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      customerType: input.customerType || 'INDIVIDUAL',
      startDate: input.startDate,
      endDate: input.endDate,
      rentalAmountCents: input.rentalAmountCents,
      depositAmountCents: input.depositAmountCents || 0,
      cautionAmountCents: input.cautionAmountCents || 0,
      penaltyAmountCents: 0,
      totalAmountCents,
      paidAmountCents: 0,
      status: 'QUOTE',
      quoteAt: new Date(),
      createdById: input.createdById,
    },
  })

  return { id: contract.id, contractNumber: contract.contractNumber }
}

// ============================================================
// Transition de statut
// ============================================================

const VALID_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  DRAFT: ['QUOTE', 'CANCELLED'],
  QUOTE: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['COMPLETED', 'CANCELLED'],
  COMPLETED: ['INVOICED'],
  INVOICED: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
}

export function isValidRentalTransition(
  from: ContractStatus,
  to: ContractStatus
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

export async function transitionRentalStatus(
  contractId: string,
  to: ContractStatus,
  userId: string,
  tx?: Prisma.TransactionClient
): Promise<{ id: string; previousStatus: ContractStatus; newStatus: ContractStatus }> {
  const client = tx || db

  const contract = await client.rentalContract.findUnique({
    where: { id: contractId },
  })
  if (!contract) {
    throw new RentalError('CONTRACT_NOT_FOUND', `Contrat ${contractId} introuvable.`)
  }

  const current = contract.status as ContractStatus
  if (current === to) {
    return { id: contract.id, previousStatus: current, newStatus: to }
  }

  if (!isValidRentalTransition(current, to)) {
    throw new RentalError(
      'INVALID_STATUS',
      `Transition invalide : ${current} → ${to}. ` +
        `Transitions valides depuis ${current} : ${VALID_TRANSITIONS[current].join(', ') || '(aucune — statut terminal)'}.`
    )
  }

  // Si on confirme, vérifier à nouveau la disponibilité (atomicité)
  if (to === 'CONFIRMED') {
    await assertResourceAvailable({
      schoolId: contract.schoolId,
      resourceId: contract.resourceId,
      startDate: contract.startDate,
      endDate: contract.endDate,
      excludeContractId: contract.id,
    }, tx)
  }

  // Métadonnées
  const updateData: any = { status: to, updatedAt: new Date() }
  if (to === 'CONFIRMED') updateData.confirmedAt = new Date()
  else if (to === 'ACTIVE') updateData.activeAt = new Date()
  else if (to === 'COMPLETED') updateData.completedAt = new Date()
  else if (to === 'INVOICED') updateData.invoicedAt = new Date()
  else if (to === 'CLOSED') updateData.closedAt = new Date()
  else if (to === 'CANCELLED') {
    updateData.cancelledAt = new Date()
  }

  await client.rentalContract.update({
    where: { id: contractId },
    data: updateData,
  })

  return { id: contract.id, previousStatus: current, newStatus: to }
}

// ============================================================
// État des lieux (entrée / sortie)
// ============================================================

export async function recordCheckIn(
  contractId: string,
  notes: string,
  userId: string,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx || db
  const contract = await client.rentalContract.findUnique({ where: { id: contractId } })
  if (!contract) throw new RentalError('CONTRACT_NOT_FOUND', `Contrat introuvable.`)
  if (contract.status !== 'CONFIRMED' && contract.status !== 'ACTIVE') {
    throw new RentalError('INVALID_STATUS', `L'état des lieux d'entrée requiert le statut CONFIRMED ou ACTIVE.`)
  }
  if (contract.checkInAt) {
    throw new RentalError('ALREADY_CONFIRMED', `L'état des lieux d'entrée a déjà été effectué.`)
  }

  await client.rentalContract.update({
    where: { id: contractId },
    data: {
      checkInNotes: notes,
      checkInAt: new Date(),
      checkInById: userId,
      status: 'ACTIVE',
      activeAt: new Date(),
    },
  })
}

export async function recordCheckOut(
  contractId: string,
  notes: string,
  damageNotes: string | null,
  damageAmountCents: number,
  userId: string,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx || db
  const contract = await client.rentalContract.findUnique({ where: { id: contractId } })
  if (!contract) throw new RentalError('CONTRACT_NOT_FOUND', `Contrat introuvable.`)
  if (contract.status !== 'ACTIVE') {
    throw new RentalError('INVALID_STATUS', `L'état des lieux de sortie requiert le statut ACTIVE.`)
  }
  if (contract.checkOutAt) {
    throw new RentalError('ALREADY_CONFIRMED', `L'état des lieux de sortie a déjà été effectué.`)
  }

  // Si des dommages sont constatés, les ajouter au montant pénalité
  const newPenalty = contract.penaltyAmountCents + damageAmountCents

  await client.rentalContract.update({
    where: { id: contractId },
    data: {
      checkOutNotes: notes,
      damageNotes,
      damageAmountCents,
      checkOutAt: new Date(),
      checkOutById: userId,
      status: 'COMPLETED',
      completedAt: new Date(),
      penaltyAmountCents: newPenalty,
      totalAmountCents: contract.totalAmountCents + damageAmountCents,
    },
  })
}

// ============================================================
// Génération de l'écriture comptable analytique
// ============================================================

/**
 * Génère l'écriture comptable analytique pour une location facturée.
 *
 * Conforme au §3.11.7 (salles) et §3.11.8 (véhicules) :
 *   Débit  411xxx  Client location         Montant TTC
 *   Crédit 7065xx  Location salle          Montant HT (pour salle)
 *   ou     7066xx  Location véhicule       Montant HT (pour véhicule)
 *   Crédit 445700  Taxe collectée          Montant taxe
 *
 * Les lignes portent les dimensions analytiques :
 *   Activité : LOCATION_SALLE | LOCATION_VEHICULE
 *   Ressource : identifiant de la ressource
 *   Contrat : numéro de contrat
 */
export function generateRentalInvoiceEntryDraft(
  contract: {
    id: string
    contractNumber: string
    resourceType: string
    rentalAmountCents: number
    cautionAmountCents: number
    penaltyAmountCents: number
  },
  taxRate: number = 0,
  customerAccountNumber: string = '411002' // Clients location salles par défaut
): JournalEntryDraft {
  const activity = contract.resourceType === 'ROOM' ? 'LOCATION_SALLE' : 'LOCATION_VEHICULE'
  const productAccountNumber = contract.resourceType === 'ROOM' ? '706500' : '706600'

  // Calcul HT et taxe
  const totalTTC = contract.rentalAmountCents + contract.penaltyAmountCents
  const netHT = taxRate > 0 ? Math.round(totalTTC / (1 + taxRate / 100)) : totalTTC
  const taxAmount = totalTTC - netHT

  const lines = [
    {
      accountNumber: customerAccountNumber,
      side: 'DEBIT' as const,
      amountCents: totalTTC,
      description: `Créance client — contrat ${contract.contractNumber}`,
      analyticalActivity: activity,
      analyticalContract: contract.contractNumber,
    },
    {
      accountNumber: productAccountNumber,
      side: 'CREDIT' as const,
      amountCents: netHT,
      description: `Produit location (${contract.resourceType.toLowerCase()})`,
      analyticalActivity: activity,
      analyticalContract: contract.contractNumber,
    },
  ]

  if (taxAmount > 0) {
    lines.push({
      accountNumber: '445700',
      side: 'CREDIT' as const,
      amountCents: taxAmount,
      description: 'Taxe collectée',
      analyticalActivity: activity,
      analyticalContract: contract.contractNumber,
    })
  }

  return {
    journalCode: contract.resourceType === 'ROOM' ? 'VE-SAL' : 'VE-VEH',
    entryDate: new Date(),
    description: `Facture location ${contract.resourceType.toLowerCase()} — contrat ${contract.contractNumber}`,
    referenceType: 'INVOICE',
    referenceId: contract.id,
    lines,
  }
}
