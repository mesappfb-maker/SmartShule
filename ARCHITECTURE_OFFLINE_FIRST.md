# ARCHITECTURE OFFLINE-FIRST — SmartShule Desktop

> Application desktop Windows multi-écoles, fonctionnant 100% hors ligne
> avec synchronisation cloud bidirectionnelle, gestion de conflits et licence propriétaire.

---

## 1. Diagramme Architecture Offline-First

```
┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION DESKTOP (Electron)               │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │            Interface Utilisateur (Next.js + React)        │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │   │
│  │  │ Dashboard    │  │ Admissions   │  │ Finance      │    │   │
│  │  │ (par rôle)   │  │              │  │              │    │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │   │
│  │  │ Documents    │  │ Sync Center  │  │ Conflits     │    │   │
│  │  │ PDF locaux   │  │              │  │              │    │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Services Offline (lib/)                       │   │
│  │  • offline.ts      — file d'attente, sync, conflits       │   │
│  │  • sync.ts         — primitives sync (GUID, hash)         │   │
│  │  • sync-bridge.ts — stratégies de résolution             │   │
│  │  • auth.ts         — sessions + RBAC local               │   │
│  │  • audit.ts        — journalisation immuable             │   │
│  │  • license.ts      — vérification + période de grâce     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │            Base SQLite Locale (par école)                 │   │
│  │  • Tables métier (119 modèles Prisma)                    │   │
│  │  • sync_outbox   — opérations en attente                  │   │
│  │  • sync_inbox    — changements reçus du cloud             │   │
│  │  • sync_conflicts — conflits à résoudre                  │   │
│  │  • sync_checkpoints — curseur de progression             │   │
│  │  • sync_runs     — journal des exécutions               │   │
│  │  • sync_errors   — journal des erreurs                   │   │
│  │  • audit_logs    — journalisation immuable               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │            Stockage Local Sécurisé                        │   │
│  │  • %APPDATA%/SmartShule/{school_id}/                     │   │
│  │    ├── db/sqlite.db (chiffré)                            │   │
│  │    ├── documents/ (PDF générés)                          │   │
│  │    ├── backups/ (sauvegardes automatiques)               │   │
│  │    ├── logs/ (audit + erreurs)                           │   │
│  │    ├── cache/ (images, pièces jointes)                   │   │
│  │    └── config (licence chiffrée, paramètres)             │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (si Internet disponible)
┌─────────────────────────────────────────────────────────────────┐
│                    CLOUD (Vercel + Supabase)                     │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐   │
│  │ API Cloud         │  │ Base Cloud       │  │ Portail Web  │   │
│  │ (Next.js API)     │  │ (PostgreSQL)     │  │ Parents/Élèves│   │
│  └──────────────────┘  └──────────────────┘  └──────────────┘   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐   │
│  │ Notifications    │  │ Sauvegardes      │  │ Licences     │   │
│  │ (Twilio SMS/WA)  │  │ (automatiques)   │  │ (signature) │   │
│  └──────────────────┘  └──────────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Diagramme Multi-Écoles

```
┌─────────────────────────────────────────────────────────────────┐
│                    INSTANCE SMARTSHULE                           │
│                                                                  │
│  ┌───────────────────┐  ┌───────────────────┐                  │
│  │  ÉCOLE A          │  │  ÉCOLE B          │   ...N écoles    │
│  │  school_id: A     │  │  school_id: B     │                  │
│  │                   │  │                   │                  │
│  │  ┌─────────────┐  │  │  ┌─────────────┐  │                  │
│  │  │ SQLite A    │  │  │  │ SQLite B    │  │                  │
│  │  │ (isolé)     │  │  │  │ (isolé)     │  │                  │
│  │  └─────────────┘  │  │  └─────────────┘  │                  │
│  │  ┌─────────────┐  │  │  ┌─────────────┐  │                  │
│  │  │ Documents A │  │  │  │ Documents B │  │                  │
│  │  │ (chemin A)  │  │  │  │ (chemin B)  │  │                  │
│  │  └─────────────┘  │  │  └─────────────┘  │                  │
│  │  ┌─────────────┐  │  │  ┌─────────────┐  │                  │
│  │  │ Licence A   │  │  │  │ Licence B   │  │                  │
│  │  │ (clé A)     │  │  │  │ (clé B)     │  │                  │
│  │  └─────────────┘  │  │  └─────────────┘  │                  │
│  │  ┌─────────────┐  │  │  ┌─────────────┐  │                  │
│  │  │ Utilisateurs│  │  │  │ Utilisateurs│  │                  │
│  │  │ A           │  │  │  │ B           │  │                  │
│  │  └─────────────┘  │  │  └─────────────┘  │                  │
│  └───────────────────┘  └───────────────────┘                  │
│           │                       │                              │
│           ▼                       ▼                              │
│  ┌─────────────────────────────────────────────────────┐        │
│  │           ISOLATION STRICTE                          │        │
│  │  • Chaque table métier contient school_id            │        │
│  │  • Chaque requête filtrée par school_id              │        │
│  │  • Chaque document stocké dans chemin /{school_id}/  │        │
│  │  • Chaque utilisateur lié à une école               │        │
│  │  • Chaque appareil lié à une école                  │        │
│  │  • Chaque licence liée à une école                  │        │
│  │  • Chaque audit contient school_id                  │        │
│  │  • Vérification school_id à chaque sync             │        │
│  └─────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

### Offres multi-écoles

| Offre | Infrastructure | Isolation | Sous-domaine |
|---|---|---|---|
| STANDARD | Partagée | school_id + politiques ligne | {school}.smartshule.app |
| PREMIUM | Renforcée | Stockage isolé + domaine perso | {custom-domain} |
| ENTERPRISE | Dédiée | Base cloud + backend dédiés | Déploiement spécifique |

---

## 3. Schéma Base Locale (SQLite)

### Tables sync (offline-first)

```
sync_devices          — appareils enregistrés
sync_operations       — opérations reçues
sync_outbox           — file d'envoi locale
sync_inbox            — changements reçus du cloud
sync_conflicts        — conflits à résoudre
sync_checkpoints      — curseur de progression
sync_runs             — journal des exécutions
sync_errors           — journal des erreurs
```

### Tables métier (119 modèles Prisma)

Voir `prisma/schema.prisma` — toutes les tables contiennent `schoolId` pour l'isolation.

---

## 4. Schéma Synchronisation

```
┌─────────────────────────────────────────────────────────────────┐
│                    CYCLE DE SYNCHRONISATION                      │
│                                                                  │
│  1. Vérifier connexion Internet                                  │
│     ├─ Online → continuer                                       │
│     └─ Offline → garder opérations dans sync_outbox             │
│                                                                  │
│  2. Vérifier licence                                             │
│     ├─ Active → continuer                                       │
│     ├─ Grace period → continuer (lecture/écriture)              │
│     └─ Expired → mode lecture seule, pas de sync               │
│                                                                  │
│  3. Vérifier identité école/appareil                            │
│     ├─ school_id correspondant → continuer                     │
│     └─ Mismatch → erreur d'isolation (audit + blocage)          │
│                                                                  │
│  4. Envoyer sync_outbox (ordre chronologique)                   │
│     ├─ Pour chaque opération :                                  │
│     │   ├─ Marquer SENDING                                     │
│     │   ├─ Envoyer au cloud                                    │
│     │   ├─ Cloud vérifie school_id, rôle, permission, version  │
│     │   ├─ Réponse : ACCEPTED / REJECTED / CONFLICT             │
│     │   ├─ ACCEPTED → marquer ACCEPTED                         │
│     │   ├─ REJECTED → marquer REJECTED (erreur)                │
│     │   └─ CONFLICT → créer SyncConflict                       │
│     └─ Continuer jusqu'à outbox vide ou erreur                 │
│                                                                  │
│  5. Télécharger changements distants (sync_inbox)               │
│     ├─ Demander changements depuis checkpoint                   │
│     ├─ Pour chaque changement :                                │
│     │   ├─ Vérifier school_id                                  │
│     │   ├─ Vérifier conflit avec données locales               │
│     │   ├─ Appliquer dans base locale                          │
│     │   └─ Mettre à jour checkpoint                            │
│     └─ Continuer jusqu'à plus de changements                   │
│                                                                  │
│  6. Mettre à jour checkpoint                                     │
│  7. Créer audit de synchronisation                              │
│  8. Afficher rapport de synchronisation                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Règles de Conflits

| Type de donnée | Stratégie | Description |
|---|---|---|
| Audit log | BLOCKING_REVIEW | Ajout uniquement, jamais écrasé |
| Paiement | BLOCKING_REVIEW | Conflit bloquant, revue comptable obligatoire |
| Écriture comptable | CORRECTION_WORKFLOW | Jamais écrasée ; ajustement ou contrepassation |
| Paie validée | CORRECTION_WORKFLOW | Jamais écrasée ; correction par ajustement |
| Note publiée | BLOCKING_REVIEW | Conflit bloquant ou validation direction |
| Admission validée | BLOCKING_REVIEW | Revue secrétariat/direction obligatoire |
| Adresse parent | MERGE | Fusion contrôlée avec historique |
| Brouillon | LAST_WRITE_WINS_DRAFT | Fusion possible si champs non contradictoires |
| Document | VERSION_NEW | Version nouvelle, jamais écrasement silencieux |
| Paramètres | SERVER_WINS | Cloud prioritaire avec historique |
| Licence | SERVER_WINS | Cloud prioritaire |
| Présence | LAST_WRITE_WINS | Clé logique (SessionId + StudentId) |

### Centre de conflits

Écran dédié accessible à `SECRETARY`, `DIRECTION`, `ACCOUNTANT`, `ADMIN` :
- Référence du conflit
- Donnée concernée (type + ID)
- Valeur locale (JSON)
- Valeur cloud (JSON)
- Auteur local
- Auteur distant
- Date
- Règle proposée (stratégie suggérée)
- Action : garder local, garder cloud, fusionner, demander revue
- Audit obligatoire de la résolution

---

## 6. Schéma Service Licence

```
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICE LICENCE                               │
│                                                                  │
│  ┌──────────────────┐                                            │
│  │ License Model     │                                           │
│  │  • license_id     │                                           │
│  │  • school_id      │                                           │
│  │  • planType       │                                           │
│  │  • maxStudents    │                                           │
│  │  • maxActivations │                                           │
│  │  • expiresAt      │                                           │
│  │  • status         │                                           │
│  │  • signature      │                                           │
│  └──────────────────┘                                            │
│                              │                                   │
│  ┌──────────────────┐        ▼                                   │
│  │ Activation        │  ┌─────────────────┐                      │
│  │  • Online         │  │ Vérification     │                     │
│  │  • Offline (fichier│ │  • Clé publique  │                     │
│  │    signé)         │  │  • Signature     │                     │
│  └──────────────────┘  │  • Période grâce  │                    │
│                        │  • Mode lecture seule│                  │
│                        └─────────────────┘                      │
│                              │                                   │
│  ┌──────────────────┐        ▼                                   │
│  │ Période de grâce  │  ┌─────────────────┐                      │
│  │  30 jours config. │  │ États           │                     │
│  │  après expiration │  │  • ACTIVE       │                     │
│  │                   │  │  • GRACE_PERIOD  │                     │
│  └──────────────────┘  │  • READ_ONLY     │                     │
│                        │  • EXPIRED       │                     │
│                        └─────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

### Règles licence

- Vérification locale avec clé publique (jamais la privée dans l'EXE)
- Activation en ligne ou par fichier signé hors ligne
- Lien licence ↔ serveur/appareil autorisé
- Toutes activations auditées
- Licences révocables selon contrats
- Fonctionnement hors ligne pendant période de grâce configurable
- Après expiration : mode lecture seule + export/sauvegarde autorisés
- Jamais blocage brutal d'accès aux données
- Mises à jour signées obligatoirement
- Secrets cloud/fournisseurs jamais intégrés au client

---

## 7. Workflow Activation Online/Offline

### Activation Online

```
Utilisateur saisit clé licence
    ↓
App envoie à API cloud : /api/license/activate
    ↓
Cloud vérifie :
  • Clé valide ?
  • Non expirée ?
  • Non déjà activée sur autre machine ?
  • Quota activations respecté ?
    ↓
OK → Cloud lie licence à machine_id
    ↓
Cloud signe licence avec clé privée
    ↓
App reçoit licence signée + signature
    ↓
App stocke localement (chiffré)
    ↓
Audit local + cloud
```

### Activation Offline (fichier signé)

```
École reçoit fichier licence.lic (signé par SmartShule)
    ↓
Utilisateur importe fichier dans l'app
    ↓
App vérifie signature avec clé publique intégrée
    ↓
Signature valide → App extrait licence
    ↓
App vérifie :
  • school_id correspond ?
  • Non expirée ?
  • Machine ID autorisé ?
    ↓
OK → App active licence locale
    ↓
Audit local
    ↓
Prochaine sync : cloud notifié de l'activation
```

---

## 8. Workflow Installation École

```
1. Choisir ou saisir école
   ↓
2. Saisir clé licence
   ↓
3. Vérifier activation
   ├─ Online → API cloud
   └─ Offline → importer fichier licence
   ↓
4. Générer school_id et device_id si nécessaire
   ↓
5. Créer base locale isolée (SQLite)
   ↓
6. Créer dossiers locaux
   • %APPDATA%/SmartShule/{school_id}/
   • db/, documents/, backups/, logs/, cache/, config/
   ↓
7. Créer administrateur établissement initial
   ↓
8. Télécharger ou créer paramètres initiaux
   • Directorates, classes, matières
   • Plan comptable
   • Modèles documents
   ↓
9. Configurer sauvegardes automatiques
   • Quotidienne à 02h00
   • Hebdomadaire (dimanche)
   • Rétention 30 jours
   ↓
10. Vérifier synchronisation
    • Test connexion cloud
    • Premier sync (vide)
    ↓
11. Produire rapport installation
    • Récapitulatif
    • Statut réussite/erreur
    ↓
12. Afficher statut final
```

---

## 9. Stratégie Packaging et Mise à Jour

### Packaging Windows

| Élément | Valeur |
|---|---|
| Format | EXE (NSIS) ou MSIX |
| Signature de code | Requis (Authenticode) |
| Version | SemVer (MAJOR.MINOR.PATCH) |
| Canaux | Stable, Beta |
| Auto-update | electron-updater + GitHub Releases |

### Configuration (electron-builder.yml)

```yaml
appId: com.smartshule.app
productName: SmartShule
win:
  target:
    - nsis
    - msix
  signingHashAlgorithms: [sha256]
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  perMachine: false
```

### Mise à jour

1. electron-updater vérifie GitHub Releases
2. Compare version locale vs distante
3. Télécharge nouvelle version (signature vérifiée)
4. Sauvegarde automatique avant installation
5. Migration base locale (Prisma migrations)
6. Installation au redémarrage
7. Rollback possible si échec

### Sécurité package

- Aucun secret sensible dans l'EXE
- Credentials Twilio chiffrés AES-256-GCM
- Clé privée licence jamais incluse
- Détection environnement production/démo
- Journalisation des installations et mises à jour

---

## 10. Matrice RBAC Synchronisation/Licence

| Rôle | Voir statut sync | Voir conflits | Résoudre conflits | Forcer sync | Gérer licence | Activer licence | Accès refusé |
|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| SYSTEM_ADMIN | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| SCHOOL_ADMIN | ✓ | ✓ | ✓ | ✓ | ✓ (lecture) | ✓ | Révoquer licence |
| DIRECTOR | ✓ | ✓ | ✓ (validations) | ✓ | ✓ (lecture) | — | Config technique |
| SECRETARY | ✓ | ✓ (admin) | ✓ (admin) | ✓ | — | — | Licence |
| ACCOUNTANT | ✓ | ✓ (finance) | ✓ (finance) | — | — | — | Conflits non-financiers |
| HR_MANAGER | ✓ | ✓ (RH) | ✓ (RH) | — | — | — | Conflits finance |
| TEACHER | ✓ (ses données) | — | — | — | — | — | Sync globale |
| PARENT/STUDENT | — | — | — | — | — | — | Tout |
| AUDITOR | ✓ (lecture) | ✓ (lecture) | — | — | ✓ (lecture) | — | Toute modification |

---

## 11. Tests Offline-First

### Tests implémentés

| ID | Test | État |
|---|---|---|
| OF-01 | Service offline disponible | A_TESTER |
| OF-02 | queueOperation crée entrée sync_outbox | A_TESTER |
| OF-03 | getPendingOperations récupère PENDING | A_TESTER |
| OF-04 | createSyncConflict crée conflit | A_TESTER |
| OF-05 | resolveConflict marque résolu | A_TESTER |
| OF-06 | getSyncStatus retourne compteurs | A_TESTER |
| OF-07 | getLicenseStatus détecte expiration | A_TESTER |
| OF-08 | canWrite bloque si licence expirée | A_TESTER |
| OF-09 | assertSchoolIsolation lève erreur si mismatch | A_TESTER |
| OF-10 | registerDevice crée ou met à jour | A_TESTER |

### Tests synchronisation (à exécuter)

| ID | Test | Description |
|---|---|---|
| SYN-01 | Sync sans Internet | Opérations restent dans outbox |
| SYN-02 | Sync avec Internet | Opérations envoyées et acceptées |
| SYN-03 | Coupure pendant sync | Reprise correcte au prochain démarrage |
| SYN-04 | Conflit même donnée | Conflit créé et bloquant |
| SYN-05 | Paiement en conflit | Blocage + revue comptable |
| SYN-06 | Multi-écoles isolation | École A ne voit pas école B |
| SYN-07 | Licence valide | Sync fonctionne |
| SYN-08 | Licence expirée | Mode lecture seule, pas de sync |

---

## 12. Guide Installation Technicien

### Prérequis

- Windows 10/11 64-bit
- 4 Go RAM minimum
- 2 Go espace disque
- Connexion Internet initiale (activation licence)

### Étapes

1. **Télécharger l'installateur** SmartShule-Setup-x.y.z.exe
2. **Exécuter en tant qu'administrateur** (clic droit)
3. **Choisir dossier installation** (défaut : `C:\Program Files\SmartShule`)
4. **Créer raccourci bureau** (optionnel)
5. **Premier lancement** :
   - Assistant installation s'ouvre
   - Saisir clé licence
   - Créer administrateur établissement
   - Configurer sauvegardes
6. **Vérifier** :
   - Base SQLite créée dans `%APPDATA%/SmartShule/{school_id}/db/`
   - Dossier documents créé
   - Première sync cloud réussie (si Internet)
7. **Tester** :
   - Créer un élève test
   - Générer un document PDF
   - Vérifier sauvegarde automatique

### Rollback

En cas d'échec mise à jour :
1. Restaurer sauvegarde pré-migration (`backups/pre-update-{date}.db`)
2. Désinstaller nouvelle version
3. Réinstaller ancienne version
4. Restaurer base depuis backup

---

## 13. Guide Utilisateur École

### Démarrage quotidien

1. Double-clic sur icône SmartShule (bureau)
2. Connexion avec identifiants (email + mot de passe)
3. Vérifier le bandeau d'état :
   - **En ligne** → tout fonctionne
   - **Hors ligne** → opérations en attente (seront synchronisées automatiquement)
   - **Conflit** → résoudre dans Centre de Conflits
   - **Licence limitée** → contacter l'administration

### Travail hors ligne

L'application fonctionne normalement hors ligne :
- Créer admissions, élèves, paiements
- Générer documents PDF
- Saisir présences et notes
- Toutes opérations sont stockées localement

### Retour Internet

La synchronisation se lance automatiquement :
1. Envoi des opérations en attente
2. Réception des changements distants
3. Détection de conflits éventuels
4. Rapport de synchronisation affiché

### Résolution de conflits

Si le bandeau affiche "X conflit(s) à résoudre" :
1. Aller dans **Synchronisation → Centre de conflits**
2. Pour chaque conflit :
   - Consulter valeur locale et valeur cloud
   - Choisir une action :
     - **Garder local** (écraser cloud)
     - **Garder cloud** (écraser local)
     - **Fusionner** (combiner)
     - **Demander revue** (assigner à un responsable)
3. Audit automatique de chaque résolution

---

## 14. Guide Sauvegarde/Restauration

### Sauvegardes automatiques

| Type | Fréquence | Emplacement | Rétention |
|---|---|---|---|
| Quotidienne | 02h00 | `backups/daily/` | 7 jours |
| Hebdomadaire | Dimanche 01h00 | `backups/weekly/` | 4 semaines |
| Pré-migration | Avant mise à jour | `backups/pre-update/` | Permanent |

### Restauration

1. **Arrêter l'application**
2. **Localiser le backup** : `%APPDATA%/SmartShule/{school_id}/backups/`
3. **Copier le fichier** `.db` dans `db/sqlite.db`
4. **Relancer l'application**
5. **Vérifier intégrité** (tests automatiques au démarrage)

### Sauvegarde cloud (si Premium/Enterprise)

- Sauvegarde chiffrée envoyée au cloud quotidiennement
- Restauration possible via interface admin
- Historique 90 jours (Premium) / 365 jours (Enterprise)

---

## 15. Liste des Livrables

| # | Livrable | Statut |
|---|---|---|
| 1 | Diagramme architecture offline-first | TERMINE |
| 2 | Diagramme multi-écoles | TERMINE |
| 3 | Schéma base locale | TERMINE (119 modèles Prisma) |
| 4 | Schéma synchronisation | TERMINE |
| 5 | Règles de conflits | TERMINE (12 stratégies) |
| 6 | Schéma service licence | TERMINE |
| 7 | Workflow activation online/offline | TERMINE |
| 8 | Workflow installation école | TERMINE |
| 9 | Stratégie packaging et mise à jour | TERMINE |
| 10 | Matrice RBAC synchronisation/licence | TERMINE |
| 11 | Résultats tests offline | A_TESTER (10 tests) |
| 12 | Résultats tests synchronisation | A_TESTER (8 scénarios) |
| 13 | Résultats tests isolation multi-écoles | A_TESTER |
| 14 | Résultats tests licence | A_TESTER |
| 15 | Résultats tests non-régression | A_TESTER |
| 16 | Guide installation technicien | TERMINE |
| 17 | Guide utilisateur école | TERMINE |
| 18 | Guide sauvegarde/restauration | TERMINE |

---

*Mise à jour : 2026-09-24*
