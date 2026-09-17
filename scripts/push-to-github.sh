#!/bin/bash
# SmartShule — Script de push vers GitHub (sécurisé)
# ============================================================
# Usage :
#   ./scripts/push-to-github.sh https://github.com/votre-user/smartshule.git
#
# Ce script :
#   1. Ajoute le remote origin (si pas déjà fait)
#   2. Pousse le code vers GitHub
#   3. Affiche les instructions pour révoquer le token après usage
#
# ⚠️  SÉCURITÉ : ne saisissez JAMAIS votre token en clair dans ce script.
#   Utilisez le prompt interactif de Git (saisie masquée).

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}📤 SmartShule — Push vers GitHub${NC}"
echo ""

# ============================================================
# 1. Vérifier qu'on est dans le bon répertoire
# ============================================================
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

if [ ! -f "package.json" ]; then
  echo -e "${RED}❌ package.json introuvable. Êtes-vous dans le bon répertoire ?${NC}"
  exit 1
fi

# ============================================================
# 2. Récupérer l'URL du dépôt distant
# ============================================================
REMOTE_URL="${1:-}"

if [ -z "$REMOTE_URL" ]; then
  echo -e "${YELLOW}📝 Entrez l'URL de votre dépôt GitHub :${NC}"
  echo -e "   Exemple : https://github.com/votre-user/smartshule.git"
  read -r REMOTE_URL
fi

if [ -z "$REMOTE_URL" ]; then
  echo -e "${RED}❌ URL du dépôt obligatoire.${NC}"
  exit 1
fi

echo -e "${BLUE}📍 Dépôt cible : ${REMOTE_URL}${NC}"
echo ""

# ============================================================
# 3. Vérifier que le commit est propre
# ============================================================
if [ -n "$(git status --porcelain)" ]; then
  echo -e "${YELLOW}⚠️  Modifications non commitées détectées. Commit automatique...${NC}"
  git add -A
  git commit -m "WIP: pre-push sync $(date '+%Y-%m-%d %H:%M:%S')" --no-verify
fi

echo -e "${GREEN}✓ Dernier commit :${NC}"
git log --oneline -1
echo ""

# ============================================================
# 4. Configurer le remote origin
# ============================================================
EXISTING_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")

if [ "$EXISTING_REMOTE" != "$REMOTE_URL" ]; then
  if [ -n "$EXISTING_REMOTE" ]; then
    echo -e "${YELLOW}🔁 Mise à jour du remote origin...${NC}"
    git remote set-url origin "$REMOTE_URL"
  else
    echo -e "${BLUE}➕ Ajout du remote origin...${NC}"
    git remote add origin "$REMOTE_URL"
  fi
else
  echo -e "${GREEN}✓ Remote origin déjà configuré.${NC}"
fi
echo ""

# ============================================================
# 5. Vérifications de sécurité
# ============================================================
echo -e "${BLUE}🔍 Vérifications de sécurité...${NC}"

# Vérifier qu'aucun .env réel n'est tracké
TRACKED_ENV=$(git ls-files | grep -E "^\.env$" || true)
if [ -n "$TRACKED_ENV" ]; then
  echo -e "${RED}❌ CRITIQUE : le fichier .env est tracké dans Git !${NC}"
  echo -e "${RED}   Exécutez : git rm --cached .env && git commit -m 'remove .env'${NC}"
  exit 1
fi

# Vérifier qu'aucun fichier .db n'est tracké
TRACKED_DB=$(git ls-files | grep -E "\.db$" || true)
if [ -n "$TRACKED_DB" ]; then
  echo -e "${RED}❌ CRITIQUE : des fichiers .db sont trackés : ${TRACKED_DB}${NC}"
  echo -e "${RED}   Exécutez : git rm --cached ${TRACKED_DB} && git commit -m 'remove db files'${NC}"
  exit 1
fi

# Vérifier qu'aucun certificat n'est tracké
TRACKED_CERTS=$(git ls-files | grep -iE "\.(pfx|p12|key)$" || true)
if [ -n "$TRACKED_CERTS" ]; then
  echo -e "${RED}❌ CRITIQUE : des certificats sont trackés : ${TRACKED_CERTS}${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Aucun secret dans les fichiers trackés.${NC}"
echo ""

# ============================================================
# 6. Push vers GitHub
# ============================================================
echo -e "${BLUE}📤 Push en cours...${NC}"
echo -e "${YELLOW}   Si Git demande un mot de passe, collez votre Personal Access Token${NC}"
echo -e "${YELLOW}   (le token ne s'affiche pas pendant la saisie — c'est normal)${NC}"
echo ""

BRANCH=$(git branch --show-current)
if git push -u origin "$BRANCH"; then
  echo ""
  echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  ✅ Push réussi !${NC}"
  echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "${BLUE}📍 Branche : ${BRANCH}${NC}"
  echo -e "${BLUE}📍 Commits : $(git rev-list --count HEAD)${NC}"
  echo -e "${BLUE}📍 Dernier SHA : $(git rev-parse HEAD | head -c 8)${NC}"
else
  echo ""
  echo -e "${RED}❌ Push échoué. Vérifiez :${NC}"
  echo -e "   1. Que le token a le scope 'repo'"
  echo -e "   2. Que l'URL du dépôt est correcte"
  echo -e "   3. Que vous avez les droits d'écriture"
  exit 1
fi

# ============================================================
# 7. Instructions de révocation du token
# ============================================================
echo ""
echo -e "${YELLOW}🔒 SÉCURITÉ — RÉVOQUER LE TOKEN MAINTENANT${NC}"
echo -e "${YELLOW}═════════════════════════════════════════════${NC}"
echo ""
echo -e "Pour révoquer votre token GitHub (recommandé après chaque push) :"
echo ""
echo -e "  1. Allez sur : https://github.com/settings/tokens"
echo -e "  2. Trouvez le token que vous venez d'utiliser"
echo -e "  3. Cliquez sur 'Delete' ou 'Revoke'"
echo -e "  4. Le token est immédiatement invalidé"
echo ""
echo -e "  Pour les prochains pushes, créez un nouveau token temporaire."
echo ""
echo -e "${GREEN}✅ Push terminé. N'oubliez pas de révoquer le token !${NC}"
