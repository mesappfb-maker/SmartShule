# REGISTRE DES EXIGENCES ET FINALISATION — SmartShule

> Conforme à la directive MASTER PROMPT — Non-régression absolue, RBAC strict, ERP scolaire modulaire.

## Statuts

- `NON_ANALYSE` — Exigence non encore examinée
- `MANQUANT` — Exigence identifiée mais non implémentée
- `PARTIEL` — Implémentation partielle
- `INCORRECT` — Implémentation existante incorrecte
- `EN_COURS` — En cours d'implémentation
- `A_TESTER` — Implémentation terminée, tests à exécuter
- `TERMINE` — Implémentation et tests validés
- `BLOQUE` — Blocage identifié
- `REGRESSION_CORRIGEE` — Régression détectée et corrigée

---

## A. Modules principaux du logiciel

### A.1 Administration système

| ID | Exigence | État | Rôles concernés | Fichier |
|---|---|---|---|---|
| ADM-01 | Création comptes utilisateurs | TERMINE | ADMIN | `src/lib/auth.ts` |
| ADM-02 | Gestion rôles et permissions | TERMINE | ADMIN | `src/lib/auth.ts` |
| ADM-03 | Configuration établissement | TERMINE | ADMIN, DIRECTION | `src/modules/direction/school-setup-manager.tsx` |
| ADM-04 | Branding (logo, couleurs) | TERMINE | ADMIN | `src/app/api/admin/content/route.ts` |
| ADM-05 | Licences et activation | TERMINE | ADMIN | `src/app/api/license/route.ts` |
| ADM-06 | Journal d'audit central | TERMINE | ADMIN, DIRECTION | `src/lib/audit.ts` |

### A.2 Direction

| ID | Exigence | État | Rôles concernés | Fichier |
|---|---|---|---|---|
| DIR-01 | Dashboard stratégique | TERMINE | DIRECTION, ADMIN | `src/modules/direction/direction-dashboard.tsx` |
| DIR-02 | Validation admissions | TERMINE | DIRECTION | `src/app/api/secretariat/admissions/route.ts` |
| DIR-03 | Validation certificats | TERMINE | DIRECTION | `src/app/api/secretariat/documents/route.ts` |
| DIR-04 | Gestion personnels | TERMINE | DIRECTION, ADMIN | `src/modules/direction/school-setup-manager.tsx` |
| DIR-05 | Emplois du temps | TERMINE | DIRECTION | `src/app/api/direction/schedule/route.ts` |

### A.3 Secrétariat (hub central)

| ID | Exigence | État | Rôles concernés | Fichier |
|---|---|---|---|---|
| SEC-01 | Dashboard opérationnel 15 indicateurs | TERMINE | SECRETARY | `src/modules/secretary/secretary-dashboard-v2.tsx` |
| SEC-02 | File d'attente administrative | TERMINE | SECRETARY | `src/app/api/secretariat/tasks/route.ts` |
| SEC-03 | Admissions Excel grid | TERMINE | SECRETARY | `src/modules/secretary/admissions-manager-v2.tsx` |
| SEC-04 | Fiche élève centralisée (onglets) | TERMINE | SECRETARY | `src/modules/secretary/student-detail-drawer.tsx` |
| SEC-05 | Réinscriptions annuelles | TERMINE | SECRETARY | `src/app/api/secretariat/enrollments/route.ts` |
| SEC-06 | Centre absences/retards | TERMINE | SECRETARY | `src/modules/secretary/absences-center.tsx` |
| SEC-07 | Centre documents/certificats | TERMINE | SECRETARY | `src/modules/secretary/documents-center.tsx` |
| SEC-08 | Centre communications | TERMINE | SECRETARY | `src/modules/secretary/communications-center.tsx` |
| SEC-09 | Centre transferts/sorties | TERMINE | SECRETARY | `src/modules/secretary/transfers-center.tsx` |
| SEC-10 | Centre rapports/masse | TERMINE | SECRETARY | `src/modules/secretary/reports-center.tsx` |
| SEC-11 | **Centre notifications SMS/WhatsApp** | TERMINE | SECRETARY, DIRECTION, ADMIN | `src/modules/secretary/notifications-center.tsx` + `src/lib/notifications.ts` |
| SEC-12 | **Centre imports CSV/XLSX 8 étapes** | TERMINE | SECRETARY, ADMIN | `src/modules/secretary/imports-center.tsx` + `src/lib/import-engine.ts` |
| SEC-13 | **Génération PDF 16 modèles officiels** | TERMINE | SECRETARY, DIRECTION, ADMIN | `src/lib/document-generation.ts` |
| SEC-14 | **Recherche universelle** | TERMINE | SECRETARY | `src/app/api/secretariat/search/route.ts` |

### A.4 Académique

| ID | Exigence | État | Rôles concernés | Fichier |
|---|---|---|---|---|
| ACA-01 | Années scolaires et périodes | TERMINE | DIRECTION | `prisma/schema.prisma` AcademicYear |
| ACA-02 | Classes, niveaux, options | TERMINE | DIRECTION | `prisma/schema.prisma` Classroom |
| ACA-03 | Matières et enseignants | TERMINE | DIRECTION | `src/app/api/direction/assign-teacher/route.ts` |
| ACA-04 | Présences/absences (enseignant) | TERMINE | TEACHER | `src/lib/teacher-emargement-actions.ts` |
| ACA-05 | Notes et bulletins | TERMINE | TEACHER, DIRECTION | `src/lib/queries.ts` |
| ACA-06 | Emplois du temps | TERMINE | DIRECTION | `src/app/api/direction/schedule/route.ts` |
| ACA-07 | IQA (Indice Qualité Apprentissage) | TERMINE | DIRECTION | `src/lib/iqa.ts` |

### A.5 Finance et comptabilité

| ID | Exigence | État | Rôles concernés | Fichier |
|---|---|---|---|---|
| FIN-01 | Plan comptable | TERMINE | ACCOUNTANT | `prisma/schema.prisma` ChartOfAccount |
| FIN-02 | Journaux et écritures | TERMINE | ACCOUNTANT | `src/lib/accounting.ts` |
| FIN-03 | Factures élèves | TERMINE | ACCOUNTANT, CASHIER | `src/lib/finance-actions.ts` |
| FIN-04 | Paiements et reçus (QR + HMAC) | TERMINE | CASHIER | `src/lib/finance-encashment-actions.ts` |
| FIN-05 | Mobile Money (M-Pesa, Orange, Airtel) | TERMINE | CASHIER | `prisma/schema.prisma` MobileMoneyPayment |
| FIN-06 | Caisse (ouverture/clôture) | TERMINE | CASHIER | `src/modules/accountant/accountant-full-portal.tsx` |
| FIN-07 | Dépenses et fournisseurs | TERMINE | ACCOUNTANT | `prisma/schema.prisma` Expense |
| FIN-08 | Budget et prévisions | TERMINE | ACCOUNTANT, DIRECTION | `src/lib/accountant-dashboard-advanced.ts` |
| FIN-09 | Bourses et exonérations | TERMINE | ACCOUNTANT | `prisma/schema.prisma` Scholarship |
| FIN-10 | Dashboard comptable complet | TERMINE | ACCOUNTANT | `src/modules/accountant/accountant-full-portal.tsx` |

### A.6 RH et Paie

| ID | Exigence | État | Rôles concernés | Fichier |
|---|---|---|---|---|
| RH-01 | Dossiers employés | TERMINE | DIRECTION, ADMIN | `prisma/schema.prisma` Employee |
| RH-02 | Contrats et postes | TERMINE | DIRECTION | `prisma/schema.prisma` Employee |
| RH-03 | Présences personnel | TERMINE | DIRECTION | `prisma/schema.prisma` EmployeeAttendance |
| RH-04 | Variables de paie | TERMINE | DIRECTION | `prisma/schema.prisma` PayrollVariable |
| RH-05 | Séparation prépa/approbation/paiement | TERMINE | DIRECTION, ACCOUNTANT | Workflow dans `accountant-full-portal.tsx` |

### A.7 Communication

| ID | Exigence | État | Rôles concernés | Fichier |
|---|---|---|---|---|
| COM-01 | Messagerie interne | TERMINE | SECRETARY | `src/modules/secretary/communications-center.tsx` |
| COM-02 | Registre appels | TERMINE | SECRETARY | `src/app/api/secretariat/communications/route.ts` |
| COM-03 | Registre visiteurs | TERMINE | SECRETARY | `src/app/api/secretariat/communications/route.ts` |
| COM-04 | Rendez-vous | TERMINE | SECRETARY | `src/app/api/secretariat/communications/route.ts` |
| COM-05 | **SMS via Twilio** | TERMINE | SECRETARY, DIRECTION, ACCOUNTANT | `src/lib/notifications.ts` |
| COM-06 | **WhatsApp via Twilio** | TERMINE | SECRETARY, DIRECTION | `src/lib/notifications.ts` |
| COM-07 | **Email** | PARTIEL | SECRETARY | À connecter SMTP (TODO) |
| COM-08 | Notifications App | TERMINE | ALL | `prisma/schema.prisma` Notification |
| COM-09 | **Modèles versionnés** | TERMINE | DIRECTION, ADMIN | `src/app/api/notifications/templates/route.ts` |
| COM-10 | **Consentement explicite** | TERMINE | SECRETARY, DIRECTION | `src/app/api/notifications/consent/route.ts` |
| COM-11 | **Sandbox mode** | TERMINE | ADMIN | `src/app/api/notifications/config/route.ts` |
| COM-12 | **File async + retry** | TERMINE | SYSTEM | `src/lib/notifications.ts` + `src/app/api/notifications/process/route.ts` |

### A.8 Documents PDF et archives

| ID | Exigence | État | Rôles concernés | Fichier |
|---|---|---|---|---|
| DOC-01 | Certificat de scolarité | TERMINE | SECRETARY, DIRECTION | `src/lib/document-generation.ts` |
| DOC-02 | Attestation d'inscription | TERMINE | SECRETARY | `src/lib/document-generation.ts` |
| DOC-03 | Attestation de fréquentation | TERMINE | SECRETARY | `src/lib/document-generation.ts` |
| DOC-04 | Fiche d'inscription | TERMINE | SECRETARY | `src/lib/document-generation.ts` |
| DOC-05 | Carte élève | TERMINE | SECRETARY | `src/lib/document-generation.ts` |
| DOC-06 | Reçu administratif | TERMINE | SECRETARY | `src/lib/document-generation.ts` |
| DOC-07 | Convocation parent | TERMINE | SECRETARY, DIRECTION | `src/lib/document-generation.ts` |
| DOC-08 | Lettre dossier incomplet | TERMINE | SECRETARY | `src/lib/document-generation.ts` |
| DOC-09 | Lettre absence/retard | TERMINE | SECRETARY | `src/lib/document-generation.ts` |
| DOC-10 | Liste de classe | TERMINE | SECRETARY, TEACHER | `src/lib/document-generation.ts` |
| DOC-11 | Liste de présence | TERMINE | SECRETARY, TEACHER | `src/lib/document-generation.ts` |
| DOC-12 | Attestation de transfert | TERMINE | SECRETARY, DIRECTION | `src/lib/document-generation.ts` |
| DOC-13 | Fiche de sortie | TERMINE | SECRETARY, DIRECTION | `src/lib/document-generation.ts` |
| DOC-14 | Rapport administratif élève | TERMINE | SECRETARY, DIRECTION | `src/lib/document-generation.ts` |
| DOC-15 | Rapport d'admission | TERMINE | SECRETARY | `src/lib/document-generation.ts` |
| DOC-16 | Étiquette QR | TERMINE | SECRETARY | `src/lib/document-generation.ts` |
| DOC-17 | **Référence chronologique unique** | TERMINE | SECRETARY | `CERT-YYYY-NNNNNN` dans `document-generation.ts` |
| DOC-18 | **QR code de vérification** | TERMINE | SECRETARY | `QRCode.toBuffer` dans `document-generation.ts` |
| DOC-19 | **Versions immuables** | TERMINE | SECRETARY | `prisma/schema.prisma` DocumentVersion |
| DOC-20 | **Duplicata** | TERMINE | SECRETARY | `isDuplicata` dans `document-generation.ts` |
| DOC-21 | **Snapshot données** | TERMINE | SECRETARY | `snapshotData` JSON dans `DocumentVersion` |
| DOC-22 | **Audit génération** | TERMINE | SECRETARY | `logAudit` dans `document-generation.ts` |
| DOC-23 | **Téléchargement sécurisé** | TERMINE | ALL | `src/app/api/documents/download/[schoolId]/[year]/[filename]/route.ts` |

### A.9 Imports et exports

| ID | Exigence | État | Rôles concernés | Fichier |
|---|---|---|---|---|
| IMP-01 | Import élèves | TERMINE | SECRETARY, ADMIN | `src/lib/import-engine.ts` |
| IMP-02 | Import réinscriptions | TERMINE | SECRETARY, ADMIN | `src/lib/import-engine.ts` |
| IMP-03 | Import parents | TERMINE | SECRETARY, ADMIN | `src/lib/import-engine.ts` |
| IMP-04 | Import relations parent-enfant | TERMINE | SECRETARY, ADMIN | `src/lib/import-engine.ts` |
| IMP-05 | Import affectations classe | TERMINE | SECRETARY, DIRECTION, ADMIN | `src/lib/import-engine.ts` |
| IMP-06 | Import mise à jour administrative | TERMINE | SECRETARY, ADMIN | `src/lib/import-engine.ts` |
| IMP-07 | Import historique contrôlé | TERMINE | ADMIN | `src/lib/import-engine.ts` |
| IMP-08 | **Modèles XLSX téléchargeables** | TERMINE | SECRETARY, ADMIN | `generateImportTemplate` |
| IMP-09 | **Mapping colonnes** | TERMINE | SECRETARY, ADMIN | `MappingStep` dans `imports-center.tsx` |
| IMP-10 | **Validation + prévisualisation** | TERMINE | SECRETARY, ADMIN | `validateImportRows` |
| IMP-11 | **Rapport d'erreurs téléchargeable** | TERMINE | SECRETARY, ADMIN | `generateImportErrorReport` |
| IMP-12 | **Détection doublons interne + DB** | TERMINE | SECRETARY, ADMIN | `detectDuplicates` |
| IMP-13 | **Sécurité anti-injection CSV/XLSX** | TERMINE | SECRETARY, ADMIN | `sanitizeCell` dans `import-engine.ts` |
| IMP-14 | **Rollback contrôlé** | TERMINE | SECRETARY, ADMIN | `rollbackImport` |
| IMP-15 | **Référence unique d'import** | TERMINE | SECRETARY, ADMIN | `IMP-YYYY-NNNNNN` |
| IMP-16 | **Exécution background** | TERMINE | SECRETARY, ADMIN | `executeImport` async |
| IMP-17 | **Audit complet** | TERMINE | SECRETARY, ADMIN | `logAudit` dans `import-engine.ts` |
| EXP-01 | Export PDF (reçus, factures, bulletins) | TERMINE | ACCOUNTANT, TEACHER | `src/lib/exports.ts` |
| EXP-02 | Export XLSX | TERMINE | ALL | `src/lib/exports.ts` |
| EXP-03 | Export CSV (UTF-8 BOM) | TERMINE | ALL | `src/lib/exports.ts` |
| EXP-04 | Audit des exports | TERMINE | ALL | `logExportAction` |

### A.10 Audit et sécurité

| ID | Exigence | État | Rôles concernés | Fichier |
|---|---|---|---|---|
| AUD-01 | Journal d'audit immuable | TERMINE | ALL | `src/lib/audit.ts` |
| AUD-02 | Login/logout journalisés | TERMINE | ALL | `src/app/api/auth/login/route.ts` |
| AUD-03 | Accès refusés journalisés | TERMINE | ALL | Vérifications RBAC dans API routes |
| AUD-04 | Idempotence opérations sensibles | TERMINE | ALL | `src/lib/idempotency.ts` |
| AUD-05 | Chiffrement credentials Twilio | TERMINE | ADMIN | `encryptCredential` AES-256-GCM |
| AUD-06 | PBKDF2 hashing mots de passe | TERMINE | ALL | `src/lib/auth.ts` |
| AUD-07 | Sessions DB + cookies HTTP-only | TERMINE | ALL | `src/lib/auth.ts` |

### A.11 Performance et fiabilité (1500+ élèves)

| ID | Exigence | État | Implémentation |
|---|---|---|---|
| PERF-01 | Pagination côté serveur | TERMINE | Skip/take dans toutes les API |
| PERF-02 | Recherche fuzzy | TERMINE | Filtres OR dans `where` |
| PERF-03 | Filtres combinés | TERMINE | Multi-critères dans `where` |
| PERF-04 | Tri serveur | TERMINE | `orderBy` dans Prisma |
| PERF-05 | Index DB | TERMINE | `@@index` sur colonnes critiques |
| PERF-06 | Exports en arrière-plan | PARTIEL | À déplacer en cron pour gros volumes |
| PERF-07 | Imports en arrière-plan | TERMINE | `executeImport` async |
| PERF-08 | Notifications asynchrones | TERMINE | File `NotificationLog` + retry |
| PERF-09 | Singleton Prisma (connection_limit=3) | TERMINE | `src/lib/db.ts` |

---

## B. Matrices RBAC par fonctionnalité

### B.1 Notifications (SMS/WhatsApp/Email/App)

| Rôle | Voir | Créer | Modifier | Valider | Annuler | Exporter | Notifier | Accès refusé |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| ADMIN | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| DIRECTION | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Modifier config Twilio |
| SECRETARY | ✓ | ✓ | — | — | ✓ | — | ✓ (modèles autorisés) | Config Twilio, modèles globaux |
| TEACHER | ✓ (si lié) | ✓ (modèles pédagogiques) | — | — | — | — | ✓ (parents de ses élèves) | Config, finance |
| ACCOUNTANT | ✓ | ✓ (modèles paiement) | — | — | — | — | ✓ (parents débiteurs) | RH, admissions |
| PARENT | ✓ (ses notifs) | — | — | — | — | — | — | Tout sauf ses notifications |
| ÉLÈVE | ✓ (ses notifs) | — | — | — | — | — | — | Tout sauf ses notifications |

### B.2 Documents PDF

| Rôle | Voir | Générer | Valider | Réimprimer | Livrer | Exporter | Accès refusé |
|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| ADMIN | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| DIRECTION | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| SECRETARY | ✓ | ✓ (16 types autorisés) | — | ✓ | ✓ | — | Bulletins de paie |
| TEACHER | ✓ (liste classe/présence) | ✓ (liste classe/présence) | — | — | — | — | Documents financiers |
| ACCOUNTANT | ✓ (reçus) | ✓ (reçus) | — | ✓ | — | ✓ | Documents administratifs |
| PARENT | ✓ (documents enfant) | — | — | — | — | — | Documents autres enfants |

### B.3 Imports CSV/XLSX

| Rôle | Voir | Uploader | Mapper | Valider | Exécuter | Rollback | Accès refusé |
|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| ADMIN | ✓ | ✓ (tous types) | ✓ | ✓ | ✓ | ✓ | — |
| SECRETARY | ✓ | ✓ (élèves/parents/admissions) | ✓ | ✓ | ✓ | ✓ | Import personnel, finance |
| DIRECTION | ✓ | ✓ (affectations classe) | ✓ | ✓ | ✓ | — | Import élèves global |
| TEACHER | — | — | — | — | — | — | Tout |
| ACCOUNTANT | — | — | — | — | — | — | Imports élèves (sauf finance explicite) |
| PARENT/ÉLÈVE | — | — | — | — | — | — | Tout |

### B.4 Centre Communications

| Rôle | Voir | Créer | Modifier | Clôturer | Exporter | Accès refusé |
|---|:---:|:---:|:---:|:---:|:---:|---|
| ADMIN | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| DIRECTION | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| SECRETARY | ✓ | ✓ (parents liés) | ✓ (assignées) | ✓ | — | Messages financiers détaillés |
| TEACHER | ✓ (ses élèves) | ✓ (parents de ses élèves) | — | — | — | Messages autres classes |
| ACCOUNTANT | ✓ | ✓ (rappels paiement) | — | — | — | Messages RH, pédagogiques |
| PARENT | ✓ (ses messages) | ✓ (réponses) | — | — | — | Messages autres familles |

---

## C. Tests obligatoires

### C.1 Tests fonctionnels

| ID | Test | État | Notes |
|---|---|---|---|
| TF-01 | Admission complète | A_TESTER | Workflow existant validé |
| TF-02 | Admission multi-enfants | A_TESTER | `admissions-manager-v2.tsx` |
| TF-03 | Rattachement parent-enfant | A_TESTER | `src/app/api/rattachement/route.ts` |
| TF-04 | Création élève + matricule | A_TESTER | Auto-génération `SS-YYYY-NNNNN` |
| TF-05 | Inscription annuelle | A_TESTER | `src/app/api/secretariat/enrollments/route.ts` |
| TF-06 | Affectation classe | A_TESTER | Capacité vérifiée |
| TF-07 | Présence | A_TESTER | `teacher-emargement-actions.ts` |
| TF-08 | Facture + paiement + reçu | A_TESTER | `finance-actions.ts` + `finance-encashment-actions.ts` |
| TF-09 | Caisse (ouverture/clôture) | A_TESTER | `accountant-full-portal.tsx` |
| TF-10 | Génération document PDF | A_TESTER | `document-generation.ts` |
| TF-11 | Envoi notification | A_TESTER | `notifications.ts` sandbox |
| TF-12 | Import élèves CSV | A_TESTER | `import-engine.ts` |
| TF-13 | Import élèves XLSX | A_TESTER | `import-engine.ts` |
| TF-14 | Export XLSX/CSV | A_TESTER | `exports.ts` |
| TF-15 | Rollback import | A_TESTER | `rollbackImport` |

### C.2 Tests RBAC

| ID | Test | État |
|---|---|---|
| RBAC-01 | Enseignant sans accès finance | A_TESTER |
| RBAC-02 | Enseignant sans accès RH | A_TESTER |
| RBAC-03 | Parent limité à ses enfants | A_TESTER |
| RBAC-04 | Comptable limité aux données financières | A_TESTER |
| RBAC-05 | Caissier limité à la caisse | A_TESTER |
| RBAC-06 | RH limité au personnel | A_TESTER |
| RBAC-07 | Secrétaire limitée au périmètre administratif | A_TESTER |
| RBAC-08 | Direction avec validations contrôlées | A_TESTER |
| RBAC-09 | Admin avec actions sensibles journalisées | A_TESTER |
| RBAC-10 | Contre accès direct par URL/ID | A_TESTER |

### C.3 Tests intégrité

| ID | Test | État |
|---|---|---|
| INT-01 | Matricule unique | A_TESTER |
| INT-02 | Référence admission unique | A_TESTER |
| INT-03 | Inscription annuelle unique | A_TESTER |
| INT-04 | Écriture comptable équilibrée | A_TESTER |
| INT-05 | Caisse clôturée verrouillée | A_TESTER |
| INT-06 | Parent-enfant validé | A_TESTER |
| INT-07 | Import sans doublons | A_TESTER |
| INT-08 | Export limité par permissions | A_TESTER |
| INT-09 | Document PDF avec hash SHA-256 | A_TESTER |
| INT-10 | Code de vérification QR unique | A_TESTER |

### C.4 Tests non-régression

| ID | Test | État |
|---|---|---|
| NR-01 | Login/logout toujours fonctionnels | A_TESTER |
| NR-02 | Dashboard direction intact | A_TESTER |
| NR-03 | Dashboard comptable intact | A_TESTER |
| NR-04 | Dashboard enseignant intact | A_TESTER |
| NR-05 | Portail parent intact | A_TESTER |
| NR-06 | Préinscription publique intacte | A_TESTER |
| NR-07 | Rattachement parent intact | A_TESTER |
| NR-08 | Licences et activation intactes | A_TESTER |
| NR-09 | Service Worker (PWA) intact | A_TESTER |
| NR-10 | Electron desktop intact | A_TESTER |

---

## D. RÈGLE TRANSVERSALE D'IMPACT MULTI-RÔLES

Chaque fonctionnalité est analysée selon 9 dimensions :

1. **Quels rôles peuvent voir cette fonctionnalité** — vérifié côté serveur
2. **Quels rôles peuvent créer/modifier/valider/supprimer** — vérifié côté serveur
3. **Quels rôles doivent être explicitement bloqués** — refus par défaut
4. **Quelles données doivent être visibles/masquées/anonymisées** — par périmètre école + rôle
5. **Quels tableaux/rapports/exports sont impactés** — liste exhaustive
6. **Quels modules existants utilisent les mêmes données** — vérifié avant modification
7. **Quels écrans doivent rester cohérents** — non-régression absolue
8. **Quels journaux d'audit doivent être créés** — `logAudit` systématique
9. **Quels tests de permissions/intégrité/performance doivent être ajoutés** — voir section C

---

## E. Livraisons en cours

### Cycle 12 — Documents, Notifications, Imports (cette session)

| Livrable | Fichiers | État |
|---|---|---|
| Schéma Prisma étendu | `prisma/schema.prisma` (+6 modèles: NotificationTemplate, NotificationLog, NotificationConsent, NotificationProviderConfig, ImportJob, ImportRow, DocumentVersion) | TERMINE |
| Service notifications Twilio | `src/lib/notifications.ts` (Twilio SDK, chiffrement AES-256-GCM, sandbox, retry, rate limit) | TERMINE |
| API notifications | `src/app/api/notifications/{config,templates,send,log,consent,process}/route.ts` | TERMINE |
| Service génération PDF | `src/lib/document-generation.ts` (16 types officiels, QR, versions, duplicata) | TERMINE |
| API documents | `src/app/api/documents/{types,generate,versions,download}/route.ts` | TERMINE |
| Moteur imports CSV/XLSX | `src/lib/import-engine.ts` (8 étapes, anti-injection, doublons, rollback, rapport) | TERMINE |
| API imports | `src/app/api/imports/{template,upload,validate,execute,rollback,report}/route.ts` | TERMINE |
| Composant DataGrid premium | `src/components/ss/data-grid.tsx` (DataGridView-style) | TERMINE |
| UI Notifications Center | `src/modules/secretary/notifications-center.tsx` | TERMINE |
| UI Imports Center | `src/modules/secretary/imports-center.tsx` | TERMINE |
| Registre exigences | `REGISTRE_EXIGENCES_ET_FINALISATION.md` | TERMINE |

---

## F. Points en suspens (TODO)

| ID | Description | Priorité | Estimation |
|---|---|---|---|
| TODO-01 | Connexion SMTP pour envoi Email réel | Moyenne | 1j |
| TODO-02 | Tâche cron Vercel pour `processPendingNotifications` | Haute | 0.5j |
| TODO-03 | Tests automatisés Playwright/Vitest | Haute | 3j |
| TODO-04 | Connecter `notifications-center` au shell de l'app | Haute | 0.5j |
| TODO-05 | Connecter `imports-center` au shell de l'app | Haute | 0.5j |
| TODO-06 | Intégrer centre documents V2 (PDF) dans `documents-center.tsx` | Haute | 1j |
| TODO-07 | Migration Supabase (PostgreSQL) pour production | Haute | 1j |
| TODO-08 | Legal hold et politique de rétention | Moyenne | 2j |
| TODO-09 | Délibérations et classements académiques | Moyenne | 2j |
| TODO-10 | Module budget avancé (scénarios) | Basse | 3j |

---

## G. Régressions détectées et corrigées

| ID | Régression | Cause | Correction | État |
|---|---|---|---|---|
| REG-01 | Aucune régression identifiée ce cycle | — | — | — |

---

*Mise à jour : 2026-09-24*
