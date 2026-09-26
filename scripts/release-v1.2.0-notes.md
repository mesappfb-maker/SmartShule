## SmartShule v1.2.0 — Version COMMERCIALE

### 🎯 Nouveautés majeures

#### 🔐 Système de licences commercial
- **Générateur de licences** intégré au portail Super Admin
- **Format de clés** : `SMART-XXXX-XXXX-XXXX-XXXX` (anti-confusion : pas de I, O, 0, 1)
- **3 plans annuels** :
  - **ESSENTIAL** : 200 élèves max, 1 appareil, 25 000 FC/mois
  - **PREMIUM** : 1000 élèves max, 3 appareils, 50 000 FC/mois
  - **ENTERPRISE** : illimité, 10 appareils, 100 000 FC/mois
- **Vérification online** : chaque activation est vérifiée sur serveur central
- **Anti-piratage** : 1 licence = X appareils max (selon plan)

#### 🎨 Branding professionnel
- **Logo SmartShule** généré (gradient bleu/vert, chapeau diplôme + livre)
- Intégré dans : installateur NSIS, raccourci Bureau, Menu Démarrer, app Electron
- Plus d'icône Electron par défaut !

#### 🧹 Page de connexion propre
- **Suppression des 14 boutons de comptes démo**
- Page de connexion **VIERGE** : juste email + mot de passe
- Aucune mention de comptes démo visibles par les clients

#### 👤 Compte propriétaire unique
- **Email** : `fabricefb@gmail.com`
- **Mot de passe** : `Wazengafb@007`
- Rôle : SYSTEM_ADMIN (accès complet)
- Aucun autre compte dans la base

### 📥 Téléchargement

| Fichier | Taille | MD5 |
|---|---|---|
| SmartShule-Setup.exe | 208 MB | `24a6ab2121b86ec170641ffdecc53ee2` |
| SmartShule-portable.zip | 352 MB | `571442a2ece501ff7fcc160b0f0dae12` |

### 🔑 Connexion

```
Email : fabricefb@gmail.com
Mot de passe : Wazengafb@007
```

⚠️ **Changez ce mot de passe** après le premier login via Espace Direction → Sécurité.

### 📋 APIs ajoutées

- `POST /api/admin/licenses` : générer une nouvelle licence (SYSTEM_ADMIN only)
- `GET /api/admin/licenses` : lister toutes les licences (SYSTEM_ADMIN only)
- `POST /api/license/verify` : vérifier une licence online (public)

### 🗂️ Fichiers ajoutés

- `scripts/seed-commercial.ts` : seed avec uniquement fabricefb@gmail.com
- `scripts/generate-logo.ts` : génération automatique du logo
- `src/lib/license.ts` : logique métier des licences (clés, plans, features)
- `src/app/api/admin/licenses/route.ts` : API CRUD licences
- `src/app/api/license/verify/route.ts` : API vérification online

### 🚀 Prochaines étapes (Phase 2)

- Page d'activation de licence au premier lancement
- Portail admin central (app web séparée)
- Migration Cloudflare Pages (en cours)
- Apps Mac DMG + Android APK

### 🔒 Démo commerciale

La version démo reste disponible sur https://smartshule-seven.vercel.app avec les 14 comptes démo pour vos prospects.
