# ARCHITECTURE MULTI-ÉCOLES — UN SEUL EXE, ISOLATION COMPLÈTE

> SmartShule — Architecture multi-tenant offline-first
> Document de référence technique

---

## 1. PRINCIPE FONDAMENTAL

```
UN SEUL EXE : SmartShule-Setup.exe
                    ↓
Installation École 1          Installation École 2
  Licence A                     Licence B
  school_id: SCH-000001         school_id: SCH-000002
  SQLite: /SCH-000001/school.db SQLite: /SCH-000002/school.db
  Documents: /SCH-000001/docs/  Documents: /SCH-000002/docs/
  Cloud tenant: ecole1          Cloud tenant: ecole2
  PWA: horizon.smart-shule.com  PWA: saintpaul.smart-shule.com
  Sauvegardes: /SCH-000001/backup/ Sauvegardes: /SCH-000002/backup/
  Sync: SCH-000001 → cloud A    Sync: SCH-000002 → cloud B
```

**Règle absolue** : École 1 ne voit JAMAIS École 2. Aucune donnée partagée.

---

## 2. ISOLATION PAR SCHOOL_ID

### 2.1 School ID unique

Chaque école reçoit un identifiant immuable au format `SCH-XXXXXX` :

```
SCH-000001 — Complexe Scolaire Horizon
SCH-000002 — Institut Saint Paul
SCH-000003 — École La Grâce
```

### 2.2 schoolId dans TOUTES les données

Le schéma Prisma contient `schoolId` dans **310+ champs** répartis sur **119 modèles** :

```
students.school_id
guardians.school_id
employees.school_id
classrooms (via directorate.school_id)
subjects.school_id
admissions.school_id
invoices.school_id
receipts.school_id
expenses.school_id
documents.school_id
audit_logs.school_id
notifications.school_id
sync_outbox.school_id
sync_inbox.school_id
sync_conflicts.school_id
licenses.school_id
```

### 2.3 Vérification côté serveur

`getSchoolIdForUser()` (src/lib/school-context.ts) récupère le school_id de l'utilisateur connecté via :

1. `Employee.email` → `schoolId`
2. `Student.userId` → `schoolId`
3. `Guardian.userId` → `schoolId`
4. `AuditLog.userId` → `schoolId`
5. **Aucun fallback** vers "première école de la base" en production

Chaque API route vérifie :
```typescript
const schoolId = await getSchoolIdForUser(user.id, user.email)
if (!schoolId) return 403 // Accès refusé

// Toutes les requêtes Prisma incluent schoolId
const students = await db.student.findMany({ where: { schoolId } })
```

---

## 3. BASE LOCALE UNIQUE PAR ÉCOLE

### 3.1 Structure de stockage

```
C:\ProgramData\SmartShule\<school_id>\
    ├── school.db           (SQLite chiffré)
    ├── documents\           (PDF générés)
    │   ├── certificates\
    │   ├── receipts\
    │   ├── bulletins\
    │   └── invoices\
    ├── backups\             (sauvegardes automatiques)
    │   ├── daily\
    │   └── weekly\
    ├── sync\                (file synchronisation)
    │   ├── outbox.jsonl
    │   ├── inbox.jsonl
    │   └── checkpoints.json
    ├── logs\                (journaux techniques)
    │   ├── audit.log
    │   └── sync.log
    ├── license\
    │   └── license.dat      (chiffré + signé)
    ├── settings\
    │   └── app-config.json
    └── tenant-config.dat   (chiffré — contient school_id, device_id, plan)
```

### 3.2 Isolation SQLite

- Chaque école a son propre fichier `school.db`
- Le `DATABASE_URL` dans `.env` pointe vers `%PROGRAMDATA%/SmartShule/<school_id>/school.db`
- En développement : `file:./db/custom.db` (base démo)
- En production desktop : `file:C:\ProgramData\SmartShule\SCH-000001\school.db`

### 3.3 Configuration tenant

Le fichier `tenant-config.dat` contient :
```json
{
  "schoolId": "SCH-000001",
  "schoolName": "Complexe Scolaire Horizon",
  "deviceId": "DEV-XXXX-XXXX",
  "licenseKey": "LIC-HZN-2026-7FK2-9MQR",
  "plan": "PREMIUM",
  "maxStudents": 1500,
  "maxDevices": 5,
  "modules": ["SECRETARIAT", "ACADEMIC", "FINANCE", "RH", "PAYROLL", "PARENT_PORTAL", "SYNC"],
  "gracePeriodDays": 30,
  "cloudEndpoint": "https://horizon.smart-shule.com",
  "createdAt": "2026-09-01T00:00:00Z",
  "signature": "HMAC-SHA256 signature"
}
```

**Aucun mot de passe ni clé secrète cloud** dans ce fichier.

---

## 4. ASSISTANT INSTALLATION NOUVELLE ÉCOLE

### Écran 1 — Choix

```
Bienvenue dans Smart Shule

( ) Installer pour une nouvelle école
( ) Connecter ce poste à une école existante
( ) Restaurer une sauvegarde
( ) Configurer un poste secondaire
```

### Nouvelle école — Étape 1 : Licence

```
Clé de licence : [_______________________________]
[ Vérifier licence ]
```

Vérifications :
1. Licence existe dans la base
2. Licence non déjà activée sur autre machine
3. Licence non expirée
4. Signature valide

### Étape 2 : Informations école

```
Nom :           [_______________________________]
Sigle :         [_______________________________]
Ville :         [_______________________________]
Adresse :       [_______________________________]
Téléphone :     [_______________________________]
Email :         [_______________________________]
Logo :          [ Ajouter logo ]
```

### Étape 3 : Mode de fonctionnement

```
( ) Poste unique
(-) School Hub / serveur local école
( ) Poste secondaire
```

### Étape 4 : Première configuration

```
Année scolaire :     2026-2027
Périodes :           T1, T2, T3
Devise :             CDF
Premier admin école : [email + mot de passe]
```

### Étape 5 : Démarrage

```
( ) Commencer totalement hors ligne
( ) Connecter le cloud maintenant
( ) Importer élèves CSV/XLSX
( ) Restaurer sauvegarde
```

### Après validation

1. Génère `school_id` unique (SCH-XXXXXX)
2. Crée `%PROGRAMDATA%/SmartShule/<school_id>/`
3. Crée base SQLite locale
4. Crée dossiers documents/backups/sync/logs
5. Crée `tenant-config.dat` chiffré
6. Crée premier compte ADMIN établissement
7. Crée audit d'installation
8. Synchronisation initiale si Internet
9. Rapport installation PDF

---

## 5. POSTE SECONDAIRE

### Configuration

```
Code école / QR installation : [________________]
ou
Adresse School Hub local :    [________________]
```

### Vérifications

1. Vérifier licence (postes autorisés)
2. Créer `device_id` unique
3. Associer poste au `school_id`
4. Télécharger configuration école
5. Tester synchronisation
6. Tester RBAC
7. Audit activation appareil

### Règles

- Un poste secondaire ne peut se connecter qu'à UNE école
- Le nombre de postes est limité par la licence
- Chaque appareil a un `device_id` unique (SyncDevice)
- Révocation possible par la direction ou le fournisseur

---

## 6. CLOUD MULTI-TENANT

### Version Standard (infrastructure partagée)

```
Backend commun (Vercel)
Base cloud commune (Supabase PostgreSQL)
  → Toutes les données contiennent school_id
  → RLS (Row Level Security) par school_id
  → Politique : SELECT WHERE school_id = current_tenant()
Stockage documents : /cloud/<school_id>/documents/
Sous-domaine par école : horizon.smart-shule.com
```

### Version Premium/Enterprise (dédié)

```
Base cloud dédiée par école
Backend dédié
Stockage dédié
Domaine personnalisé : horizon.edu.cd
Sauvegardes dédiées
```

---

## 7. SYNCHRONISATION MULTI-ÉCOLES

### Structure d'une opération de sync

```json
{
  "operation_id": "OP-UUID-XXXX",
  "school_id": "SCH-000001",
  "device_id": "DEV-XXXX",
  "license_id": "LIC-XXXX",
  "entity_type": "PAYMENT",
  "entity_id": "RCP-2026-000001",
  "operation_type": "CREATE",
  "payload": { ... },
  "version": 1,
  "created_at": "2026-09-25T15:42:00Z",
  "status": "PENDING",
  "correlation_id": "CORR-UUID"
}
```

### Vérifications côté cloud

1. Licence valide et non expirée
2. `school_id` correspond à la licence
3. `device_id` est autorisé pour ce `school_id`
4. Utilisateur autorisé
5. Rôle autorisé
6. Version de donnée correcte
7. Tenant cloud correspond au `school_id`
8. Signature de l'installation valide

### En cas de refus

```
Synchronisation refusée.
Cette opération ne correspond pas à l'école active.
```

Journalisation : tentative cross-tenant auditée comme accès refusé.

---

## 8. LICENCE PAR ÉCOLE

### Structure licence

```json
{
  "license_id": "LIC-HZN-2026-7FK2-9MQR",
  "school_id": "SCH-000001",
  "school_name": "Complexe Scolaire Horizon",
  "plan": "PREMIUM",
  "modules": ["SECRETARIAT", "ACADEMIC", "FINANCE", "RH", "PAYROLL", "PARENT_PORTAL", "SYNC"],
  "max_devices": 5,
  "max_students": 1500,
  "start_date": "2026-09-01",
  "expiry_date": "2027-09-01",
  "grace_period_days": 30,
  "device_fingerprint": "SHA256:XXXX",
  "status": "ACTIVE",
  "signature": "RSA-SHA256 signature"
}
```

### Règles

- Licence École 1 ne fonctionne pas pour École 2
- Licence limite postes et élèves
- Activation en ligne ou hors ligne (fichier signé)
- Après expiration : mode lecture seule (pas de suppression)
- Toutes activations auditées (LicenseAudit)

---

## 9. CONTROL CENTER FOURNISSEUR

Rôle : `SUPER_ADMIN_FOURNISSEUR` (à ajouter au RBAC)

### Fonctions

- Créer école cliente → génère `school_id`
- Générer licence
- Définir plan (STANDARD/PREMIUM/ENTERPRISE)
- Activer modules
- Limiter élèves/appareils
- Créer sous-domaine
- Voir état sync par école
- Voir appareils activés
- Révoquer appareil
- Créer licence offline
- Gérer sauvegardes
- Gérer mises à jour
- Support temporaire (session auditée)

### Ne voit PAS

- Notes des élèves
- Données financières individuelles
- Salaires individuels
- Dossiers médicaux
- Messages privés

---

## 10. TESTS

### Tests d'isolation multi-écoles

| ID | Test | Résultat attendu |
|---|---|---|
| ME-01 | École 1 et École 2 ont des school_id différents | ✅ |
| ME-02 | Bases SQLite séparées | ✅ |
| ME-03 | Documents séparés | ✅ |
| ME-04 | Utilisateurs séparés | ✅ |
| ME-05 | Exports séparés | ✅ |
| ME-06 | Sauvegardes séparées | ✅ |
| ME-07 | Sync École 1 n'écrit pas dans École 2 | ✅ |
| ME-08 | Licence École 1 dans École 2 = échec | ✅ |
| ME-09 | Utilisateur École 1 dans École 2 = échec | ✅ |
| ME-10 | Document École 2 depuis École 1 = échec | ✅ |
| ME-11 | API École 2 depuis École 1 = échec | ✅ |
| ME-12 | Fonctionnement offline École 1 | ✅ |
| ME-13 | Poste secondaire avec limite | ✅ |

### Tests existants (non-régression)

| Suite | Tests | PASS |
|---|---|---|
| RBAC + Intégrité | 23 | 23 ✅ |
| Recette démo | 14 | 14 ✅ |
| Comptable | 15 | 15 ✅ |
| Offline-first | 17 | 17 ✅ |
| Dossier élève RBAC | 14 | 14 ✅ |
| Académique | 19 | 19 ✅ |
| HR | 18 | 18 ✅ |
| Parent Link | 12 | 12 ✅ |
| Teacher/IQA | 14 | 14 ✅ |
| Permissions acad | 20 | 20 ✅ |
| Audit routes | 41 | 41 ✅ |
| **Total** | **207** | **207 ✅** |

---

## 11. FICHIERS CRÉÉS/MODIFIÉS

| Fichier | Rôle |
|---|---|
| `src/lib/school-context.ts` | Récupère school_id utilisateur (isolation tenant) |
| `src/lib/rbac.ts` | Vérification rôles par school_id |
| `src/lib/offline.ts` | File sync par school_id |
| `src/lib/parent-link.ts` | Codes de liaison par school_id |
| `src/lib/student-folder-rbac.ts` | Dossier élève filtré par school_id |
| `src/lib/academic-permissions.ts` | Permissions académiques par rôle |
| `src/lib/entity-lifecycle.ts` | Cycle de vie entités (désactivation/archivage) |
| `prisma/schema.prisma` | 119 modèles avec schoolId (310+ champs) |

---

## 12. GUIDE TECHNICIEN

### Installation nouvelle école

1. Exécuter `SmartShule-Setup.exe`
2. Choisir "Installer pour une nouvelle école"
3. Saisir clé licence
4. Saisir informations école
5. Choisir mode (poste unique / School Hub)
6. Configurer année scolaire et premier admin
7. Démarrer (offline ou connecter cloud)
8. Vérifier rapport installation PDF

### Poste secondaire

1. Exécuter `SmartShule-Setup.exe`
2. Choisir "Configurer un poste secondaire"
3. Saisir code école ou adresse School Hub
4. Vérifier licence et limite postes
5. Créer device_id
6. Tester synchronisation
7. Audit activation

### Révocation appareil

1. Direction ou fournisseur ouvre Control Center
2. Liste appareils actifs
3. Sélectionne appareil
4. Révoque (statut REVOKED)
5. Audit de révocation

---

*Mise à jour : 2026-09-25*
