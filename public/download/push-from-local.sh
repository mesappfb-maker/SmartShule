#!/bin/bash
# SmartShule — Push depuis votre machine locale
# ============================================================
# À exécuter sur VOTRE ordinateur (pas dans le sandbox).
#
# Prérequis :
#   1. Git installé : https://git-scm.com/
#   2. Un Personal Access Token GitHub (PAT) avec scope "repo"
#      → https://github.com/settings/tokens → Generate new token
#      → Expiration : 7 jours (vous le révoquerez après)
#      → Cochez : repo (Full control of private repositories)
#   3. Le fichier smartshule-full.bundle téléchargé depuis le sandbox

set -e

REPO_URL="https://github.com/mesappfb-maker/SmartShule.git"
BUNDLE_FILE="smartshule-full.bundle"
WORK_DIR="smartshule-push"

echo "📤 SmartShule — Push vers GitHub"
echo "================================"
echo ""

# 1. Vérifier que le bundle existe
if [ ! -f "$BUNDLE_FILE" ]; then
    echo "❌ Fichier $BUNDLE_FILE introuvable."
    echo "   Téléchargez-le depuis le sandbox : /home/z/my-project/download/smartshule-full.bundle"
    exit 1
fi

# 2. Cloner depuis le bundle
echo "📥 Clonage depuis le bundle..."
rm -rf "$WORK_DIR"
git clone "$BUNDLE_FILE" "$WORK_DIR"
cd "$WORK_DIR"

# 3. Configurer le remote
echo "🔧 Configuration du remote..."
git remote remove origin 2>/dev/null || true
git remote add origin "$REPO_URL"

# 4. Vérifier le contenu
echo ""
echo "📊 Contenu du dépôt :"
echo "   Commits : $(git rev-list --count HEAD)"
echo "   Fichiers : $(git ls-files | wc -l)"
echo "   Dernier commit : $(git log --oneline -1)"
echo ""

# 5. Pousser vers GitHub
echo "🚀 Push vers GitHub..."
echo "   URL : $REPO_URL"
echo ""
echo "   ⚠️  Quand Git demande votre mot de passe, collez votre PAT."
echo "   (Le token ne s'affiche pas pendant la saisie — c'est normal)"
echo ""

git push -u origin main

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✅ PUSH RÉUSSI !"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "📍 Votre dépôt : https://github.com/mesappfb-maker/SmartShule"
echo ""
echo "🔒 ÉTAPES SUIVANTES :"
echo ""
echo "1. RÉVOQUEZ VOTRE TOKEN maintenant :"
echo "   → https://github.com/settings/tokens"
echo "   → Trouvez le token → Delete"
echo ""
echo "2. Configurez les secrets GitHub Actions :"
echo "   → https://github.com/mesappfb-maker/SmartShule/settings/secrets/actions"
echo "   → Ajoutez :"
echo "     - CUSTOM_GITHUB_TOKEN (nouveau PAT avec scope repo)"
echo "     - NEXTAUTH_SECRET (générer : openssl rand -base64 32)"
echo ""
echo "3. Vérifiez le workflow :"
echo "   → https://github.com/mesappfb-maker/SmartShule/actions"
echo "   → Le workflow 'Build & Deploy SmartShule' se lance automatiquement"
echo "   → ~20 min plus tard → Artifacts → SmartShule-Setup-*.exe"
echo ""
echo "4. Pour une release publique (téléchargeable par tous) :"
echo "   git tag v1.0.0"
echo "   git push origin v1.0.0"
echo ""
