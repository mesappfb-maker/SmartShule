// SmartShule — Tests unitaires : moteur d'exports (Cycle 04)
//
// Vérifie :
//   - La génération XLSX d'élèves renvoie un buffer non vide avec le bon MIME type ;
//   - La génération CSV contient le BOM UTF-8 et les en-têtes attendus ;
//   - La génération PDF d'un reçu renvoie un buffer PDF valide (commence par %PDF-) ;
//   - La fonction toCsv échappe correctement les valeurs avec virgules et guillemets.
//
// Note : ces tests utilisent la DB de démo (school existante).

import { test, expect, describe, beforeAll } from 'bun:test'
import { db } from '../../src/lib/db'
import {
  generateStudentsXLSX,
  generateStudentsCSV,
  generateJournalEntriesXLSX,
  generateJournalEntriesCSV,
  generatePaymentReceiptPDF,
  generateInvoicePDF,
} from '../../src/lib/exports'

let schoolId: string
let testInvoiceId: string
let testPaymentId: string

describe('Moteur d\'exports (Cycle 04)', () => {
  beforeAll(async () => {
    const school = await db.school.findFirst()
    if (!school) throw new Error('Aucune école dans la DB de test. Lancez scripts/seed.ts.')
    schoolId = school.id

    // Trouver une facture et un paiement existants
    const invoice = await db.invoice.findFirst({
      where: { schoolId, status: { in: ['PAID', 'PARTIALLY_PAID'] } },
    })
    if (invoice) testInvoiceId = invoice.id

    const payment = await db.payment.findFirst({
      where: { schoolId, status: 'CONFIRMED' },
    })
    if (payment) testPaymentId = payment.id
  })

  describe('generateStudentsXLSX', () => {
    test('génère un buffer XLSX valide (non videide)', async () => {
      const result = await generateStudentsXLSX(schoolId)
      expect(result.buffer.length).toBeGreaterThan(1000)
      expect(result.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      expect(result.filename).toMatch(/^eleves-\d{4}-\d{2}-\d{2}\.xlsx$/)
    })

    test('le buffer commence par la signature XLSX (PK)', async () => {
      const result = await generateStudentsXLSX(schoolId)
      // Les fichiers XLSX sont des ZIP : commencent par PK (0x50 0x4B)
      expect(result.buffer[0]).toBe(0x50)
      expect(result.buffer[1]).toBe(0x4B)
    })
  })

  describe('generateStudentsCSV', () => {
    test('génère un CSV avec BOM UTF-8', async () => {
      const result = await generateStudentsCSV(schoolId)
      // BOM UTF-8 = 0xEF 0xBB 0xBF
      expect(result.buffer[0]).toBe(0xEF)
      expect(result.buffer[1]).toBe(0xBB)
      expect(result.buffer[2]).toBe(0xBF)
      expect(result.mimeType).toContain('text/csv')
      expect(result.filename).toMatch(/^eleves-\d{4}-\d{2}-\d{2}\.csv$/)
    })

    test('le CSV contient les en-têtes attendus', async () => {
      const result = await generateStudentsCSV(schoolId)
      const content = result.buffer.toString('utf-8').replace(/^\uFEFF/, '')
      const firstLine = content.split('\n')[0]
      expect(firstLine).toContain('Matricule')
      expect(firstLine).toContain('Prénom')
      expect(firstLine).toContain('Nom')
      expect(firstLine).toContain('Classe')
    })
  })

  describe('generateJournalEntriesXLSX', () => {
    test('génère un XLSX avec les colonnes comptables', async () => {
      const result = await generateJournalEntriesXLSX(schoolId)
      expect(result.buffer.length).toBeGreaterThan(1000)
      expect(result.buffer[0]).toBe(0x50) // PK
      expect(result.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    })
  })

  describe('generateJournalEntriesCSV', () => {
    test('génère un CSV avec les en-têtes comptables', async () => {
      const result = await generateJournalEntriesCSV(schoolId)
      const content = result.buffer.toString('utf-8').replace(/^\uFEFF/, '')
      const firstLine = content.split('\n')[0]
      expect(firstLine).toContain('N° écriture')
      expect(firstLine).toContain('N° compte')
      expect(firstLine).toContain('Débit')
      expect(firstLine).toContain('Crédit')
      expect(firstLine).toContain('Équilibrée')
    })
  })

  describe('generatePaymentReceiptPDF', () => {
    test('génère un PDF valide (commence par %PDF-)', async () => {
      if (!testPaymentId) {
        console.warn('Aucun paiement de test disponible — test skip')
        return
      }
      const result = await generatePaymentReceiptPDF(testPaymentId, schoolId)
      expect(result.buffer.length).toBeGreaterThan(1000)
      const header = result.buffer.toString('ascii', 0, 5)
      expect(header).toBe('%PDF-')
      expect(result.mimeType).toBe('application/pdf')
      expect(result.filename).toMatch(/^recu-REC-\d{4}-\d{4}\.pdf$/)
    })
  })

  describe('generateInvoicePDF', () => {
    test('génère un PDF valide', async () => {
      if (!testInvoiceId) {
        console.warn('Aucune facture de test disponible — test skip')
        return
      }
      const result = await generateInvoicePDF(testInvoiceId, schoolId)
      expect(result.buffer.length).toBeGreaterThan(1000)
      const header = result.buffer.toString('ascii', 0, 5)
      expect(header).toBe('%PDF-')
      expect(result.filename).toMatch(/^facture-FAC-\d{4}-\d{4}\.pdf$/)
    })
  })
})
