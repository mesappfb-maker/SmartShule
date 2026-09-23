# 📤 Guide de Push vers GitHub — SmartShule

> Ce guide vous accompagne pas à pas pour pousser le code SmartShule vers GitHub, configurer les workflows CI/CD, et révoquer votre token en toute sécurité.

---

## 📋 Prérequis

1. **Un compte GitHub** (gratuit)
2. **Un dépôt GitHub vide** — créez-le sur https://github.com/new
   - Nom : `smartshule`
   - Visibilité : **Private** (recommandé — contient du code métier)
   - **NE PAS** initialiser avec README/.gitignore (le dépôt local a déjà tout)
3. **Un Personal Access Token** (PAT) — voir section ci-dessous

---

## 🔐 Étape 1 — Créer un Personal Access Token temporaire

1. Allez sur https://github.com/settings/tokens?type=beta (tokens fine-grained, plus sécurisés)
   - **OU** https://github.com/settings/tokens (tokens classiques, plus simple)
2. Cliquez **Generate new token**
3. Configurez :
   - **Note** : `SmartShule push temporaire`
   - **Expiration** : `7 days` (court — vous le révoquerez après le push)
   - **Scopes** (tokens classiques) :
     - ✅ `repo` (Full control of private repositories)
   - **OU** pour fine-grained :
     - **Repository access** : Only select repositories → `smartshule`
     - **Permissions** : Contents = Read and write
4. Cliquez **Generate token**
5. **Copiez le token** (format : `ghp_xxxxxxxxxxxx` ou `github_pat_xxxxxxxxxxxx`)
   - ⚠️ Vous ne le verrez qu'une seule fois !

---

## 📤 Étape 2 — Pousser le code

### Option A — Script automatisé (recommandé)

```bash
cd /home/z/my-project

# Lancez le script avec l'URL de votre dépôt
./scripts/push-to-github.sh https://github.com/VOTRE-USER/smartshule.git
```

Le script va :
- ✅ Vérifier qu'aucun secret n'est dans les fichiers trackés
- ✅ Configurer le remote `origin`
- ✅ Pousser le code vers GitHub
- ✅ Vous rappeler de révoquer le token

Quand Git demande votre mot de passe, **collez votre token** (il ne s'affiche pas à l'écran — c'est normal).

### Option B — Commandes manuelles

```bash
cd /home/z/my-project

# 1. Ajouter le remote
git remote add origin https://github.com/VOTRE-USER/smartshule.git

# 2. Pousser
git push -u origin main

# Quand demandé :
#   Username: votre-username-github
#   Password: collez-votre-token-ici
```

---

## 🔒 Étape 3 — Révoquer le token IMMÉDIATEMENT

**Cette étape est obligatoire après le push.**

1. Allez sur https://github.com/settings/tokens
2. Trouvez le token `SmartShule push temporaire`
3. Cliquez **Delete** ou **Revoke**
4. Le token est immédiatement invalidé — plus personne ne peut l'utiliser

> 💡 Pour les prochains pushes, créez un nouveau token temporaire à chaque fois.
> C'est une bonne pratique de sécurité — un token qui n'existe pas ne peut pas être volé.

---

## ⚙️ Étape 4 — Configurer les Secrets GitHub (pour CI/CD)

Une fois le code poussé, configurez les secrets pour que GitHub Actions fonctionne :

1. Allez sur votre dépôt → **Settings** → **Secrets and variables** → **Actions**
2. Cliquez **New repository secret**
3. Ajoutez les secrets suivants :

### Secrets obligatoires

| Nom | Valeur | Comment l'obtenir |
|---|---|---|
| `CUSTOM_GITHUB_TOKEN` | Un nouveau PAT avec scope `repo` | https://github.com/settings/tokens |

### Secrets recommandés

| Nom | Valeur | Comment l'obtenir |
|---|---|---|
| `NEXTAUTH_SECRET` | Une chaîne aléatoire | `openssl rand -base64 32` dans votre terminal |

### Secrets optionnels (code signing Windows)

| Nom | Valeur |
|---|---|
| `WINDOWS_CERTIFICATE_PFX` | Contenu base64 du fichier .pfx |
| `WINDOWS_CERTIFICATE_PASSWORD` | Mot de passe du certificat |

---

## 🚀 Étape 5 — Vérifier que les workflows fonctionnent

Après le premier push :

1. Allez sur votre dépôt → onglet **Actions**
2. Vous devriez voir le workflow **🚀 Build & Deploy SmartShule** en cours
3. Attendez ~15-20 minutes (build Electron sur Windows runner)
4. Une fois terminé, cliquez sur le run → section **Artifacts** en bas
5. Téléchargez `SmartShule-Setup-1.0.X-Windows` → c'est votre .exe !

---

## 🏷️ Étape 6 — Créer une Release publique (optionnel)

Pour publier une version téléchargeable par tous les postes école :

```bash
cd /home/z/my-project

# Mettre à jour la version
# Éditez package.json → "version": "1.0.0" → "1.0.1"

# Créer le tag
git tag v1.0.0
git push origin v1.0.0
```

Le workflow **📦 Release SmartShule** se déclenche automatiquement :
- Compile le .exe (Windows) + .dmg (macOS) + .AppImage (Linux)
- Crée une GitHub Release publique
- Génère `latest.yml` (pour electron-updater)

Les postes installés se mettront à jour automatiquement.

---

## 🔄 Synchronisation ultérieure (VS Code ⟷ Agent IA)

Pour synchroniser votre travail local avec les modifications de l'agent :

```bash
# Synchronisation standard
./scripts/sync-project.sh

# Mode stash (préserve les modifications non commitables)
./scripts/sync-project.sh --stash
```

---

## ❓ Dépannage

### "Authentication failed"

- Vérifiez que le token a le scope `repo`
- Vérifiez que le token n'est pas expiré
- Vérifiez que votre username GitHub est correct

### "Permission denied (publickey)"

- Vous utilisez SSH au lieu de HTTPS
- Utilisez l'URL HTTPS : `https://github.com/user/repo.git` (pas `git@github.com:...`)

### Le workflow GitHub Actions échoue

- Vérifiez que `CUSTOM_GITHUB_TOKEN` est configuré dans les secrets
- Vérifiez que le token a le scope `repo`
- Regardez les logs dans l'onglet Actions

### Le .exe n'est pas généré

- Le job `build-electron-windows` prend ~15 min
- Si il échoue, regardez les logs → souvent un problème de Prisma generate
- Re-déclenchez manuellement via "Re-run jobs" dans l'onglet Actions

---

## 📊 Résumé des commandes

```bash
# 1. Push initial (avec script sécurisé)
./scripts/push-to-github.sh https://github.com/VOTRE-USER/smartshule.git

# 2. Révoquer le token (sur GitHub)
# → https://github.com/settings/tokens → Delete

# 3. Configurer les secrets (sur GitHub)
# → Settings → Secrets → Actions
#   - CUSTOM_GITHUB_TOKEN
#   - NEXTAUTH_SECRET

# 4. Vérifier le workflow (sur GitHub)
# → Onglet Actions → attendre ~20 min → Artifacts → .exe

# 5. Release publique (quand prêt)
git tag v1.0.0
git push origin v1.0.0
```

---

## ⚠️ Checklist de sécurité

- [ ] Le token a une expiration courte (7 jours max)
- [ ] Le token est révoqué immédiatement après le push
- [ ] Aucun token n'est écrit dans le code source
- [ ] Le fichier `.env` est dans `.gitignore` (vérifié ✅)
- [ ] La base SQLite `db/custom.db` est dans `.gitignore` (vérifié ✅)
- [ ] Aucun certificat (`.pfx`, `.key`) n'est committé (vérifié ✅)
- [ ] Le dépôt GitHub est en **Private** (recommandé)

---

**Bon push ! 🚀**
