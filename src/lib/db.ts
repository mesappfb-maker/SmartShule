import { PrismaClient } from '@prisma/client'
import path from 'path'
import fs from 'fs'

// SmartShule — Singleton Prisma optimisé pour Vercel + Supabase
// ============================================================
// Problème : Vercel crée plusieurs instances du serveur (serverless)
// et chaque instance crée sa propre PrismaClient. Avec Supabase
// (pool_size: 15), on atteint vite la limite EMAXCONNSESSION.
//
// Solution :
//   1. Singleton global (une seule instance Prisma par processus)
//   2. Connection limit réduit à 3 (au lieu de 15 par défaut)
//   3. En production, on garde le singleton même en serverless

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// S'assurer que le répertoire SQLite existe (dev local)
if (typeof window === 'undefined') {
  try {
    const dbUrl = process.env.DATABASE_URL || 'file:./db/custom.db'
    if (dbUrl.startsWith('file:')) {
      const dbDir = path.dirname(dbUrl.replace('file:', ''))
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true })
      }
    }
  } catch (e) {
    // Ignore côté client
  }
}

// Configuration de la connexion
const prismaOptions: ConstructorParameters<typeof PrismaClient>[0] = {
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
}

// Ajouter un connection_limit à l'URL si PostgreSQL (Supabase)
// Limite à 3 connexions par instance serverless (au lieu de 15 par défaut)
if (process.env.DATABASE_URL?.startsWith('postgresql://')) {
  prismaOptions.datasources = {
    db: {
      url: process.env.DATABASE_URL + (process.env.DATABASE_URL.includes('?') ? '&' : '?') + 'connection_limit=3&pool_timeout=10',
    },
  }
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient(prismaOptions)

// Toujours garder le singleton, même en production
// (Vercel serverless réutilise les instances chaudes)
globalForPrisma.prisma = db
