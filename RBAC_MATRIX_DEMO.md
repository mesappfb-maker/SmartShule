# MATRICE RBAC — 14 RÔLES STRICTS

> SmartShule — Système de gestion scolaire
> Conforme directive MASTER PROMPT §5 — RBAC strict, refus par défaut
> Vérifications côté serveur sur toutes les actions

## Rôles

| # | Rôle | Code | Dashboard | Périmètre |
|---|---|---|---|---|
| 1 | Super administrateur système | SYSTEM_ADMIN | Système | Configuration, licences, support |
| 2 | Administrateur établissement | SCHOOL_ADMIN | Établissement | Setup école, référentiels, audit |
| 3 | Directeur | DIRECTOR | Direction | Pilotage, validations, décisions |
| 4 | Promoteur / propriétaire | PROMOTER | Stratégie | Lecture KPIs, grandes décisions |
| 5 | Secrétaire | SECRETARY | Secrétariat | Admissions, élèves, documents, comms |
| 6 | Agent d'admission | ADMISSIONS_OFFICER | Admissions | Création/soumission admissions |
| 7 | Comptable | ACCOUNTANT | Finance | Écritures, budgets, rapports |
| 8 | Caissier | CASHIER | Caisse | Encaissements, reçus, clôture |
| 9 | Responsable RH | HR_MANAGER | RH | Personnel, contrats, présences |
| 10 | Responsable paie | PAYROLL_OFFICER | Paie | Calcul, validation, paiement |
| 11 | Enseignant | TEACHER | Pédagogique | Ses classes, matières, élèves |
| 12 | Parent / tuteur | PARENT | Parent | Ses enfants liés uniquement |
| 13 | Élève | STUDENT | Élève | Ses propres données |
| 14 | Auditeur | AUDITOR | Audit | Lecture journaux, traces, rapports |

---

## Matrice détaillée par module

### Module : Administration système

| Rôle | Voir | Créer | Modifier | Valider | Supprimer | Audit | Accès refusé |
|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| SYSTEM_ADMIN | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Données élèves sensibles sans justification |
| SCHOOL_ADMIN | ✓ | ✓ | ✓ | — | — | ✓ | Licences, config système global |
| DIRECTOR | — | — | — | — | — | — | Config système |
| SECRETARY | — | — | — | — | — | — | Tout |
| TEACHER | — | — | — | — | — | — | Tout |
| PARENT/STUDENT | — | — | — | — | — | — | Tout |

### Module : Direction

| Rôle | Voir | Créer | Modifier | Valider | Annuler | Exporter | Accès refusé |
|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| DIRECTOR | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Config système |
| PROMOTER | ✓ | — | — | ✓* | — | ✓ | Modifications opérationnelles |
| SCHOOL_ADMIN | ✓ | — | ✓ | — | — | ✓ | Validations direction |
| SECRETARY | — | — | — | — | — | — | Dashboard direction |
| ACCOUNTANT | — | — | — | — | — | — | Dashboard direction |
| TEACHER | — | — | — | — | — | — | Dashboard direction |

*Promoteur valide seulement les grandes décisions (dépenses > seuil)

### Module : Secrétariat (hub central)

| Rôle | Voir | Créer | Modifier | Valider | Annuler | Imprimer | Exporter | Accès refusé |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| SECRETARY | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | Config Twilio, finance |
| ADMISSIONS_OFFICER | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | Documents financiers |
| DIRECTOR | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| SCHOOL_ADMIN | ✓ | — | ✓ | — | — | ✓ | ✓ | Création admissions |
| TEACHER | — | — | — | — | — | — | — | Secrétariat |
| PARENT | — | — | — | — | — | — | — | Secrétariat (sauf portail parent) |

### Module : Finance / Comptabilité

| Rôle | Voir | Créer | Modifier | Valider | Annuler | Exporter | Accès refusé |
|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| ACCOUNTANT | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Contrats RH, notes élèves |
| CASHIER | ✓ (caisse) | ✓ (encaissements) | ✓ (caisse) | — | — | ✓ (caisse) | Budget, rapprochement banque, écritures comptables |
| DIRECTOR | ✓ | — | — | ✓ | ✓ | ✓ | Saisie écritures |
| PROMOTER | ✓ (synthèse) | — | — | ✓* | — | ✓ | Saisie, modification |
| HR_MANAGER | — | — | — | — | — | — | Finance (sauf variables paie) |
| TEACHER | — | — | — | — | — | — | Tout finance |
| PARENT | ✓ (ses factures) | — | — | — | — | ✓ (ses reçus) | Factures autres familles |

### Module : Caisse

| Rôle | Voir | Créer | Modifier | Clôturer | Ajuster | Exporter | Accès refusé |
|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| CASHIER | ✓ | ✓ | ✓ | ✓ | — | ✓ | Rapprochement, écritures |
| ACCOUNTANT | ✓ | — | ✓ | — | ✓ | ✓ | Encaissements directs |
| DIRECTOR | ✓ | — | — | — | ✓ | ✓ | Encaissements |
| HR_MANAGER | — | — | — | — | — | — | Caisse |
| TEACHER | — | — | — | — | — | — | Caisse |

### Module : RH / Paie

| Rôle | Voir | Créer | Modifier | Valider | Payer | Rapprocher | Accès refusé |
|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| HR_MANAGER | ✓ | ✓ | ✓ | ✓ (variables) | — | — | Écritures comptables, paiement |
| PAYROLL_OFFICER | ✓ | ✓ | ✓ | ✓ (paie) | ✓ | ✓ | Contrats, présences personnel |
| ACCOUNTANT | ✓ (écritures) | ✓ (écritures) | ✓ (écritures) | — | — | ✓ | Contrats, variables paie |
| DIRECTOR | ✓ | — | — | ✓ (paie) | — | — | Saisie variables |
| CASHIER | — | — | — | — | ✓ (exécution) | — | Contrats, calcul paie |
| TEACHER | — | — | — | — | — | — | RH (sauf ses propres données) |
| PARENT/STUDENT | — | — | — | — | — | — | RH |

### Module : Académique (notes, présences, bulletins)

| Rôle | Voir | Créer | Modifier | Publier | Exporter | Accès refusé |
|---|:---:|:---:|:---:|:---:|:---:|---|
| TEACHER | ✓ (ses classes) | ✓ (ses matières) | ✓ (ses notes) | ✓ (ses bulletins) | ✓ (ses classes) | Autres classes, finance |
| DIRECTOR | ✓ | — | — | ✓ (validation) | ✓ | Saisie notes |
| SECRETARY | ✓ (lecture) | — | — | — | ✓ | Saisie notes |
| STUDENT | ✓ (ses notes) | — | — | — | — | Notes autres élèves |
| PARENT | ✓ (ses enfants) | — | — | — | — | Notes autres enfants |
| ACCOUNTANT | — | — | — | — | — | Académique |

### Module : Documents PDF

| Rôle | Voir | Générer | Valider | Réimprimer | Livrer | Exporter | Accès refusé |
|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| SECRETARY | ✓ | ✓ (16 types) | — | ✓ | ✓ | — | Bulletins paie |
| DIRECTION | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| TEACHER | ✓ | ✓ (liste classe/présence) | — | — | — | — | Documents financiers |
| ACCOUNTANT | ✓ | ✓ (reçus) | — | ✓ | — | ✓ | Documents admin autres |
| PARENT | ✓ (ses enfants) | — | — | — | — | — | Documents autres enfants |
| STUDENT | ✓ (ses docs) | — | — | — | — | — | Documents autres |

### Module : Imports CSV/XLSX

| Rôle | Voir | Uploader | Mapper | Valider | Exécuter | Rollback | Accès refusé |
|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| SCHOOL_ADMIN | ✓ | ✓ (tous) | ✓ | ✓ | ✓ | ✓ | — |
| SECRETARY | ✓ | ✓ (élèves/parents) | ✓ | ✓ | ✓ | ✓ | Imports personnel, finance |
| DIRECTOR | ✓ | ✓ (affectations) | ✓ | ✓ | ✓ | — | Imports élèves global |
| ADMISSIONS_OFFICER | ✓ | ✓ (admissions) | ✓ | ✓ | ✓ | — | Imports RH, finance |
| ACCOUNTANT | — | — | — | — | — | — | Imports élèves |
| HR_MANAGER | ✓ | ✓ (personnel) | ✓ | ✓ | ✓ | — | Imports élèves, finance |
| TEACHER | — | — | — | — | — | — | Tout |
| PARENT/STUDENT | — | — | — | — | — | — | Tout |

### Module : Notifications

| Rôle | Voir | Envoyer | Modifier modèles | Configurer | Consentement | Accès refusé |
|---|:---:|:---:|:---:|:---:|:---:|---|
| SECRETARY | ✓ | ✓ (modèles autorisés) | — | — | ✓ | Config Twilio |
| DIRECTION | ✓ | ✓ (urgences) | ✓ | — | ✓ | Config Twilio |
| SCHOOL_ADMIN | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| TEACHER | ✓ (ses élèves) | ✓ (modèles pédago) | — | — | — | Config, finance |
| ACCOUNTANT | ✓ | ✓ (rappels paiement) | — | — | — | RH, admissions |
| PARENT | ✓ (ses notifs) | — | — | — | ✓ (ses canaux) | Notifications autres |
| STUDENT | ✓ (ses notifs) | — | — | — | — | Notifications autres |

### Module : Audit

| Rôle | Voir | Exporter | Anonymiser | Purger | Accès refusé |
|---|:---:|:---:|:---:|:---:|---|
| AUDITOR | ✓ | ✓ | — | — | Toute modification |
| SYSTEM_ADMIN | ✓ | ✓ | ✓ | ✓ | Données sensibles sans justification |
| SCHOOL_ADMIN | ✓ | ✓ | — | — | Purge, anonymisation |
| DIRECTOR | ✓ (lecture) | ✓ (rapports) | — | — | Purge, anonymisation |
| ACCOUNTANT | ✓ (finance) | ✓ | — | — | Audit RH, académique |
| HR_MANAGER | ✓ (RH) | ✓ | — | — | Audit finance, académique |
| TEACHER | — | — | — | — | Audit (sauf ses actions) |

---

## Règles fondamentales RBAC

1. **Refus par défaut** : toute action non explicitement autorisée est refusée
2. **Vérification serveur** : jamais seulement côté client (bouton masqué ≠ permission)
3. **Périmètre école** : un utilisateur ne voit que les données de son école
4. **Périmètre classe** : un enseignant ne voit que ses classes/matières
5. **Périmètre famille** : un parent ne voit que ses enfants liés
6. **Périmètre personnel** : un employé ne voit que ses propres données
7. **Pas de contournement** : vérification sur URL, API, export, recherche, identifiant
8. **Audit systématique** : toute action sensible est journalisée
9. **Séparation des rôles** : paie = préparation ≠ approbation ≠ paiement ≠ rapprochement
10. **Comptes démo** : `isDemoAccount = true`, jamais en production

---

## Comptes démo (14 rôles)

Tous les comptes démo utilisent le mot de passe : `Demo2026!`

| Rôle | Email | DisplayName |
|---|---|---|
| SYSTEM_ADMIN | sysadmin@demo.smartshule.com | Super Admin Démo |
| SCHOOL_ADMIN | schooladmin@demo.smartshule.com | Admin École Démo |
| DIRECTOR | director@demo.smartshule.com | Directeur Démo |
| PROMOTER | promoter@demo.smartshule.com | Promoteur Démo |
| SECRETARY | secretary@demo.smartshule.com | Secrétaire Démo |
| ADMISSIONS_OFFICER | admissions@demo.smartshule.com | Agent Admission Démo |
| ACCOUNTANT | accountant@demo.smartshule.com | Comptable Démo |
| CASHIER | cashier@demo.smartshule.com | Caissier Démo |
| HR_MANAGER | hrmanager@demo.smartshule.com | RH Démo |
| PAYROLL_OFFICER | payroll@demo.smartshule.com | Paie Démo |
| TEACHER | teacher@demo.smartshule.com | Enseignant Démo |
| PARENT | parent@demo.smartshule.com | Parent Démo |
| STUDENT | student@demo.smartshule.com | Élève Démo |
| AUDITOR | auditor@demo.smartshule.com | Auditeur Démo |

⚠️ **Sécurité** : ces comptes sont marqués `isDemoAccount = true`, jamais créés en production.

---

## Mapping anciens rôles → nouveaux rôles

Pour préserver la non-régression, les anciens codes restent compatibles :

| Ancien rôle | Nouveau rôle équivalent | Notes |
|---|---|---|
| ADMIN | SYSTEM_ADMIN | Config système |
| DIRECTION | DIRECTOR | Pilotage |
| SECRETARY | SECRETARY | Inchangé |
| TEACHER | TEACHER | Inchangé |
| ACCOUNTANT | ACCOUNTANT | Inchangé |
| CASHIER | CASHIER | Nouveau (séparé d'ACCOUNTANT) |
| PARENT | PARENT | Inchangé |
| STUDENT | STUDENT | Inchangé |
| SERVER | SYSTEM_ADMIN | Migration automatique |

Les API existantes qui vérifient `user.role === 'ADMIN'` ou `'DIRECTION'` continuent de fonctionner (compatibilité descendante).

---

*Mise à jour : 2026-09-24*
