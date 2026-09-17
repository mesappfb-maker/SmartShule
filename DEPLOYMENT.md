# SmartShule — Guide de Déploiement & CI/CD

> Documentation complète pour déployer SmartShule sur Cloudflare + Render, générer l'exécutable Windows via GitHub Actions, et synchroniser le travail local avec l'agent IA.

---

## 📋 Sommaire

1. [Vue d'ensemble de l'infrastructure](#1-vue-densemble-de-linfrastructure)
2. [Déploiement Frontend sur Cloudflare Pages](#2-déploiement-frontend-sur-cloudflare-pages)
3. [Déploiement Backend sur Render](#3-déploiement-backend-sur-render)
4. [Compilation .exe Windows via GitHub Actions](#4-compilation-exe-windows-via-github-actions)
5. [Mises à jour automatiques (electron-updater)](#5-mises-à-jour-automatiques-electron-updater)
6. [Workflow Git bidirectionnel (VS Code ⟷ Agent IA)](#6-workflow-git-bidirectionnel-vs-code--agent-ia)
7. [Secrets GitHub à configurer](#7-secrets-github-à-configurer)
8. [Dépannage & FAQ](#8-dépannage--faq)

---

## 1. Vue d'ensemble de l'infrastructure

```text
┌─────────────────────────────────────────────────────────────┐
│                     GitHub Repository                       │
│  (Code source + GitHub Actions workflows)                   │
└──────┬──────────────────────────────────┬───────────────────┘
       │                                  │
       │ push to main                     │ tag v1.0.0
       ▼                                  ▼
┌─────────────────┐         ┌─────────────────────────────┐
│  Cloudflare     │         │  GitHub Actions             │
│  Pages          │         │  (.github/workflows/)       │
│  (Frontend)     │         │                             │
│  → Portail web  │         │  build-web → build-electron │
└─────────────────┘         └─────────┬───────────────────┘
                                      │
       ┌──────────────────────────────┘
       │
       ▼
┌─────────────────┐         ┌─────────────────────────────┐
│  Render.com     │         │  GitHub Releases             │
│  (Backend API)  │◀────────│  → SmartShule-Setup.exe      │
│  → Prisma + DB  │         │  → latest.yml (auto-update)  │
└─────────────────┘         └─────────────────────────────┘
        ▲
        │
┌─────────────────┐
│  Postes école   │
│  (App Electron) │
│  → .exe Windows │
│  → Auto-update  │
└─────────────────┘
```

---

## 2. Déploiement Frontend sur Cloudflare Pages

### Étapes

1. **Créer un compte** sur [Cloudflare Pages](https://pages.cloudflare.com/)
2. **Connecter le dépôt GitHub** SmartShule
3. **Configurer le build** :
   - **Framework preset** : Next.js
   - **Build command** : `npm run build`
   - **Build output directory** : `.next`
   - **Environment variables** :
     ```
     NEXT_PUBLIC_API_URL=https://smartshule-api.onrender.com
     NODE_VERSION=20
     ```

4. **Déployer** : chaque push sur `main` déclenchera un build automatique.

### Notes importantes

- ⚠️ Cloudflare Pages ne supporte pas les Server Actions Next.js par défaut. Pour les Server Actions, le backend doit être déployé séparément sur Render.
- Le Portail Parent (accessible aux familles via smartphone) sera servi par Cloudflare — ultra-rapide via le réseau global Cloudflare.
- Le domaine sera `https://smartshule.pages.dev` (ou votre domaine personnalisé).

---

## 3. Déploiement Backend sur Render

### Étapes

1. **Créer un compte** sur [Render.com](https://render.com/)
2. **Nouveau service Web** → connecter le dépôt GitHub
3. **Configuration** :
   - **Runtime** : Node.js
   - **Build Command** :
     ```bash
     npm install && npx prisma generate && npx prisma db push --accept-data-loss
     ```
   - **Start Command** :
     ```bash
     node .next/standalone/server.js
     ```
   - **Environment variables** :
     ```
     DATABASE_URL=file:/data/custom.db
     NEXTAUTH_SECRET=<générer avec openssl rand -base64 32>
     NODE_ENV=production
     PORT=10000
     ```

4. **Disque persistant** (CRITIQUE pour SQLite) :
   - Dans **Settings → Disks**, ajouter :
     - **Mount Path** : `/data`
     - **Size** : 1 GB (gratuit)
   - Modifier `DATABASE_URL` : `file:/data/custom.db`
   - Sans cela, **la base SQLite sera effacée à chaque redéploiement**.

5. **Health Check** : Render vérifie `/` → doit répondre 200.

### Mise à jour automatique

Chaque push sur `main` redéploie automatiquement le backend Render.

---

## 4. Compilation .exe Windows via GitHub Actions

### Workflows disponibles

| Fichier | Déclencheur | Rôle |
|---|---|---|
| `.github/workflows/pr-checks.yml` | Pull Request | Lint + tests + type check (bloque le merge si KO) |
| `.github/workflows/deploy.yml` | Push sur `main` ou `dev-agent` | Build + tests + génération .exe (artifact) |
| `.github/workflows/release.yml` | Tag `v*` (ex: `v1.0.0`) | Publie une Release publique avec .exe téléchargeable |

### Workflow détaillé `deploy.yml`

```text
Push → quality → build-web → build-electron-windows → upload artifact
                                ↓
                (optionnel) build-electron-multi → macOS + Linux
                                ↓
                            notify (résumé)
```

**Jobs** :
1. **quality** (ubuntu-latest, ~3 min) : lint + 150 tests
2. **build-web** (ubuntu-latest, ~5 min) : build Next.js standalone
3. **build-electron-windows** (windows-latest, ~15 min) : build .exe avec electron-builder
4. **build-electron-multi** (macOS + Linux, optionnel, non bloquant)
5. **notify** : résumé dans l'onglet Summary

### Télécharger le .exe

Après un push réussi :
1. Allez sur l'onglet **Actions** de votre dépôt GitHub
2. Cliquez sur le run réussi
3. En bas, section **Artifacts** → téléchargez `SmartShule-Setup-1.0.X-Windows`

### Lancer une release publique

Pour publier une version téléchargeable par tous les postes école :

```bash
# 1. Mettre à jour la version dans package.json
npm version patch  # 1.0.0 → 1.0.1
# ou
npm version minor   # 1.0.0 → 1.1.0
# ou
npm version major   # 1.0.0 → 2.0.0

# 2. Pousser le tag
git push origin main --tags
```

Le workflow `release.yml` se déclenche automatiquement et :
- Compile le .exe sur Windows
- Compile .dmg (macOS) et .AppImage (Linux) en parallèle
- Crée une GitHub Release publique
- Génère `latest.yml` (utilisé par electron-updater pour les mises à jour auto)

---

## 5. Mises à jour automatiques (electron-updater)

### Fonctionnement

```text
┌─────────────────────┐    checkForUpdates()     ┌─────────────────────┐
│  SmartShule.exe     │ ────────────────────────> │  GitHub Releases    │
│  (poste école)      │                           │  latest.yml         │
│                     │ <──── new version ─────── │  SmartShule-1.0.1   │
│                     │                           └─────────────────────┘
│  1. Vérifie (toutes │
│     les 4h)         │
│  2. Télécharge      │
│     silencieusement │
│  3. Demande à       │
│     l'utilisateur   │
│     de redémarrer   │
└─────────────────────┘
```

### Configuration

Le fichier `electron/main.js` intègre déjà `electron-updater` :

- **Vérification au démarrage** (après 10s)
- **Vérification toutes les 4 heures**
- **Téléchargement automatique** en arrière-plan
- **Notification utilisateur** avec choix "Redémarrer maintenant / Plus tard"
- **Installation silencieuse** à la fermeture de l'app

### Prérequis pour fonctionner

1. **`publish.provider: github`** dans `electron-builder.yml` ✅ (déjà configuré)
2. **Tag préfixé par `v`** (ex: `v1.0.0`) ✅ (configuré dans `release.yml`)
3. **`CUSTOM_GITHUB_TOKEN` secret** avec scope `repo` (voir section 7)
4. **latest.yml publié** dans la release ✅ (généré automatiquement par `--publish always`)

### Code signing (recommandé pour éviter SmartScreen)

Sans signature, Windows affiche un avertissement SmartScreen à l'installation. Pour le supprimer :

1. Acheter un certificat code signing Windows (EV ~300€/an, OV ~150€/an)
2. Configurer les secrets GitHub :
   ```
   WINDOWS_CERTIFICATE_PFX (base64 du fichier .pfx)
   WINDOWS_CERTIFICATE_PASSWORD
   ```
3. Décommenter les lignes `CSC_LINK` et `CSC_KEY_PASSWORD` dans `deploy.yml` et `release.yml`

---

## 6. Workflow Git bidirectionnel (VS Code ⟷ Agent IA)

### Problématique

L'agent IA travaille sur `dev-agent`, vous travaillez sur `main` depuis VS Code. Sans workflow, vous risquez d'écraser le travail de l'autre.

### Solution : script `sync-project.sh`

```bash
# Synchronisation standard (commit WIP + rebase + push)
./scripts/sync-project.sh

# Mode stash (préserve les modifications non commitables)
./scripts/sync-project.sh --stash

# Mode hard (reset vers origin/main — ATTENTION, perd les modifs locales)
./scripts/sync-project.sh --hard
```

### Workflow recommandé

```text
1. Vous codez sur VS Code → main
2. L'agent IA code → dev-agent
3. Avant de pusher : ./scripts/sync-project.sh
   - Commit WIP automatique
   - Fetch + rebase sur origin/main
   - Push sécurisé
4. Sur GitHub : PR de dev-agent vers main
   - pr-checks.yml valide (lint + tests)
   - Merge après validation
5. main mis à jour → deploy.yml se déclenche → nouveau .exe
```

### Branches recommandées

- `main` : branche stable, déployée en production
- `dev-agent` : branche de travail de l'agent IA
- `feature/*` : branches de fonctionnalités (ex: `feature/finance-module`)
- `hotfix/*` : correctifs urgents

---

## 7. Secrets GitHub à configurer

Allez dans **Settings → Secrets and variables → Actions → New repository secret** :

### Secrets obligatoires

| Nom | Description | Comment l'obtenir |
|---|---|---|
| `GITHUB_TOKEN` | Token automatique | ✅ Préexistant (pas besoin de le créer) |
| `CUSTOM_GITHUB_TOKEN` | PAT (Personal Access Token) avec scope `repo` | GitHub → Settings → Developer settings → Personal access tokens |

### Secrets optionnels (recommandés)

| Nom | Description |
|---|---|
| `NEXTAUTH_SECRET` | Secret JWT pour l'auth (sinon valeur par défaut dev) |
| `WINDOWS_CERTIFICATE_PFX` | Certificat code signing Windows (base64) |
| `WINDOWS_CERTIFICATE_PASSWORD` | Mot de passe du certificat |
| `APPLE_ID` | Apple ID pour notarisation macOS |
| `APPLE_APP_SPECIFIC_PASSWORD` | Mot de passe spécifique à l'app |
| `MAC_CERTIFICATE_P12` | Certificat développeur macOS (P12 base64) |
| `MAC_CERTIFICATE_PASSWORD` | Mot de passe du certificat macOS |

---

## 8. Dépannage & FAQ

### ❌ Le build Electron échoue sur Windows runner

**Cause probable** : Prisma n'arrive pas à générer le client sur Windows.

**Solution** : vérifiez que `npx prisma generate` est bien appelé avant `electron-builder`. Le workflow le fait déjà.

### ❌ Le .exe généré ne se lance pas (SmartScreen)

**Cause** : exécutable non signé.

**Solution** : voir section 5.4 (Code signing). Sans certificat, l'utilisateur doit cliquer "Informations complémentaires" → "Exécuter quand même".

### ❌ Les mises à jour automatiques ne fonctionnent pas

**Causes possibles** :

1. **Pas de `latest.yml` dans la release** → vérifiez que `--publish always` est passé à electron-builder (déjà dans `release.yml`)
2. **Token GitHub insuffisant** → `CUSTOM_GITHUB_TOKEN` doit avoir le scope `repo`
3. **Tag non préfixé par `v`** → utilisez `v1.0.0` et non `1.0.0`
4. **Build en mode dev** → electron-updater ne fonctionne qu'en version packagée (pas en `npm run electron:dev`)

### ❌ La base SQLite s'efface sur Render

**Cause** : pas de disque persistant configuré.

**Solution** : voir section 3.4 — ajouter un disque de 1 GB monté sur `/data`, et `DATABASE_URL=file:/data/custom.db`.

### ❌ Conflit de merge dans sync-project.sh

**Solution** :
```bash
# 1. Résoudre les conflits dans VS Code
# 2. Marquer comme résolus
git add .
# 3. Continuer le rebase
git rebase --continue
# 4. Relancer le script
./scripts/sync-project.sh
```

### ❌ Les tests échouent en CI mais passent en local

**Cause probable** : la DB de test locale contient des données résiduelles.

**Solution** : en CI, on utilise `DATABASE_URL=file:./db/test.db` (frais). Localement, supprimez `db/test.db` avant de relancer :

```bash
rm -f db/test.db
bun run db:push
bun test
```

### ❌ Cloudflare Pages ne supporte pas mes Server Actions

**Solution** : déployez uniquement le **Portail Parent** sur Cloudflare (lecture seule), et gardez l'application administrative complète (avec Server Actions) sur Render. Configurez `NEXT_PUBLIC_API_URL` en conséquence.

---

## 📚 Ressources

- [Documentation electron-builder](https://www.electron.build/)
- [Documentation electron-updater](https://www.electron.build/auto-update)
- [Documentation GitHub Actions](https://docs.github.com/en/actions)
- [Documentation Render Disks](https://render.com/docs/disks)
- [Documentation Cloudflare Pages](https://developers.cloudflare.com/pages/)

---

## 🚀 Démarrage rapide

```bash
# 1. Cloner le dépôt
git clone https://github.com/votre-repo/smartshule.git
cd smartshule

# 2. Installer les dépendances
bun install

# 3. Configurer la DB
cp .env.example .env
bun run db:push
bun run scripts/seed.ts
bun run scripts/seed-accounting.ts

# 4. Lancer en développement
bun run dev

# 5. Tester le build local
bun run build

# 6. Tester Electron en dev
npm run electron:dev

# 7. Premier release publique
git tag v1.0.0
git push origin v1.0.0
# → Le workflow release.yml génère le .exe et publie la Release
```

---

**Mission accomplie.** 🎉
