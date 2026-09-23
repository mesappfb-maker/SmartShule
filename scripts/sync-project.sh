#!/bin/bash
# SmartShule — Script de synchronisation bidirectionnelle
# ============================================================
# Utilitaire pour synchroniser le travail local (VS Code) avec les
# modifications de l'agent IA sur GitHub, sans écraser les modifications.
#
# Usage :
#   ./scripts/sync-project.sh              # synchronisation standard
#   ./scripts/sync-project.sh --stash      # stash avant pull, pop après
#   ./scripts/sync-project.sh --hard       # reset hard vers origin/main (ATTENTION)
#
# Prérequis :
#   - Git installé
#   - Configuration utilisateur (git config user.name, user.email)
#   - Accès SSH ou HTTPS au dépôt GitHub

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

MODE="${1:-standard}"

echo -e "${BLUE}🔄 SmartShule — Synchronisation Git bidirectionnelle${NC}"
echo -e "${BLUE}Mode : ${MODE}${NC}"
echo ""

# ============================================================
# 1. Vérifier qu'on est bien dans un dépôt Git
# ============================================================
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo -e "${RED}❌ Ce répertoire n'est pas un dépôt Git.${NC}"
  echo -e "   Initialisez-le avec : git init && git remote add origin <url>"
  exit 1
fi

# ============================================================
# 2. Vérifier la branche courante
# ============================================================
CURRENT_BRANCH=$(git branch --show-current)
echo -e "${YELLOW}📍 Branche courante : ${CURRENT_BRANCH}${NC}"

if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "dev-agent" ]; then
  echo -e "${YELLOW}⚠️  Vous n'êtes pas sur main ou dev-agent. Continuer ? [y/N]${NC}"
  read -r response
  if [ "$response" != "y" ] && [ "$response" != "Y" ]; then
    echo -e "${RED}Abandon.${NC}"
    exit 0
  fi
fi

# ============================================================
# 3. Sauvegarder le travail local (stash ou commit WIP)
# ============================================================
if [ "$MODE" = "--stash" ]; then
  echo -e "${BLUE}📥 Stash des modifications locales...${NC}"
  if [ -n "$(git status --porcelain)" ]; then
    git stash push -u -m "WIP: sync $(date +%Y-%m-%d_%H-%M-%S)"
    STASHED=1
  else
    echo -e "${GREEN}✓ Aucune modification locale à stasher.${NC}"
    STASHED=0
  fi
else
  echo -e "${BLUE}💾 Commit WIP des modifications locales...${NC}"
  if [ -n "$(git status --porcelain)" ]; then
    git add .
    git commit -m "WIP: sync $(date '+%Y-%m-%d %H:%M:%S')" --no-verify || true
    COMMITED=1
  else
    echo -e "${GREEN}✓ Aucune modification locale à committer.${NC}"
    COMMITED=0
  fi
fi

# ============================================================
# 4. Récupérer les dernières modifications depuis GitHub
# ============================================================
echo ""
echo -e "${BLUE}📥 Fetch depuis origin...${NC}"
git fetch origin --tags

# ============================================================
# 5. Fusion (rebase pour historique propre, ou merge)
# ============================================================
echo ""
echo -e "${BLUE}🔀 Rebase des modifications locales sur origin/${CURRENT_BRANCH}...${NC}"

if [ "$MODE" = "--hard" ]; then
  echo -e "${RED}⚠️  MODE HARD : reset vers origin/main. Toutes les modifications locales seront perdues.${NC}"
  echo -e "${RED}   Continuer ? [y/N]${NC}"
  read -r response
  if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
    git reset --hard origin/main
    echo -e "${GREEN}✓ Reset hard effectué.${NC}"
  else
    echo -e "${YELLOW}Abandon du reset hard.${NC}"
  fi
else
  # Rebase pour historique linéaire
  if ! git pull origin "$CURRENT_BRANCH" --rebase; then
    echo ""
    echo -e "${RED}⚠️  Conflit détecté lors du rebase !${NC}"
    echo -e "${YELLOW}   Résolvez les conflits dans VS Code, puis :${NC}"
    echo -e "${YELLOW}   1. git add <fichiers résolus>${NC}"
    echo -e "${YELLOW}   2. git rebase --continue${NC}"
    echo -e "${YELLOW}   3. Relancez ./scripts/sync-project.sh${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ Rebase réussi.${NC}"
fi

# ============================================================
# 6. Restaurer le travail local (si stashé)
# ============================================================
if [ "$MODE" = "--stash" ] && [ "$STASHED" = "1" ]; then
  echo ""
  echo -e "${BLUE}📤 Pop du stash...${NC}"
  if ! git stash pop; then
    echo -e "${YELLOW}⚠️  Conflit lors du pop du stash. Résolvez-le manuellement.${NC}"
    echo -e "${YELLOW}   Le stash est conservé : git stash list${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ Stash restauré.${NC}"
fi

# ============================================================
# 7. Pousser vers GitHub
# ============================================================
echo ""
echo -e "${BLUE}📤 Push vers origin/${CURRENT_BRANCH}...${NC}"
if [ "$COMMITED" = "1" ] || [ "$MODE" = "--hard" ]; then
  if git push origin "$CURRENT_BRANCH"; then
    echo -e "${GREEN}✓ Push réussi.${NC}"
  else
    echo -e "${RED}❌ Push échoué. Vérifiez vos droits sur le dépôt.${NC}"
    exit 1
  fi
else
  echo -e "${GREEN}✓ Aucune modification à pousser (branche à jour).${NC}"
fi

# ============================================================
# 8. Résumé final
# ============================================================
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Synchronisation SmartShule réussie !${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Statut Git :${NC}"
git status -s | head -10
if [ -z "$(git status --porcelain)" ]; then
  echo -e "${GREEN}  (propre)${NC}"
fi
echo ""
echo -e "${BLUE}Derniers commits :${NC}"
git log --oneline -5
echo ""
echo -e "${YELLOW}💡 Astuce : pour générer une release .exe, créez un tag :${NC}"
echo -e "${YELLOW}   git tag v1.0.0 && git push origin v1.0.0${NC}"
