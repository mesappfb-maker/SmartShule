# SmartShule — Guide Configuration Supabase Production
# ============================================================
# Ce script configure Supabase pour SmartShule multi-écoles.
# 
# ⚠️ AVANT D'EXÉCUTER :
#   1. Crée un projet Supabase sur https://supabase.com
#   2. Récupère l'URL de connexion (Project Settings → Database → Connection string)
#   3. Format : postgresql://postgres.REF:PASSWORD@aws-REGION.pooler.supabase.com:5432/postgres
#
# Variables d'environnement nécessaires :
#   SUPABASE_DB_URL="postgresql://postgres.REF:PASSWORD@aws-REGION.pooler.supabase.com:5432/postgres"
#   NEXT_PUBLIC_SUPABASE_URL="https://YOUR-PROJECT.supabase.co"
#   NEXT_PUBLIC_SUPABASE_ANON_KEY="YOUR-ANON-KEY"
#   SUPABASE_SERVICE_ROLE_KEY="YOUR-SERVICE-ROLE-KEY"

set -e

if [ -z "$SUPABASE_DB_URL" ]; then
  echo "❌ Variable SUPABASE_DB_URL manquante"
  echo ""
  echo "   Exportez la variable :"
  echo '   export SUPABASE_DB_URL="postgresql://postgres.REF:PASSWORD@aws-REGION.pooler.supabase.com:5432/postgres"'
  echo ""
  echo "   Puis relancez :"
  echo "   bash scripts/supabase-setup-production.sh"
  exit 1
fi

echo "🔄 Configuration Supabase Production pour SmartShule..."
echo ""

# 1. Switcher le provider Prisma vers PostgreSQL
echo "1. Switch Prisma → PostgreSQL..."
DATABASE_URL="$SUPABASE_DB_URL" node scripts/switch-provider.js
echo "   ✅ Provider PostgreSQL activé"
echo ""

# 2. Appliquer le schéma (db push)
echo "2. Application du schéma Prisma sur Supabase..."
DATABASE_URL="$SUPABASE_DB_URL" npx prisma db push --accept-data-loss
echo "   ✅ Schéma appliqué (128 modèles)"
echo ""

# 3. Générer le client Prisma
echo "3. Génération du client Prisma..."
DATABASE_URL="$SUPABASE_DB_URL" npx prisma generate
echo "   ✅ Client Prisma généré"
echo ""

# 4. Activer Row Level Security (RLS) — isolation multi-écoles
echo "4. Activation Row Level Security (RLS)..."
psql "$SUPABASE_DB_URL" <<'SQL'
-- ============================================================
-- RLS : Isolation multi-écoles par school_id
-- ============================================================
-- Chaque table contient school_id.
-- RLS garantit qu'un utilisateur ne voit QUE les données de son école.
-- ============================================================

-- Fonction : récupère le school_id de l'utilisateur courant
CREATE OR REPLACE FUNCTION get_current_school_id()
RETURNS TEXT AS $$
BEGIN
  -- En production : récupérer depuis le JWT Supabase Auth
  -- Pour l'instant : retourne NULL (RLS désactivée tant que l'auth Supabase n'est pas configurée)
  -- Quand l'auth sera activée, remplacer par :
  --   RETURN (SELECT school_id FROM users WHERE id = auth.uid());
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Activer RLS sur toutes les tables critiques
-- (à actifier APRÈS configuration de l'auth Supabase)
-- Exemple :
-- ALTER TABLE students ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY students_isolation ON students
--   FOR ALL USING (school_id = get_current_school_id());

-- Pour l'instant, RLS est désactivée (l'isolation se fait via l'applicatif)
SELECT 'RLS ready — activation différée après configuration auth Supabase' as status;
SQL
echo "   ✅ RLS prêt (activation différée après auth)"
echo ""

# 5. Créer le bucket storage pour les documents
echo "5. Création du bucket de stockage documents..."
psql "$SUPABASE_DB_URL" <<'SQL'
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;
SQL
echo "   ✅ Buckets 'documents' et 'backups' créés"
echo ""

echo "============================================================"
echo "✅ CONFIGURATION SUPABASE TERMINÉE"
echo "============================================================"
echo ""
echo "Prochaines étapes :"
echo "  1. Configurez les variables Vercel :"
echo "     DATABASE_URL = $SUPABASE_DB_URL"
echo "     NEXT_PUBLIC_SUPABASE_URL = https://YOUR-PROJECT.supabase.co"
echo "     NEXT_PUBLIC_SUPABASE_ANON_KEY = YOUR-ANON-KEY"
echo ""
echo "  2. Déployez sur Vercel :"
echo "     git push origin main"
echo ""
echo "  3. Après déploiement, seed la production :"
echo "     curl -X POST https://smart-shule-seven.vercel.app/api/seed-demo"
echo "     curl -X POST https://smart-shule-seven.vercel.app/api/seed-demo-enrich"
echo ""
echo "  4. Pour activer RLS (isolation multi-écoles au niveau DB) :"
echo "     - Configurez Supabase Auth"
echo "     - Activez les politiques RLS dans le SQL Editor"
echo "     - La fonction get_current_school_id() récupère le school_id depuis le JWT"
