// SmartShule — Constantes partagées (rôles, statuts, catégories, icônes de mapping)

export const ROLE_LABELS: Record<string, string> = {
  PARENT: 'Parent',
  STUDENT: 'Élève',
  DIRECTION: 'Direction',
  ADMIN: 'Administrateur',
}

export const REQUEST_CATEGORIES: Record<string, string> = {
  INSCRIPTION: 'Inscription',
  FRAIS: 'Frais & paiement',
  ABSENCE: 'Absence',
  DOCUMENT: 'Document',
  TRANSPORT: 'Transport',
  DISCIPLINE: 'Discipline',
  SANTE: 'Santé',
  TECHNIQUE: 'Problème technique',
  AUTRE: 'Autre sujet',
}

export const REQUEST_PRIORITIES: Record<string, { label: string; tone: 'primary' | 'info' | 'warning' | 'danger' }> = {
  LOW: { label: 'Basse', tone: 'info' },
  NORMAL: { label: 'Normale', tone: 'primary' },
  HIGH: { label: 'Haute', tone: 'warning' },
  URGENT: { label: 'Urgente', tone: 'danger' },
}

export const REQUEST_STATUSES: Record<string, { label: string; tone: 'info' | 'warning' | 'success' | 'danger' | 'primary' | 'default' }> = {
  NEW: { label: 'Nouvelle', tone: 'info' },
  IN_PROGRESS: { label: 'En traitement', tone: 'warning' },
  WAITING: { label: 'En attente', tone: 'default' },
  ANSWERED: { label: 'Répondue', tone: 'success' },
  CLOSED: { label: 'Clôturée', tone: 'default' },
  ARCHIVED: { label: 'Archivée', tone: 'default' },
}

export const INVOICE_STATUSES: Record<string, { label: string; tone: 'default' | 'warning' | 'success' | 'danger' }> = {
  DRAFT: { label: 'Brouillon', tone: 'default' },
  UNPAID: { label: 'Impayée', tone: 'danger' },
  PARTIALLY_PAID: { label: 'Partiellement payée', tone: 'warning' },
  PAID: { label: 'Payée', tone: 'success' },
  CANCELLED: { label: 'Annulée', tone: 'default' },
}

export const PAYMENT_METHODS: Record<string, string> = {
  CASH: 'Espèces',
  BANK: 'Banque',
  MOBILE_MONEY: 'Mobile Money',
  CARD: 'Carte bancaire',
}

export const ATTENDANCE_STATUSES: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' }> = {
  PRESENT: { label: 'Présent', tone: 'success' },
  LATE: { label: 'En retard', tone: 'warning' },
  ABSENT: { label: 'Absent', tone: 'danger' },
  EXCUSED: { label: 'Excusé', tone: 'info' },
}

export const ANNOUNCEMENT_PRIORITIES: Record<string, { label: string; tone: 'info' | 'primary' | 'warning' | 'danger' }> = {
  LOW: { label: 'Basse', tone: 'info' },
  NORMAL: { label: 'Normale', tone: 'primary' },
  HIGH: { label: 'Haute', tone: 'warning' },
  URGENT: { label: 'Urgente', tone: 'danger' },
}

export const RELATIONSHIP_LABELS: Record<string, string> = {
  PERE: 'Père',
  MERE: 'Mère',
  TUTEUR: 'Tuteur',
  AUTRE: 'Autre',
}
