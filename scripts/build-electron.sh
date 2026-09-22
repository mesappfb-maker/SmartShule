#!/bin/bash
# SmartShule — Build script pour GitHub Actions (Electron)
# ============================================================
# Prérequis : npm install --include=dev déjà fait par le workflow
# Ce script fait uniquement :
#   1. mkdir db
#   2. next build
#   3. copy standalone + static + public

set -e

echo "🔧 1. Préparation du dossier db..."
mkdir -p db

echo "🏗️ 2. Build Next.js (standalone)..."
npx next build 2>&1 | tail -30

echo "📋 3. Copie des fichiers standalone..."
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/ 2>/dev/null || echo "⚠️ .next/static non trouvé"
cp -r public .next/standalone/ 2>/dev/null || echo "⚠️ public non trouvé"

echo "✅ Build terminé !"
ls -la .next/standalone/ 2>&1 | head -10
