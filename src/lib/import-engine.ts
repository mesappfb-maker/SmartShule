// SmartShule — Moteur d'import massif CSV/XLSX
// ============================================================
// 8 étapes :
//   1. Sélection type d'import
//   2. Téléchargement modèle
//   3. Dépôt fichier
//   4. Mapping colonnes
//   5. Validation + prévisualisation
//   6. Correction erreurs
//   7. Confirmation + exécution (background)
//   8. Résultat + rollback contrôlé
//
// SÉCURITÉ ANTI-INJECTION CSV/XLSX :
//   - Toutes les cellules sont traitées comme données non fiables
//   - Rejet des cellules commençant par =, +, -, @, \t, \r
//   - Aucune exécution de macros / scripts embarqués
//   - Limitation taille fichier (10 Mo) + nombre lignes (10 000)
//   - Désinfection lors des exports (escape CSV)

import ExcelJS from 'exceljs'
import { db } from '@/lib/db'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'
import crypto from 'crypto'
import path from 'path'
import fs from 'fs/promises'

// ============================================================
// Types
// ============================================================

export type ImportType =
  | 'STUDENTS' | 'REENROLLMENTS' | 'PARENTS' | 'PARENT_STUDENT_LINKS'
  | 'CLASS_ASSIGNMENTS' | 'ADMIN_UPDATE' | 'HISTORY'

export interface ImportConfig {
  type: ImportType
  label: string
  description: string
  allowedRoles: string[]
  requiredColumns: string[]
  optionalColumns: string[]
  referenceColumns: string[] // Colonnes pour détection doublons
  maxRows: number
}

export interface ImportRowData {
  rowNumber: number
  rawData: Record<string, any>
  mappedData: Record<string, any>
  status: 'PENDING' | 'VALID' | 'WARNING' | 'ERROR' | 'DUPLICATE' | 'IMPORTED' | 'REJECTED' | 'IGNORED'
  errors: Array<{ field: string; message: string; severity: 'error' | 'warning' }>
}

export interface ValidationResult {
  totalRows: number
  validRows: number
  warningRows: number
  errorRows: number
  duplicateRows: number
  ignoredRows: number
  rows: ImportRowData[]
}

// ============================================================
// Configurations par type d'import
// ============================================================

export const IMPORT_CONFIGS: Record<ImportType, ImportConfig> = {
  STUDENTS: {
    type: 'STUDENTS',
    label: 'Nouveaux élèves',
    description: 'Importer des élèves non encore enregistrés',
    allowedRoles: ['SECRETARY', 'ADMIN'],
    requiredColumns: ['firstName', 'lastName', 'gender', 'birthDate'],
    optionalColumns: ['birthPlace', 'address', 'phone', 'email', 'matricule', 'parentName', 'parentPhone', 'parentEmail', 'parentRelation'],
    referenceColumns: ['matricule', 'firstName', 'lastName', 'birthDate'],
    maxRows: 10000,
  },
  REENROLLMENTS: {
    type: 'REENROLLMENTS',
    label: 'Réinscriptions',
    description: 'Réinscrire les élèves existants pour la nouvelle année',
    allowedRoles: ['SECRETARY', 'ADMIN'],
    requiredColumns: ['matricule', 'classroomName'],
    optionalColumns: ['directorateName', 'sectionName', 'optionName'],
    referenceColumns: ['matricule'],
    maxRows: 10000,
  },
  PARENTS: {
    type: 'PARENTS',
    label: 'Parents / Tuteurs',
    description: 'Importer des parents ou tuteurs',
    allowedRoles: ['SECRETARY', 'ADMIN'],
    requiredColumns: ['firstName', 'lastName'],
    optionalColumns: ['phone', 'email', 'occupation', 'address', 'workplace'],
    referenceColumns: ['phone', 'email'],
    maxRows: 5000,
  },
  PARENT_STUDENT_LINKS: {
    type: 'PARENT_STUDENT_LINKS',
    label: 'Relations parent-enfant',
    description: 'Lier des parents existants à des élèves existants',
    allowedRoles: ['SECRETARY', 'ADMIN'],
    requiredColumns: ['parentPhone', 'studentMatricule', 'relation'],
    optionalColumns: ['isPrimary', 'hasCustody', 'isEmergencyContact'],
    referenceColumns: ['parentPhone', 'studentMatricule'],
    maxRows: 10000,
  },
  CLASS_ASSIGNMENTS: {
    type: 'CLASS_ASSIGNMENTS',
    label: 'Affectations de classe',
    description: 'Affecter des élèves à des classes',
    allowedRoles: ['SECRETARY', 'DIRECTION', 'ADMIN'],
    requiredColumns: ['studentMatricule', 'classroomName'],
    optionalColumns: ['directorateName', 'academicYearLabel'],
    referenceColumns: ['studentMatricule', 'classroomName'],
    maxRows: 10000,
  },
  ADMIN_UPDATE: {
    type: 'ADMIN_UPDATE',
    label: 'Mise à jour administrative',
    description: 'Mettre à jour des données administratives existantes',
    allowedRoles: ['SECRETARY', 'ADMIN'],
    requiredColumns: ['matricule'],
    optionalColumns: ['address', 'phone', 'email', 'status'],
    referenceColumns: ['matricule'],
    maxRows: 10000,
  },
  HISTORY: {
    type: 'HISTORY',
    label: 'Import historique contrôlé',
    description: 'Importer un historique validé (élèves archivés, anciennes années)',
    allowedRoles: ['ADMIN'],
    requiredColumns: ['firstName', 'lastName', 'matricule'],
    optionalColumns: ['birthDate', 'gender', 'academicYearLabel', 'classroomName'],
    referenceColumns: ['matricule'],
    maxRows: 20000,
  },
}

// ============================================================
// Sécurité : validation cellule CSV/XLSX (anti-injection)
// ============================================================

const DANGEROUS_PREFIXES = ['=', '+', '-', '@', '\t', '\r', '\x00']
const DANGEROUS_FORMULAS = /(\b(sum|count|avg|vlookup|hlookup|match|index|indirect|offset|hyperlink|concatenate|concat)\s*\(|\b(if|ifs|sumif|countif)\s*\()/i

export function sanitizeCell(value: any): { value: any; warning?: string } {
  if (value === null || value === undefined) return { value: null }
  if (typeof value === 'number' || typeof value === 'boolean' || value instanceof Date) {
    return { value }
  }
  const str = String(value)
  if (str.length === 0) return { value: '' }

  // Détection injection
  const firstChar = str.charAt(0)
  if (DANGEROUS_PREFIXES.includes(firstChar)) {
    // Préfixer avec apostrophe pour neutraliser
    return { value: `'${str}`, warning: `Cellule préfixée pour neutraliser formule potentielle (commence par ${firstChar})` }
  }

  // Détection formule
  if (DANGEROUS_FORMULAS.test(str)) {
    return { value: `'${str}`, warning: 'Cellule suspecte (formule détectée) — neutralisée' }
  }

  // Suppression caractères de contrôle
  const cleaned = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  return { value: cleaned }
}

// ============================================================
// Parser CSV (sécurisé, sans évaluation de formules)
// ============================================================

export function parseCsv(content: string): { headers: string[]; rows: Record<string, any>[]; warnings: string[] } {
  const warnings: string[] = []
  const lines = content.split(/\r?\n/)
  if (lines.length === 0) return { headers: [], rows: [], warnings }

  // Parse header
  const headers = parseCsvLine(lines[0])
  if (headers.length === 0) {
    warnings.push('En-tête vide ou mal formaté')
    return { headers: [], rows: [], warnings }
  }

  const rows: Record<string, any>[] = []
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const values = parseCsvLine(lines[i])
    const row: Record<string, any> = {}
    headers.forEach((h, idx) => {
      const raw = values[idx] || ''
      const { value, warning } = sanitizeCell(raw)
      if (warning) warnings.push(`Ligne ${i + 1}, colonne ${h}: ${warning}`)
      row[h] = value
    })
    rows.push(row)
  }

  return { headers, rows, warnings }
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (c === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += c
    }
  }
  result.push(current.trim())
  return result
}

// ============================================================
// Parser XLSX (sécurisé)
// ============================================================

export async function parseXlsx(buffer: Buffer | ArrayBuffer): Promise<{ headers: string[]; rows: Record<string, any>[]; warnings: string[] }> {
  const warnings: string[] = []
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as any)

  const sheet = workbook.worksheets[0]
  if (!sheet) {
    warnings.push('Aucune feuille trouvée dans le fichier XLSX')
    return { headers: [], rows: [], warnings }
  }

  // Headers = ligne 1
  const headers: string[] = []
  const headerRow = sheet.getRow(1)
  headerRow.eachCell((cell, colNumber) => {
    const val = sanitizeCell(cell.value).value
    headers[colNumber - 1] = String(val || `Colonne${colNumber}`)
  })

  // Lignes de données
  const rows: Record<string, any>[] = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const rowData: Record<string, any> = {}
    headers.forEach((h, idx) => {
      const cell = row.getCell(idx + 1)
      const { value, warning } = sanitizeCell(cell.value)
      if (warning) warnings.push(`Ligne ${rowNumber}, colonne ${h}: ${warning}`)
      rowData[h] = value
    })
    rows.push(rowData)
  })

  return { headers, rows, warnings }
}

// ============================================================
// Génération des modèles (templates) CSV/XLSX téléchargeables
// ============================================================

export async function generateImportTemplate(type: ImportType, format: 'csv' | 'xlsx' = 'xlsx'): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
  const config = IMPORT_CONFIGS[type]
  const allColumns = [...config.requiredColumns, ...config.optionalColumns]
  const filename = `modele-${type.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.${format}`

  if (format === 'csv') {
    const header = allColumns.join(',')
    // 2 lignes d'exemple
    const examples = [
      allColumns.map((c) => {
        if (c === 'firstName') return 'Jean'
        if (c === 'lastName') return 'Dupont'
        if (c === 'gender') return 'M'
        if (c === 'birthDate') return '2010-05-15'
        if (c === 'phone') return '+243812345678'
        if (c === 'email') return 'exemple@email.com'
        if (c === 'matricule') return 'SS-2026-00001'
        if (c === 'classroomName') return '6A'
        if (c === 'parentPhone') return '+243812345678'
        if (c === 'parentRelation') return 'PERE'
        if (c === 'relation') return 'PERE'
        return ''
      }).join(','),
      allColumns.map((c) => {
        if (c === 'firstName') return 'Marie'
        if (c === 'lastName') return 'Kabongo'
        if (c === 'gender') return 'F'
        if (c === 'birthDate') return '2011-09-22'
        return ''
      }).join(','),
    ]
    const csv = `${header}\n${examples.join('\n')}`
    return {
      buffer: Buffer.from('\uFEFF' + csv, 'utf-8'),
      mimeType: 'text/csv; charset=utf-8',
      filename,
    }
  }

  // XLSX
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Import', {
    properties: { tabColor: { argb: 'FF1E40AF' } },
  })

  // En-têtes
  sheet.columns = allColumns.map((c) => ({
    header: c,
    key: c,
    width: c.length + 5,
    style: { font: { bold: true } },
  }))

  // Marquer les colonnes requises en couleur
  sheet.getRow(1).eachCell((cell, colNumber) => {
    const colName = allColumns[colNumber - 1]
    if (config.requiredColumns.includes(colName)) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } } // Jaune pâle
      cell.note = `Colonne obligatoire: ${colName}`
    }
  })

  // Lignes d'exemple
  sheet.addRow({
    firstName: 'Jean', lastName: 'Dupont', gender: 'M', birthDate: '2010-05-15',
    phone: '+243812345678', email: 'exemple@email.com', matricule: 'SS-2026-00001',
    classroomName: '6A', directorateName: 'Primaire',
    parentName: 'Pierre Dupont', parentPhone: '+243812345678', parentEmail: 'pierre@email.com', parentRelation: 'PERE',
  })
  sheet.addRow({
    firstName: 'Marie', lastName: 'Kabongo', gender: 'F', birthDate: '2011-09-22',
    phone: '+243815556677', email: 'marie@email.com', matricule: 'SS-2026-00002',
    classroomName: '5B', directorateName: 'Primaire',
    parentName: 'Anne Kabongo', parentPhone: '+243815556677', parentEmail: 'anne@email.com', parentRelation: 'MERE',
  })

  // Feuille d'instructions
  const instrSheet = workbook.addWorksheet('Instructions', {
    properties: { tabColor: { argb: 'FF10B981' } },
  })
  instrSheet.columns = [{ header: 'Rubrique', key: 'rub', width: 30 }, { header: 'Description', key: 'desc', width: 70 }]
  instrSheet.addRow({ rub: 'Type d\'import', desc: config.label })
  instrSheet.addRow({ rub: 'Description', desc: config.description })
  instrSheet.addRow({ rub: 'Colonnes obligatoires', desc: config.requiredColumns.join(', ') })
  instrSheet.addRow({ rub: 'Colonnes optionnelles', desc: config.optionalColumns.join(', ') || '—' })
  instrSheet.addRow({ rub: 'Lignes max', desc: String(config.maxRows) })
  instrSheet.addRow({ rub: 'Format date', desc: 'YYYY-MM-DD (ex: 2010-05-15)' })
  instrSheet.addRow({ rub: 'Format téléphone', desc: 'E.164 (ex: +243812345678)' })
  instrSheet.addRow({ rub: 'Sécurité', desc: 'Les cellules commençant par =, +, -, @ sont neutralisées automatiquement' })
  instrSheet.addRow({ rub: 'Rôles autorisés', desc: config.allowedRoles.join(', ') })

  instrSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  instrSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } }

  const buffer = await workbook.xlsx.writeBuffer()
  return {
    buffer: Buffer.from(buffer),
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename,
  }
}

// ============================================================
// Validation d'une ligne
// ============================================================

function validateField(field: string, value: any, config: ImportConfig): { error?: string; warning?: string } {
  if (config.requiredColumns.includes(field) && (!value || String(value).trim() === '')) {
    return { error: `Champ obligatoire manquant: ${field}` }
  }
  if (!value) return {}

  const str = String(value).trim()

  // Validations par type de champ
  if (field === 'email' && str) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
      return { error: `Email invalide: ${str}` }
    }
  }
  if (field === 'phone' || field === 'parentPhone') {
    if (str && !/^\+?\d{8,15}$/.test(str.replace(/[\s\-().]/g, ''))) {
      return { error: `Téléphone invalide: ${str}` }
    }
  }
  if (field === 'birthDate' && str) {
    const d = new Date(str)
    if (isNaN(d.getTime())) return { error: `Date invalide: ${str}` }
    if (d > new Date()) return { error: `Date future non autorisée: ${str}` }
    if (d < new Date('1900-01-01')) return { error: `Date trop ancienne: ${str}` }
  }
  if (field === 'gender' && str) {
    if (!['M', 'F', 'Masculin', 'Féminin', 'MASCULIN', 'FEMININ'].includes(str)) {
      return { warning: `Genre inhabituel: ${str} (attendu: M ou F)` }
    }
  }
  if (field === 'matricule' && str) {
    if (str.length < 3) return { warning: 'Matricule court' }
  }
  return {}
}

// ============================================================
// Détection de doublons
// ============================================================

async function detectDuplicates(
  schoolId: string,
  rows: Record<string, any>[],
  config: ImportConfig
): Promise<Set<number>> {
  const duplicates = new Set<number>()

  // Doublons internes au fichier
  const seen = new Map<string, number>()
  rows.forEach((row, idx) => {
    const key = config.referenceColumns
      .map((c) => String(row[c] || '').trim().toLowerCase())
      .filter((s) => s)
      .join('|')
    if (!key) return
    if (seen.has(key)) {
      duplicates.add(idx)
      duplicates.add(seen.get(key)!)
    } else {
      seen.set(key, idx)
    }
  })

  // Doublons avec base existante
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (duplicates.has(i)) continue

    const matricule = String(row.matricule || '').trim()
    if (matricule) {
      const existing = await db.student.findFirst({
        where: { schoolId, matricule: { equals: matricule } },
        select: { id: true },
      })
      if (existing) duplicates.add(i)
    }

    const firstName = String(row.firstName || '').trim()
    const lastName = String(row.lastName || '').trim()
    const birthDate = row.birthDate ? new Date(row.birthDate) : null
    if (firstName && lastName && birthDate && !isNaN(birthDate.getTime())) {
      const existing = await db.student.findFirst({
        where: {
          schoolId,
          firstName: firstName,
          lastName: lastName,
          birthDate,
        },
        select: { id: true },
      })
      if (existing) duplicates.add(i)
    }
  }

  return duplicates
}

// ============================================================
// Validation complète d'un fichier importé
// ============================================================

export async function validateImportRows(
  schoolId: string,
  importType: ImportType,
  rows: Record<string, any>[],
  columnMapping?: Record<string, string>
): Promise<ValidationResult> {
  const config = IMPORT_CONFIGS[importType]
  if (rows.length > config.maxRows) {
    return {
      totalRows: rows.length, validRows: 0, warningRows: 0, errorRows: rows.length,
      duplicateRows: 0, ignoredRows: 0,
      rows: rows.map((_, i) => ({
        rowNumber: i + 2, rawData: rows[i], mappedData: {},
        status: 'ERROR',
        errors: [{ field: '__root', message: `Limite dépassée: ${rows.length} > ${config.maxRows}`, severity: 'error' }],
      })),
    }
  }

  // Mapping des colonnes
  const applyMapping = (row: Record<string, any>): Record<string, any> => {
    if (!columnMapping) return row
    const mapped: Record<string, any> = {}
    for (const [sourceCol, targetField] of Object.entries(columnMapping)) {
      if (row[sourceCol] !== undefined) mapped[targetField] = row[sourceCol]
    }
    // Copier aussi les colonnes déjà au bon nom
    for (const [k, v] of Object.entries(row)) {
      if (config.requiredColumns.includes(k) || config.optionalColumns.includes(k)) {
        if (mapped[k] === undefined) mapped[k] = v
      }
    }
    return mapped
  }

  // Détection doublons
  const duplicateIndices = await detectDuplicates(schoolId, rows, config)

  const result: ImportRowData[] = []
  let valid = 0, warning = 0, error = 0, duplicate = 0, ignored = 0

  for (let i = 0; i < rows.length; i++) {
    const rawRow = rows[i]
    const mappedRow = applyMapping(rawRow)
    const errors: ImportRowData['errors'] = []

    // Vérifier colonnes obligatoires
    for (const req of config.requiredColumns) {
      if (mappedRow[req] === undefined || mappedRow[req] === null || String(mappedRow[req]).trim() === '') {
        errors.push({ field: req, message: `Champ obligatoire manquant: ${req}`, severity: 'error' })
      }
    }

    // Vérifier format de chaque champ
    for (const [field, value] of Object.entries(mappedRow)) {
      const v = validateField(field, value, config)
      if (v.error) errors.push({ field, message: v.error, severity: 'error' })
      else if (v.warning) errors.push({ field, message: v.warning, severity: 'warning' })
    }

    let status: ImportRowData['status']
    const hasError = errors.some((e) => e.severity === 'error')
    const hasWarning = errors.some((e) => e.severity === 'warning')
    const isDuplicate = duplicateIndices.has(i)

    if (hasError) { status = 'ERROR'; error++ }
    else if (isDuplicate) { status = 'DUPLICATE'; duplicate++ }
    else if (hasWarning) { status = 'WARNING'; warning++ }
    else { status = 'VALID'; valid++ }

    result.push({
      rowNumber: i + 2, // +1 pour l'en-tête, +1 pour index 1-based
      rawData: rawRow,
      mappedData: mappedRow,
      status,
      errors,
    })
  }

  return {
    totalRows: rows.length,
    validRows: valid,
    warningRows: warning,
    errorRows: error,
    duplicateRows: duplicate,
    ignoredRows: ignored,
    rows: result,
  }
}

// ============================================================
// Exécution de l'import (background)
// ============================================================

const STORAGE_ROOT = process.env.STORAGE_ROOT || '/home/z/my-project/storage/imports'

export async function executeImport(
  importJobId: string,
  schoolId: string,
  importType: ImportType,
  rows: ImportRowData[],
  userId: string,
  userName: string,
  userRole: string
): Promise<{ createdCount: number; updatedCount: number; rejectedCount: number; errors: any[] }> {
  const config = IMPORT_CONFIGS[importType]
  let createdCount = 0, updatedCount = 0, rejectedCount = 0
  const errors: any[] = []

  await db.importJob.update({
    where: { id: importJobId },
    data: { status: 'RUNNING', startedAt: new Date(), progressPct: 0 },
  })

  const total = rows.length
  let processed = 0

  for (const row of rows) {
    try {
      if (row.status === 'ERROR' || row.status === 'DUPLICATE') {
        rejectedCount++
        await db.importRow.create({
          data: {
            importJobId,
            rowNumber: row.rowNumber,
            rawData: JSON.stringify(row.rawData),
            mappedData: JSON.stringify(row.mappedData),
            status: row.status === 'ERROR' ? 'REJECTED' : 'DUPLICATE',
            errors: JSON.stringify(row.errors),
          },
        })
        processed++
        continue
      }

      // Selon le type d'import
      let createdId: string | undefined
      let updatedId: string | undefined

      if (importType === 'STUDENTS' || importType === 'HISTORY') {
        const data = row.mappedData
        // Générer matricule si non fourni
        let matricule = data.matricule
        if (!matricule) {
          const count = await db.student.count({ where: { schoolId } })
          matricule = `SS-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`
        }
        // Normaliser genre
        let gender = data.gender ? String(data.gender).toUpperCase().charAt(0) : null
        if (gender !== 'M' && gender !== 'F') gender = null

        const student = await db.student.create({
          data: {
            schoolId,
            firstName: String(data.firstName || '').trim(),
            lastName: String(data.lastName || '').trim(),
            matricule,
            gender,
            birthDate: data.birthDate ? new Date(data.birthDate) : null,
            status: importType === 'HISTORY' ? 'TRANSFERRED' : 'ACTIVE',
          },
        })
        createdId = student.id
        createdCount++

        // Créer parent si fourni
        if (data.parentName || data.parentPhone) {
          const [pFirst, ...pRest] = String(data.parentName || 'Parent').split(' ')
          const pLast = pRest.join(' ') || '—'
          const guardian = await db.guardian.create({
            data: {
              schoolId,
              firstName: pFirst,
              lastName: pLast,
              phone: data.parentPhone || null,
              email: data.parentEmail || null,
            },
          })
          await db.guardianStudentLink.create({
            data: {
              guardianId: guardian.id,
              studentId: student.id,
              relationship: data.parentRelation || 'AUTRE',
              isPrimary: true,
            },
          })
        }
      } else if (importType === 'REENROLLMENTS' || importType === 'CLASS_ASSIGNMENTS') {
        const data = row.mappedData
        const student = await db.student.findFirst({
          where: { schoolId, matricule: String(data.matricule).trim() },
        })
        if (!student) {
          errors.push({ row: row.rowNumber, message: `Matricule introuvable: ${data.matricule}` })
          rejectedCount++
        } else {
          const classroom = await db.classroom.findFirst({
            where: { name: String(data.classroomName).trim() },
          })
          if (!classroom) {
            errors.push({ row: row.rowNumber, message: `Classe introuvable: ${data.classroomName}` })
            rejectedCount++
          } else {
            // Trouver l'année active
            const activeYear = await db.academicYear.findFirst({
              where: { schoolId, active: true },
            })
            if (activeYear) {
              // Désactiver les inscriptions actives précédentes
              await db.enrollment.updateMany({
                where: { studentId: student.id, status: 'ACTIVE' },
                data: { status: 'COMPLETED' },
              })
              // Créer nouvelle inscription
              await db.enrollment.create({
                data: {
                  studentId: student.id,
                  classroomId: classroom.id,
                  academicYearId: activeYear.id,
                  status: 'ACTIVE',
                },
              })
              updatedId = student.id
              updatedCount++
            }
          }
        }
      } else if (importType === 'PARENTS') {
        const data = row.mappedData
        const guardian = await db.guardian.create({
          data: {
            schoolId,
            firstName: String(data.firstName || '').trim(),
            lastName: String(data.lastName || '').trim(),
            phone: data.phone || null,
            email: data.email || null,
            profession: data.occupation || null,
            address: data.address || null,
          },
        })
        createdId = guardian.id
        createdCount++
      } else if (importType === 'PARENT_STUDENT_LINKS') {
        const data = row.mappedData
        const guardian = await db.guardian.findFirst({
          where: { schoolId, phone: String(data.parentPhone).trim() },
        })
        const student = await db.student.findFirst({
          where: { schoolId, matricule: String(data.studentMatricule).trim() },
        })
        if (!guardian || !student) {
          errors.push({ row: row.rowNumber, message: 'Parent ou élève introuvable' })
          rejectedCount++
        } else {
          await db.guardianStudentLink.create({
            data: {
              guardianId: guardian.id,
              studentId: student.id,
              relationship: data.relation || 'AUTRE',
              isPrimary: data.isPrimary === 'true' || data.isPrimary === true,
            },
          })
          createdId = `${guardian.id}|${student.id}`
          createdCount++
        }
      } else if (importType === 'ADMIN_UPDATE') {
        const data = row.mappedData
        const student = await db.student.findFirst({
          where: { schoolId, matricule: String(data.matricule).trim() },
        })
        if (!student) {
          errors.push({ row: row.rowNumber, message: `Matricule introuvable: ${data.matricule}` })
          rejectedCount++
        } else {
          await db.student.update({
            where: { id: student.id },
            data: {
              ...(data.status ? { status: String(data.status) } : {}),
            },
          })
          updatedId = student.id
          updatedCount++
        }
      }

      await db.importRow.create({
        data: {
          importJobId,
          rowNumber: row.rowNumber,
          rawData: JSON.stringify(row.rawData),
          mappedData: JSON.stringify(row.mappedData),
          status: createdId ? 'IMPORTED' : updatedId ? 'IMPORTED' : 'REJECTED',
          errors: errors.length > 0 ? JSON.stringify(errors.slice(-5)) : null,
          createdEntityId: createdId,
          updatedEntityId: updatedId,
        },
      })
    } catch (err: any) {
      errors.push({ row: row.rowNumber, message: err.message })
      rejectedCount++
    }

    processed++
    if (processed % 50 === 0) {
      const pct = Math.round((processed / total) * 100)
      await db.importJob.update({
        where: { id: importJobId },
        data: { progressPct: pct },
      })
    }
  }

  // Mettre à jour le job
  await db.importJob.update({
    where: { id: importJobId },
    data: {
      status: 'COMPLETED',
      progressPct: 100,
      completedAt: new Date(),
      createdCount,
      updatedCount,
      rejectedCount,
      errors: errors.length > 0 ? JSON.stringify(errors.slice(0, 100)) : null,
    },
  })

  // Audit
  const h = await headers()
  await logAudit({
    userId, userName, userRole, schoolId,
    action: 'IMPORT',
    entityType: 'IMPORT',
    entityId: importJobId,
    description: `Import ${importType} terminé: ${createdCount} créés, ${updatedCount} mis à jour, ${rejectedCount} rejetés`,
    ipAddress: getClientIP(h),
    metadata: { importType, createdCount, updatedCount, rejectedCount },
  })

  return { createdCount, updatedCount, rejectedCount, errors }
}

// ============================================================
// Rollback d'un import (annulation contrôlée)
// ============================================================

export async function rollbackImport(
  importJobId: string,
  schoolId: string,
  userId: string,
  userName: string,
  userRole: string,
  reason: string
): Promise<{ ok: boolean; deletedCount: number; message: string }> {
  const job = await db.importJob.findUnique({ where: { id: importJobId } })
  if (!job || job.schoolId !== schoolId) {
    return { ok: false, deletedCount: 0, message: 'Import introuvable' }
  }
  if (job.rolledBackAt) {
    return { ok: false, deletedCount: 0, message: 'Import déjà annulé' }
  }
  if (!job.isRollbackable) {
    return { ok: false, deletedCount: 0, message: 'Import non annulable' }
  }

  // Récupérer toutes les lignes importées
  const rows = await db.importRow.findMany({
    where: { importJobId, status: 'IMPORTED' },
  })

  let deletedCount = 0
  for (const row of rows) {
    if (row.createdEntityId && !row.createdEntityId.includes('|')) {
      // Suppression (en cascade pour guardianLinks, etc.)
      try {
        // Vérifier que c'est un Student ou Guardian
        const student = await db.student.findUnique({ where: { id: row.createdEntityId } })
        if (student && student.schoolId === schoolId) {
          await db.student.delete({ where: { id: row.createdEntityId } })
          deletedCount++
          continue
        }
        const guardian = await db.guardian.findUnique({ where: { id: row.createdEntityId } })
        if (guardian && guardian.schoolId === schoolId) {
          await db.guardian.delete({ where: { id: row.createdEntityId } })
          deletedCount++
          continue
        }
      } catch (err) {
        // Ignore: entité déjà supprimée
      }
    }
  }

  // Marquer le job comme annulé
  await db.importJob.update({
    where: { id: importJobId },
    data: {
      rolledBackAt: new Date(),
      rolledBackById: userId,
      rolledBackByName: userName,
      rollbackReason: reason,
    },
  })

  // Audit
  const h = await headers()
  await logAudit({
    userId, userName, userRole, schoolId,
    action: 'IMPORT_ROLLBACK',
    entityType: 'IMPORT',
    entityId: importJobId,
    description: `Rollback import ${job.importType}: ${deletedCount} entités supprimées. Raison: ${reason}`,
    ipAddress: getClientIP(h),
    metadata: { importJobId, deletedCount, reason },
  })

  return { ok: true, deletedCount, message: `${deletedCount} entités supprimées` }
}

// ============================================================
// Génération d'un rapport d'erreurs téléchargeable
// ============================================================

export async function generateImportErrorReport(
  importJobId: string,
  format: 'csv' | 'xlsx' = 'xlsx'
): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
  const job = await db.importJob.findUnique({
    where: { id: importJobId },
    include: {
      rows: {
        where: { status: { in: ['REJECTED', 'ERROR', 'DUPLICATE'] } },
        orderBy: { rowNumber: 'asc' },
      },
    },
  })
  if (!job) throw new Error('Import introuvable')

  const filename = `rapport-erreurs-${job.importReference}.${format}`

  if (format === 'csv') {
    const header = 'Ligne,Statut,Erreurs,Données'
    const body = job.rows.map((r) => {
      const errors = (r.errors ? JSON.parse(r.errors) : []).map((e: any) => `${e.field}: ${e.message}`).join('; ')
      const data = JSON.stringify(JSON.parse(r.rawData))
      return `${r.rowNumber},${r.status},"${errors.replace(/"/g, '""')}","${data.replace(/"/g, '""')}"`
    }).join('\n')
    return {
      buffer: Buffer.from('\uFEFF' + header + '\n' + body, 'utf-8'),
      mimeType: 'text/csv; charset=utf-8',
      filename,
    }
  }

  // XLSX
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Erreurs', { properties: { tabColor: { argb: 'FFDC2626' } } })
  sheet.columns = [
    { header: 'Ligne', key: 'row', width: 8 },
    { header: 'Statut', key: 'status', width: 15 },
    { header: 'Erreurs', key: 'errors', width: 80 },
    { header: 'Données brutes', key: 'data', width: 60 },
  ]
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } }

  for (const r of job.rows) {
    const errors = (r.errors ? JSON.parse(r.errors) : []).map((e: any) => `${e.field}: ${e.message}`).join('; ')
    sheet.addRow({
      row: r.rowNumber,
      status: r.status,
      errors,
      data: JSON.stringify(JSON.parse(r.rawData), null, 2),
    })
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return { buffer: Buffer.from(buffer), mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename }
}
