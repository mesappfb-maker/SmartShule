// SmartShule — Détection automatique du provider Prisma
// ============================================================
// Avant chaque build, ce script :
//   1. Lit DATABASE_URL
//   2. Si PostgreSQL → passe le provider en "postgresql"
//   3. Si SQLite (file:) → passe le provider en "sqlite"
//   4. Régénère le client Prisma
//
// Permet d'utiliser le MÊME schéma Prisma pour :
//   - Dev local (SQLite)
//   - Prod Vercel/Render/Railway (PostgreSQL Supabase)

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma')
const dbUrl = process.env.DATABASE_URL || ''

let targetProvider
if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
  targetProvider = 'postgresql'
} else if (dbUrl.startsWith('file:')) {
  targetProvider = 'sqlite'
} else {
  console.log('⚠️  DATABASE_URL non reconnue, keeping current provider')
  process.exit(0)
}

let schema = fs.readFileSync(schemaPath, 'utf8')
const currentMatch = schema.match(/provider\s*=\s*"(\w+)"/)

if (!currentMatch) {
  console.error('❌ Impossible de trouver "provider" dans le schéma Prisma')
  process.exit(1)
}

const currentProvider = currentMatch[1]

if (currentProvider === targetProvider) {
  console.log(`✅ Provider déjà sur "${targetProvider}" — aucune modification`)
  process.exit(0)
}

console.log(`🔄 Bascule du provider : "${currentProvider}" → "${targetProvider}"`)
schema = schema.replace(
  /provider\s*=\s*"(\w+)"/,
  `provider = "${targetProvider}"`
)
fs.writeFileSync(schemaPath, schema)
console.log(`✅ Schéma Prisma mis à jour vers "${targetProvider}"`)

// Régénérer le client Prisma
try {
  execSync('npx prisma generate', { stdio: 'inherit' })
  console.log('✅ Client Prisma régénéré')
} catch (err) {
  console.error('❌ Erreur lors de prisma generate:', err.message)
  process.exit(1)
}
