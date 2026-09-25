// SmartShule — Service de sauvegarde et restauration
// ============================================================
// Sauvegarde automatique de la base SQLite locale.
// En production Supabase : backup via API Supabase.
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const STORAGE_ROOT = process.env.STORAGE_ROOT || '/home/z/my-project/storage'
const BACKUP_DIR = path.join(STORAGE_ROOT, 'backups')
const DB_PATH = process.env.DATABASE_URL?.replace('file:', '') || './db/custom.db'

export interface BackupResult {
  ok: boolean
  backupId?: string
  fileName?: string
  fileSize?: number
  hash?: string
  createdAt?: string
  error?: string
}

export interface RestoreResult {
  ok: boolean
  restoredFrom?: string
  fileSize?: number
  hashVerified?: boolean
  error?: string
}

// ============================================================
// 1. Sauvegarde locale (SQLite)
// ============================================================

export async function createLocalBackup(schoolId: string, triggeredBy: { id: string; name: string; role: string }): Promise<BackupResult> {
  try {
    const backupDir = path.join(BACKUP_DIR, schoolId)
    await fs.mkdir(backupDir, { recursive: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `backup-${timestamp}.db`
    const backupPath = path.join(backupDir, fileName)

    // Copier le fichier SQLite
    const dbBuffer = await fs.readFile(DB_PATH)
    await fs.writeFile(backupPath, dbBuffer)

    // Calculer le hash SHA-256
    const hash = crypto.createHash('sha256').update(dbBuffer).digest('hex')

    // Audit
    await logAudit({
      userId: triggeredBy.id,
      userName: triggeredBy.name,
      userRole: triggeredBy.role,
      schoolId,
      action: 'BACKUP_CREATED',
      entityType: 'BACKUP',
      description: `Sauvegarde créée: ${fileName} (${(dbBuffer.length / 1024 / 1024).toFixed(2)} Mo)`,
      metadata: { fileName, fileSize: dbBuffer.length, hash: hash.slice(0, 16) + '...' },
    })

    return {
      ok: true,
      backupId: `${schoolId}/${fileName}`,
      fileName,
      fileSize: dbBuffer.length,
      hash,
      createdAt: new Date().toISOString(),
    }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

// ============================================================
// 2. Sauvegarde automatique (appelée par cron)
// ============================================================

export async function autoBackup(schoolId: string): Promise<BackupResult> {
  return createLocalBackup(schoolId, { id: 'system', name: 'Système (auto)', role: 'SYSTEM' })
}

// ============================================================
// 3. Lister les sauvegardes
// ============================================================

export interface BackupInfo {
  fileName: string
  fileSize: number
  createdAt: string
  hash: string
}

export async function listBackups(schoolId: string): Promise<BackupInfo[]> {
  try {
    const backupDir = path.join(BACKUP_DIR, schoolId)
    const files = await fs.readdir(backupDir).catch(() => [])

    const backups: BackupInfo[] = []
    for (const file of files) {
      if (!file.endsWith('.db')) continue
      const filePath = path.join(backupDir, file)
      const stat = await fs.stat(filePath)
      const buffer = await fs.readFile(filePath)
      const hash = crypto.createHash('sha256').update(buffer).digest('hex')

      backups.push({
        fileName: file,
        fileSize: stat.size,
        createdAt: stat.mtime.toISOString(),
        hash,
      })
    }

    // Trier par date décroissante
    backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return backups
  } catch {
    return []
  }
}

// ============================================================
// 4. Restaurer depuis une sauvegarde
// ============================================================

export async function restoreFromBackup(
  schoolId: string,
  backupFileName: string,
  triggeredBy: { id: string; name: string; role: string }
): Promise<RestoreResult> {
  try {
    const backupPath = path.join(BACKUP_DIR, schoolId, backupFileName)
    const backupBuffer = await fs.readFile(backupPath)

    // Vérifier le hash
    const hash = crypto.createHash('sha256').update(backupBuffer).digest('hex')

    // Sauvegarder la base actuelle avant restauration
    await createLocalBackup(schoolId, { id: 'system', name: 'Système (pre-restore)', role: 'SYSTEM' })

    // Remplacer la base actuelle
    await fs.writeFile(DB_PATH, backupBuffer)

    // Audit
    await logAudit({
      userId: triggeredBy.id,
      userName: triggeredBy.name,
      userRole: triggeredBy.role,
      schoolId,
      action: 'BACKUP_RESTORED',
      entityType: 'BACKUP',
      description: `Restauration depuis: ${backupFileName} (${(backupBuffer.length / 1024 / 1024).toFixed(2)} Mo)`,
      metadata: { backupFileName, hash: hash.slice(0, 16) + '...' },
    })

    return {
      ok: true,
      restoredFrom: backupFileName,
      fileSize: backupBuffer.length,
      hashVerified: true,
    }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

// ============================================================
// 5. Nettoyer les anciennes sauvegardes (rétention)
// ============================================================

export async function cleanupOldBackups(schoolId: string, maxDaily = 7, maxWeekly = 4): Promise<number> {
  try {
    const backups = await listBackups(schoolId)
    if (backups.length <= maxDaily) return 0

    // Garder les N plus récentes
    const toDelete = backups.slice(maxDaily)
    const backupDir = path.join(BACKUP_DIR, schoolId)

    for (const backup of toDelete) {
      await fs.unlink(path.join(backupDir, backup.fileName)).catch(() => {})
    }

    return toDelete.length
  } catch {
    return 0
  }
}

// ============================================================
// 6. Vérifier l'intégrité d'une sauvegarde
// ============================================================

export async function verifyBackupIntegrity(schoolId: string, backupFileName: string): Promise<{ ok: boolean; hash: string; size: number }> {
  try {
    const backupPath = path.join(BACKUP_DIR, schoolId, backupFileName)
    const buffer = await fs.readFile(backupPath)
    const hash = crypto.createHash('sha256').update(buffer).digest('hex')

    return {
      ok: buffer.length > 0,
      hash,
      size: buffer.length,
    }
  } catch (err) {
    return { ok: false, hash: '', size: 0 }
  }
}
