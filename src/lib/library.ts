// SmartShule — Helper Bibliothèque (Cycle 06, §14.2.19-A)
//
// Implémente :
//   - Le prêt d'un livre (décrémente availableCopies) ;
//   - Le retour d'un livre (incrémente availableCopies) ;
//   - Le signalement d'un livre perdu (availableCopies décrémenté définitivement) ;
//   - Le suivi des retards (statut OVERDUE).

import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'

// ============================================================
// Types & erreurs
// ============================================================

export type LoanStatus = 'ACTIVE' | 'RETURNED' | 'OVERDUE' | 'LOST'

export class LibraryError extends Error {
  constructor(
    public readonly code:
      | 'BOOK_NOT_FOUND'
      | 'BOOK_UNAVAILABLE'
      | 'LOAN_NOT_FOUND'
      | 'INVALID_DATES'
      | 'ALREADY_RETURNED'
      | 'STUDENT_NOT_ENROLLED',
    message: string
  ) {
    super(message)
    this.name = 'LibraryError'
  }
}

// ============================================================
// Prêt d'un livre
// ============================================================

export async function loanBook(
  input: {
    schoolId: string
    bookId: string
    borrowerName: string
    borrowerType?: 'STUDENT' | 'TEACHER' | 'STAFF'
    borrowerId?: string
    dueDate: Date
    notes?: string
  },
  tx?: Prisma.TransactionClient
): Promise<{ id: string }> {
  const client = tx || db

  const book = await client.book.findUnique({ where: { id: input.bookId } })
  if (!book) throw new LibraryError('BOOK_NOT_FOUND', `Livre introuvable.`)
  if (book.status !== 'ACTIVE') {
    throw new LibraryError('BOOK_UNAVAILABLE', `Livre archivé.`)
  }
  if (book.availableCopies <= 0) {
    throw new LibraryError(
      'BOOK_UNAVAILABLE',
      `Aucun exemplaire disponible (0/${book.numberOfCopies}).`
    )
  }
  if (input.dueDate <= new Date()) {
    throw new LibraryError('INVALID_DATES', 'La date de retour prévue doit être future.')
  }

  // Transaction : créer le prêt + décrémenter availableCopies
  const loan = await client.bookLoan.create({
    data: {
      schoolId: input.schoolId,
      bookId: input.bookId,
      borrowerName: input.borrowerName,
      borrowerType: input.borrowerType || 'STUDENT',
      borrowerId: input.borrowerId,
      loanDate: new Date(),
      dueDate: input.dueDate,
      status: 'ACTIVE',
      notes: input.notes,
    },
  })

  await client.book.update({
    where: { id: input.bookId },
    data: { availableCopies: book.availableCopies - 1 },
  })

  return { id: loan.id }
}

// ============================================================
// Retour d'un livre
// ============================================================

export async function returnBook(
  loanId: string,
  tx?: Prisma.TransactionClient
): Promise<{ id: string; status: LoanStatus }> {
  const client = tx || db

  const loan = await client.bookLoan.findUnique({
    where: { id: loanId },
    include: { book: true },
  })
  if (!loan) throw new LibraryError('LOAN_NOT_FOUND', `Prêt introuvable.`)
  if (loan.status === 'RETURNED') {
    throw new LibraryError('ALREADY_RETURNED', `Ce livre a déjà été rendu.`)
  }

  // Déterminer le statut : si en retard, on marque OVERDUE mais on permet le retour
  const isOverdue = loan.dueDate < new Date()

  await client.bookLoan.update({
    where: { id: loanId },
    data: {
      returnDate: new Date(),
      status: 'RETURNED',
    },
  })

  // Incrémenter availableCopies (sauf si livre perdu)
  if (loan.status !== 'LOST') {
    await client.book.update({
      where: { id: loan.bookId },
      data: { availableCopies: loan.book.availableCopies + 1 },
    })
  }

  return { id: loanId, status: isOverdue ? 'OVERDUE' : 'RETURNED' }
}

// ============================================================
// Signaler un livre perdu
// ============================================================

export async function markBookLost(
  loanId: string,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx || db
  const loan = await client.bookLoan.findUnique({ where: { id: loanId } })
  if (!loan) throw new LibraryError('LOAN_NOT_FOUND', `Prêt introuvable.`)
  if (loan.status === 'RETURNED') {
    throw new LibraryError('ALREADY_RETURNED', `Ce livre est déjà rendu.`)
  }

  await client.bookLoan.update({
    where: { id: loanId },
    data: { status: 'LOST', returnDate: new Date() },
  })

  // Ne pas incrémenter availableCopies : le livre est perdu
  // Mais décrémenter numberOfCopies car l'exemplaire est définitivement retiré
  await client.book.update({
    where: { id: loan.bookId },
    data: {
      numberOfCopies: { decrement: 1 },
    },
  })
}
