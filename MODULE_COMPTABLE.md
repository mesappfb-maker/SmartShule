# MODULE COMPTABLE SCOLAIRE PROFESSIONNEL — Documentation

> SmartShule — Module Finance & Comptabilité complet
> Conçu pour gérer une école de 2000+ élèves

---

## 1. Liste des fonctionnalités livrées

### A. Dashboard comptable (`/api/accountant/dashboard`)

**25 KPI cliquables** avec données réelles :

| KPI | Description | Source |
|---|---|---|
| Élèves actifs | Count students ACTIVE | `db.student.count` |
| Élèves facturés | Students with invoices | `db.invoice.groupBy` |
| Élèves débiteurs | Students with unpaid invoices | `db.invoice.groupBy` |
| Total facturé | Sum totalAmountCents | `db.invoice.aggregate` |
| Total encaissé | Sum paidAmountCents | `db.invoice.aggregate` |
| Total impayé | Facturé - Encaissé | Calcul |
| Taux recouvrement | % encaissé/facturé | Calcul |
| Recettes du jour | Receipts today | `db.receipt.aggregate` |
| Recettes du mois | Receipts this month | `db.receipt.aggregate` |
| Dépenses du jour | Expenses today | `db.expense.aggregate` |
| Dépenses du mois | Expenses this month | `db.expense.aggregate` |
| Solde caisse | Cash in - Cash out | `db.receipt + db.expense` |
| Écart caisse | Variance simulée | Configurable |
| Solde bancaire | Cumul simulé | Configurable |
| Transactions non rapprochées | BANK + MOBILE_MONEY | `db.receipt.count` |
| Factures échues | dueDate < now | `db.invoice.count` |
| Dépenses à approuver | PENDING | `db.expense.aggregate` |
| Budget consommé | % vs total | `db.expense.aggregate` |
| Budget dépassé | consumed > total | Calcul |
| Masse salariale prévue | employees × avg salary | Calcul |
| Masse salariale payée | 80% de prévue | Simulé |
| Paie en attente | Prévue - Payée | Calcul |
| Employés actifs | Count | `db.employee.count` |
| Enseignants | Count globalRole=ENSEIGNANT | `db.employee.count` |
| Personnel administratif | Count ADMINISTRATIF+DIRECTION | `db.employee.count` |
| Alertes financières | CRITICAL/HIGH/MEDIUM | Calcul automatique |

### B. Fonctionnalités financières

1. **Frais et tarification** — `InvoiceLineConfig` (8 types : inscription, minerval, examen, carte, transport, cantine, laboratoire)
2. **Facturation** — 96 factures démo avec statuts variés (PAID, PARTIALLY_PAID, UNPAID)
3. **Paiements et encaissements** — 86 reçus (CASH, BANK, MOBILE_MONEY)
4. **Reçus PDF** — QR code + signature HMAC-SHA256 (anti-falsification)
5. **Impayés et recouvrement** — 10 factures échues détectées
6. **Caisse** — Solde calculé (entrées - sorties)
7. **Dépenses** — 8 dépenses (PENDING, APPROVED, REFUSED)
8. **Budget** — Consommation vs total annuel
9. **RH & Paie** — 27 employés, masse salariale calculée
10. **Comptabilité générale** — JournalEntry, ChartOfAccount, JournalEntryLine

### C. Données démo

| Donnée | Quantité |
|---|---|
| Élèves | 100 (10 classes × 10) |
| Parents/tuteurs | 85 |
| Employés | 27 (2 dir, 3 sec, 2 fin, 2 RH, 12 ens, 6 soutien) |
| Factures | 96 (45 payées, 15 partielles, 10 impayées, 5 remise) |
| Reçus | 86 (CASH + MOBILE_MONEY + BANK) |
| Dépenses | 8 (2 PENDING, 5 APPROVED, 1 REFUSED) |
| Notes | 460 |
| Bulletins | 50 |
| Cours | 78 |
| Affectations enseignants | 78 |
| Admissions | 19 (4 SUBMITTED, 4 INCOMPLETE, 2 DUPLICATE, 2 TRANSMITTED, 5 ACCEPTED, 2 REFUSED) |

---

## 2. Matrice RBAC Finance

| Rôle | Voir KPI | Encaisser | Facturer | Valider dépense | Rapprocher banque | Voir paie | Exporter | Accès refusé |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| COMPTABLE | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | RH contrat |
| CAISSIER | ✓ (caisse) | ✓ | — | — | — | — | ✓ (caisse) | Budget, écritures |
| DIRECTOR | ✓ | — | — | ✓ | — | ✓ (lecture) | ✓ | Saisie écritures |
| PROMOTER | ✓ (synthèse) | — | — | ✓* | — | ✓ (lecture) | ✓ | Saisie |
| SECRETARY | — | — | — | — | — | — | — | Finance complet |
| HR_MANAGER | — | — | — | — | — | — | — | Finance élèves |
| TEACHER | — | — | — | — | — | — | — | Tout finance |
| PARENT | ✓ (ses factures) | — | — | — | — | — | ✓ (ses reçus) | Autres familles |
| AUDITOR | ✓ (lecture) | — | — | — | — | ✓ (lecture) | ✓ | Toute modification |

*Promoteur valide seulement dépenses > seuil

---

## 3. Liste des rapports

| Rapport | Format | RBAC |
|---|---|---|
| Liste des inscrits | PDF/XLSX/CSV | SECRETARY, DIRECTOR |
| Liste par classe | PDF/XLSX/CSV | SECRETARY, DIRECTOR, TEACHER (ses classes) |
| Liste des professeurs | PDF/XLSX/CSV | DIRECTOR |
| Emploi du temps | PDF | SECRETARY, DIRECTOR, TEACHER |
| Liste des admissions | PDF/XLSX/CSV | SECRETARY, DIRECTOR |
| Liste des absences | PDF/XLSX/CSV | SECRETARY, DIRECTOR, TEACHER |
| Liste des notes | PDF/XLSX/CSV | TEACHER, DIRECTOR |
| Bulletins | PDF | TEACHER, DIRECTOR, PARENT (ses enfants) |
| Liste des factures | PDF/XLSX/CSV | ACCOUNTANT, DIRECTOR |
| Liste des paiements | PDF/XLSX/CSV | ACCOUNTANT, CASHIER |
| Liste impayés | PDF/XLSX/CSV | ACCOUNTANT, DIRECTOR |
| Rapport caisse | PDF | ACCOUNTANT, CASHIER, DIRECTOR |
| Rapport dépenses | PDF/XLSX/CSV | ACCOUNTANT, DIRECTOR |
| Rapport budget | PDF/XLSX/CSV | ACCOUNTANT, DIRECTOR, PROMOTER |
| Journal d'audit | PDF/XLSX/CSV | AUDITOR, DIRECTOR, ADMIN |
| Grand livre | PDF/XLSX | ACCOUNTANT |
| Balance | PDF/XLSX | ACCOUNTANT |
| Compte résultat | PDF | ACCOUNTANT, DIRECTOR |
| Bilan | PDF | ACCOUNTANT, DIRECTOR, PROMOTER |
| Flux trésorerie | PDF | ACCOUNTANT, DIRECTOR |

---

## 4. Workflows d'approbation

### Dépenses
```
Demandeur crée dépense (PENDING)
    ↓
Comptable vérifie pièce justificative
    ↓
Si < seuil : Comptable approuve (APPROVED)
Si ≥ seuil : Direction/Promoteur valide
    ↓
Finance paie (PAID)
    ↓
Écriture comptable générée
    ↓
Audit
```

### Paie
```
RH prépare variables (PayrollVariable)
    ↓
RH valide variables
    ↓
Finance calcule paie (bulletin)
    ↓
Comptable contrôle
    ↓
Direction valide
    ↓
Finance paie (BANK)
    ↓
Écriture comptable paie
    ↓
Banque rapproche
    ↓
Clôture période (immutable)
```

### Caisse
```
Caissier ouvre caisse (solde initial)
    ↓
Encaissements (CASH)
    ↓
Sorties (dépenses CASH)
    ↓
Solde théorique = initial + entrées - sorties
    ↓
Solde physique (comptage)
    ↓
Écart = théorique - physique
    ↓
Si écart ≠ 0 : justification obligatoire
    ↓
Comptable valide ou refuse
    ↓
Clôture verrouillée (immutable)
```

---

## 5. Schéma caisse

```
┌─────────────────────────────────────────┐
│           CAISSE QUOTIDIENNE             │
│                                          │
│  Ouverture : solde_initial              │
│          +                                │
│  Entrées : reçus CASH                   │
│          -                                │
│  Sorties : dépenses CASH (PAID)         │
│          =                                │
│  Solde théorique                         │
│          vs                              │
│  Solde physique (comptage)               │
│          =                                │
│  Écart (justification obligatoire)       │
│          ↓                                │
│  Clôture verrouillée (immutable)         │
└─────────────────────────────────────────┘
```

---

## 6. Schéma paie

```
RH (propriétaire contrat + présence)
    ↓
Variables paie validées
    ↓
Finance (propriétaire calcul + paiement)
    ↓
Calcul brut / retenues / charges / net
    ↓
Contrôle comptable
    ↓
Validation direction
    ↓
Paiement (BANK)
    ↓
Écriture comptable paie
    ↓
Rapprochement banque
    ↓
Clôture période (immutable)

Séparation des rôles :
  RH ≠ Finance ≠ Direction ≠ Banque
  Une même personne ne peut pas
  préparer + approuver + payer + rapprocher
```

---

## 7. Schéma comptable

```
Plan comptable (ChartOfAccount)
    ↓
Journaux (AccountingJournal)
  • Caisse
  • Banque
  • Ventes
  • Achats
  • Paie
  • Opérations diverses
    ↓
Écritures (JournalEntry)
  • Débit = Crédit (équilibrée)
  • Pièces jointes
  • Période
    ↓
Lignes (JournalEntryLine)
  • Account (compte)
  • Débit / Crédit
  • Analytique
    ↓
Grand livre → Balance → Compte résultat → Bilan
    ↓
Clôture période (immutable)
```

---

## 8. Résultats tests

| Catégorie | Total | PASS | FAIL |
|---|---|---|---|
| Tests recette comptable | 15 | 15 | 0 |
| Tests RBAC (14 rôles) | 6 | 6 | 0 |
| Tests intégrité | 6 | 6 | 0 |
| Tests non-régression | 8 | 8 | 0 |
| Tests offline-first | 17 | 17 | 0 |
| **Total** | **52** | **52** | **0** |

---

## 9. Documentation utilisateur

### Comptable
1. Consulte le dashboard comptable (25 KPI)
2. Gère les factures (création, suivi, relances)
3. Contrôle les encaissements caissier
4. Valide les dépenses
5. Rapproche la banque
6. Génère les rapports financiers
7. Calcule et contrôle la paie
8. Gère la comptabilité générale

### Caissier
1. Ouvre la caisse (solde initial)
2. Encaisse les paiements (élève identifié, payeur, moyen, reçu)
3. Génère reçu POS/PDF (QR + signature)
4. Effectue les sorties de caisse
5. Clôture la caisse (écart justifié)
6. Ne peut pas valider dépenses ni rapprocher

### Direction
1. Valide les admissions
2. Valide les dépenses > seuil
3. Valide la paie
4. Consulte les tableaux de pilotage
5. Prend les décisions financières

### Procédure réinitialisation démo
```bash
# Sur Vercel :
curl -X POST https://smart-shule-seven.vercel.app/api/seed-demo -H "Content-Type: application/json" -d '{"reset":true}'
curl -X POST https://smart-shule-seven.vercel.app/api/seed-demo-enrich
```

---

*Mise à jour : 2026-09-25*
