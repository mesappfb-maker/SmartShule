# DOSSIER ÉLÈVE — Architecture et RBAC

> Le dossier élève est le cœur central du système. Chaque rôle ne voit que ce dont il a besoin.

---

## 1. Structure du dossier (9 sections)

| Section | Description | Données incluses |
|---|---|---|
| IDENTITE_STATUT | Identité et statut scolaire | Matricule, nom, naissance, photo, statut, classe, famille |
| ACADEMIQUE | Parcours et résultats | Inscriptions, notes, moyennes, bulletins, présences, IQA |
| VIE_SCOLAIRE | Discipline et vie quotidienne | Incidents, sanctions, encouragements |
| FINANCIER | Situation financière | Factures, reçus, bourses, solde, échéances |
| DOCUMENTS | Documents de l'élève | Documents admin, certificats, bulletins, reçus |
| COMMUNICATIONS | Messages et échanges | Messages, annonces, statut livraison |
| SANTE_URGENCE | Santé (sensible) | Groupe sanguin, allergies, contacts urgence |
| TRANSFERTS_SORTIES | Mouvements | Transferts entrants/sortants, retraits, réintégrations |
| AUDIT | Traçabilité | Consultations, modifications, exports |

---

## 2. Matrice RBAC par section et rôle

### Légende
- ✅ Lecture/écriture
- 👁️ Lecture seule
- 📊 Résumé seulement (summaryOnly)
- 🔒 Champs masqués (maskSensitive)
- ❌ Aucun accès
- 👨‍👩‍👧 Propre enfant seulement

| Section | DIRECTOR | SECRETARY | ACCOUNTANT | CASHIER | TEACHER | PARENT | STUDENT | AUDITOR | HR |
|---|---|---|---|---|---|---|---|---|---|
| IDENTITE_STATUT | ✅ | ✅ | 👁️🔒 | 👁️🔒 | 👁️🔒 | 👁️ | 👁️ | 👁️🔒 | ❌ |
| ACADEMIQUE | ✅ | ✅ | ❌ | ❌ | ✅* | 👁️ | 👁️ | 👁️ | ❌ |
| VIE_SCOLAIRE | ✅ | ✅ | ❌ | ❌ | ✅*📊 | 👁️📊 | 👁️📊 | 👁️ | ❌ |
| FINANCIER | ✅ | 👁️📊 | ✅ | ✅ | ❌ | 👁️ | ❌ | 👁️ | ❌ |
| DOCUMENTS | ✅ | ✅ | ✅ | 👁️📊 | 👁️📊 | 👁️ | 👁️ | 👁️ | ❌ |
| COMMUNICATIONS | ✅ | ✅ | 👁️📊 | ❌ | ✅* | ✅ | ✅ | 👁️ | ❌ |
| SANTE_URGENCE | ✅ | 👁️📊🔒 | ❌ | ❌ | ❌ | ✅ | 👁️📊 | ❌ | ❌ |
| TRANSFERTS_SORTIES | ✅ | ✅ | 👁️📊 | ❌ | ❌ | 👁️ | ❌ | 👁️ | ❌ |
| AUDIT | 👁️ | ❌ | 👁️ | ❌ | ❌ | ❌ | ❌ | 👁️ | ❌ |

*TEACHER : seulement si assigné à la classe de l'élève

### Permissions globales

| Rôle | canExport | canPrint | canSeeAuditTrail |
|---|---|---|---|
| DIRECTOR | ✅ | ✅ | ✅ |
| SECRETARY | ✅ | ✅ | ❌ |
| ACCOUNTANT | ✅ | ✅ | ❌ |
| CASHIER | ✅ | ✅ | ❌ |
| TEACHER | ❌ | ✅ | ❌ |
| PARENT | ✅ | ✅ | ❌ |
| STUDENT | ❌ | ✅ | ❌ |
| AUDITOR | ✅ | ✅ | ✅ |
| HR_MANAGER | ❌ | ❌ | ❌ |

---

## 3. Fichiers livrés

| Fichier | Rôle |
|---|---|
| `src/lib/student-folder-rbac.ts` | Service RBAC central (permissions par section/role) |
| `src/app/api/students/[id]/folder/route.ts` | API dossier structuré filtré par rôle |
| `scripts/run-student-folder-tests.ts` | 14 tests RBAC |

---

## 4. Règles de sécurité

1. **Refus par défaut** : toute section non explicitement autorisée = masquée
2. **Vérification serveur** : permissions calculées côté API, jamais côté client
3. **Champs masqués** : phone, email, address masqués pour TEACHER/CASHIER/ACCOUNTANT
4. **Summary only** : SECRETARY voit FINANCIER en résumé (pas de détails)
5. **Parent isolation** : PARENT ne voit QUE ses enfants liés (GuardianStudentLink)
6. **Teacher isolation** : TEACHER ne voit QUE les élèves de ses classes (TeacherAssignment)
7. **Audit systématique** : chaque consultation du dossier est journalisée
8. **Santé protégée** : SANTE_URGENCE masquée pour TEACHER, CASHIER, ACCOUNTANT, HR, AUDITOR

---

## 5. Tests (14/14 PASS)

| ID | Test | Vérifie |
|---|---|---|
| DF-01 | DIRECTOR voit 9 sections | Accès complet direction |
| DF-02 | SECRETARY ne voit pas AUDIT | canSeeAuditTrail=false |
| DF-03 | ACCOUNTANT ne voit pas ACADEMIQUE/SANTE | Isolation financière |
| DF-04 | CASHIER limité à caisse | Pas de notes, santé, audit |
| DF-05 | TEACHER ne voit pas FINANCIER/SANTE | Règle critique |
| DF-06 | TEACHER non assigné = aucun accès | Isolation par classe |
| DF-07 | PARENT ne voit que son enfant | Isolation familiale |
| DF-08 | STUDENT ne voit pas FINANCIER global | Pas de détails financiers |
| DF-09 | AUDITOR ne voit pas SANTE | Santé protégée |
| DF-10 | HR n'a aucun accès | Isolation RH |
| DF-11 | maskSensitiveFields | Masquage champs |
| DF-12 | ADMIN a tout accès | Super admin |
| DF-13 | SECRETARY SANTE summary + masquage | Accès limité santé |
| DF-14 | TEACHER écrit notes, pas identité | Permissions granulaires |

---

*Mise à jour : 2026-09-25*
