#!/bin/bash
# SmartShule — Build script pour GitHub Actions (Electron)
# ============================================================
# Ce script est exécuté par le workflow release.yml
# Il fait uniquement ce qui est nécessaire pour le build Electron :
#   1. Installer les dépendances
#   2. Switch le provider Prisma vers SQLite
#   3. Générer le client Prisma
#   4. Build Next.js (standalone)
#   5. Copier les fichiers standalone + public

set -e

echo "📦 1. Installation des dépendances..."
npm install --include=dev 2>&1 | tail -5

echo "🔧 2. Switch provider vers SQLite..."
mkdir -p db
DATABASE_URL="file:./db/prod.db" node scripts/switch-provider.js

echo "🔍 3. Génération du client Prisma..."
DATABASE_URL="file:./db/prod.db" npx prisma generate

echo "🏗️ 4. Build Next.js (standalone)..."
mkdir -p db
DATABASE_URL="file:./db/prod.db" \
NEXTAUTH_SECRET="desktop-build-secret" \
NEXTAUTH_URL="http://localhost:3000" \
NODE_ENV=production \
npx next build 2>&1 | tail -20

echo "📋 5. Copie des fichiers standalone..."
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/ 2>/dev/null || echo "⚠️ .next/static non trouvé (peut être vide)"
cp -r public .next/standalone/ 2>/dev/null || echo "⚠️ public non trouvé"

echo "✅ Build terminé !"
ls -la .next/standalone/ 2>&1 | head -10
