// SmartShule — Tests unitaires : Bibliothèque (Cycle 06)
// Vérifie :
//   - Le prêt décrémente availableCopies ;
//   - Le retour incrémente availableCopies ;
//   - Le signalement "perdu" décrémente numberOfCopies définitivement ;
//   - Le refus de prêt si plus d'exemplaire disponible ;
//   - Le refus de retour si déjà rendu.

import { test, expect, describe, beforeAll, afterAll, beforeEach } from 'bun:test'
import { db } from '../../src/lib/db'
import { loanBook, returnBook, markBookLost, LibraryError } from '../../src/lib/library'

// Tests séquentiels : l'état du livre change entre tests (availableCopies)
const test_seq = test.serial

const TEST_SUFFIX = Date.now().toString()
let schoolId: string
let bookId: string

describe('Bibliothèque — prêts et retours (Cycle 06)', () => {
  beforeAll(async () => {
    const school = await db.school.findFirst()
    if (!school) throw new Error('Aucune école dans la DB. Lancez scripts/seed.ts.')
    schoolId = school.id

    const book = await db.book.create({
      data: {
        schoolId,
        title: `Livre test ${TEST_SUFFIX}`,
        author: 'Auteur Test',
        category: 'Roman',
        numberOfCopies: 3,
        availableCopies: 3,
        status: 'ACTIVE',
      },
    })
    bookId = book.id
  })

  afterAll(async () => {
    await db.bookLoan.deleteMany({ where: { bookId } })
    await db.book.deleteMany({ where: { id: bookId } })
  })

  // Avant chaque test, remettre le livre dans l'état initial (3 copies disponibles)
  beforeEach(async () => {
    await db.bookLoan.deleteMany({ where: { bookId } })
    await db.book.update({
      where: { id: bookId },
      data: { numberOfCopies: 3, availableCopies: 3, status: 'ACTIVE' },
    })
  })

  test_seq('prêt décrémente availableCopies', async () => {
    const before = await db.book.findUnique({ where: { id: bookId } })
    expect(before?.availableCopies).toBe(3)

    const loan = await loanBook({
      schoolId, bookId,
      borrowerName: 'Élève Test',
      dueDate: new Date(Date.now() + 14 * 86400000),
    })

    const after = await db.book.findUnique({ where: { id: bookId } })
    expect(after?.availableCopies).toBe(2)
    expect(loan.id).toBeTruthy()
  })

  test_seq('retour incrémente availableCopies', async () => {
    const loan = await loanBook({
      schoolId, bookId,
      borrowerName: 'Élève Test 2',
      dueDate: new Date(Date.now() + 7 * 86400000),
    })
    const before = await db.book.findUnique({ where: { id: bookId } })
    expect(before?.availableCopies).toBe(2) // 3 - 1 = 2

    await returnBook(loan.id)

    const after = await db.book.findUnique({ where: { id: bookId } })
    expect(after?.availableCopies).toBe(3) // 2 + 1 = 3
  })

  test_seq('refuse le prêt si plus d\'exemplaire disponible', async () => {
    // Épuiser les 3 exemplaires
    await loanBook({ schoolId, bookId, borrowerName: 'E1', dueDate: new Date(Date.now() + 7 * 86400000) })
    await loanBook({ schoolId, bookId, borrowerName: 'E2', dueDate: new Date(Date.now() + 7 * 86400000) })
    await loanBook({ schoolId, bookId, borrowerName: 'E3', dueDate: new Date(Date.now() + 7 * 86400000) })

    await expect(loanBook({
      schoolId, bookId, borrowerName: 'E4',
      dueDate: new Date(Date.now() + 7 * 86400000),
    })).rejects.toThrow(LibraryError)
  })

  test_seq('refuse le retour si déjà rendu', async () => {
    const loan = await loanBook({
      schoolId, bookId,
      borrowerName: 'E5',
      dueDate: new Date(Date.now() + 7 * 86400000),
    })
    await returnBook(loan.id)

    await expect(returnBook(loan.id)).rejects.toThrow(LibraryError)
  })

  test_seq('signalement "perdu" décrémente numberOfCopies définitivement', async () => {
    const before = await db.book.findUnique({ where: { id: bookId } })
    expect(before?.numberOfCopies).toBe(3)

    const loan = await loanBook({
      schoolId, bookId,
      borrowerName: 'E6',
      dueDate: new Date(Date.now() + 7 * 86400000),
    })

    await markBookLost(loan.id)

    const after = await db.book.findUnique({ where: { id: bookId } })
    expect(after?.numberOfCopies).toBe(2) // 3 - 1 = 2
    // availableCopies doit rester à 2 (le prêt a décrémenté de 1, markBookLost ne réincrémente pas)
    expect(after?.availableCopies).toBe(2)
  })

  test_seq('rejette un prêt avec date antérieure', async () => {
    await expect(loanBook({
      schoolId, bookId,
      borrowerName: 'E7',
      dueDate: new Date(Date.now() - 86400000), // hier
    })).rejects.toThrow(LibraryError)
  })
})
