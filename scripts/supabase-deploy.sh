#!/bin/bash
# ============================================================
# SmartShule — Script de déploiement schéma Supabase
# ============================================================
# Applique le schéma PostgreSQL complet sur Supabase
# + les extensions (Portail Prof IQA)
#
# Usage :
#   SUPABASE_DB_URL="postgresql://postgres.REF:PASS@aws-REGION.pooler.supabase.com:5432/postgres" \
#     bash scripts/supabase-deploy.sh
#
# Alternative (depuis le Dashboard Supabase) :
#   1. Aller dans SQL Editor
#   2. Copier/coller le contenu des 2 fichiers SQL ci-dessous
#   3. Exécuter
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA_CORE="$SCRIPT_DIR/supabase-schema.sql"
SCHEMA_PROF="$SCRIPT_DIR/supabase-schema-portail-prof.sql"

if [ -z "$SUPABASE_DB_URL" ]; then
  echo "❌ Variable d'environnement SUPABASE_DB_URL manquante"
  echo ""
  echo "   Usage :"
  echo "     SUPABASE_DB_URL=\"postgresql://postgres.REF:PASS@aws-REGION.pooler.supabase.com:5432/postgres\" \\"
  echo "       bash $0"
  echo ""
  echo "   Alternative : appliquez manuellement les fichiers SQL depuis le Dashboard Supabase → SQL Editor :"
  echo "     - $SCHEMA_CORE"
  echo "     - $SCHEMA_PROF"
  exit 1
fi

# Vérifier que psql est installé
if ! command -v psql &> /dev/null; then
  echo "❌ psql n'est pas installé. Installez-le :"
  echo "   Ubuntu/Debian : sudo apt install postgresql-client"
  echo "   macOS : brew install postgresql"
  exit 1
fi

echo "🚀 Déploiement du schéma SmartShule sur Supabase..."
echo "   URL : ${SUPABASE_DB_URL%%@*}@***"
echo ""

# 1. Schéma core (modèles existants)
echo "━━━ 1/2 : Schéma core ━━━"
if psql "$SUPABASE_DB_URL" -f "$SCHEMA_CORE"; then
  echo "✅ Schéma core appliqué avec succès"
else
  echo "❌ Échec du schéma core"
  exit 1
fi

echo ""

# 2. Extension Portail Prof (IQA, émargements, incidents)
echo "━━━ 2/2 : Extension Portail Prof ━━━"
if psql "$SUPABASE_DB_URL" -f "$SCHEMA_PROF"; then
  echo "✅ Extension Portail Prof appliquée avec succès"
else
  echo "❌ Échec de l'extension Portail Prof"
  exit 1
fi

echo ""
echo "🎉 Déploiement terminé !"
echo ""
echo "Prochaines étapes :"
echo "  1. Vérifiez les tables dans Supabase Dashboard → Table Editor"
echo "  2. Vérifiez les RLS policies dans Database → Policies"
echo "  3. Vérifiez les triggers dans Database → Triggers"
echo "  4. Configurez les variables d'env dans Railway/Vercel/Render"
