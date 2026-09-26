## SmartShule v2.0.0 — Version COMMERCIALE (activation licence)

### 🎯 Nouvelle architecture — version majeure

Cette version introduit une **architecture commerciale complète** :

```
┌─────────────────────────────────────────────────────────────┐
│ 1. SITE DÉMO (smartshule-seven.vercel.app)                  │
│    • 14 comptes démo pour prospects                         │
│    • Reste en ligne pour démo commerciale                   │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│ 2. SITE CENTRAL D'ADMIN (smartshule-seven.vercel.app/admin) │
│    • Fabrice s'y connecte avec fabricefb@gmail.com          │
│    • Génère des licences (SMART-XXXX-XXXX-XXXX-XXXX)        │
│    • Gère toutes les écoles clientes                        │
│    • API de vérification online                             │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│ 3. INSTALLATEUR COMMERCIAL (SmartShule-Setup.exe v2.0)      │
│    • AUCUN compte pré-créé                                   │
│    • AUCUN mot de passe dans le guide                       │
│    • Au 1er lancement → PAGE D'ACTIVATION                   │
│    • L'école saisit sa clé de licence                       │
│    • Vérification online sur le site central                 │
│    • Si valide → wizard de configuration :                  │
│        - Infos école (nom, adresse, couleurs)               │
│        - Création du compte admin (par l'utilisateur)       │
│    • L'app démarre TOUJOURS en local (jamais Vercel)        │
└─────────────────────────────────────────────────────────────┘
```

### 📥 Téléchargement

| Fichier | Taille | MD5 |
|---|---|---|
| SmartShule-Setup.exe | 212 MB | `bbab1ecf47579a0cdc198875560b0d91` |
| SmartShule-portable.zip | 359 MB | `439682abbbaf4253ace46cc675cb6a0b` |

### 🚀 Workflow commercial complet

#### Côté Fabrice (vous)
1. Allez sur **https://smartshule-seven.vercel.app/admin/login**
2. Connectez-vous avec `fabricefb@gmail.com` / `Wazengafb@007`
3. ⚠️ **IMPORTANT** : Au premier accès, appelez `https://smartshule-seven.vercel.app/api/admin/seed-owner` pour créer votre compte
4. Allez dans **Licences** → cliquez **"Générer une licence"**
5. Saisissez les infos de l'école cliente + choisissez le plan
6. Copiez la clé générée (format `SMART-XXXX-XXXX-XXXX-XXXX`)
7. Envoyez la clé à l'école cliente

#### Côté école cliente
1. Télécharge `SmartShule-Setup.exe` v2.0
2. Installe le logiciel
3. Au premier lancement → **page d'activation**
4. Saisit sa clé de licence
5. Vérification online sur votre site central
6. Si valide → wizard de configuration :
   - Nom de l'école, slogan, adresse, téléphone, email
   - Création du compte admin (leur propre email + leur propre mot de passe)
7. L'app crée la base locale avec leurs données
8. L'école se connecte et utilise SmartShule

### 📋 Plans de licences disponibles

| Plan | Élèves max | Appareils | Prix annuel |
|---|---|---|---|
| **ESSENTIAL** | 200 | 1 | 250 000 FC |
| **PREMIUM** | 1000 | 3 | 500 000 FC |
| **ENTERPRISE** | Illimité | 10 | 1 000 000 FC |

### 🔒 Sécurité

- ❌ **Aucun mot de passe** dans le guide de démarrage
- ❌ **Aucun compte** pré-créé dans l'installateur
- ✅ Chaque école crée son propre compte admin
- ✅ Vérification online de chaque licence
- ✅ Anti-piratage : 1 licence = X appareils max
- ✅ L'app Electron charge **TOUJOURS** le serveur local (jamais Vercel)

### 📋 APIs ajoutées

| Endpoint | Méthode | Description |
|---|---|---|
| `/api/admin/seed-owner` | GET | Crée le compte Fabrice (à appeler 1 fois) |
| `/api/admin/licenses` | GET | Liste toutes les licences (Fabrice only) |
| `/api/admin/licenses` | POST | Génère une nouvelle licence (Fabrice only) |
| `/api/license/verify` | POST | Vérification online (appelée par les EXE) |
| `/api/setup/initialize` | POST | Crée école + admin après activation licence |

### 📁 Fichiers ajoutés

- `src/app/admin/` — Portail admin central (login + dashboard + licences + écoles)
- `src/modules/setup/license-activation.tsx` — Page d'activation 3 étapes
- `src/app/api/setup/initialize/route.ts` — Setup initial après licence
- `scripts/seed-empty.ts` — Base totalement vide
- `electron/main.js` — Modifié : toujours local, jamais Vercel
