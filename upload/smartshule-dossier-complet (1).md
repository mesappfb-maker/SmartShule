# SmartShule (SS) — Dossier complet du projet

> **Slogan : _SmartShule — L’intelligence qui rapproche l’école et la famille._**
>
> Ce document regroupe en un seul fichier le cahier des charges fonctionnel et technique, le prompt système de l’agent autonome et le template du journal de bord.

## Table des matières

1. [Cahier des charges fonctionnel et technique](#partie-i--cahier-des-charges-fonctionnel-et-technique)
2. [Prompt système de l’agent autonome](#partie-ii--prompt-système-de-lagent-autonome)
3. [Template du journal de bord](#partie-iii--template-du-journal-de-bord)

---

# Partie I — Cahier des charges fonctionnel et technique

# SmartShule (SS)
## Cahier des charges fonctionnel et technique pour un système intégré de gestion scolaire, administrative et commerciale

**Version :** 1.0  
**Cible technique :** C# avec .NET 8, ASP.NET Core, Entity Framework Core 8  
**Type de solution :** application multi-postes, centralisée, sécurisée et utilisable hors connexion  
**Périmètre :** établissement scolaire comprenant plusieurs directions, sections, cycles, services et activités génératrices de revenus

---

## 1. Vision du produit

**SmartShule (SS)** est un progiciel intégré destiné à administrer une école complète. Il doit réunir dans une même plateforme les activités pédagogiques, les inscriptions, les élèves, les enseignants, les ressources humaines, la paie, les frais académiques, la comptabilité, le patrimoine et les services commerciaux de l’établissement.

> **Slogan recommandé : _SmartShule — L’intelligence qui rapproche l’école et la famille._**

Autres variantes possibles : **« SmartShule — Une école connectée, une réussite partagée »** et **« SmartShule — Piloter l’école, accompagner chaque élève »**. Le premier slogan est recommandé, car il couvre à la fois la gestion centrale, le portail et la communication avec les parents.

Le logiciel doit prendre en charge une organisation composée, par exemple, d’une direction maternelle, d’une direction primaire, d’une direction secondaire et de sections spécialisées telles que les mathématiques, la physique, la biologie-chimie, les lettres, les langues, l’informatique ou toute autre section ajoutée ultérieurement.

Le système doit également gérer les services qui ne sont pas strictement scolaires, notamment la location de salles de fête et la location de véhicules. Ces services doivent être reliés à la facturation, aux encaissements, aux dépenses, au patrimoine et à la comptabilité générale de l’école. Il ne s’agit donc pas de deux modules isolés, mais de deux activités commerciales intégrées au même système financier.

Le logiciel doit rester opérationnel lorsque certains postes ne disposent pas d’une connexion Internet ou d’un accès au serveur central. La connexion permet ensuite de synchroniser les opérations avec le serveur administratif central. Cette synchronisation doit être contrôlée, traçable, sécurisée et résistante aux doublons.

> **Principe directeur :** une donnée est saisie une seule fois dans le module responsable, puis réutilisée par les autres modules selon les droits de l’utilisateur.

---

## 2. Objectifs

Le projet poursuit les objectifs suivants :

1. Centraliser les informations scolaires, administratives, financières et patrimoniales.
2. Réduire la double saisie et les erreurs de transcription.
3. Donner à chaque service un espace de travail adapté à ses responsabilités.
4. Permettre le fonctionnement local en cas de coupure réseau.
5. Synchroniser les opérations entre les postes et le serveur central.
6. Assurer une traçabilité complète des créations, modifications, validations et annulations.
7. Produire des tableaux de bord fiables pour la direction.
8. Relier les inscriptions, les élèves, les classes, les cours, les paiements et la comptabilité.
9. Relier les réservations de salles et de véhicules à la facturation et aux disponibilités réelles.
10. Préparer le système à l’évolution de l’établissement et à l’ajout de nouvelles directions ou sections.

---

## 3. Périmètre fonctionnel

### 3.1 Paramétrage général et référentiels

Le système doit permettre de configurer :

- l’établissement, ses sites et ses bâtiments ;
- les années scolaires et les périodes académiques ;
- les directions et sous-directions ;
- les cycles : maternel, primaire, secondaire et supérieur, si nécessaire ;
- les sections, options et orientations ;
- les niveaux, classes, salles et groupes ;
- les matières et unités d’enseignement ;
- les types de frais et tarifs ;
- les devises, modes de paiement et comptes financiers ;
- les types de documents et numérotations ;
- les catégories d’équipements, véhicules, salles et contrats ;
- les calendriers, jours fériés et horaires de fonctionnement.

Tous ces référentiels doivent posséder un identifiant global unique afin de rester cohérents entre les bases locales et la base centrale.

### 3.2 Gestion des directions et de la structure scolaire

Une direction peut posséder ses propres responsables, enseignants, classes, cours, élèves et règles de validation, tout en restant rattachée à l’établissement principal.

Le système doit permettre de représenter une structure comme celle-ci :

```text
Établissement
├── Direction maternelle
│   ├── Niveaux
│   ├── Classes
│   └── Corps enseignant
├── Direction primaire
│   ├── Niveaux
│   ├── Classes
│   └── Corps enseignant
├── Direction secondaire
│   ├── Tronc commun
│   ├── Section mathématiques
│   ├── Section physique
│   ├── Section biologie-chimie
│   ├── Section lettres et langues
│   └── Corps enseignant
└── Services administratifs et commerciaux
```

La structure doit être configurable. Le code ne doit pas contenir de noms de directions en dur.

### 3.3 Admissions, inscriptions et réinscriptions

Le module doit gérer le cycle complet de l’élève : candidature, admission, inscription, réinscription, affectation dans une classe, transfert, suspension et sortie.

Fonctions attendues :

- préinscription d’un candidat ;
- collecte des pièces exigées ;
- validation du dossier ;
- attribution d’un matricule ;
- gestion des responsables légaux ;
- gestion des contacts d’urgence ;
- choix du niveau, de la section et de l’année scolaire ;
- génération d’un contrat ou d’une fiche d’inscription ;
- facturation automatique des frais selon le niveau et la section ;
- réinscription avec reprise contrôlée des informations ;
- changement de classe ou de section avec historique ;
- suivi des dossiers incomplets ;
- impression ou export des listes d’inscrits.

Un élève ne doit pas être supprimé physiquement après une inscription. Il doit être archivé avec son historique académique, financier et administratif.

### 3.4 Gestion des élèves et des responsables

Le dossier élève doit regrouper l’identité, la photo, les coordonnées, les responsables, les documents, l’historique scolaire, les absences, les résultats et la situation financière autorisée par le rôle de l’utilisateur.

Un responsable légal peut être lié à plusieurs élèves. Un élève peut avoir plusieurs responsables avec des liens différents : père, mère, tuteur, institution ou autre.

### 3.5 Gestion des classes, sections et groupes

Le module doit gérer :

- les classes par année scolaire ;
- leur capacité maximale ;
- leur salle principale ;
- leur direction et leur section ;
- leur professeur principal ;
- les groupes pédagogiques ;
- les sous-groupes pour les travaux pratiques ;
- les changements de classe ;
- l’historique des affectations.

Le système doit empêcher l’affectation d’un élève dans une classe inactive ou dans une classe dont la capacité validée est dépassée, sauf dérogation autorisée et journalisée.

### 3.6 Gestion des enseignants, des cours et des emplois du temps

Un enseignant peut dispenser la même matière dans plusieurs classes, plusieurs niveaux et plusieurs sections. Il peut également être rattaché à plusieurs directions.

Le système doit donc séparer clairement :

- la personne ;
- le dossier du personnel ;
- la qualification ;
- la matière enseignée ;
- l’affectation de l’enseignant à une classe ;
- l’affectation à une section ;
- la séance planifiée ;
- la séance réellement dispensée ;
- les élèves concernés ;
- les évaluations et résultats.

Fonctions attendues :

- création des matières ;
- affectation d’un enseignant à une ou plusieurs matières ;
- affectation à plusieurs classes et sections ;
- gestion des volumes horaires ;
- création d’emplois du temps ;
- détection des conflits d’enseignant, de salle et de classe ;
- suivi des cours prévus et réalisés ;
- saisie des présences des élèves ;
- saisie des présences des enseignants ;
- préparation des supports et observations de cours ;
- gestion des devoirs, interrogations et examens ;
- calcul des notes selon des règles configurables ;
- bulletins et relevés de notes ;
- verrouillage des notes après validation.

Le logiciel doit offrir à l’enseignant une vue limitée à ses propres cours, classes, groupes et évaluations, sauf autorisation particulière.

### 3.7 Absences, discipline et vie scolaire

Le module doit permettre de suivre les absences et retards des élèves et du personnel. Chaque absence doit comporter une date, une durée, un motif, une justification éventuelle, son statut et l’utilisateur qui l’a enregistrée.

Il doit également gérer les incidents disciplinaires, les avertissements, les sanctions, les convocations et les observations, avec une confidentialité renforcée.

### 3.8 Ressources humaines

Le module RH doit gérer les employés, enseignants et agents administratifs :

- dossier personnel ;
- contrat et type de contrat ;
- poste et service ;
- qualification ;
- date d’entrée et de sortie ;
- affectation à une direction ;
- congés et absences ;
- avances et retenues ;
- documents administratifs ;
- historique des changements ;
- évaluations internes ;
- état actif, suspendu ou sorti.

Un même employé peut exercer plusieurs fonctions, mais les responsabilités doivent être distinguées dans les autorisations informatiques.

### 3.9 Paie et rémunération

Le module de paie doit être paramétrable selon la réglementation et les règles internes de l’établissement. Il ne doit pas imposer des taux légaux codés en dur.

Il doit gérer :

- période de paie ;
- salaire de base ;
- primes ;
- heures supplémentaires ;
- retenues ;
- avances ;
- absences non rémunérées ;
- état provisoire ;
- validation ;
- clôture ;
- bulletin de paie ;
- écriture comptable générée après validation.

La paie doit être contrôlée par des rôles séparés. La personne qui saisit les éléments ne doit pas nécessairement être celle qui valide le paiement.

### 3.10 Frais académiques, facturation et encaissements

Le système doit gérer les frais d’inscription, de scolarité, de transport, de cantine, d’uniforme, de fournitures, d’examen et tout autre frais configuré.

Fonctions attendues :

- grille tarifaire par année, direction, niveau, section et catégorie ;
- facturation individuelle ou en masse ;
- échéancier ;
- réduction et bourse soumise à autorisation ;
- paiement partiel ;
- reçu numéroté ;
- paiement par espèces, banque, mobile money ou autre mode configurable ;
- annulation contrôlée d’un reçu ;
- remboursement soumis à validation ;
- relance des impayés ;
- état de compte par élève ;
- rapprochement des encaissements ;
- transfert vers la comptabilité.

Aucune modification directe d’un paiement validé ne doit être autorisée. Toute correction doit produire une annulation, un avoir ou une écriture de régularisation avec justification.

### 3.11 Comptabilité intégrée

La comptabilité doit être alimentée par les événements validés des autres modules. Elle doit permettre, selon le niveau de sophistication retenu :

- plan comptable configurable ;
- journaux ;
- comptes clients et fournisseurs ;
- caisse et banques ;
- recettes académiques ;
- recettes de location ;
- dépenses ;
- achats ;
- salaires ;
- immobilisations ;
- amortissements ;
- pièces justificatives ;
- rapprochement bancaire ;
- clôture de période ;
- balance ;
- grand livre ;
- compte de résultat ;
- états de caisse et de trésorerie.

La comptabilité doit distinguer les centres de responsabilité, par exemple la direction primaire, la section scientifique, la location de salles et la location de véhicules.

Le système doit utiliser le principe de **double entrée** lorsque la comptabilité générale est activée. Les règles de génération des écritures doivent être configurées et testées avec le responsable financier.

#### 3.11.1 Principe de calcul comptable

Le logiciel doit distinguer quatre notions qui ne doivent jamais être confondues :

- le **devis**, qui constitue une proposition commerciale sans écriture comptable ;
- la **réservation ou le contrat**, qui matérialise un engagement opérationnel, mais ne crée pas nécessairement un produit comptable ;
- la **facture**, qui constate la créance du client et le produit ou la prestation facturée ;
- l’**encaissement**, qui diminue la créance et augmente la caisse, la banque ou le compte de paiement concerné.

La comptabilité doit être calculée sur le montant hors taxe, la taxe éventuelle et le montant toutes taxes comprises. Les taux de taxe, les règles d’exonération, les comptes de taxe et la date d’exigibilité doivent être paramétrables par période et par type de prestation. Le logiciel ne doit pas déduire automatiquement une règle fiscale nationale non configurée.

Pour chaque ligne facturée, le système doit conserver :

1. le prix unitaire ;
2. la quantité ou la durée ;
3. la remise ;
4. le montant brut ;
5. le montant net hors taxe ;
6. le taux et le montant de taxe ;
7. le montant toutes taxes comprises ;
8. le compte de produit ;
9. le centre de coût ou de profit ;
10. la source métier : frais académiques, salle, véhicule, prestation additionnelle, pénalité ou dommage.

Les montants doivent être calculés avec le type `decimal`, jamais avec `double`. La précision interne doit être supérieure à la précision d’affichage. Les arrondis doivent être appliqués selon une règle configurée, de préférence au niveau de chaque ligne puis contrôlés au niveau de la facture. La différence éventuelle d’arrondi doit être imputée à un compte d’écart d’arrondi autorisé et auditée.

#### 3.11.2 Structure recommandée du plan comptable

Les numéros ci-dessous constituent un exemple de structure fonctionnelle. Ils doivent être remplacés ou mappés vers le plan comptable légal applicable au pays de l’établissement.

| Classe fonctionnelle | Comptes proposés | Utilisation |
|---|---|---|
| Trésorerie | `51xx` Banque, `53xx` Caisse, `54xx` comptes de paiement | Encaissements, décaissements et virements |
| Clients | `411xxx` Clients académiques, `4112xx` Clients salles, `4113xx` Clients véhicules | Créances par catégorie de client |
| Autres créances | `4457xx` Taxes à recevoir, `467xxx` avances ou comptes divers | Créances fiscales et opérations à régulariser |
| Immobilisations | `21xx` Salles et bâtiments, `218x` équipements, `2182` véhicules | Actifs utilisés par l’école ou loués |
| Fournisseurs | `401xxx` Fournisseurs d’achats, `404xxx` Fournisseurs d’immobilisations | Dettes envers les fournisseurs |
| Dettes diverses | `419xxx` Avances reçues, `467xxx` cautions à restituer | Acomptes et cautions qui ne sont pas encore des produits |
| Produits scolaires | `7061xx` Inscriptions, `7062xx` Scolarité, `7063xx` transport, `7064xx` cantine | Revenus issus de l’activité pédagogique |
| Produits salles | `7065xx` Location de salles, `70651x` prestations annexes, `70652x` pénalités facturables | Revenus de l’activité de salles |
| Produits véhicules | `7066xx` Location de véhicules, `70661x` kilomètres ou carburant, `70662x` prestations annexes, `70663x` pénalités facturables | Revenus de l’activité de véhicules |
| Charges d’exploitation | `60xx` achats, `61xx` services, `62xx` entretien, `64xx` personnel | Coûts opérationnels |
| Charges spécifiques | `615xxx` maintenance véhicules et salles, `681xxx` amortissements | Coûts directement rattachables aux locations |
| Résultat analytique | Centres `ECOLE`, `SALLE`, `VEHICULE`, par direction ou site | Analyse de rentabilité |

Le logiciel doit séparer le **compte général** du **code analytique**. Une location de salle peut donc être enregistrée dans le même compte général de produit tout en étant affectée au centre `LOC-SALLE`, à une salle précise et à un site donné. Cette séparation évite de créer un nouveau compte général pour chaque salle ou chaque véhicule.

#### 3.11.3 Journaux comptables

Le système doit prévoir au minimum les journaux suivants :

| Journal | Code exemple | Événements |
|---|---|---|
| Ventes scolaires | `VE-SCO` | Factures d’inscription et de scolarité |
| Ventes salles | `VE-SAL` | Factures de location de salles et prestations annexes |
| Ventes véhicules | `VE-VEH` | Factures de location de véhicules et prestations annexes |
| Caisse | `CAIS` | Encaissements et sorties de caisse |
| Banque | `BQxx` | Encaissements et paiements bancaires |
| Achats | `ACHA` | Factures fournisseurs et charges |
| Paie | `PAIE` | Salaires, retenues et charges |
| Opérations diverses | `OD` | Régularisations, amortissements, provisions et clôture |

Chaque journal doit posséder une numérotation séquentielle par exercice et période. Une pièce validée ne doit pas être supprimée. Une erreur doit être corrigée par une écriture inverse, un avoir ou une opération de régularisation référencée à la pièce initiale.

#### 3.11.4 Règles de calcul d’une facture

Pour chaque ligne, le calcul doit suivre les étapes suivantes :

```text
Montant brut = Quantité ou durée × Prix unitaire
Montant de remise = Montant brut × Taux de remise / 100
Montant net HT = Montant brut - Montant de remise
Montant taxe = Montant net HT × Taux de taxe / 100
Montant TTC = Montant net HT + Montant taxe
Solde = Montant TTC - Somme des règlements imputés - Avoirs imputés
```

Une remise doit avoir un motif, un utilisateur demandeur, un utilisateur approbateur et une limite maximale. Une remise exceptionnelle doit être validée avant l’émission de la facture.

La facture doit être enregistrée dans la période de sa date comptable. La date de réservation ne doit pas remplacer automatiquement la date de facturation. Si l’établissement applique une comptabilité d’engagement, une facture émise constate une créance même si le client n’a encore rien payé.

#### 3.11.5 Écritures des frais académiques

Lors de la validation d’une facture de frais académiques :

```text
Débit   411xxx Client ou responsable payeur       Montant TTC
Crédit  7061xx Produit d’inscription ou scolarité Montant HT
Crédit  4457xx Taxe collectée éventuelle         Montant taxe
```

Lors de l’encaissement :

```text
Débit   53xxx Caisse, 51xxx Banque ou 54xxx paiement  Montant encaissé
Crédit  411xxx Client                                  Montant encaissé
```

Un paiement partiel ne solde que la partie correspondante de la créance. Le système doit conserver l’ordre d’imputation : facture précise, échéance précise et mode de paiement précis.

#### 3.11.6 Acomptes et cautions de location

Un acompte reçu avant l’émission de la facture finale ne doit pas être enregistré directement comme produit. Il doit être enregistré comme avance reçue :

```text
À la réception de l’acompte :
Débit   53xxx ou 51xxx Trésorerie                  Montant reçu
Crédit  419xxx Avances reçues de clients           Montant reçu
```

Lors de l’émission de la facture définitive, l’acompte est imputé :

```text
Débit   411xxx Client                               Montant TTC de la facture
Crédit  7065xx ou 7066xx Produit de location        Montant HT
Crédit  4457xx Taxe collectée éventuelle             Montant taxe
```

Puis l’acompte est transféré de la dette d’avance vers la créance client :

```text
Débit   419xxx Avances reçues de clients            Montant de l’acompte
Crédit  411xxx Client                                Montant de l’acompte
```

Une caution remboursable doit rester une dette envers le client :

```text
Débit   53xxx ou 51xxx Trésorerie                   Montant caution
Crédit  419xxx Cautions reçues                       Montant caution
```

Lors de la restitution :

```text
Débit   419xxx Cautions reçues                       Montant restitué
Crédit  53xxx ou 51xxx Trésorerie                    Montant restitué
```

Si une partie de la caution est retenue pour un dommage réellement facturable, seule cette partie est transférée vers la créance ou le produit concerné après validation d’un état des lieux et d’une pièce justificative. La caution entière ne doit jamais être reconnue automatiquement comme revenu.

#### 3.11.7 Écritures des locations de salles

Pour une facture de salle, le moteur comptable doit utiliser le compte produit `7065xx` et le centre analytique de la salle. Exemple : location facturée pour **1 000 unités monétaires hors taxe**, avec une taxe paramétrée à **20 %**, soit **1 200 TTC** :

```text
Débit   4112xx Client location salle                1 200
Crédit  7065xx Location de salles                  1 000
Crédit  4457xx Taxe collectée                       200
```

Les prestations annexes doivent être séparées lorsqu’elles ont une nature différente :

```text
Débit   4112xx Client location salle                Total TTC
Crédit  7065xx Location de salle                    Prix salle HT
Crédit  70651x Sonorisation ou équipement            Prix prestation HT
Crédit  70652x Pénalité ou frais facturables         Prix pénalité HT
Crédit  4457xx Taxe collectée                       Total taxes
```

Le centre analytique doit indiquer au minimum le site, la salle, le contrat, le type d’événement et la période. Les charges directement liées doivent être affectées au même centre : nettoyage, sécurité, énergie additionnelle, maintenance et personnel occasionnel. Le rapport doit distinguer le chiffre d’affaires, les coûts directs et la marge de la salle.

#### 3.11.8 Écritures des locations de véhicules

Pour une facture de véhicule, le moteur comptable doit utiliser `7066xx` et identifier le véhicule, le contrat, la période, le conducteur et le kilométrage de départ et de retour.

Exemple pour une location de **800 unités monétaires hors taxe** et une taxe de **20 %** :

```text
Débit   4113xx Client location véhicule             960
Crédit  7066xx Location de véhicules                800
Crédit  4457xx Taxe collectée                       160
```

Si le contrat distingue le forfait, les kilomètres supplémentaires et le carburant :

```text
Débit   4113xx Client location véhicule             Total TTC
Crédit  7066xx Forfait de location                  Forfait HT
Crédit  70661x Kilomètres ou carburant              Complément HT
Crédit  70662x Service chauffeur ou livraison       Service HT
Crédit  70663x Dommage ou pénalité facturable       Montant HT validé
Crédit  4457xx Taxe collectée                       Total taxes
```

Les coûts de maintenance, assurance, carburant pris en charge par l’école et amortissement du véhicule doivent être enregistrés en charges selon leur nature. Ils doivent être affectés au centre du véhicule afin de calculer sa rentabilité réelle.

Lors de l’acquisition d’un véhicule destiné à être utilisé durablement :

```text
Débit   218x Immobilisation véhicule                Coût HT capitalisable
Débit   4456xx Taxe récupérable éventuelle           Taxe déductible
Crédit  404xxx Fournisseur d’immobilisation          Total facture
```

Les dépenses d’entretien courant doivent rester en charges. Seules les dépenses répondant aux règles d’immobilisation configurées et validées doivent augmenter la valeur de l’actif.

#### 3.11.9 Annulations, avoirs, dommages et pénalités

Une réservation annulée ne produit pas automatiquement une écriture. Le traitement dépend de son état :

- une réservation sans facture est simplement annulée avec motif ;
- un acompte remboursable est débité du compte d’avance et recrédité sur la trésorerie ;
- une facture non réglée est corrigée par un avoir ;
- une facture réglée est corrigée par un avoir et, si nécessaire, un remboursement ;
- une pénalité conservée doit être facturée ou imputée conformément au contrat ;
- un dommage doit être documenté par un état des lieux, une estimation et une validation.

Un avoir doit reprendre les lignes originales, les comptes de produits, les taxes et les centres analytiques. Il ne doit pas être saisi comme une facture négative libre sans référence à la pièce initiale.

#### 3.11.10 Comptabilité analytique des locations

Chaque opération de location doit porter les dimensions analytiques suivantes : `Activite`, `Site`, `Ressource`, `Contrat`, `Client`, `Periode` et `DirectionResponsable`.

Les dimensions minimales sont :

```text
Activité : ECOLE | LOCATION_SALLE | LOCATION_VEHICULE
Ressource : identifiant de la salle ou du véhicule
Centre : direction, site ou service responsable
```

Les tableaux de bord doivent présenter :

1. chiffre d’affaires facturé ;
2. chiffre d’affaires encaissé ;
3. créances et impayés ;
4. acomptes et cautions en attente ;
5. taxes collectées éventuelles ;
6. coûts directs ;
7. amortissements ;
8. marge brute ;
9. taux d’occupation des salles ;
10. taux d’utilisation des véhicules ;
11. rentabilité par ressource et par période.

La formule analytique de base est :

```text
Marge brute = Produits de location HT - Charges directes - Amortissements affectés
Taux de marge = Marge brute / Produits de location HT × 100
```

Les charges communes, comme l’administration générale ou une partie de l’électricité, doivent être réparties seulement si une clé de répartition validée est configurée. Le système doit conserver la clé utilisée et permettre de recalculer le rapport.

#### 3.11.11 Clôture et contrôles comptables

Avant la clôture d’une période, le système doit contrôler :

- l’égalité débit/crédit de chaque pièce ;
- l’absence de facture validée sans compte comptable ;
- l’absence d’encaissement non imputé ;
- le rapprochement entre factures, acomptes, cautions et contrats ;
- les réservations terminées sans facture ou état de retour ;
- les véhicules et salles dont les coûts directs sont absents ;
- les écritures en brouillon ;
- les comptes de taxe configurés pour les prestations concernées ;
- les séquences manquantes de pièces ;
- les opérations de synchronisation rejetées ou en conflit.

La clôture doit être irréversible pour un utilisateur ordinaire. Une réouverture doit demander un rôle spécifique, un motif et une trace d’audit. Les rapports de location doivent pouvoir être rapprochés avec le grand livre par journal, compte produit, centre analytique et période.

### 3.12 Patrimoine et immobilisations

Le module patrimoine doit inventorier les bâtiments, salles, meubles, équipements pédagogiques, équipements informatiques, véhicules et autres actifs.

Pour chaque bien, il faut pouvoir conserver :

- code d’inventaire ;
- catégorie ;
- désignation ;
- numéro de série ;
- localisation ;
- responsable ;
- date d’acquisition ;
- fournisseur ;
- coût ;
- état ;
- valeur résiduelle ;
- garantie ;
- documents ;
- mouvements ;
- maintenance ;
- sortie ou réforme.

Les biens utilisés pour la location doivent être reliés aux contrats, réservations, dégradations éventuelles et factures concernées.

### 3.13 Location de salles de fête

La location de salles doit être une activité commerciale complète intégrée à la gestion financière.

Le module doit gérer :

- catalogue des salles ;
- capacité et équipements ;
- tarifs par durée, jour, type d’événement ou saison ;
- calendrier de disponibilité ;
- client particulier ou organisation ;
- demande de réservation ;
- devis ;
- contrat ;
- acompte ;
- facture ;
- solde ;
- caution ;
- état des lieux avant et après ;
- prestations additionnelles ;
- annulation et pénalités ;
- affectation d’un agent ;
- rapport de rentabilité.

Le système doit empêcher deux réservations confirmées sur le même créneau pour la même salle. Les réservations provisoires doivent expirer après un délai configurable.

### 3.14 Location de véhicules

Le module de location de véhicules doit gérer :

- parc automobile ;
- marque, modèle, immatriculation et kilométrage ;
- capacité et caractéristiques ;
- assurance et documents ;
- maintenance ;
- disponibilité ;
- client ;
- conducteur ;
- contrat de location ;
- état du véhicule au départ et au retour ;
- carburant ;
- kilométrage ;
- caution ;
- facture ;
- pénalités et dommages ;
- planning des véhicules ;
- coût et rentabilité par véhicule.

Un véhicule immobilisé, expiré administrativement ou déjà réservé ne doit pas être proposé comme disponible.

### 3.15 Achats, fournisseurs et dépenses

Le module achats doit gérer les demandes internes, les validations, les fournisseurs, les bons de commande, les réceptions, les factures et les paiements.

Une dépense doit être reliée à un budget, un service, un centre de coût et une pièce justificative. Les seuils de validation doivent dépendre du montant et du rôle.

### 3.16 Documents et archivage

Le système doit stocker les documents avec leurs métadonnées, leur type, leur propriétaire, leur version, leur date d’expiration et leur niveau de confidentialité.

Les fichiers lourds ne doivent pas être systématiquement copiés dans toutes les bases locales. Le système doit prévoir un mécanisme de téléchargement différé et une miniature ou une empreinte locale lorsque cela est possible.

### 3.17 Notifications et communication

Le logiciel peut intégrer des notifications internes et, selon les services disponibles, l’envoi de courriels ou de messages. Chaque message doit être traçable : destinataire, statut, date d’envoi et erreur éventuelle.

### 3.18 Tableaux de bord et rapports

Les tableaux de bord doivent être filtrables par année scolaire, direction, section, niveau, période et centre de responsabilité.

Les indicateurs prioritaires sont : effectif inscrit, inscriptions incomplètes, taux de présence, résultats, impayés, encaissements, dépenses, trésorerie, paie, occupation des salles, chiffre d’affaires des locations, disponibilité des véhicules, patrimoine et alertes administratives.

---

## 4. Rôles et autorisations

Le système doit appliquer le principe du moindre privilège. Un rôle donne accès à des fonctions et à des périmètres de données. Une direction peut limiter la visibilité aux élèves et aux activités qui lui sont rattachés.

| Rôle | Responsabilités principales |
|---|---|
| Super administrateur | Paramétrage technique, sécurité et gestion des tenants ou établissements |
| Administrateur fonctionnel | Référentiels, années scolaires, directions et règles métiers |
| Direction générale | Validation, supervision et tableaux de bord consolidés |
| Directeur de direction | Suivi des classes, enseignants, élèves et résultats de sa direction |
| Secrétariat | Admissions, dossiers, inscriptions et documents |
| Enseignant | Cours, présences, évaluations et suivi de ses classes |
| Responsable pédagogique | Programmes, emplois du temps, validations de notes |
| RH | Dossiers du personnel, congés et éléments de paie |
| Responsable de paie | Préparation et contrôle de la paie |
| Comptable | Factures, encaissements, dépenses et écritures |
| Caissier | Encaissements et édition de reçus selon limite autorisée |
| Gestionnaire patrimoine | Inventaire, équipements, maintenance et mouvements |
| Responsable locations | Salles, véhicules, contrats, états des lieux et planning |
| Auditeur | Consultation des journaux et rapports sans modification |
| Agent de synchronisation | Transmission technique limitée, sans accès métier direct |

Il faut prévoir une séparation des tâches pour les opérations sensibles : création d’une facture, encaissement, annulation, validation comptable, remboursement, clôture et suppression logique.

---

## 5. Architecture technique recommandée

### 5.1 Architecture logique

L’architecture recommandée est composée de quatre éléments :

1. **Application cliente de poste**, installée dans chaque service. Une application desktop en WPF est adaptée à un fonctionnement riche sur Windows. Une application .NET MAUI peut être retenue si une cible multiplateforme est requise.
2. **Base locale SQLite**, utilisée par le poste pour les données nécessaires à son périmètre et pour les opérations effectuées hors connexion.
3. **API centrale ASP.NET Core 8**, qui applique les règles métier, l’authentification, la synchronisation et l’accès aux données centrales.
4. **Base centrale relationnelle**, de préférence SQL Server ou PostgreSQL selon l’environnement d’exploitation et les compétences disponibles.

Une architecture en couches doit séparer le domaine métier, les cas d’utilisation, l’infrastructure et l’interface. Le domaine ne doit pas dépendre directement de WPF, de SQLite ou d’un contrôleur HTTP.

```text
Poste Secrétariat ─┐
Poste Comptabilité ─┼─ Base locale + moteur Sync ── HTTPS ── API centrale ── Base centrale
Poste Pédagogie ───┤
Poste Locations ───┘                         └── Stockage documentaire et journal d’audit
```

### 5.2 Solution et projets .NET

Une organisation possible est :

```text
SmartShule.sln
├── SmartShule.Domain
├── SmartShule.Application
├── SmartShule.Infrastructure
├── SmartShule.Contracts
├── SmartShule.Api
├── SmartShule.Sync
├── SmartShule.Desktop
├── SmartShule.Reporting
└── SmartShule.Tests
```

Le projet doit suivre des conventions cohérentes : nullable reference types activés, analyzers, validation des entrées, journalisation structurée, tests automatisés et migrations versionnées.

### 5.3 Base de données

Les principales agrégats sont : `School`, `AcademicYear`, `Directorate`, `Section`, `Level`, `Classroom`, `Student`, `Guardian`, `Enrollment`, `Employee`, `TeacherAssignment`, `Subject`, `CourseSession`, `Attendance`, `Assessment`, `Grade`, `FeeDefinition`, `Invoice`, `Payment`, `Account`, `JournalEntry`, `Asset`, `RoomRental`, `Vehicle`, `VehicleRental`, `Supplier`, `PurchaseOrder`, `AuditLog`, `SyncOperation` et `SyncConflict`.

Chaque entité métier doit comporter au minimum :

- un identifiant global de type `Guid` ;
- une date de création ;
- une date de dernière modification ;
- l’identité du créateur et du dernier modificateur ;
- un statut métier ;
- une version de concurrence ;
- un indicateur de suppression logique lorsque le cas le permet.

Les opérations financières, les reçus, les écritures validées et les éléments d’audit ne doivent jamais être supprimés physiquement.

---

## 6. Mécanisme de fonctionnement hors connexion et de synchronisation

### 6.1 Principe

Le poste local n’est pas une copie complète et indépendante de toute l’école. Il reçoit uniquement les données nécessaires à son rôle et à son périmètre. Il peut créer des opérations locales dans une file d’attente appelée **Outbox**. Lorsque la connexion revient, le moteur transmet ces opérations au serveur central.

Le serveur traite chaque opération de façon idempotente. Si la même opération est reçue deux fois, elle ne doit produire qu’un seul effet.

### 6.2 Flux d’envoi

1. L’utilisateur réalise une action validée sur son poste.
2. L’application enregistre la donnée dans SQLite dans une transaction locale.
3. Elle crée une opération `SyncOperation` dans l’Outbox.
4. L’opération reçoit un identifiant global, un type, une version, un horodatage et une empreinte.
5. Le moteur essaie l’envoi vers l’API centrale.
6. Le serveur vérifie l’authentification, les droits, la version et l’empreinte.
7. Le serveur applique l’opération dans une transaction.
8. Le serveur renvoie un accusé de réception.
9. Le poste marque l’opération comme synchronisée.

### 6.3 Flux de réception

Le poste demande au serveur les changements depuis son dernier curseur de synchronisation. Le serveur envoie des événements ou des changements autorisés pour le rôle et le périmètre du poste. Le poste applique les changements dans une transaction locale, puis avance son curseur.

### 6.4 Conflits

Les conflits doivent être traités explicitement. Ils ne doivent pas être masqués par un simple écrasement de la dernière valeur.

| Type de donnée | Politique recommandée |
|---|---|
| Référentiel général | Le serveur central est prioritaire |
| Dossier élève | Conflit présenté à un responsable administratif |
| Présence d’élève | Fusion par événement daté, avec contrôle des doublons |
| Note validée | Interdiction de modification directe ; correction par procédure |
| Réservation de salle ou véhicule | Le serveur central réserve le créneau de manière atomique |
| Paiement ou écriture comptable | Aucune fusion automatique ; régularisation tracée |
| Documents | Versionnement et conservation des deux versions |

### 6.5 Contraintes de sécurité de la synchronisation

- Utiliser HTTPS avec authentification forte.
- Donner à chaque poste un identifiant d’installation et des clés renouvelables.
- Ne jamais faire confiance à l’horloge locale pour les validations sensibles.
- Vérifier les droits côté serveur même si l’interface les masque.
- Chiffrer les données locales contenant des informations sensibles lorsque l’environnement le permet.
- Journaliser les erreurs et les reprises.
- Prévoir un mécanisme de reprise après interruption au milieu d’un lot.
- Limiter la taille des lots et compresser les échanges.
- Ne jamais synchroniser les mots de passe.

### 6.6 États d’une opération

Une opération peut passer par les états suivants : `Pending`, `Sending`, `Acknowledged`, `Rejected`, `Conflict`, `Retrying` et `Cancelled`. Les erreurs doivent fournir un message compréhensible à l’utilisateur et un détail technique dans les journaux.

### 6.7 Limites assumées

Le mode hors connexion ne signifie pas que toutes les fonctions sont disponibles partout. La paie finale, la clôture comptable, la confirmation définitive d’une réservation concurrente et certaines validations doivent exiger une connexion au serveur central. L’interface doit indiquer clairement si l’action est locale, en attente ou confirmée par le serveur.

---

## 7. Sécurité, audit et protection des données

Le système doit utiliser une authentification sécurisée, des mots de passe hachés, une gestion des sessions, une expiration des jetons et une politique de verrouillage. L’authentification à deux facteurs peut être activée pour les rôles sensibles.

Les autorisations doivent être vérifiées sur trois niveaux : fonction, action et périmètre de données. Par exemple, un comptable peut consulter les paiements de l’établissement, tandis qu’un caissier peut seulement enregistrer les encaissements de sa caisse.

Le journal d’audit doit enregistrer l’utilisateur, le poste, la date, l’action, l’entité, l’identifiant, l’ancienne valeur lorsque nécessaire, la nouvelle valeur, le motif et le résultat. Les journaux doivent être non modifiables par les utilisateurs ordinaires.

Les sauvegardes doivent comprendre une copie de la base centrale, une copie des documents et une procédure de restauration testée. Une sauvegarde jamais restaurée ne doit pas être considérée comme vérifiée.

---

## 8. Règles métier critiques

1. Un matricule élève est unique dans l’établissement.
2. Une inscription appartient à une année scolaire précise.
3. Une classe appartient à une direction et à une année scolaire.
4. Un enseignant peut avoir plusieurs affectations, mais chaque affectation précise la matière, la classe, la section et la période.
5. Un cours ne peut pas créer simultanément un conflit de salle, de classe ou d’enseignant sans dérogation explicite.
6. Un paiement validé n’est jamais modifié directement.
7. Une facture payée ne peut être supprimée ; elle doit être annulée ou régularisée.
8. Une réservation confirmée bloque la ressource et le créneau.
9. Un véhicule non disponible ne peut pas être affecté à un contrat.
10. Une note validée ne peut être corrigée que par un workflow autorisé.
11. Toute opération synchronisée doit être idempotente.
12. Toute opération sensible doit être auditable.
13. Les suppressions ordinaires sont logiques et conservent l’historique.
14. Les règles de tarifs et de paie doivent être paramétrables et datées.

---

## 9. Exigences non fonctionnelles

| Domaine | Exigence |
|---|---|
| Performance | Les écrans courants doivent répondre rapidement sur un réseau local normal ; les recherches doivent utiliser des index adaptés |
| Disponibilité | Le serveur doit pouvoir être redémarré sans perte d’opérations déjà validées |
| Fiabilité | Toute transaction métier doit être atomique |
| Évolutivité | Ajouter une direction, une section ou un type de frais sans modifier le code central |
| Sécurité | Aucune autorisation ne doit reposer uniquement sur l’interface cliente |
| Maintenabilité | Code modulaire, tests et migrations versionnées |
| Exploitabilité | Journaux, métriques, sauvegardes et diagnostics de synchronisation |
| Accessibilité | Libellés clairs, navigation clavier et contrastes suffisants |
| Langue de l’interface | Français uniquement ; les formats locaux restent configurables |
| Traçabilité | Audit de toutes les opérations financières et administratives sensibles |

---

## 10. Phasage recommandé

### Phase 0 — Cadrage

Valider les procédures réelles de l’établissement, les rôles, les documents utilisés, les règles tarifaires, le plan comptable, les règles de paie et les besoins de connexion entre sites.

### Phase 1 — Socle

Construire l’authentification, les rôles, les établissements, les directions, les années scolaires, les référentiels, les journaux d’audit et le moteur de synchronisation de base.

### Phase 2 — Scolarité

Développer les élèves, responsables, admissions, inscriptions, classes, sections, enseignants, matières, cours, présences, évaluations et bulletins.

### Phase 3 — Finance scolaire

Développer les tarifs, factures, paiements, reçus, caisses et premières écritures comptables.

### Phase 4 — RH et paie

Développer les dossiers du personnel, congés, éléments variables, paie et validation.

### Phase 5 — Patrimoine et achats

Développer les actifs, salles, équipements, maintenance, fournisseurs, achats et dépenses.

### Phase 6 — Locations

Développer la location de salles de fête et de véhicules, les contrats, les acomptes, les cautions, les états des lieux, la facturation et la rentabilité.

### Phase 7 — Consolidation

Renforcer les rapports, les contrôles, les performances, les sauvegardes, la sécurité et la formation des utilisateurs.

Il est préférable de livrer un premier périmètre fonctionnel stable plutôt que de construire tous les modules superficiellement.

---

## 11. Critères d’acceptation principaux

Le produit sera considéré comme conforme lorsque :

- un utilisateur autorisé peut travailler sans connexion sur son périmètre ;
- les données locales sont conservées après une coupure ;
- la reconnexion synchronise les opérations sans doublon ;
- les conflits sensibles sont bloqués ou soumis à validation ;
- un élève peut être inscrit, affecté à une classe, facturé et payé ;
- un enseignant peut être affecté à plusieurs classes et sections ;
- un cours ne peut pas créer de conflit non autorisé ;
- une réservation de salle ou de véhicule bloque correctement la ressource ;
- chaque paiement et chaque écritures validés sont auditables ;
- les rôles ne voient que les données autorisées ;
- une sauvegarde peut être restaurée sur un environnement de test ;
- les rapports de direction rapprochent les données scolaires et financières.

---

## 12. Prompt maître pour concevoir le logiciel

Copiez le prompt suivant dans un assistant de développement capable de produire une architecture et du code :

```text
Tu es un architecte logiciel senior et un expert métier des systèmes de gestion scolaire, financière et patrimoniale.

Conçois une solution nommée « SmartShule » en C# avec .NET 8 et Entity Framework Core 8. La solution doit gérer un établissement comportant plusieurs directions : maternelle, primaire, secondaire et sections spécialisées comme mathématiques, physique, biologie-chimie, lettres, langues et informatique. La structure doit être entièrement paramétrable.

La solution doit être offline-first. Chaque poste de travail possède une base locale SQLite limitée à son périmètre autorisé. Un serveur central expose une API ASP.NET Core 8 et utilise une base SQL Server ou PostgreSQL. Le poste local doit enregistrer les opérations dans une Outbox. Le serveur doit les traiter de manière idempotente. La réception des changements doit utiliser un curseur de synchronisation. Les conflits doivent être détectés et stockés dans une table SyncConflict. Les paiements, écritures comptables, notes validées et réservations confirmées ne doivent jamais être écrasés silencieusement.

Modules obligatoires :
1. paramétrage de l’établissement, années scolaires, directions, cycles, sections, niveaux, classes, salles, matières et tarifs ;
2. admissions, inscriptions, réinscriptions, élèves, responsables et documents ;
3. classes, groupes, sections, emplois du temps et détection des conflits ;
4. enseignants, affectations multiples, cours, présences, évaluations et bulletins ;
5. ressources humaines, contrats, congés, absences et paie paramétrable ;
6. frais académiques, factures, paiements, reçus, remises, impayés et rapprochement ;
7. comptabilité intégrée avec plan comptable, journaux, double entrée, centres de coûts, fournisseurs, dépenses et clôture ;
8. patrimoine, immobilisations, équipements, maintenance et inventaire ;
9. location de salles de fête avec disponibilités, devis, contrat, acompte, caution, facture et état des lieux ;
10. location de véhicules avec parc, disponibilité, contrats, kilométrage, carburant, caution, dommages et maintenance ;
11. achats, fournisseurs, commandes, réceptions et paiements ;
12. tableaux de bord, rapports, notifications, audit et sauvegardes.

Rôles minimum : super administrateur, administrateur fonctionnel, direction générale, directeur de direction, secrétariat, enseignant, responsable pédagogique, RH, responsable paie, comptable, caissier, gestionnaire patrimoine, responsable locations et auditeur.

Contraintes d’architecture :
- utiliser une architecture en couches ou Clean Architecture ;
- séparer Domain, Application, Infrastructure, Contracts, Api, Sync, Desktop et Tests ;
- utiliser des identifiants Guid, la concurrence optimiste, la suppression logique et l’audit ;
- ne jamais supprimer physiquement les documents financiers validés ;
- vérifier les droits côté serveur ;
- utiliser des transactions ;
- rendre les opérations de synchronisation idempotentes ;
- écrire des tests unitaires, d’intégration et de synchronisation ;
- fournir les migrations EF Core ;
- documenter les décisions d’architecture et les limites du mode hors connexion.

Avant d’écrire le code, produis dans cet ordre :
A. hypothèses et questions qui changent réellement l’architecture ;
B. architecture globale ;
C. modèle de domaine et agrégats ;
D. schéma relationnel détaillé ;
E. règles métier ;
F. matrice des rôles et permissions ;
G. protocole de synchronisation ;
H. plan de réalisation par itérations ;
I. stratégie de tests ;
J. risques et mesures de réduction.

Ensuite, implémente une première tranche verticale complète : authentification, rôles, année scolaire, direction, élève, inscription, base locale SQLite, Outbox, API centrale et synchronisation idempotente. Ne génère pas tout le système en une seule réponse. Produis du code compilable, avec les chemins de fichiers, les commandes .NET, les migrations, les tests et les instructions d’exécution.
```

---

## 13. Prompts spécialisés pour le développement

### Prompt architecture et modèle de données

```text
À partir du cahier des charges SmartShule, propose un modèle de domaine normalisé. Définis les agrégats, les entités, les value objects, les relations, les contraintes d’unicité, les index, les stratégies de concurrence et les règles de suppression. Distingue les données scolaires, les données RH, les documents et les transactions financières. Retourne un diagramme Mermaid ER, le code des entités C# et les configurations Fluent API EF Core 8. Vérifie qu’un enseignant peut être affecté à plusieurs classes, directions, sections et matières.
```

### Prompt synchronisation offline-first

```text
Implémente un moteur de synchronisation offline-first en C# .NET 8 entre une base locale SQLite et une API ASP.NET Core centrale. Utilise une Outbox locale, une Inbox serveur, des identifiants Guid, une clé d’idempotence, un curseur de téléchargement, des lots limités, des retries avec backoff et des états Pending, Sending, Acknowledged, Rejected, Conflict et Retrying. Ajoute la détection de concurrence optimiste et une table SyncConflict. Donne le schéma SQL, les classes C#, les endpoints, les transactions, les tests d’interruption réseau et les tests de réception en double. Ne fais jamais de résolution silencieuse pour les paiements, notes validées, écritures et réservations.
```

### Prompt module scolarité

```text
Implémente le module scolarité d’SmartShule : candidat, élève, responsable légal, dossier, année scolaire, direction, section, niveau, classe, groupe, inscription, réinscription, matière, affectation enseignant-classe, cours, séance, présence, évaluation et bulletin. Ajoute les règles de capacité de classe, d’affectation multiple des enseignants, de conflit de salle et de conflit d’horaire. Fournis les commandes, requêtes, validateurs, API, écran desktop, migrations et tests.
```

### Prompt module comptabilité et paiements

```text
Implémente le module financier d’SmartShule. Utilise decimal et non double. Gère un plan comptable paramétrable, des journaux de ventes scolaires, ventes salles, ventes véhicules, caisse, banque, achats, paie et opérations diverses. Gère les tarifs académiques, factures, lignes de facture, paiements partiels, reçus, remises autorisées, avoirs, remboursements, caisses, banques, fournisseurs, dépenses et écritures comptables en double entrée.

Pour chaque ligne, calcule montant brut, remise, montant HT, taxe paramétrable, montant TTC et solde. Sépare toujours devis, contrat, facture et encaissement. Une facture validée doit débiter le compte client et créditer le compte de produit ainsi que le compte de taxe éventuel. Un encaissement doit débiter caisse ou banque et créditer le compte client. Un acompte doit être enregistré dans un compte d’avances reçues et une caution remboursable dans un compte de dettes, jamais directement comme produit.

Utilise des comptes produits distincts ou mappables pour les frais académiques, la location de salles, les prestations annexes de salles, la location de véhicules, les kilomètres, le carburant, les chauffeurs et les pénalités. Ajoute les dimensions analytiques Activité, Site, Ressource, Contrat, Client, Période et DirectionResponsable. Chaque événement financier validé doit générer une écriture équilibrée et traçable. Interdis la suppression ou modification directe d’un paiement validé. Les corrections passent par avoir, remboursement ou écriture inverse référencée.

Pour les locations, bloque les réservations concurrentes au niveau serveur, rapproche contrat, acompte, facture, caution, état des lieux et paiement, puis produis les rapports de chiffre d’affaires HT, taxes, encaissements, créances, coûts directs, amortissements, marge et rentabilité par salle ou véhicule. Fournis les règles de validation, les transactions, l’audit, les migrations EF Core, les rapports et les tests de rapprochement et de clôture.
```

### Prompt module location de salles

```text
Implémente la gestion commerciale de location de salles de fête. Une salle possède une capacité, des équipements, un calendrier, des tarifs et un état de disponibilité. Gère prospect, devis, réservation provisoire, réservation confirmée, contrat, acompte, caution, solde, facture, prestation additionnelle, état des lieux, annulation et pénalité. Empêche les chevauchements confirmés par une transaction serveur atomique. Relie chaque opération aux comptes clients, à la caisse et à la comptabilité. Fournis les entités, cas d’utilisation, API, écran de calendrier et tests de concurrence.
```

### Prompt module location de véhicules

```text
Implémente la gestion de location de véhicules. Gère véhicule, catégorie, immatriculation, kilométrage, assurance, maintenance, disponibilité, client, conducteur, contrat, acompte, caution, carburant, état de départ, état de retour, dommages, pénalités, facture et écriture comptable. Un véhicule réservé, immobilisé ou administrativement expiré ne doit pas être proposé. Ajoute les tests de chevauchement, de retour, de calcul des kilomètres et de facturation.
```

### Prompt sécurité et audit

```text
Ajoute une sécurité complète à SmartShule : authentification, rôles, permissions par module, action et direction, journal d’audit immuable, gestion des sessions, renouvellement des jetons, validation serveur, protection contre les doublons et contrôle des opérations sensibles. Produis une matrice de permissions et des tests qui vérifient qu’un utilisateur ne peut pas consulter ou modifier les données hors de son périmètre.
```

### Prompt qualité et livraison

```text
Prépare la solution SmartShule pour la production. Ajoute tests unitaires, tests d’intégration API, tests de base locale, tests de synchronisation, tests de concurrence, tests de sécurité et tests de restauration de sauvegarde. Ajoute journalisation structurée, métriques, health checks, migrations, configuration par environnement, scripts de déploiement, documentation d’installation et guide de support. Vérifie que la solution compile avec .NET 8 et que les erreurs sont corrigées avant de livrer.
```

---

## 14. Portail web parents, élèves et direction

### 14.1 Objectif du portail

Le système doit être complété par un portail web sécurisé accessible depuis un ordinateur ou un téléphone. Ce portail ne remplace pas l’application administrative interne. Il expose uniquement les informations et services autorisés pour les parents, les élèves et la direction.

Le portail doit permettre :

- aux parents de suivre l’évolution de leurs enfants ;
- aux élèves de consulter leurs cours, devoirs et résultats autorisés ;
- à la direction de publier des informations et de répondre aux familles ;
- à l’administration de gérer les annonces, documents et demandes ;
- de centraliser les échanges institutionnels sans donner aux parents un accès direct aux professeurs.

La règle de communication demandée est la suivante : **les parents et les élèves communiquent avec la direction ou le secrétariat, mais pas directement avec les enseignants depuis le portail familial**. Les enseignants peuvent déposer des cours, devoirs, présences et observations dans le système interne. La direction contrôle les messages et peut transmettre une réponse officielle à la famille.

### 14.2 Architecture d’intégration

Le portail doit utiliser la même API centrale que l’application administrative. Il ne doit jamais accéder directement à la base de données. L’API applique l’authentification, les autorisations, le filtrage par élève et les règles de confidentialité.

```text
Application interne des services
              │
Application locale offline-first ── API centrale ASP.NET Core 8 ── Base centrale
              │                                  │
              └──────────────────────────────────┼── Portail web
                                                 ├── Espace parent
                                                 ├── Espace élève
                                                 └── Espace direction/secrétariat
```

Le portail peut être développé avec Blazor WebAssembly, Blazor Server, React ou une autre interface web compatible avec l’API ASP.NET Core 8. Le choix de l’interface ne doit pas modifier les règles du domaine métier.

Les données sensibles doivent être filtrées côté serveur. Masquer un bouton dans le navigateur ne constitue pas une autorisation suffisante.

### 14.2.1 Architecture détaillée de l’API REST

L’API REST constitue l’unique point d’accès applicatif entre le portail web et le serveur central. Le navigateur ne doit jamais se connecter directement à SQL Server, PostgreSQL, SQLite ou au stockage de fichiers.

L’architecture recommandée est la suivante :

```text
Navigateur parent / élève
          │ HTTPS
          ▼
WAF ou reverse proxy
          │
          ▼
ASP.NET Core 8 API
 ┌──────────────────────────────┐
 │ Authentification              │
 │ Autorisation et périmètre     │
 │ Validation des requêtes       │
 │ Cas d’utilisation métier      │
 │ Journalisation et audit       │
 │ Limitation de débit           │
 └──────────────┬───────────────┘
                │
        Services applicatifs
       ┌────────┼────────┐
       ▼        ▼        ▼
 Base centrale  Stockage  Service notifications
 SQL Server     fichiers  courriel/SMS
```

La solution doit respecter une séparation en couches :

```text
SmartShule.Api              Contrôleurs REST, middleware et configuration HTTP
SmartShule.Application      Commandes, requêtes, DTO, validateurs et autorisations
SmartShule.Domain           Entités, règles métier et événements de domaine
SmartShule.Infrastructure   EF Core, identité, stockage fichiers, courriels et SMS
SmartShule.Contracts        Contrats versionnés des requêtes et réponses
SmartShule.Tests             Tests unitaires, intégration et sécurité
```

Les contrôleurs ne doivent pas contenir les règles métier. Ils doivent recevoir une requête, vérifier sa forme, appeler un cas d’utilisation et retourner une réponse HTTP cohérente.

### 14.2.2 Principes REST et versionnement

L’API doit utiliser des ressources métier et des verbes HTTP standards : `GET` pour consulter, `POST` pour créer une action ou une ressource, `PUT` pour remplacer une ressource complète, `PATCH` pour une modification partielle contrôlée et `DELETE` uniquement lorsque la suppression est autorisée. Pour les données sensibles et les transactions, la suppression sera généralement remplacée par une désactivation, une annulation ou une clôture.

L’URL doit être versionnée dès la première version :

```text
https://api.ecole.example.com/api/v1/...
```

Une nouvelle version majeure ne doit pas modifier silencieusement la signification d’un champ ou d’une règle métier. Les anciennes versions doivent avoir une date de fin annoncée et une période de coexistence.

Les réponses doivent utiliser `application/json` et suivre une structure homogène. Une erreur doit comporter un identifiant de corrélation, un code fonctionnel, un message lisible et, si nécessaire, une liste de détails de validation.

Exemple :

```json
{
  "type": "https://api.ecole.example.com/errors/validation",
  "title": "La requête contient des erreurs",
  "status": 422,
  "code": "VALIDATION_ERROR",
  "traceId": "01JEXAMPLE",
  "errors": {
    "dueDate": ["La date limite doit être postérieure à la date de publication."]
  }
}
```

L’API doit prendre en charge la pagination par curseur pour les listes importantes. Les réponses doivent accepter des paramètres de filtre, de tri et de limite contrôlée. Le serveur doit imposer une limite maximale afin d’éviter qu’un parent ou un client malveillant ne demande toute la base.

### 14.2.3 Authentification

L’API doit utiliser **OpenID Connect et OAuth 2.0 avec Authorization Code Flow et PKCE** pour le portail web. Le portail ne doit pas stocker de mot de passe utilisateur dans le navigateur et ne doit pas utiliser un flux implicite.

Le serveur d’identité peut être intégré à ASP.NET Core Identity avec un fournisseur OpenID Connect compatible. Les éléments minimum sont :

- identifiant unique du compte ;
- mot de passe haché avec un algorithme adapté ;
- vérification du courriel ou du téléphone ;
- expiration des sessions ;
- révocation des sessions ;
- limitation des tentatives ;
- récupération de compte ;
- authentification multifactorielle optionnelle pour les parents et renforcée pour la direction ;
- rotation des refresh tokens ;
- détection de réutilisation d’un refresh token.

Pour une application web classique, les jetons doivent être conservés dans une session serveur ou dans un cookie `HttpOnly`, `Secure` et `SameSite` correctement configuré. Ils ne doivent pas être exposés à JavaScript dans `localStorage` lorsque cette architecture peut être évitée.

Le jeton d’accès doit être de courte durée. Il doit contenir uniquement les revendications nécessaires, par exemple :

```json
{
  "sub": "user-global-id",
  "aud": "ecole-fute-portal",
  "iss": "https://identity.ecole.example.com",
  "scope": "portal.read portal.write",
  "role": "Parent",
  "tenant_id": "school-id",
  "session_id": "session-id",
  "exp": 1780000000
}
```

Le rôle contenu dans le jeton ne suffit pas à déterminer les élèves visibles. Le serveur doit interroger le rattachement officiel entre le compte parent et les dossiers élèves à chaque opération sensible ou depuis un cache court invalidé lors d’un changement.

### 14.2.4 Autorisation par rôle et par périmètre

L’API doit appliquer une autorisation en profondeur :

1. **Autorisation de fonction :** le compte peut-il utiliser cette catégorie d’API ?
2. **Autorisation d’action :** peut-il consulter, créer, modifier, publier ou clôturer ?
3. **Autorisation de périmètre :** cette donnée appartient-elle à son ou ses enfants, sa classe, sa direction ou son établissement ?
4. **Autorisation d’état :** la donnée est-elle publiée, validée ou encore confidentielle ?

Exemples :

| Appel | Contrôle obligatoire |
|---|---|
| Consulter un élève | Le compte parent est rattaché à cet élève |
| Télécharger un bulletin | Le bulletin est publié et concerne l’enfant rattaché |
| Consulter un devoir | Le devoir est publié pour la classe ou le groupe de l’élève |
| Déposer un devoir | L’élève est inscrit dans la classe et le devoir est ouvert |
| Créer une demande | Le parent est authentifié et choisit un enfant autorisé |
| Répondre à une demande | L’utilisateur appartient au service ou à la direction autorisée |
| Publier une note | Le rôle possède la permission de publication et la période est ouverte |
| Consulter un paiement | Le parent est le responsable autorisé ou le compte est administratif habilité |

Les politiques d’autorisation peuvent être implémentées avec des policies ASP.NET Core et des handlers dédiés, mais la vérification du périmètre doit rester dans le cas d’utilisation et non uniquement dans l’attribut du contrôleur.

### 14.2.5 Catalogue des endpoints principaux

Les endpoints suivants constituent le contrat initial de l’API. Les noms peuvent évoluer, mais les responsabilités doivent rester séparées.

#### Identité et profil

```text
GET    /api/v1/me
GET    /api/v1/me/children
PATCH  /api/v1/me/contact-preferences
POST   /api/v1/me/sessions/revoke
GET    /api/v1/me/notifications
POST   /api/v1/me/notifications/{id}/read
```

`GET /me/children` ne retourne que les élèves officiellement rattachés au compte connecté. Les informations retournées doivent être minimales : identifiant, nom affichable, photo autorisée, classe publiée et statut du compte.

#### Tableau de bord parent

```text
GET /api/v1/parent/dashboard?childId={id}&period={period}
GET /api/v1/parent/children/{childId}/summary
GET /api/v1/parent/children/{childId}/attendance
GET /api/v1/parent/children/{childId}/timetable
GET /api/v1/parent/children/{childId}/grades
GET /api/v1/parent/children/{childId}/report-cards
GET /api/v1/parent/children/{childId}/fees
```

Le serveur doit vérifier le rattachement avant d’utiliser `childId`. Un identifiant deviné ou remplacé dans l’URL ne doit jamais permettre l’accès aux données d’un autre élève.

#### Cours et devoirs

```text
GET  /api/v1/students/{studentId}/courses
GET  /api/v1/students/{studentId}/courses/{courseId}
GET  /api/v1/students/{studentId}/assignments
GET  /api/v1/students/{studentId}/assignments/{assignmentId}
POST /api/v1/students/{studentId}/assignments/{assignmentId}/submissions
GET  /api/v1/students/{studentId}/submissions/{submissionId}
POST /api/v1/students/{studentId}/submissions/{submissionId}/finalize
```

Le compte parent peut consulter les devoirs de son enfant, mais seul le compte élève peut déposer et finaliser une remise, sauf procédure administrative exceptionnelle.

#### Demandes adressées à la direction

```text
GET  /api/v1/parent/requests
POST /api/v1/parent/requests
GET  /api/v1/parent/requests/{requestId}
POST /api/v1/parent/requests/{requestId}/messages
POST /api/v1/parent/requests/{requestId}/close
GET  /api/v1/admin/requests
POST /api/v1/admin/requests/{requestId}/assign
POST /api/v1/admin/requests/{requestId}/reply
POST /api/v1/admin/requests/{requestId}/status
```

Les endpoints `admin` ne doivent être accessibles qu’à la direction, au secrétariat ou à un service explicitement autorisé. Une affectation interne ne doit pas exposer aux parents les notes internes ou les utilisateurs internes non nécessaires.

#### Annonces et publications

```text
GET  /api/v1/announcements
GET  /api/v1/announcements/{announcementId}
POST /api/v1/admin/announcements
POST /api/v1/admin/announcements/{announcementId}/publish
POST /api/v1/admin/announcements/{announcementId}/archive
```

Les annonces doivent être filtrées selon la cible : établissement, direction, classe, section ou groupe. Le serveur doit exclure les annonces en brouillon ou expirées.

#### Documents et fichiers

```text
POST /api/v1/files/upload-intents
PUT  /api/v1/files/{fileId}/content
POST /api/v1/files/{fileId}/complete
GET  /api/v1/files/{fileId}/download-url
DELETE /api/v1/files/{fileId}
```

Le téléchargement doit retourner une URL temporaire ou un flux autorisé. Le serveur doit vérifier le rattachement et le droit d’accès avant de générer cette URL. La suppression doit être logique et interdite si le fichier est rattaché à une pièce officielle ou financière.

### 14.2.6 Écriture des commandes et idempotence

Toutes les commandes qui créent une donnée ou déclenchent une action doivent accepter une clé `Idempotency-Key` unique par opération. Elle est obligatoire pour :

- création d’une demande ;
- dépôt d’un devoir ;
- finalisation d’un dépôt ;
- paiement ou initialisation de paiement ;
- envoi d’un message ;
- création d’une réservation ;
- publication ou clôture d’une ressource.

Exemple :

```http
POST /api/v1/parent/requests HTTP/1.1
Authorization: Bearer <access-token>
Idempotency-Key: 3d7f3c1e-...
Content-Type: application/json
```

Le serveur doit enregistrer la clé avec le compte, l’empreinte de la requête, le résultat et la date d’expiration. Une même clé avec une requête différente doit être rejetée. Une répétition identique doit retourner le même résultat sans créer un doublon.

### 14.2.7 Validation, concurrence et transactions

Les DTO d’entrée doivent être validés avec des règles explicites : longueur, format, taille des fichiers, dates, statut autorisé et relation avec l’élève. Les validateurs doivent être exécutés côté serveur même si le formulaire web effectue déjà une validation.

Les ressources publiées doivent utiliser une concurrence optimiste avec une version ou un `ETag`. Une modification basée sur une version ancienne doit retourner `412 Precondition Failed` ou `409 Conflict` selon la convention adoptée.

Les opérations suivantes doivent être atomiques :

- rattachement d’un parent à un élève ;
- création d’une demande et de son premier message ;
- finalisation d’une remise de devoir ;
- publication d’un devoir ou d’une annonce ;
- émission d’un reçu ou enregistrement d’un paiement ;
- réservation d’une salle ou d’un véhicule ;
- génération d’une écriture comptable.

Une transaction doit valider la donnée métier, l’audit et l’événement de notification destiné à être traité. L’envoi réel d’un courriel ou SMS doit être réalisé de manière asynchrone depuis une file fiable, afin qu’une panne du fournisseur de messagerie ne fasse pas échouer l’opération métier déjà validée.

### 14.2.8 Synchronisation et événements

Le portail fonctionne principalement en ligne. Il doit toutefois tolérer une coupure momentanée lors de la consultation et réessayer les commandes idempotentes. Les données créées par l’application interne offline-first doivent être exposées au portail uniquement après réception, validation et publication sur le serveur central.

Le serveur peut utiliser un pattern **Outbox** pour publier les événements suivants : `GradePublished`, `ReportCardPublished`, `AssignmentPublished`, `SubmissionReceived`, `AnnouncementPublished`, `ParentRequestCreated`, `ParentRequestAnswered` et `PaymentConfirmed`.

Un worker traite les événements et crée les notifications. L’événement doit comporter un identifiant unique afin d’éviter les notifications en double. Les échecs doivent être réessayés avec un nombre maximum de tentatives et placés dans une file d’erreur après dépassement.

### 14.2.9 Sécurité HTTP et protection de l’API

Les mesures minimum sont :

- HTTPS obligatoire, avec redirection du HTTP et en-têtes de sécurité ;
- validation stricte de l’origine CORS, sans `AllowAnyOrigin` pour les requêtes authentifiées ;
- protection CSRF si les cookies sont utilisés ;
- limitation de débit par IP, compte et endpoint ;
- protection contre l’énumération des comptes et des élèves ;
- contrôle de taille et de type des requêtes ;
- analyse antivirus des pièces jointes ;
- journalisation des refus sans enregistrer de mot de passe ni de jeton ;
- masquage des données personnelles dans les logs ;
- protection contre l’injection SQL par EF Core et requêtes paramétrées ;
- en-têtes `Content-Security-Policy`, `X-Content-Type-Options` et `Referrer-Policy` ;
- désactivation des messages d’erreur détaillés en production ;
- secrets conservés dans un coffre ou des variables sécurisées, jamais dans le dépôt Git.

Les endpoints de connexion, de récupération de compte, de dépôt de fichiers et de messagerie doivent avoir des limites de débit plus strictes. Les administrateurs doivent disposer d’une authentification renforcée et d’une journalisation plus détaillée.

### 14.2.10 Journalisation, audit et observabilité

Chaque requête doit recevoir un `traceId` et un `requestId`. Les journaux techniques doivent enregistrer la méthode, le chemin, le statut, la durée, la taille et le résultat général. Ils ne doivent pas enregistrer les mots de passe, les jetons, les pièces jointes ou les messages privés en clair.

Les événements d’audit métier doivent enregistrer : utilisateur, rôle, établissement, adresse IP éventuellement hachée ou protégée, poste ou session, action, ressource, ancienne version, nouvelle version, motif et résultat.

L’API doit exposer des health checks protégés :

```text
GET /health/live
GET /health/ready
```

Le premier indique que le processus fonctionne. Le second vérifie les dépendances nécessaires, sans révéler de détails sensibles. Les métriques doivent surveiller les temps de réponse, les erreurs 4xx et 5xx, les conflits de version, les fichiers rejetés, les événements en attente et les notifications échouées.

### 14.2.11 Déploiement recommandé

Le serveur central doit être déployé dans des environnements séparés : développement, test, préproduction et production. Chaque environnement doit posséder ses bases, ses secrets et ses clés d’identité propres.

Une configuration de production minimale comprend :

- reverse proxy ou WAF ;
- certificat TLS renouvelé automatiquement ;
- API ASP.NET Core 8 sans accès public à la base ;
- base centrale sur réseau privé ;
- stockage de fichiers privé ;
- worker de notifications ;
- sauvegardes chiffrées ;
- supervision et alertes ;
- plan de restauration testé ;
- migrations de base exécutées de manière contrôlée.

Les migrations destructives doivent être interdites dans le déploiement automatique. Toute modification de schéma doit être compatible avec la version précédente pendant la période de déploiement progressif.

### 14.2.12 Tests obligatoires de l’API

Avant la mise en production, les tests doivent couvrir :

1. authentification valide, expirée, révoquée et MFA ;
2. isolation entre deux familles ;
3. interdiction pour un parent de modifier une note ou une présence ;
4. accès aux seuls bulletins publiés ;
5. accès d’un élève à ses seuls devoirs ;
6. impossibilité de réutiliser une remise d’un autre élève ;
7. idempotence des commandes répétées ;
8. conflit de version sur une publication ;
9. limitation de débit ;
10. téléchargement interdit d’un fichier non rattaché ;
11. protection CORS et CSRF ;
12. absence de données sensibles dans les logs ;
13. fonctionnement après redémarrage du worker de notifications ;
14. restauration d’une sauvegarde et reprise du service.

L’API ne doit pas être déclarée prête sur la seule base de tests unitaires. Des tests d’intégration doivent exécuter les contrôleurs, l’authentification, les policies, la base de test, le stockage de fichiers et le mécanisme d’idempotence.

### 14.2.13 Spécifications techniques d’implémentation de l’API

#### A. Configuration du projet

Le projet `SmartShule.Api` doit cibler `net8.0` et activer les fonctionnalités suivantes :

```xml
<TargetFramework>net8.0</TargetFramework>
<Nullable>enable</Nullable>
<ImplicitUsings>enable</ImplicitUsings>
<TreatWarningsAsErrors>true</TreatWarningsAsErrors>
```

Les dépendances principales sont :

```text
Microsoft.AspNetCore.Authentication.JwtBearer
Microsoft.AspNetCore.OpenApi
Microsoft.EntityFrameworkCore
Microsoft.EntityFrameworkCore.SqlServer ou Npgsql.EntityFrameworkCore.PostgreSQL
Microsoft.EntityFrameworkCore.Design
FluentValidation.AspNetCore
AspNetCoreRateLimit ou Microsoft.AspNetCore.RateLimiting
Serilog.AspNetCore
Swashbuckle.AspNetCore
Microsoft.AspNetCore.Mvc.Testing
Testcontainers ou une base de test dédiée
```

Les versions des packages doivent être alignées sur .NET 8 et verrouillées dans le fichier de projet ou dans un fichier de gestion centralisée des packages. Les dépendances non nécessaires ne doivent pas être ajoutées au projet API.

#### B. Organisation des projets

```text
src/
├── SmartShule.Api/
│   ├── Controllers/
│   ├── Middleware/
│   ├── Extensions/
│   ├── OpenApi/
│   └── Program.cs
├── SmartShule.Application/
│   ├── Abstractions/
│   ├── Behaviors/
│   ├── Features/
│   │   ├── ParentPortal/
│   │   ├── StudentPortal/
│   │   ├── Assignments/
│   │   ├── Requests/
│   │   └── Notifications/
│   └── Common/
├── SmartShule.Domain/
├── SmartShule.Infrastructure/
└── SmartShule.Contracts/
tests/
├── SmartShule.UnitTests/
├── SmartShule.IntegrationTests/
└── SmartShule.SecurityTests/
```

Les contrôleurs doivent rester minces. Un contrôleur ne doit pas appeler directement `DbContext` pour appliquer une règle métier. Il doit déléguer à une commande ou à une requête de l’application.

#### C. Contrats d’API

Les entités EF Core ne doivent jamais être retournées directement au portail. Chaque endpoint doit utiliser des DTO dédiés : `ChildSummaryDto`, `ParentDashboardDto`, `AssignmentDto`, `SubmissionDto`, `ParentRequestDto`, `AnnouncementDto` et `ProblemDetailsDto`.

Exemple de contrat de tableau de bord :

```csharp
public sealed record ParentDashboardDto(
    Guid ChildId,
    string DisplayName,
    string? ClassName,
    IReadOnlyList<AlertDto> Alerts,
    IReadOnlyList<UpcomingAssignmentDto> UpcomingAssignments,
    IReadOnlyList<PublishedReportCardDto> ReportCards,
    FeeSummaryDto? Fees);
```

Les DTO de sortie ne doivent pas contenir de données internes telles que les notes privées, les identifiants techniques inutiles, les mots de passe, les chemins de fichiers ou les commentaires non publiés.

#### D. Pipeline HTTP obligatoire

L’ordre du pipeline doit garantir que les requêtes sont sécurisées avant leur traitement :

```text
Exception handler
→ HTTPS redirection / HSTS en production
→ Correlation ID
→ Serilog request logging
→ Security headers
→ CORS strict
→ Rate limiting
→ Authentication
→ Authorization
→ Routing
→ Validation
→ Controllers / Endpoints
```

Le middleware d’exception doit retourner `ProblemDetails` et ne doit pas exposer la trace .NET en production. Il doit inscrire l’exception complète dans un système de journalisation protégé avec le `traceId`.

#### E. Configuration sécurisée

Les paramètres sensibles doivent être fournis par variables d’environnement, gestionnaire de secrets ou coffre sécurisé : chaîne de connexion, secret d’identité, certificats, clés de stockage et clés de fournisseurs de notification.

Exemple de configuration non sensible :

```json
{
  "Api": {
    "PublicBaseUrl": "https://api.smartshule.example",
    "MaxPageSize": 100,
    "DefaultPageSize": 25,
    "UploadMaxBytes": 10485760
  },
  "Authentication": {
    "Authority": "https://identity.smartshule.example",
    "Audience": "smartshule-portal",
    "RequireHttpsMetadata": true
  },
  "Cors": {
    "AllowedOrigins": ["https://portal.smartshule.example"]
  }
}
```

La configuration doit être validée au démarrage. Si une valeur obligatoire manque en production, l’application doit refuser de démarrer plutôt que fonctionner avec une valeur par défaut dangereuse.

#### F. Authentification JWT Bearer

L’API doit valider au minimum l’émetteur, l’audience, la signature, la durée de validité et la présence du sujet utilisateur. Les tokens expirés, révoqués ou destinés à une autre API doivent être rejetés.

Exemple de configuration conceptuelle :

```csharp
builder.Services.AddAuthentication("Bearer")
    .AddJwtBearer("Bearer", options =>
    {
        options.Authority = configuration["Authentication:Authority"]!;
        options.Audience = configuration["Authentication:Audience"]!;
        options.RequireHttpsMetadata = true;
        options.MapInboundClaims = false;
        options.TokenValidationParameters.ValidateIssuer = true;
        options.TokenValidationParameters.ValidateAudience = true;
        options.TokenValidationParameters.ValidateLifetime = true;
        options.TokenValidationParameters.ClockSkew = TimeSpan.FromSeconds(30);
    });
```

Le portail ne doit pas accepter un token portant seulement un rôle sans vérifier que le compte est actif et que son rattachement métier est toujours valide.

#### G. Policies et autorisation métier

Les policies minimales sont : `PortalParentRead`, `PortalParentWrite`, `PortalStudentRead`, `PortalStudentSubmit`, `DirectionManageRequests`, `DirectionPublishContent`, `FinanceViewOwnFees` et `AdminAuditRead`.

Chaque commande doit utiliser un service tel que `IAccessScopeService` :

```csharp
Task<bool> CanParentAccessChildAsync(
    Guid userId,
    Guid childId,
    CancellationToken cancellationToken);
```

Ce service doit vérifier le rattachement en base centrale. Il ne doit pas faire confiance à un `childId` transmis par le navigateur ni à une simple valeur de rôle.

#### H. Accès aux données avec EF Core

Les requêtes de consultation doivent être en lecture seule lorsque cela est possible : `AsNoTracking()`. Les projections doivent sélectionner uniquement les colonnes utiles. Les listes doivent être paginées et indexées.

Les index prioritaires sont :

```text
ParentStudentLink(UserId, StudentId, IsActive)
Enrollment(StudentId, AcademicYearId, Status)
Assignment(ClassId, PublishedAt, DueAt)
Submission(StudentId, AssignmentId, Version)
ParentRequest(ParentId, Status, UpdatedAt)
Announcement(TargetType, TargetId, PublishedAt, ExpiresAt)
AuditLog(UserId, CreatedAt)
IdempotencyRecord(UserId, Key)
```

Les filtres globaux EF Core peuvent être utilisés pour l’archivage, mais la vérification de périmètre parent–élève doit rester explicite dans les requêtes sensibles afin d’éviter une erreur de configuration de filtre.

#### I. Pattern CQRS léger

Le portail doit utiliser des requêtes et commandes séparées :

```text
GetParentDashboardQuery
GetChildAssignmentsQuery
CreateParentRequestCommand
AddRequestMessageCommand
SubmitAssignmentCommand
FinalizeSubmissionCommand
PublishAnnouncementCommand
```

Chaque handler doit :

1. vérifier l’utilisateur courant ;
2. vérifier le périmètre de données ;
3. charger uniquement les données nécessaires ;
4. appliquer les règles métier ;
5. enregistrer la transaction et l’audit ;
6. publier l’événement Outbox si une notification est nécessaire ;
7. retourner un DTO ou un résultat métier.

#### J. Codes HTTP à respecter

| Situation | Réponse |
|---|---:|
| Consultation ou commande réussie | `200 OK` |
| Ressource créée | `201 Created` |
| Opération acceptée en arrière-plan | `202 Accepted` |
| Requête valide sans contenu | `204 No Content` |
| Token absent ou invalide | `401 Unauthorized` |
| Compte authentifié mais action interdite | `403 Forbidden` |
| Ressource inexistante ou non visible | `404 Not Found` |
| Conflit de version ou doublon métier | `409 Conflict` |
| Précondition `ETag` non respectée | `412 Precondition Failed` |
| Validation métier incorrecte | `422 Unprocessable Entity` |
| Trop de requêtes | `429 Too Many Requests` |
| Erreur inattendue | `500 Internal Server Error` |

Pour éviter de révéler l’existence d’un élève ou d’un document, l’API peut retourner `404 Not Found` lorsqu’un utilisateur authentifié ne possède pas le droit de voir la ressource.

#### K. Idempotence et transactions

Un middleware ou un behavior applicatif doit traiter `Idempotency-Key` pour les commandes. La clé doit être liée à l’utilisateur et à l’empreinte de la requête. La réponse originale doit être stockée dans `IdempotencyRecord` pendant une durée configurable.

La transaction doit inclure la ressource métier, l’audit et l’événement Outbox :

```text
BEGIN TRANSACTION
  vérifier clé d’idempotence
  vérifier autorisation et version
  modifier la ressource
  écrire AuditLog
  écrire OutboxMessage
  écrire IdempotencyRecord
COMMIT
```

Le worker de notification ne doit pas modifier la transaction métier. Il consomme l’Outbox, envoie le message et inscrit le résultat dans `NotificationDelivery`.

#### L. Upload et téléchargement sécurisé

Le serveur doit contrôler l’extension, le type MIME réel, la taille et l’empreinte du fichier. Le nom envoyé par l’utilisateur ne doit pas devenir le nom physique du fichier. Les fichiers doivent être stockés sous un identifiant aléatoire dans un conteneur privé.

Le flux recommandé est : intention d’envoi, transfert vers le stockage privé, confirmation, association au devoir ou à la demande. Une URL de téléchargement doit être courte, signée et générée seulement après autorisation.

#### M. Documentation OpenAPI

Swagger/OpenAPI doit être activé en développement et en préproduction. En production, sa disponibilité doit être protégée par authentification administrative ou désactivée selon la politique de sécurité.

La documentation doit présenter les schémas DTO, les réponses d’erreur, les scopes nécessaires, les exemples de pagination, les clés d’idempotence et les en-têtes `If-Match` / `ETag`.

#### N. Tests et définition de terminé

Une fonctionnalité API est terminée seulement si elle possède :

- DTO d’entrée et de sortie ;
- validation serveur ;
- policy ou vérification de permission ;
- contrôle du périmètre de données ;
- handler applicatif ;
- contrôleur ou endpoint ;
- audit ;
- gestion d’erreur ;
- test unitaire ;
- test d’intégration avec base de test ;
- test négatif d’accès à une autre famille ;
- documentation OpenAPI ;
- métrique ou journal pertinent.

Le pipeline CI doit exécuter `dotnet restore`, `dotnet build --no-restore`, les tests avec couverture, l’analyse statique et la vérification des vulnérabilités des dépendances. Aucun secret ne doit être présent dans le dépôt et aucune alerte critique ne doit être ignorée sans justification documentée.

### 14.2.14 Stratégie de synchronisation hors-ligne des postes

#### A. Objectif et périmètre

SmartShule doit fonctionner même lorsque le poste d’un service administratif ou d’un professeur ne peut pas joindre le serveur central. Le mode hors-ligne ne doit pas créer une seconde école indépendante. Il doit permettre de continuer un travail limité, puis de transmettre des opérations contrôlées au serveur central dès que la connexion est rétablie.

La synchronisation concerne deux catégories de postes :

| Poste | Peut travailler hors-ligne sur | Ne doit pas confirmer hors-ligne |
|---|---|---|
| Administration | dossiers, inscriptions préparatoires, affectations autorisées, présences, documents légers, demandes internes | clôture comptable, remboursement, paie finale, réservation commerciale définitive |
| Professeur | cours préparés, présences de ses classes, devoirs, observations, évaluations en brouillon | publication officielle des notes, modification d’une note validée, données d’une autre classe |

Les paiements, écritures comptables, réservations confirmées, publications officielles et validations définitives doivent être confirmés par le serveur central. L’application doit afficher clairement la différence entre `Enregistré localement`, `En attente de synchronisation`, `Accepté par le serveur`, `Rejeté` et `En conflit`.

#### B. Architecture locale

Chaque installation possède une base SQLite locale chiffrée autant que le permet l’environnement de déploiement. Elle contient uniquement le périmètre nécessaire au poste : établissement, direction, classes, groupes, matières, élèves autorisés et documents utiles.

```text
SmartShule Desktop
├── Interface métier
├── Domaine local et validation
├── SQLite locale
├── Outbox des opérations locales
├── Inbox des changements du serveur
├── Curseur de téléchargement
├── Moteur de synchronisation
└── Journal local de diagnostic
```

La base locale ne doit pas être une copie complète de la base centrale. La réplication doit être filtrée par établissement, direction, classe, matière, rôle et période scolaire. Un professeur ne doit jamais recevoir en local les dossiers des autres classes uniquement parce qu’ils existent sur le serveur.

#### C. Identité des données

Toutes les entités synchronisables doivent utiliser un identifiant global `Guid` créé au moment de la création locale. Elles doivent aussi comporter :

```text
GlobalId
TenantId ou SchoolId
CreatedAtUtc
UpdatedAtUtc
CreatedBy
UpdatedBy
EntityVersion
IsDeleted
LastServerSequence
```

Les dates échangées avec le serveur doivent être en UTC. L’heure locale ne doit jamais décider seule de l’ordre d’une opération sensible. Le serveur attribue une séquence globale ou un curseur de changement pour permettre une réception ordonnée.

#### D. Outbox : file d’envoi locale

Toute commande locale doit être enregistrée dans la même transaction que la modification métier locale. Ainsi, une présence enregistrée localement ne peut pas être validée sans que son opération de synchronisation soit également conservée.

Structure minimale de `SyncOutbox` :

```text
OperationId       Guid unique
AggregateType     Type d’entité
AggregateId       Guid de l’entité
OperationType     Create | Update | Delete | Submit | Publish
Payload           JSON versionné
PayloadHash       Empreinte du payload
BaseVersion       Version connue au moment de l’édition
DeviceId          Identifiant de l’installation
UserId            Utilisateur local
CreatedAtUtc      Date de création
Status            Pending | Sending | Accepted | Rejected | Conflict
AttemptCount      Nombre de tentatives
LastErrorCode     Code technique ou métier
```

Le payload doit décrire une intention métier plutôt qu’une copie arbitraire de ligne SQL. Exemples : `RecordStudentAttendance`, `SaveTeacherDraftGrade`, `SubmitAssignment`, `CreateEnrollmentDraft` et `UpdateLessonMaterial`.

#### E. Inbox et curseur de réception

Le serveur expose un flux de changements autorisés par le poste :

```http
GET /api/v1/sync/changes?cursor=18420&limit=200
```

La réponse contient les changements, le prochain curseur et une indication éventuelle de resynchronisation complète :

```json
{
  "items": [],
  "nextCursor": 18620,
  "hasMore": true,
  "requiresSnapshot": false
}
```

Le poste applique les changements entrants dans une transaction SQLite. Il ne déplace le curseur qu’après l’application réussie de tout le lot. Si le poste s’arrête au milieu du traitement, il reprend avec le même curseur sans perdre les changements.

Une table `SyncInbox` doit conserver les `ChangeId` déjà appliqués. La réception répétée du même changement doit être ignorée sans produire de doublon.

#### F. Cycle complet de synchronisation

Le moteur suit le cycle suivant :

```text
1. Détecter la connectivité
2. Authentifier le poste et l’utilisateur
3. Envoyer les opérations Outbox par petits lots
4. Recevoir les accusés de réception
5. Marquer les opérations acceptées
6. Isoler les opérations rejetées ou en conflit
7. Télécharger les changements depuis le dernier curseur
8. Appliquer l’Inbox dans une transaction locale
9. Avancer le curseur
10. Télécharger les métadonnées ou fichiers autorisés
11. Afficher l’état de synchronisation à l’utilisateur
```

La synchronisation doit être déclenchée manuellement et automatiquement. Le déclenchement automatique doit utiliser un délai progressif en cas d’échec : par exemple 30 secondes, 2 minutes, 5 minutes, 15 minutes, puis une limite configurable. Il ne faut pas créer une boucle de requêtes permanente lorsque le serveur est indisponible.

#### G. API de synchronisation

Les endpoints minimum sont :

```text
POST /api/v1/sync/push
GET  /api/v1/sync/changes
POST /api/v1/sync/acknowledge
GET  /api/v1/sync/status
POST /api/v1/sync/resolve-conflict
POST /api/v1/sync/request-snapshot
```

`POST /sync/push` doit accepter un lot limité et retourner un résultat par opération :

```json
{
  "results": [
    {
      "operationId": "...",
      "status": "Accepted",
      "serverVersion": 42,
      "serverSequence": 18621
    },
    {
      "operationId": "...",
      "status": "Conflict",
      "code": "STALE_VERSION",
      "conflictId": "..."
    }
  ]
}
```

Le serveur doit traiter chaque `OperationId` de manière idempotente. Si un lot est renvoyé après une coupure, une opération déjà acceptée doit retourner son résultat précédent sans être rejouée.

#### H. Stratégies par type de donnée

Les données ne doivent pas toutes utiliser la même résolution de conflit.

| Donnée | Stratégie hors-ligne |
|---|---|
| Référentiels | Téléchargement depuis le serveur ; modification réservée à l’administration centrale |
| Dossier élève | Modification locale limitée ; conflit envoyé au secrétariat |
| Inscription | Brouillon local ; validation centrale obligatoire |
| Présence | Événement daté avec identifiant unique ; fusion si deux postes ne saisissent pas le même événement |
| Note en brouillon | Dernière version valide ou comparaison manuelle selon la version de base |
| Note publiée | Modification interdite ; correction par procédure officielle |
| Cours | Brouillon local du professeur puis publication contrôlée |
| Devoir | Création locale possible ; publication après validation ou règle configurée |
| Paiement | Aucun paiement financier définitif hors confirmation centrale |
| Réservation de salle ou véhicule | Consultation locale possible ; confirmation atomique en ligne obligatoire |
| Document | Versionnement ; conservation des versions concurrentes |
| Suppression | Suppression logique sous forme d’événement auditable |

#### I. Présences des élèves et enseignants

Les présences doivent être modélisées comme des événements, et non comme une simple valeur écrasable :

```text
AttendanceEventId
StudentId ou EmployeeId
ClassId
SessionId
Status: Present | Late | Absent | Excused
RecordedAtUtc
RecordedBy
DeviceId
CorrectionOfEventId éventuel
```

Si deux postes enregistrent la présence pour la même séance et le même élève, le serveur doit détecter le doublon logique. Il peut fusionner automatiquement les enregistrements identiques. Si les statuts diffèrent, il doit créer un conflit pour le responsable pédagogique, sans choisir silencieusement la dernière saisie.

#### J. Notes et évaluations

Un professeur peut saisir une note hors-ligne uniquement dans l’état `Brouillon`. Le poste peut calculer localement un aperçu, mais la note n’est pas officielle.

Le serveur doit contrôler : élève, matière, évaluation, barème, période, professeur habilité et version de l’évaluation. La publication suit ce flux :

```text
Brouillon local → Synchronisé → Contrôlé → Validé → Publié
```

Après publication, toute modification crée une correction référencée à la note initiale. Le portail parent ne reçoit que la note publiée.

#### K. Documents et contenus de cours

Les métadonnées d’un document peuvent être synchronisées avant le contenu. Les fichiers volumineux doivent être téléchargés à la demande et conservés dans un cache chiffré avec une date d’expiration.

Un cours préparé hors-ligne possède une version locale. Si une version centrale plus récente existe, le professeur doit voir les différences et choisir de fusionner, remplacer ou conserver son brouillon. Aucun fichier central ne doit être remplacé automatiquement par un brouillon local.

#### L. Gestion des conflits

Une table `SyncConflict` doit conserver :

```text
ConflictId
OperationId
AggregateType
AggregateId
LocalPayload
ServerPayload
BaseVersion
ServerVersion
ConflictType
AssignedTo
Status: Open | UnderReview | Resolved | Rejected
ResolutionNote
ResolvedAtUtc
ResolvedBy
```

L’interface doit présenter les valeurs locales et centrales, l’utilisateur source, les dates, les versions et les conséquences. Les résolutions possibles sont `KeepServer`, `KeepLocal`, `Merge` ou `CreateCorrection`. Les choix autorisés dépendent du rôle et du type de donnée.

Un professeur ne peut pas résoudre un conflit de paiement, de dossier administratif ou de note publiée. Il peut uniquement corriger son brouillon ou transmettre le conflit au responsable autorisé.

#### M. Sécurité du poste déconnecté

Chaque installation doit avoir un `DeviceId` enregistré et révocable. Le serveur doit pouvoir désactiver un poste perdu ou compromis. Les tokens et secrets locaux doivent être protégés par le mécanisme sécurisé du système d’exploitation lorsque cela est disponible.

L’accès hors-ligne doit être limité dans le temps. Après une durée configurable sans renouvellement de session, l’utilisateur doit pouvoir consulter uniquement les données non sensibles déjà autorisées, ou être contraint de se reconnecter. Les actions financières et les exports sensibles doivent être interdits si la session locale n’est plus considérée comme fiable.

La base locale doit être chiffrée ou protégée au niveau du disque. Les journaux locaux ne doivent pas contenir de mots de passe, tokens, données médicales ou documents confidentiels en clair.

#### N. Reprise, erreurs et resynchronisation complète

Le moteur doit distinguer : absence de réseau, serveur indisponible, token expiré, opération rejetée, conflit métier, schéma local obsolète et corruption locale.

Si le serveur indique que le curseur est trop ancien ou que les changements nécessaires ne sont plus disponibles, il doit demander un snapshot. Le poste réalise alors :

```text
1. sauvegarde locale chiffrée
2. export des opérations Outbox non traitées
3. téléchargement d’un snapshot filtré
4. restauration dans une base temporaire
5. réinjection contrôlée de l’Outbox
6. reprise du curseur
7. archivage du diagnostic
```

Une resynchronisation complète ne doit jamais écraser sans sauvegarde les opérations locales non confirmées.

#### O. Indicateurs de supervision

L’administration doit suivre :

- dernier contact de chaque poste ;
- durée depuis la dernière synchronisation réussie ;
- nombre d’opérations en attente ;
- nombre de rejets ;
- nombre de conflits ouverts ;
- taille de l’Outbox ;
- délai moyen d’acceptation ;
- version de l’application et du schéma local ;
- postes désactivés ou obsolètes.

Le professeur doit voir un indicateur simple dans l’application : **Synchronisé**, **Travail local en attente**, **Erreur à corriger** ou **Connexion requise**. L’administration doit disposer du détail technique et pouvoir relancer une opération autorisée.

#### P. Tests obligatoires

La synchronisation doit être validée par des tests d’intégration et de panne :

1. saisie d’une présence sans réseau puis synchronisation réussie ;
2. arrêt du poste pendant l’envoi d’un lot ;
3. renvoi du même lot et absence de doublon ;
4. expiration du token pendant la synchronisation ;
5. serveur indisponible pendant plusieurs tentatives ;
6. conflit entre deux saisies de présence ;
7. conflit entre une note locale et une note centrale publiée ;
8. restauration après corruption de la base locale ;
9. resynchronisation complète avec Outbox non traitée ;
10. interdiction pour un professeur de recevoir ou modifier les données d’une autre classe ;
11. absence d’écriture financière définitive hors confirmation centrale ;
12. téléchargement différé et sécurisé d’un document de cours.

La définition de terminé exige que chaque scénario produise un journal de synchronisation exploitable, un résultat déterministe et une preuve que les données non confirmées n’ont pas été perdues.

### 14.2.15 Architecture de base de données pour la synchronisation hors-ligne

#### A. Modèle général

SmartShule utilise une architecture **hub-and-spoke** : une base centrale fait autorité et plusieurs bases locales de postes échangent des opérations contrôlées avec elle. Une base locale n’est jamais une copie complète et autonome de l’établissement.

```text
Base locale Administration A ─┐
Base locale Administration B ─┼─ API Sync ── Base centrale SmartShule
Base locale Professeur P1 ───┤                    ├─ Portail web
Base locale Professeur P2 ───┘                    ├─ Rapports
                                                  └─ Sauvegardes
```

La base centrale est la source d’autorité pour les référentiels, les permissions, les validations officielles, les paiements, les écritures comptables, les réservations confirmées, les notes publiées et les documents officiels. La base locale est une zone de travail limitée au périmètre du poste.

#### B. Technologies et responsabilités

| Élément | Technologie recommandée | Responsabilité |
|---|---|---|
| Base centrale | SQL Server ou PostgreSQL | Données officielles, transactions, contraintes et historique |
| Base locale | SQLite | Travail hors-ligne, cache filtré et Outbox |
| Accès central | EF Core 8 | Migrations, transactions et requêtes paramétrées |
| Accès local | EF Core SQLite | Modèle local et transactions embarquées |
| Échange | API REST ASP.NET Core 8 | Push, pull, accusés et conflits |
| Fichiers | Stockage privé central | Documents, pièces jointes et téléchargement différé |
| Identité | Service d’identité central | Utilisateurs, appareils, tokens et permissions |

Le code métier ne doit pas dépendre directement de SQLite ou de SQL Server. Les différences de fournisseur doivent être isolées dans l’infrastructure.

#### C. Schéma logique central

La base centrale doit distinguer les tables métier, les tables de synchronisation et les tables d’audit.

Tables métier principales :

```text
School, Site, Directorate, Section, AcademicYear, ClassRoom, Subject
Student, Guardian, GuardianStudentLink, Enrollment
Employee, TeacherAssignment, Course, CourseSession, Attendance
Assessment, Grade, Assignment, Submission, ReportCard
FeeDefinition, Invoice, InvoiceLine, Payment, AccountingEntry
Room, RoomRental, Vehicle, VehicleRental, Asset, MaintenanceRequest
ParentRequest, Announcement, Document, Notification
```

Tables de synchronisation :

```text
SyncDevice
SyncScope
SyncOperation
SyncOperationResult
SyncChange
SyncCursor
SyncConflict
SyncSnapshot
IdempotencyRecord
```

Tables de contrôle :

```text
User, Role, Permission, UserRole, RolePermission
UserScope, Session, RefreshToken, AuditLog
OutboxMessage, NotificationDelivery, ExportJob
```

#### D. Colonnes communes des entités synchronisables

Toute entité métier synchronisable doit comporter au minimum :

```text
Id                 UUID/GUID global, clé primaire
SchoolId           Établissement propriétaire
CreatedAtUtc       Date de création UTC
CreatedBy          Utilisateur créateur
UpdatedAtUtc       Dernière modification UTC
UpdatedBy          Dernier utilisateur modificateur
RowVersion         Version de concurrence
IsDeleted          Suppression logique
DeletedAtUtc       Date d’archivage éventuelle
LastChangeSequence Séquence centrale connue
```

Sur SQL Server, `rowversion` peut être utilisé pour la concurrence. Sur PostgreSQL ou SQLite, une colonne de version entière ou un jeton généré par l’application doit être utilisé. La version doit augmenter à chaque modification métier validée.

Les identifiants sont générés avec `Guid.CreateVersion7()` lorsque la version .NET et la bibliothèque adoptée le permettent, ou avec des GUID aléatoires robustes. Un poste ne doit jamais générer un identifiant séquentiel dépendant uniquement de son horloge locale.

#### E. Tables locales

La base SQLite locale doit contenir uniquement les entités nécessaires au poste, ainsi que les tables techniques suivantes :

```sql
CREATE TABLE SyncOutbox (
    OperationId TEXT PRIMARY KEY,
    AggregateType TEXT NOT NULL,
    AggregateId TEXT NOT NULL,
    OperationType TEXT NOT NULL,
    PayloadJson TEXT NOT NULL,
    PayloadHash TEXT NOT NULL,
    BaseVersion INTEGER NULL,
    DeviceId TEXT NOT NULL,
    UserId TEXT NOT NULL,
    CreatedAtUtc TEXT NOT NULL,
    Status TEXT NOT NULL,
    AttemptCount INTEGER NOT NULL DEFAULT 0,
    LastAttemptAtUtc TEXT NULL,
    LastErrorCode TEXT NULL,
    LastErrorMessage TEXT NULL
);

CREATE TABLE SyncInbox (
    ChangeId TEXT PRIMARY KEY,
    ServerSequence INTEGER NOT NULL,
    AggregateType TEXT NOT NULL,
    AggregateId TEXT NOT NULL,
    ChangeType TEXT NOT NULL,
    PayloadJson TEXT NOT NULL,
    ReceivedAtUtc TEXT NOT NULL,
    AppliedAtUtc TEXT NULL,
    Status TEXT NOT NULL
);

CREATE TABLE LocalSyncState (
    DeviceId TEXT PRIMARY KEY,
    LastDownloadedSequence INTEGER NOT NULL DEFAULT 0,
    LastUploadedAtUtc TEXT NULL,
    LastDownloadedAtUtc TEXT NULL,
    SchemaVersion INTEGER NOT NULL,
    Status TEXT NOT NULL
);

CREATE TABLE LocalConflict (
    ConflictId TEXT PRIMARY KEY,
    OperationId TEXT NOT NULL,
    AggregateType TEXT NOT NULL,
    AggregateId TEXT NOT NULL,
    LocalPayloadJson TEXT NOT NULL,
    ServerPayloadJson TEXT NULL,
    Status TEXT NOT NULL,
    CreatedAtUtc TEXT NOT NULL
);
```

La table `SyncOutbox` doit avoir des index sur `Status`, `CreatedAtUtc` et `DeviceId`. `SyncInbox` doit avoir un index sur `ServerSequence` et `Status`. Les opérations locales non acceptées ne doivent jamais être supprimées automatiquement par une tâche de nettoyage.

#### F. Tables centrales de synchronisation

La table `SyncDevice` doit contenir :

```text
DeviceId, SchoolId, DeviceType, UserId, AppVersion,
SchemaVersion, LastSeenAtUtc, RevokedAtUtc, Status,
PublicKey ou DeviceSecretReference
```

La table `SyncScope` décrit le périmètre autorisé d’un appareil : établissement, site, direction, classes, matières, groupes et date d’expiration. Ce périmètre est recalculé ou invalidé lorsqu’un rôle, une affectation ou un rattachement change.

La table `SyncOperation` conserve l’opération reçue : `OperationId`, `DeviceId`, `UserId`, `PayloadHash`, `ReceivedAtUtc`, `ProcessedAtUtc`, `Status`, `ResultJson`, `ErrorCode` et `ConflictId` éventuel. Une contrainte unique sur `OperationId` garantit l’idempotence.

La table `SyncChange` représente les changements publiables : `ChangeId`, `ServerSequence`, `SchoolId`, `AggregateType`, `AggregateId`, `ChangeType`, `PayloadJson`, `CreatedAtUtc`, `VisibilityScope` et `ExpiresAtUtc` éventuel. La séquence centrale doit être monotone par base centrale.

#### G. Transactions locales

Une modification locale doit utiliser une transaction SQLite unique :

```text
BEGIN
  vérifier le rôle local et le périmètre en cache
  modifier la donnée locale
  augmenter la version locale
  créer SyncOutbox
COMMIT
```

Si l’écriture métier réussit mais que l’Outbox échoue, toute la transaction doit être annulée. Une donnée locale non représentée dans l’Outbox ne doit pas être considérée comme synchronisable.

#### H. Transaction de réception centrale

Le serveur traite chaque opération dans une transaction :

```text
BEGIN TRANSACTION
  vérifier DeviceId, session, rôle et périmètre
  vérifier OperationId et PayloadHash
  vérifier BaseVersion et règle de conflit
  appliquer la commande métier
  enregistrer SyncOperation
  créer SyncChange
  écrire AuditLog
  créer OutboxMessage si notification nécessaire
COMMIT
```

Une opération financière ou une réservation confirmée doit produire dans la même transaction sa donnée métier, son écriture ou verrou de ressource, son audit et son résultat de synchronisation.

#### I. Curseur et séquence de changements

Le poste conserve un `LastDownloadedSequence`. Le serveur retourne les changements où `ServerSequence > LastDownloadedSequence` et qui appartiennent au périmètre de l’appareil.

Le curseur ne doit avancer qu’après application atomique du lot local. Si un lot contient un changement invalide, le poste doit isoler l’erreur et ne pas perdre les changements suivants. Le serveur doit pouvoir retourner un `requiresSnapshot` lorsque le curseur est trop ancien ou qu’une rétention a été dépassée.

La séquence n’est pas une date et ne doit pas être calculée par le poste. Elle est attribuée par le serveur central dans une transaction afin de garantir l’ordre observable des changements.

#### J. Règles de rétention

Les changements nécessaires aux postes doivent être conservés pendant une durée supérieure à la durée maximale prévue de déconnexion. Les éléments suivants ne doivent pas être supprimés avant archivage : opérations non traitées, conflits ouverts, audits, écritures comptables et documents officiels.

Une politique peut archiver les `SyncChange` déjà consommés par tous les appareils actifs. Avant suppression d’un ancien changement, le système doit vérifier les appareils inactifs et déclencher une resynchronisation complète si leur curseur est trop ancien.

#### K. Conflits au niveau base de données

Un conflit est créé si :

- `BaseVersion` ne correspond plus à `RowVersion` centrale ;
- le même événement logique existe déjà avec une valeur différente ;
- une donnée est archivée localement alors qu’elle a été modifiée au central ;
- un poste n’a plus le périmètre requis ;
- une règle métier interdit l’application tardive de l’opération.

`SyncConflict` doit conserver les versions locale, centrale et de base, les payloads, les auteurs, les dates, le type de conflit, le responsable et la résolution. Une résolution ne doit jamais modifier directement l’historique : elle produit une nouvelle opération auditable.

#### K.1 Politique retenue pour les absences

Les absences ne doivent pas être traitées comme une simple valeur écrasable par la dernière synchronisation. Elles sont modélisées comme des événements liés à une séance, un élève et une source de saisie.

La politique retenue est la suivante :

| Situation | Stratégie |
|---|---|
| Deux postes saisissent exactement le même statut pour la même séance et le même élève | Déduplication automatique grâce à une clé métier |
| Deux postes saisissent des événements différents pour des séances différentes | Fusion automatique des événements |
| Un poste ajoute une justification à une absence existante sans modifier le statut | Fusion contrôlée des champs si la version n’a pas été clôturée |
| Un poste indique `Présent` et un autre `Absent` pour la même séance | Conflit manuel, jamais Last-Write-Wins |
| Un responsable autorisé corrige une absence déjà validée | Nouvelle opération de correction référencée à l’événement initial |
| Une absence est publiée sur le portail parent | Modification directe interdite ; correction par workflow audité |

La clé logique recommandée est :

```text
AttendanceKey = SchoolId + SessionId + StudentId
```

Le serveur peut fusionner automatiquement deux événements strictement identiques, mais il ne doit jamais choisir le dernier statut uniquement sur la base de `UpdatedAtUtc`, de l’heure du poste ou de l’ordre d’arrivée du paquet. Une absence contradictoire est affectée au responsable pédagogique ou au rôle administratif désigné.

La résolution doit afficher : élève, séance, classe, statut local, statut central, justificatif, auteur, appareil, dates et versions. Les décisions possibles sont `ConserverPrésent`, `ConserverAbsent`, `MarquerJustifié`, `CréerCorrection` ou `RetournerPourVérification`, selon les permissions.

#### K.2 Politique retenue pour les notes

La stratégie dépend de l’état de la note. Le **Last-Write-Wins n’est acceptable que pour un brouillon non publié**, et uniquement lorsque la version centrale n’a pas été publiée ou verrouillée entre-temps.

| État de la note | Stratégie |
|---|---|
| Brouillon local d’un professeur, aucune version centrale plus récente | Acceptation de la mise à jour si `BaseVersion` correspond |
| Deux modifications de brouillon sur une même note | Conflit de version ; comparaison manuelle ou LWW explicitement configuré pour les brouillons |
| Note contrôlée mais non publiée | Résolution par responsable pédagogique si deux versions diffèrent |
| Note publiée | Aucun écrasement ; correction officielle obligatoire |
| Bulletin publié | Aucune modification directe ; réouverture autorisée uniquement par rôle habilité |
| Note calculée à partir d’évaluations | Recalcul contrôlé depuis les évaluations sources, jamais remplacement libre |

La règle par défaut de SmartShule est donc :

```text
Brouillon non publié  → concurrence optimiste, LWW limité et traçable si autorisé
Note contrôlée        → résolution manuelle
Note publiée          → correction officielle, jamais LWW
Bulletin publié       → réouverture exceptionnelle et audit obligatoire
```

Même lorsqu’un LWW est autorisé sur un brouillon, le serveur doit vérifier la version de base, conserver la version précédente dans l’historique et enregistrer l’auteur, l’appareil et l’heure UTC. Le LWW ne doit pas s’appliquer à une note publiée, à un bulletin, à une moyenne validée ou à une écriture comptable associée.

Une correction de note doit créer une opération de type `GradeCorrection` contenant :

```text
OriginalGradeId
PreviousValue
CorrectedValue
Reason
RequestedBy
ApprovedBy
ApprovedAtUtc
EvidenceDocumentId éventuel
```

Le portail parent ne doit afficher la nouvelle valeur qu’après validation et republication du résultat. L’historique de l’ancienne note reste accessible aux rôles d’audit autorisés.

#### K.3 Règle générale de décision

SmartShule ne doit pas utiliser une politique unique pour toutes les données. La règle est déterminée par la nature métier et l’état de la donnée :

```text
Événement indépendant       → fusion ou déduplication automatique
Brouillon réversible        → concurrence optimiste, LWW limité si autorisé
Donnée contradictoire       → résolution manuelle
Donnée publiée ou financière→ correction officielle auditée
```

Le type de résolution appliqué doit être stocké dans `SyncConflict.ResolutionStrategy`, avec les valeurs `AutoDeduplicated`, `Merged`, `LastWriteWinsDraft`, `ManualResolution` ou `CorrectionWorkflow`. Cela permet aux rapports d’audit de distinguer une fusion automatique d’une décision humaine.

#### L. Intégrité, contraintes et index

La base centrale doit utiliser des clés étrangères, contraintes d’unicité et index adaptés. Exemples :

```text
Unique(Student, SchoolId, StudentNumber)
Unique(Enrollment, StudentId, AcademicYearId)
Unique(Attendance, SessionId, StudentId)
Unique(SyncOperation, OperationId)
Unique(SyncInbox, ChangeId)
Unique(IdempotencyRecord, UserId, Key)
Index(SyncChange, SchoolId, ServerSequence)
Index(SyncConflict, Status, AssignedTo)
```

Les contraintes spécifiques aux fournisseurs doivent être couvertes par des tests sur SQL Server ou PostgreSQL, et par des tests SQLite pour le comportement local. Une contrainte critique ne doit pas être simulée uniquement dans l’interface.

#### M. Migration et version du schéma local

Chaque base locale possède un `SchemaVersion`. Le poste ne doit pas synchroniser si son schéma est incompatible avec le serveur. Les migrations locales doivent être non destructives par défaut : ajouter une colonne, migrer les données, puis supprimer l’ancien champ dans une version ultérieure.

Avant une migration, le poste sauvegarde sa base et l’Outbox. En cas d’échec, il restaure la base locale et conserve l’export des opérations non traitées. Une nouvelle version de l’application doit pouvoir lire la version précédente pendant une période de transition.

#### N. Sauvegarde et resynchronisation complète

Une resynchronisation complète suit ce flux :

```text
1. verrouiller les nouvelles opérations locales
2. sauvegarder SQLite et exporter l’Outbox
3. demander un snapshot filtré par périmètre
4. restaurer le snapshot dans une base temporaire
5. valider l’intégrité et la version du schéma
6. remplacer la base active de manière atomique
7. réinjecter l’Outbox dans l’ordre
8. traiter les conflits
9. reprendre avec le nouveau curseur
10. archiver le diagnostic
```

Le remplacement de la base active doit être atomique. Il ne doit pas supprimer les données locales non confirmées avant qu’une copie vérifiable soit disponible.

#### O. Critères d’acceptation de la base de données

L’architecture est acceptée lorsque :

- une transaction locale enregistre toujours donnée et Outbox ensemble ;
- une opération reçue deux fois ne produit qu’un seul effet ;
- un changement reçu deux fois ne produit qu’une seule application locale ;
- le curseur ne progresse pas après un lot non appliqué ;
- un professeur ne reçoit aucune donnée hors de sa classe ou matière ;
- une note publiée et un paiement validé ne sont jamais écrasés silencieusement ;
- les conflits contiennent les versions et payloads nécessaires ;
- une base locale corrompue peut être restaurée ;
- une migration locale ne perd pas l’Outbox ;
- une resynchronisation complète conserve les opérations non confirmées ;
- les contraintes d’unicité empêchent les doublons métier ;
- les sauvegardes centrale et locale sont testées par restauration réelle.

### 14.2.16 Cas de test et scénarios de validation de la synchronisation

#### A. Préconditions communes

Les tests doivent être exécutés dans un environnement de test isolé comprenant :

- un serveur SmartShule avec une base centrale de test ;
- un poste administratif A équipé d’une base SQLite locale ;
- un poste professeur P équipé d’une base SQLite locale ;
- deux utilisateurs administratifs avec des périmètres différents ;
- deux professeurs affectés à des classes différentes ;
- au moins deux élèves, deux classes et deux matières ;
- une séance de cours, une évaluation, un devoir et un document ;
- un simulateur permettant de couper le réseau, ralentir l’API, retourner des erreurs HTTP et interrompre le processus local ;
- un horodatage UTC contrôlé dans les tests ;
- un accès aux journaux, à l’Outbox, à l’Inbox et aux tables de conflits.

Chaque cas doit être exécuté avec un identifiant de corrélation. Les résultats doivent conserver la requête, la réponse, l’état de l’Outbox avant et après, le curseur avant et après, ainsi que les lignes d’audit produites.

#### B. États attendus

Les états fonctionnels minimum sont :

```text
Pending → Sending → Accepted
Pending → Sending → Rejected
Pending → Sending → Conflict
Sending → Retrying → Accepted
Sending → Retrying → Rejected
```

Une opération `Accepted` ne doit plus être rejouée. Une opération `Rejected` doit rester consultable avec un motif. Une opération `Conflict` doit être associée à un `SyncConflict` et ne doit pas être supprimée automatiquement.

#### C. Matrice des tests fonctionnels

| ID | Scénario | Préconditions | Action | Résultat attendu |
|---|---|---|---|---|
| SYNC-F01 | Première connexion d’un poste | Poste autorisé, base locale vide | Demander un snapshot filtré | Seules les données du périmètre sont importées et le curseur initial est enregistré |
| SYNC-F02 | Saisie hors-ligne d’une présence | Professeur affecté à la classe, réseau coupé | Enregistrer une présence | La présence et l’opération Outbox sont enregistrées dans une même transaction locale |
| SYNC-F03 | Reconnexion après présence | SYNC-F02 terminé | Rétablir le réseau et synchroniser | L’opération est acceptée, la présence centrale est créée une seule fois et l’Outbox passe à `Accepted` |
| SYNC-F04 | Création d’un brouillon de cours | Professeur autorisé, réseau coupé | Préparer un cours | Le cours reste en brouillon local et n’est pas visible sur le portail parent |
| SYNC-F05 | Publication contrôlée d’un cours | Cours local synchronisé | Publier sans permission | L’opération est rejetée ; aucun contenu n’est publié |
| SYNC-F06 | Devoir hors-ligne | Professeur autorisé | Créer un devoir avec date limite | Le devoir est stocké localement ; sa publication suit la règle de validation configurée |
| SYNC-F07 | Dépôt de devoir hors-ligne | Élève et devoir disponibles localement | Déposer puis finaliser | Le fichier et l’intention sont conservés ; la confirmation centrale intervient après reconnexion |
| SYNC-F08 | Inscription en brouillon | Agent administratif autorisé | Créer un dossier hors-ligne | Le dossier est marqué brouillon ou en attente ; aucun matricule officiel contradictoire n’est généré |
| SYNC-F09 | Validation administrative centrale | Dossier synchronisé | Valider depuis l’administration centrale | Le statut devient officiel et le changement est envoyé aux postes autorisés |
| SYNC-F10 | Paiement hors-ligne interdit | Poste sans connexion | Tenter de valider un paiement | L’action est bloquée ou enregistrée comme intention non financière ; aucun reçu comptable définitif n’est créé |
| SYNC-F11 | Réservation hors-ligne | Salle déjà potentiellement utilisée | Confirmer une location sans serveur | La confirmation est refusée ; seule une demande provisoire peut être sauvegardée selon la règle métier |
| SYNC-F12 | Curseur de réception | Poste avec curseur connu | Télécharger les changements | Seuls les changements après le curseur sont reçus et le curseur avance après transaction réussie |
| SYNC-F13 | Réception par lots | Plus de 200 changements | Télécharger avec limite 200 | Les lots sont traités dans l’ordre sans perte ni duplication |
| SYNC-F14 | Reprise après interruption locale | Lot en cours d’application | Arrêter le poste puis redémarrer | Le lot est rejoué sans corruption ; les changements déjà appliqués restent idempotents |
| SYNC-F15 | Mise à jour d’un référentiel | Référentiel modifié au central | Synchroniser un poste | La valeur centrale est reçue ; le poste ne peut pas créer une version concurrente non autorisée |
| SYNC-F16 | Suppression logique | Élève archivé au central | Synchroniser un poste autorisé | Le dossier devient invisible dans les listes actives mais reste conservé dans l’historique autorisé |
| SYNC-F17 | Fichier différé | Métadonnée synchronisée, contenu absent | Ouvrir le document après reconnexion | Le fichier est téléchargé par URL autorisée puis conservé dans le cache avec son empreinte vérifiée |
| SYNC-F18 | Indicateur utilisateur | Opérations en attente | Ouvrir l’application | L’interface affiche `Travail local en attente` et le nombre d’opérations sans exposer de détails sensibles |

#### D. Tests d’idempotence et de doublons

| ID | Scénario | Action | Résultat attendu |
|---|---|---|---|
| SYNC-I01 | Même opération envoyée deux fois | Renvoyer le même `OperationId` | Le serveur retourne le premier résultat ; une seule donnée métier est créée |
| SYNC-I02 | Même clé avec payload différent | Réutiliser `Idempotency-Key` avec un contenu différent | Le serveur retourne `409 Conflict` et n’applique pas la deuxième requête |
| SYNC-I03 | Timeout après commit | Couper la réponse après validation centrale puis renvoyer | Le serveur reconnaît l’opération déjà validée et ne double pas l’écriture |
| SYNC-I04 | Double clic utilisateur | Cliquer deux fois sur synchroniser ou finaliser | Une seule commande est traitée ; l’interface affiche l’état déjà obtenu |
| SYNC-I05 | Réception d’un même changement | Insérer deux fois le même `ChangeId` dans l’Inbox | Une seule application locale est effectuée |

#### E. Tests de conflits et de concurrence

| ID | Scénario | Action | Résultat attendu |
|---|---|---|---|
| SYNC-C01 | Deux présences identiques | Deux postes saisissent `Absent` pour le même élève et la même séance | Le serveur fusionne ou ignore le doublon selon la clé métier ; aucune double absence n’apparaît |
| SYNC-C02 | Présences contradictoires | Un poste saisit `Présent`, l’autre `Absent` | Un conflit est créé ; aucune valeur n’est choisie silencieusement |
| SYNC-C03 | Note locale contre note publiée | Professeur modifie une note ancienne pendant qu’elle est publiée au central | L’opération est rejetée ou transformée en demande de correction ; la note publiée reste intacte |
| SYNC-C04 | Deux modifications de dossier élève | Deux postes modifient le même téléphone avec la même version de base | Un conflit de version est enregistré avec les deux payloads |
| SYNC-C05 | Résolution autorisée | Responsable pédagogique ouvre un conflit de présence | Les valeurs, versions et auteurs sont visibles ; la résolution produit un audit |
| SYNC-C06 | Résolution interdite | Professeur tente de résoudre un conflit financier | L’API retourne `403 Forbidden` et ne modifie pas le conflit |
| SYNC-C07 | Suppression concurrente | Un poste archive une donnée pendant qu’un autre la modifie | Le serveur applique la règle de cycle de vie et conserve la traçabilité |

#### F. Tests de panne et de reprise

| ID | Panne simulée | Vérification |
|---|---|---|
| SYNC-P01 | Absence totale de réseau | Les données locales restent disponibles et les opérations restent en `Pending` |
| SYNC-P02 | DNS ou serveur inaccessible | Les retries utilisent un backoff et ne bloquent pas l’interface métier |
| SYNC-P03 | HTTP 401 pendant l’envoi | Le moteur suspend l’envoi, demande une reconnexion et ne perd pas l’Outbox |
| SYNC-P04 | HTTP 403 | L’opération passe en `Rejected` avec motif de permission ; aucune nouvelle tentative infinie |
| SYNC-P05 | HTTP 409 | L’opération est isolée en `Conflict` et l’utilisateur reçoit une action claire |
| SYNC-P06 | HTTP 429 | Le moteur respecte `Retry-After` et limite les nouvelles tentatives |
| SYNC-P07 | HTTP 500 | L’opération reste rejouable ; une alerte apparaît après le nombre maximal de tentatives |
| SYNC-P08 | Processus arrêté pendant un commit SQLite | La transaction locale est atomique ; aucune opération partiellement écrite n’est visible |
| SYNC-P09 | Batterie ou arrêt pendant téléchargement | Le fichier incomplet est supprimé ou marqué temporaire ; l’empreinte finale doit être vérifiée |
| SYNC-P10 | Base locale corrompue | Une sauvegarde locale et l’Outbox exportable permettent une restauration contrôlée |
| SYNC-P11 | Schéma local obsolète | La synchronisation est suspendue et une migration sûre est exigée avant reprise |
| SYNC-P12 | Curseur expiré | Le serveur demande un snapshot ; les opérations locales non confirmées sont sauvegardées puis réinjectées |

#### G. Tests de sécurité et de périmètre

| ID | Scénario | Résultat attendu |
|---|---|---|
| SYNC-S01 | Professeur demande une autre classe | Les changements hors périmètre ne sont pas retournés, même avec un identifiant connu |
| SYNC-S02 | Poste compromis révoqué | Le serveur refuse toute nouvelle synchronisation de ce `DeviceId` |
| SYNC-S03 | Token expiré hors-ligne | Les actions sensibles sont bloquées après la durée locale autorisée |
| SYNC-S04 | Modification du payload local | L’empreinte ou la validation serveur détecte la modification et rejette l’opération |
| SYNC-S05 | Réutilisation d’un `OperationId` d’un autre utilisateur | Le serveur refuse l’opération et inscrit un événement de sécurité |
| SYNC-S06 | Export local | Un professeur ne peut pas exporter les données d’élèves hors de son périmètre |
| SYNC-S07 | Lecture de la base SQLite | Les données locales sont protégées par chiffrement ou permissions système et les secrets ne sont pas lisibles en clair |
| SYNC-S08 | Journal local | Aucun token, mot de passe ou document confidentiel n’apparaît en clair dans les logs |

#### H. Tests d’intégrité fonctionnelle après synchronisation

Après chaque scénario, les assertions suivantes doivent être exécutées lorsque le type de donnée est concerné :

```text
Nombre d’opérations locales = nombre d’opérations acceptées
    + nombre d’opérations rejetées
    + nombre d’opérations en conflit
    + nombre d’opérations encore en attente

Chaque opération acceptée possède un accusé serveur.
Chaque opération en conflit possède un SyncConflict ouvert.
Chaque changement reçu possède un ChangeId unique dans l’Inbox.
Chaque donnée financière validée conserve une écriture débit = crédit.
Chaque note publiée est identique sur les postes autorisés et le portail.
Chaque présence visible est associée à une séance, un élève et une source.
Chaque fichier téléchargé possède une empreinte conforme au serveur.
```

#### I. Scénarios métier de validation de bout en bout

##### Scénario E2E-01 — Professeur hors-ligne

1. Connecter le professeur P et télécharger sa classe.
2. Couper le réseau.
3. Saisir les présences de dix élèves.
4. Créer un devoir en brouillon.
5. Enregistrer une note provisoire sans la publier.
6. Fermer brutalement l’application.
7. Redémarrer le poste.
8. Vérifier que les données et l’Outbox sont présentes.
9. Rétablir le réseau.
10. Synchroniser.
11. Vérifier l’acceptation des présences, la conservation du devoir et le maintien de la note en brouillon.
12. Vérifier que le portail parent ne montre ni le brouillon de note ni le devoir avant sa publication.

**Critère de réussite :** aucune présence n’est perdue, aucun doublon n’est créé et aucune donnée non publiée n’est exposée.

##### Scénario E2E-02 — Administration déconnectée

1. Télécharger le périmètre administratif autorisé.
2. Couper le réseau.
3. Créer deux dossiers d’inscription incomplets.
4. Modifier une adresse de responsable.
5. Enregistrer une demande administrative locale.
6. Rétablir le réseau avec une version centrale plus récente de l’adresse.
7. Synchroniser.
8. Vérifier que le dossier incomplet reste en brouillon.
9. Vérifier que l’adresse modifiée produit un conflit si la même donnée a changé au central.
10. Résoudre le conflit avec un rôle autorisé.

**Critère de réussite :** les dossiers et les modifications sont conservés, le conflit est explicite et la décision est auditée.

##### Scénario E2E-03 — Résilience pendant l’envoi

1. Placer 500 opérations dans l’Outbox.
2. Configurer des lots de 100.
3. Couper le réseau pendant le deuxième lot.
4. Redémarrer le moteur.
5. Rétablir le réseau.
6. Reprendre la synchronisation.
7. Vérifier les cinq lots, l’absence de doublon et la progression du curseur.

**Critère de réussite :** les opérations acceptées ne sont pas rejouées et les opérations non transmises restent disponibles.

##### Scénario E2E-04 — Resynchronisation complète

1. Créer des opérations locales non synchronisées.
2. Rendre le curseur local invalide ou trop ancien.
3. Demander un snapshot.
4. Sauvegarder l’Outbox.
5. Restaurer le snapshot filtré.
6. Réinjecter les opérations locales.
7. Traiter les conflits éventuels.
8. Vérifier le nombre final d’opérations et le contenu des données.

**Critère de réussite :** aucune opération locale non confirmée n’est supprimée et le poste retrouve un curseur cohérent.

#### J. Critères de sortie de recette

La synchronisation peut être déclarée valide uniquement si :

- 100 % des cas critiques `F`, `I`, `C`, `P` et `S` sont réussis ;
- aucun défaut bloquant ou critique reste ouvert ;
- les tests de doublons n’ont produit aucune création multiple ;
- les tests de sécurité n’ont révélé aucun accès hors périmètre ;
- les paiements, réservations et notes publiées respectent leurs restrictions ;
- les tests de restauration ont été réalisés avec succès ;
- les journaux permettent de reconstituer chaque incident ;
- le temps de reprise après une coupure respecte le seuil défini par l’école ;
- les utilisateurs pilotes ont validé les indicateurs et messages d’état.

Le procès-verbal de recette doit joindre les versions du serveur, de l’application cliente, du schéma local, les résultats des tests, les anomalies acceptées et la décision de mise en production.

### 14.2.17 Ligne directrice UI/UX et design system premium

#### A. Vision visuelle

SmartShule doit adopter une interface **épurée, moderne, professionnelle et cohérente**. Elle doit être suffisamment institutionnelle pour une direction et suffisamment simple pour un secrétariat, un professeur, un parent ou un élève.

```text
Clarté       → hiérarchie forte et peu d’éléments visibles à la fois
Confiance    → espaces réguliers, typographie lisible et états explicites
Modernité    → cartes sobres, icônes cohérentes et animations discrètes
Productivité → recherche rapide, filtres persistants et actions contextuelles
Identité     → logo et palette propres à chaque établissement
Accessibilité→ contraste, clavier, tailles lisibles et mode sombre
```

La couleur doit indiquer une action, un état ou une priorité. Elle ne doit pas être appliquée à tous les composants comme élément décoratif.

#### B. Branding configurable par école

Un utilisateur autorisé doit pouvoir configurer sans modifier le code :

- logo principal et logo compact ;
- favicon ou icône d’application ;
- nom officiel et slogan de l’établissement ;
- couleur primaire ;
- couleur secondaire ;
- couleur tertiaire ou accent ;
- couleurs de succès, avertissement, erreur et information ;
- couleur du texte et des surfaces ;
- police autorisée ;
- image de connexion facultative ;
- coordonnées et pied de page.

Les formats PNG et SVG sont acceptés après vérification du type MIME, de la taille et de la résolution. Le système doit produire ou demander des variantes claire, sombre et compacte. Le logo doit apparaître dans l’écran de connexion, l’application interne, le portail parent, les tableaux de bord, les reçus et les rapports.

Le branding est stocké comme une configuration versionnée. Toute modification est prévisualisable avant publication et enregistrée dans l’audit. Le thème ne doit jamais permettre l’injection de CSS ou de JavaScript arbitraire.

#### C. Design tokens et thèmes

Les couleurs ne doivent pas être codées directement dans les vues. Elles doivent utiliser des tokens communs :

```css
:root {
  --ss-color-primary: #2563EB;
  --ss-color-primary-hover: #1D4ED8;
  --ss-color-secondary: #0F766E;
  --ss-color-tertiary: #F59E0B;
  --ss-color-surface: #FFFFFF;
  --ss-color-surface-muted: #F8FAFC;
  --ss-color-text: #172033;
  --ss-color-text-muted: #64748B;
  --ss-color-border: #E2E8F0;
  --ss-color-success: #16A34A;
  --ss-color-warning: #D97706;
  --ss-color-danger: #DC2626;
  --ss-radius-md: 10px;
  --ss-radius-lg: 16px;
  --ss-shadow-card: 0 8px 24px rgba(15, 23, 42, .08);
}
```

Pour WPF, les mêmes tokens doivent être représentés dans des `ResourceDictionary`. Pour le portail web, ils doivent être représentés en variables CSS ou dans le mécanisme de thème du framework choisi. Le thème doit comporter une variante claire et une variante sombre.

Le système doit contrôler automatiquement le contraste. Une couleur d’école qui rend un texte essentiel illisible doit être refusée ou corrigée par une suggestion. La couleur ne doit jamais être le seul moyen d’identifier un état.

#### D. Navigation et écrans

```text
Barre supérieure : logo, recherche, notifications, synchronisation, aide, profil
Menu latéral     : tableau de bord, scolarité, élèves, cours, RH, finance,
                   patrimoine, locations, portail, rapports, paramètres
Zone centrale    : fil d’Ariane, titre, filtres, contenu et actions
```

Le menu est filtré par rôle. L’interface conserve le contexte autorisé : année scolaire, direction, section, période et filtres. Les tableaux de bord présentent notamment les inscriptions en attente, absences à traiter, devoirs, impayés, conflits de synchronisation, demandes parentales et réservations du jour.

#### E. DataGridView et alternatives gratuites à Guna

Guna UI ne doit pas être une dépendance obligatoire. Pour une application desktop .NET 8, le choix recommandé est **WPF avec le `DataGrid` et le `ListView` natifs**, stylés par `ResourceDictionary`, `CollectionViewSource`, filtres, tri, regroupement et pagination.

Alternatives gratuites à évaluer selon la plateforme :

| Besoin | Alternative | Usage |
|---|---|---|
| Thème WPF | MaterialDesignInXamlToolkit | Contrôles, thèmes, dialogues et navigation |
| Thème WPF | MahApps.Metro | Fenêtres et styles sobres |
| Contrôles WPF | HandyControl | Contrôles complémentaires |
| Grille WPF | DataGrid natif stylé | Solution légère et maîtrisée |
| Listes | ListView + GridView natif | Élèves, enseignants, demandes et documents |
| WinForms | ReaLTaiizor ou Krypton Toolkit Community | Alternative si WinForms est choisi |
| Portail web | MudBlazor ou composants du framework retenu | Tables, cartes et responsive web |

Les licences de chaque bibliothèque doivent être vérifiées avant intégration. Il faut éviter de mélanger plusieurs bibliothèques de thèmes concurrentes.

#### F. Ligne premium des tableaux et listes

Les `DataGrid` et `ListView` doivent respecter les règles suivantes :

- en-tête clair et peu contrasté ;
- lignes aérées et bordures discrètes ;
- recherche visible au-dessus du tableau ;
- filtres sous forme de sélecteurs ou de chips ;
- colonnes redimensionnables et masquables ;
- tri indiqué par icône et texte accessible ;
- sélection avec une couleur primaire douce ;
- actions principales en haut à droite ;
- actions secondaires dans un menu contextuel ;
- badges pour actif, en attente, publié, payé, conflit et archivé ;
- pagination et compteur de résultats ;
- états vide, chargement, erreur et synchronisation explicites.

Une ligne de liste doit présenter une structure stable : avatar ou icône, titre, information secondaire, badge d’état et action contextuelle. Sur petit écran, les détails passent sous le titre et les actions deviennent un menu `...`. Les colonnes comptables ou sensibles doivent être filtrées selon le rôle.

#### G. Responsive design

Le portail doit être responsive sur mobile, tablette, ordinateur et grand écran. L’application desktop doit gérer le redimensionnement et les résolutions faibles.

```text
Mobile       < 600 px    : une colonne, navigation en panneau, cartes empilées
Tablette     600–1023 px : deux colonnes et tableaux adaptatifs
Ordinateur   1024–1439 px: navigation complète et tableaux standards
Grand écran  ≥ 1440 px   : contenu centré et panneaux secondaires
```

Sur mobile, un tableau large devient une carte ou un défilement horizontal contrôlé. Les formulaires utilisent une colonne et des labels toujours visibles. Aucune page ne doit supposer une résolution fixe.

#### H. Composants standardisés

Le design system doit fournir :

```text
SsAppShell, SsSidebar, SsTopBar, SsPageHeader, SsBreadcrumb,
SsSearchBox, SsFilterBar, SsDataGrid, SsListView, SsStatusBadge,
SsStatCard, SsModal, SsDrawer, SsConfirmDialog, SsEmptyState,
SsLoadingSkeleton, SsErrorState, SsFileUploader, SsSyncStatus,
SsNotificationCenter et SsPagination.
```

Chaque composant doit définir ses états normal, survol, focus, actif, désactivé, chargement et erreur. Il doit être documenté avec ses propriétés, événements et exemples.

#### I. Écran de personnalisation du thème

Le module **Identité visuelle** doit permettre :

1. l’importation du logo ;
2. la saisie des couleurs primaire, secondaire et tertiaire ;
3. l’aperçu clair et sombre ;
4. l’aperçu de boutons, cartes, badges, tableaux et écran de connexion ;
5. la vérification automatique du contraste ;
6. la restauration du thème par défaut ;
7. l’enregistrement en brouillon ;
8. la validation et la publication ;
9. l’historique des versions du thème.

La publication est transactionnelle. Si le logo ou une couleur est invalide, l’ancien thème reste actif. Le thème est mis en cache côté portail, avec invalidation après publication et une valeur de secours pour le mode hors-ligne.

#### J. Accessibilité et critères d’acceptation

Le portail doit viser WCAG 2.2 niveau AA lorsque le framework le permet. Il doit proposer un focus visible, un ordre de tabulation logique, des labels associés, des messages d’erreur explicites, des tailles tactiles suffisantes, le support du zoom, `prefers-reduced-motion` et une navigation clavier.

Le design est accepté lorsque :

- un administrateur peut modifier les trois couleurs et prévisualiser le thème ;
- un administrateur peut importer et remplacer le logo ;
- le branding est visible dans l’application interne et le portail ;
- les fenêtres et tableaux restent utilisables sur les résolutions cibles ;
- les états vide, chargement, erreur et synchronisation sont compréhensibles ;
- aucun composant Guna payant n’est obligatoire ;
- le thème clair et sombre reste cohérent ;
- les tests visuels couvrent les rôles administrateur, professeur, parent et élève.

#### K. Prompt de conception UI/UX

```text
Conçois l’interface premium de SmartShule (SS), logiciel de gestion scolaire et portail parents-élèves-direction. Utilise une ligne visuelle épurée, moderne, institutionnelle et responsive. Prévois des design tokens avec couleurs primaire, secondaire, tertiaire, couleurs d’état, surfaces, texte, bordures, rayons et ombres.

Permets à chaque école d’importer son logo et de personnaliser son branding sans modifier le code. Fournis un écran de prévisualisation et de publication avec contrôle de contraste, thème clair et thème sombre.

Pour l’application desktop .NET 8, privilégie WPF avec DataGrid et ListView natifs stylés par ResourceDictionary. Évalue MaterialDesignInXamlToolkit, MahApps.Metro ou HandyControl comme alternatives gratuites. Si WinForms est retenu, évalue ReaLTaiizor ou Krypton Toolkit Community. N’utilise pas de composant Guna payant obligatoire.

Crée SsAppShell, SsSidebar, SsTopBar, SsPageHeader, SsFilterBar, SsDataGrid, SsListView, SsStatusBadge, SsStatCard, SsModal, SsEmptyState, SsLoadingSkeleton, SsSyncStatus et SsNotificationCenter. Garantit le responsive mobile, tablette, desktop et grand écran, la navigation clavier, les contrastes, les états de chargement et l’affichage hors-ligne.
```

### 14.2.18 Exports, documents et solution informatique intégrée

#### A. Moteur d’exportation

SmartShule doit intégrer un moteur d’exportation commun à tous les modules. Un utilisateur ne peut exporter que les données visibles dans son périmètre et selon son rôle. L’export doit conserver les filtres, la période, la direction, la section et les colonnes sélectionnées.

Formats obligatoires :

| Format | Utilisation |
|---|---|
| XLSX | Analyses, listes filtrables, rapprochements et travail administratif |
| PDF | Bulletins, reçus, factures, contrats, rapports, listes et documents officiels |
| CSV UTF-8 | Échanges avec des systèmes externes et import/export de masse |
| DOCX | Courriers, attestations et modèles administratifs modifiables |
| JSON | Intégrations API et échanges techniques contrôlés |
| XML | Échanges réglementaires si requis par le pays |
| PNG ou SVG | Graphiques, tableaux de bord et éléments visuels autorisés |

Le moteur doit offrir :

- export de la page courante ou de l’ensemble filtré ;
- aperçu avant génération ;
- choix des colonnes ;
- titre, sous-titre, logo et couleurs de l’établissement ;
- période et date de génération ;
- numéro de document ;
- pied de page et signature ;
- pagination ;
- orientation portrait ou paysage ;
- répétition des en-têtes ;
- totaux et sous-totaux ;
- regroupement par direction, classe, section ou période ;
- export de graphiques ;
- protection optionnelle par mot de passe pour les PDF ;
- journalisation de l’utilisateur, du filtre et du fichier produit.

Les exports volumineux doivent être générés en arrière-plan. Le système crée une tâche `ExportJob`, affiche sa progression et notifie l’utilisateur lorsque le fichier est prêt. Le fichier doit être temporaire, protégé par autorisation et supprimé automatiquement après une durée configurable.

#### B. Modèles de documents

Un module de modèles doit permettre à l’administration de configurer les documents sans modifier le code :

- certificat de scolarité ;
- attestation de fréquentation ;
- reçu de paiement ;
- facture ;
- contrat de location ;
- bulletin ;
- relevé de notes ;
- convocation ;
- lettre aux parents ;
- contrat de travail ;
- bulletin de paie ;
- fiche d’inscription ;
- état des lieux ;
- inventaire du patrimoine.

Chaque modèle doit être versionné et posséder un statut brouillon, validé, publié ou archivé. Les variables doivent être issues d’une liste blanche : identité de l’élève, classe, période, montants, logo et informations officielles. Il ne faut pas autoriser l’exécution de code dans un modèle.

Les documents officiels doivent afficher leur numéro, leur date, leur version, leur établissement et, si nécessaire, un QR code de vérification. Un endpoint public limité peut vérifier l’authenticité d’un document à partir d’un identifiant non prédictible, sans révéler les données personnelles.

#### C. Importations et échanges de données

Le système doit également proposer des assistants d’importation pour les élèves, responsables, employés, tarifs, notes, présences, articles, véhicules et immobilisations.

L’importation doit suivre ce processus :

```text
Télécharger un modèle → Charger le fichier → Contrôler les colonnes
→ Prévisualiser les erreurs → Corriger ou ignorer les lignes invalides
→ Valider l’importation → Journaliser le résultat
```

Les imports sensibles doivent fonctionner en mode simulation avant validation. Les lignes déjà existantes doivent être identifiées par une clé métier ou un identifiant global, jamais par une simple position de ligne.

### 14.2.19 Fonctionnalités complémentaires utiles

Les fonctionnalités suivantes doivent être prévues pour atteindre une couverture complète du fonctionnement scolaire.

#### A. Bibliothèque et ressources pédagogiques

Le module bibliothèque doit gérer les ouvrages, auteurs, catégories, exemplaires, codes-barres ou QR codes, adhérents, prêts, retours, réservations, pertes, amendes éventuelles et inventaire. Il doit distinguer les ressources physiques des documents numériques et appliquer les droits d’accès correspondants.

#### B. Transport scolaire

Le module transport doit gérer les lignes, arrêts, horaires, véhicules, chauffeurs, accompagnateurs, élèves inscrits, présences au départ et au retour, incidents, coûts et facturation. Il doit être relié aux responsables, aux frais scolaires et à la disponibilité des véhicules.

#### C. Cantine et restauration

Le système doit gérer les menus, régimes alimentaires, allergies, inscriptions aux repas, fournisseurs, stocks, coûts, présences et facturation. Les informations médicales ou alimentaires sensibles doivent être visibles uniquement par les rôles habilités.

#### D. Santé et sécurité scolaire

Un dossier de santé minimal et confidentiel peut enregistrer allergies, personnes à contacter, incidents, infirmerie, vaccinations lorsque la réglementation l’autorise et autorisations parentales. Ce module doit avoir une permission spécifique et un audit renforcé.

Le système doit aussi gérer les incidents de sécurité, évacuations, exercices, visiteurs, badges et événements nécessitant une traçabilité.

#### E. Calendrier institutionnel et réservation interne

Un calendrier central doit regrouper l’année scolaire, vacances, examens, réunions, événements, sorties, réservations de salles, échéances financières et publications du portail. Les calendriers doivent être filtrables par direction, classe, section, rôle et ressource.

#### F. Réunions et procès-verbaux

La direction doit pouvoir planifier une réunion, inviter des participants, gérer l’ordre du jour, enregistrer les décisions, affecter des actions et archiver le procès-verbal. Une action possède un responsable, une échéance, un statut et une preuve de clôture.

#### G. Budgets et contrôle de gestion

Le module budget doit gérer les exercices, prévisions, budgets par direction ou activité, engagements, dépenses réalisées, écarts et révisions. Les locations de salles et véhicules doivent posséder des budgets et des rapports de rentabilité séparés de l’activité scolaire.

#### H. Stocks et fournitures

Le système doit gérer les articles, unités, emplacements, entrées, sorties, transferts, seuils minimum, inventaires, fournisseurs et demandes internes. Les fournitures scolaires, produits de cantine, pièces de maintenance et consommables informatiques doivent pouvoir être suivis sans mélanger leur stock.

#### I. Maintenance et interventions

Le module maintenance doit gérer les équipements, bâtiments, salles, véhicules, contrats de maintenance, demandes d’intervention, priorités, prestataires, coûts, pièces utilisées, dates prévues et historique. Il doit produire des alertes avant expiration d’une assurance, d’une garantie ou d’un contrôle obligatoire.

#### J. Gestion des admissions et communication externe

Un formulaire public de préinscription peut alimenter une file de candidatures. Les données doivent rester isolées jusqu’à validation par le secrétariat. Le système doit gérer les campagnes d’admission, listes d’attente, convocations, pièces reçues et décisions.

Les communications collectives doivent être préparées, validées et planifiées. Le système doit éviter les envois multiples et protéger les adresses des familles.

#### K. Recherche globale et centre de tâches

Une recherche globale doit permettre à un utilisateur autorisé de trouver un élève, parent, employé, facture, reçu, véhicule, salle, document ou demande. Les résultats doivent être filtrés par rôle et afficher le type, le statut et le contexte.

Un centre de tâches doit regrouper les actions en attente : dossier incomplet, note à valider, conflit de synchronisation, facture à approuver, contrat à signer, maintenance à planifier, demande parentale et document expirant.

#### L. Signatures et validation électronique

Le système doit pouvoir gérer une validation électronique interne pour les notes, dépenses, contrats, rapports et documents. Le niveau de signature requis dépend de la sensibilité et de la réglementation. Une signature ne doit pas être présentée comme une signature légale qualifiée sans intégration avec un prestataire et une procédure conformes au pays concerné.

#### M. Sauvegarde, archivage et continuité

Le système doit prévoir :

- sauvegarde automatique de la base centrale ;
- sauvegarde séparée des fichiers ;
- rétention quotidienne, hebdomadaire et mensuelle ;
- chiffrement des sauvegardes ;
- copie hors site ;
- restauration testée ;
- archivage par année scolaire ;
- procédure de reprise après panne ;
- plan de continuité et rôles d’urgence.

Les bases locales doivent disposer d’une sauvegarde chiffrée avant une resynchronisation complète. Les exports temporaires et caches de documents doivent être nettoyés selon une politique de conservation.

#### N. Administration technique

Une console technique doit afficher la santé du serveur, l’espace disque, les tâches planifiées, les erreurs API, les files de synchronisation, les postes actifs, les versions clientes et les jobs d’export. Elle doit être séparée des écrans fonctionnels et réservée aux administrateurs techniques.

#### O. Configuration locale en français

SmartShule sera livré exclusivement en français. Aucune interface multilingue, aucun sélecteur de langue et aucun catalogue de traduction ne sont prévus dans le périmètre initial. Les formats de date, heure, devise, téléphone, fuseau horaire, règles fiscales et jours fériés restent configurables selon le pays d’utilisation, sans changer la langue de l’application.

#### P. Intégrations externes

Selon les besoins, SmartShule pourra intégrer :

- passerelles de paiement ;
- banques ;
- Mobile Money ;
- courriel et SMS ;
- stockage documentaire ;
- authentification d’entreprise ;
- systèmes comptables externes ;
- lecteurs de QR codes ou de codes-barres ;
- visioconférence ou plateforme pédagogique.

Chaque intégration doit être isolée derrière une interface, posséder une journalisation, une gestion de reprise, des clés protégées et un mode simulation. La panne d’un fournisseur externe ne doit pas corrompre une transaction interne déjà validée.

### 14.2.20 Architecture fonctionnelle complète cible

La carte fonctionnelle de SmartShule devient :

```text
Pilotage et direction
├── Tableaux de bord et indicateurs
├── Rapports et exports
├── Workflow et validations
└── Réunions et décisions

Scolarité
├── Admissions et inscriptions
├── Élèves et responsables
├── Directions, sections et classes
├── Enseignants, cours et emplois du temps
├── Présences, évaluations et bulletins
├── Devoirs et portail pédagogique
└── Discipline et vie scolaire

Administration
├── Ressources humaines et paie
├── Documents et archivage
├── Notifications et communication
├── Transport et cantine
├── Bibliothèque
└── Santé et sécurité

Finance et patrimoine
├── Frais scolaires et encaissements
├── Comptabilité et budgets
├── Achats, fournisseurs et stocks
├── Immobilisations et patrimoine
├── Maintenance
├── Location de salles
└── Location de véhicules

Plateforme technique
├── API REST et portail web
├── Mode hors-ligne et synchronisation
├── Identité, rôles et audit
├── Exports et modèles de documents
├── Sauvegardes et continuité
└── Intégrations externes
```

### 14.2.21 Priorisation de l’implémentation

Pour éviter un projet trop large livré trop tard, les fonctionnalités doivent être priorisées :

| Priorité | Contenu |
|---|---|
| P0 — Socle | Identité, rôles, établissement, référentiels, audit, API, base centrale, synchronisation, sauvegarde |
| P1 — Cœur scolaire | Élèves, inscriptions, classes, enseignants, cours, présences, notes, bulletins, portail parent |
| P1 — Finance | Frais, factures, paiements, reçus, comptabilité de base et exports |
| P2 — Administration | RH, paie, documents, communication, calendrier, demandes et modèles PDF |
| P2 — Exploitation | Patrimoine, achats, stocks, maintenance, transport et cantine |
| P3 — Activités complémentaires | Bibliothèque, santé, signatures, intégrations bancaires et Mobile Money |
| P3 — Optimisation | Analytique avancée, prévisions, automatisations, applications mobiles et extensions externes |

Chaque priorité doit être livrée sous forme de tranche testée et utilisable. Aucun module ne doit être considéré terminé sans permissions, audit, exports, tests, sauvegarde et prise en charge des erreurs.

### 14.2.22 Prompt maître pour compléter la solution

```text
Complète SmartShule (SS) comme une solution informatique intégrée pour établissement scolaire. Ajoute un moteur d’exportation sécurisé en XLSX, PDF, CSV UTF-8, DOCX, JSON et XML. Les exports doivent respecter les permissions, les filtres, le branding, la période et la direction de l’utilisateur. Les exports lourds utilisent des jobs asynchrones, une progression, une notification et une expiration automatique des fichiers.

Ajoute les modèles versionnés de bulletins, reçus, factures, certificats, attestations, contrats, lettres, paie et rapports. Ajoute les modules utiles non limités à la scolarité : bibliothèque, transport, cantine, santé confidentielle, sécurité, calendrier, réunions, budgets, stocks, maintenance, admissions publiques, recherche globale, centre de tâches, signatures, sauvegarde, archivage, continuité, administration technique et intégrations de paiement, banque, SMS et courriel.

Pour chaque module, fournis entités, règles métier, permissions, audit, API, écrans, exports, notifications, fonctionnement hors-ligne lorsque pertinent, tests unitaires, tests d’intégration, sauvegarde et critères d’acceptation. Priorise P0, P1, P2 et P3. Ne génère pas du code superficiel pour tous les modules : implémente une tranche verticale complète, compilable et testée avant de passer à la suivante.
```

### 14.2.23 Modules de sécurité et gestion RBAC

SmartShule doit appliquer un modèle **RBAC — Role-Based Access Control**, complété par un contrôle de périmètre. Le rôle détermine les fonctions accessibles, tandis que le périmètre détermine les données réellement visibles.

```text
Utilisateur → Rôle → Permission → Périmètre → État de la donnée → Action autorisée
```

Un parent peut donc consulter un bulletin uniquement si celui-ci est publié et rattaché à l’un de ses enfants. Un administrateur peut consulter les inscriptions uniquement dans l’établissement ou la direction qui lui est attribué.

#### Modules de sécurité recommandés

| Module | Fonction |
|---|---|
| Identité et comptes | Création, activation, suspension, archivage et récupération |
| Authentification | Mot de passe sécurisé, sessions, expiration, révocation et MFA |
| Gestion des rôles | Rôles, permissions, affectations et dates de validité |
| Périmètres | Établissement, site, direction, section, classe, groupe et enfant |
| Autorisation API | Policies ASP.NET Core, scopes et contrôle côté serveur |
| Appareils et sessions | Appareils connus, sessions actives et révocation |
| Audit | Accès, consultations, modifications, exports et validations |
| Protection des données | Chiffrement, masquage, rétention et archivage |
| Fichiers | Contrôle MIME, antivirus, stockage privé et URLs temporaires |
| Synchronisation | DeviceId, idempotence, conflits et révocation de poste |
| Incidents | Alertes, blocage, enquête, résolution et rapport |
| Consentements | Autorisations parentales et préférences de communication |

#### Rôles principaux

| Rôle | Périmètre | Accès principal |
|---|---|---|
| Super administrateur technique | Tous les établissements | Sécurité, infrastructure et supervision |
| Administrateur fonctionnel | Établissement affecté | Référentiels, workflows et rôles fonctionnels |
| Direction générale | Établissement entier | Pilotage, validations et communications officielles |
| Directeur de direction | Sa direction | Élèves, classes, enseignants et résultats de sa direction |
| Secrétariat | Site ou direction affectée | Dossiers, inscriptions et documents |
| Comptable | Centres financiers autorisés | Factures, paiements, écritures et budgets |
| RH / Paie | Personnel autorisé | Employés, contrats, congés et paie |
| Responsable pédagogique | Sections affectées | Cours, évaluations et validations pédagogiques |
| Professeur | Classes, groupes et matières affectés | Cours, présences, devoirs et notes en brouillon |
| Parent | Enfants rattachés | Suivi, documents publiés, frais et demandes |
| Élève | Son propre dossier | Cours, devoirs, dépôts et résultats publiés |
| Auditeur | Périmètre attribué | Lecture seule des journaux et rapports |

#### Permissions atomiques

Les permissions doivent suivre le format `Module.Action` et ne doivent pas regrouper des opérations de risque différent :

```text
Student.Read              Student.Create           Student.Update
Enrollment.Create         Enrollment.Validate
Attendance.Record         Grade.DraftWrite         Grade.Publish
Assignment.Create         Assignment.Publish       Submission.Create
ReportCard.Publish        Fee.Read                  Payment.Create
Payment.Cancel            Payment.Refund            Accounting.Post
Accounting.ClosePeriod    RoomRental.Confirm        VehicleRental.Confirm
ParentRequest.Create      ParentRequest.Reply       Export.Generate
Audit.Read                Security.ManageRoles
```

`Payment.Create`, `Payment.Cancel`, `Payment.Refund` et `Accounting.ClosePeriod` doivent rester des permissions différentes. Les mêmes règles s’appliquent à la saisie, au contrôle et à la publication des notes.

#### Droits de l’administration

| Domaine | Secrétariat | Directeur | Comptable | RH/Paie | Pédagogie | Direction générale |
|---|---|---|---|---|---|---|
| Élèves et responsables | Créer/modifier | Consulter sa direction | Identité utile | Aucun par défaut | Consulter sa direction | Consulter tout |
| Inscriptions | Préparer/contrôler | Valider selon délégation | Frais associés | Aucun | Effectifs | Exceptions |
| Classes et affectations | Préparer | Valider sa direction | Aucun | Aucun | Créer/contrôler | Arbitrer |
| Présences | Consulter selon rôle | Contrôler | Aucun | Personnel uniquement | Contrôler | Indicateurs |
| Notes et bulletins | Aucun par défaut | Contrôler selon workflow | Aucun | Aucun | Saisir/valider | Superviser |
| Finance | Aucun ou lecture limitée | Impayés autorisés | Gérer et rapprocher | Retenues autorisées | Aucun | Superviser |
| Locations | Consulter si nécessaire | Sa direction | Facturer/rapprocher | Aucun | Aucun | Superviser |
| Exports | Données autorisées | Sa direction | Finance | RH | Pédagogie | Selon confidentialité |
| Sécurité et rôles | Aucun | Aucun | Aucun | Aucun | Aucun | Délégation contrôlée |

La séparation des tâches doit empêcher un utilisateur de créer, encaisser, annuler et valider seul la même opération financière.

#### Droits des parents

Le rôle `Parent` est limité aux élèves officiellement rattachés. Il peut consulter le tableau de bord, les cours et devoirs publiés, absences visibles, bulletins publiés, documents, factures et état des frais. Il peut initier un paiement via un fournisseur sécurisé, modifier ses coordonnées, gérer ses préférences et créer une demande à la direction ou au secrétariat.

Le parent ne peut pas consulter un autre élève, modifier une note ou une présence, voir les notes privées d’un professeur, communiquer directement avec un enseignant, consulter les journaux internes, exporter une classe, annuler un paiement confirmé ou supprimer un document officiel.

#### Administration des rôles

L’écran RBAC doit permettre de créer un rôle fonctionnel, sélectionner ses permissions, limiter son périmètre, définir une date de début et de fin, suspendre une affectation, simuler les droits et exporter la matrice. Toute modification doit être auditée.

Les rôles critiques ne doivent pas être supprimés physiquement. Ils doivent être désactivés avec conservation de l’historique. Une permission expirée doit être refusée côté API même si l’ancienne interface est encore ouverte.

#### Sécurité des comptes parents

Le compte parent doit prévoir une invitation administrative, la vérification du courriel ou du téléphone, une politique de mot de passe, une récupération sans révéler l’existence du compte, la limitation des essais, le verrouillage temporaire, la révocation de toutes les sessions, la notification de nouvelle connexion et la révocation des appareils connus.

Une famille possédant plusieurs enfants doit utiliser un seul compte parent avec plusieurs rattachements contrôlés, et non un compte automatique par enfant.

#### Tests RBAC obligatoires

Les tests doivent vérifier qu’un parent ne voit jamais les données d’une autre famille, qu’un professeur ne reçoit que ses classes, qu’un directeur ne voit pas les directions non rattachées, qu’un comptable ne peut pas modifier les notes, qu’un utilisateur sans droit d’export ne peut pas appeler l’endpoint d’export et qu’une session révoquée ne peut plus accéder à l’API.

### 14.3 Comptes et rattachements

Un compte parent doit être rattaché à un ou plusieurs élèves par une relation explicite et validée par l’administration. Un parent ne doit voir que les enfants qui lui sont rattachés.

Un compte élève doit être rattaché à un seul dossier élève. Pour les jeunes élèves, l’administration peut désactiver le compte élève tout en conservant le compte parent.

Un parent peut posséder plusieurs moyens de contact, mais l’adresse électronique ou le numéro de téléphone utilisé pour la connexion doit être vérifié. Une procédure de récupération doit éviter de révéler si un compte existe.

Les états minimum d’un compte sont : `Invité`, `Actif`, `Suspendu`, `Bloqué` et `Archivé`. La suspension d’un compte ne doit pas supprimer l’historique des messages, paiements ou documents.

### 14.4 Tableau de bord parent

Après connexion, le parent doit pouvoir sélectionner un enfant lorsqu’il en a plusieurs. Le tableau de bord doit afficher uniquement les informations validées et publiées :

- identité et classe actuelle ;
- calendrier scolaire ;
- emploi du temps publié ;
- présences, retards et absences justifiées ou non ;
- notes et bulletins publiés ;
- devoirs à faire et devoirs remis ;
- documents scolaires disponibles ;
- factures, échéances et paiements autorisés ;
- situation des frais académiques ;
- annonces de la direction ;
- demandes et messages adressés à la direction ;
- alertes importantes et échéances.

Le parent ne doit pas pouvoir modifier les notes, présences, affectations, décisions disciplinaires ou informations pédagogiques. Il peut demander une correction ou envoyer une observation à la direction.

### 14.5 Tableau de bord élève

Le tableau de bord élève doit présenter :

- les matières et cours de sa classe ;
- les supports publiés ;
- les devoirs avec date limite ;
- les consignes et pièces jointes ;
- le dépôt d’un devoir ;
- l’état du dépôt : brouillon, remis, en retard, retourné ou clôturé ;
- les notes et commentaires publiés ;
- les absences et retards visibles selon la politique de l’école ;
- les annonces officielles ;
- les réunions ou événements scolaires publiés.

L’élève ne doit accéder qu’aux cours correspondant à sa classe, sa section, son groupe et sa période d’inscription. Un élève transféré de classe conserve son historique, mais ne doit pas voir les nouveaux contenus avant la date d’affectation autorisée.

### 14.6 Cours et devoirs en ligne

Le module pédagogique doit distinguer le contenu préparé par l’enseignant de sa publication officielle. Le professeur peut préparer un cours ou un devoir dans l’application interne, mais la direction ou le responsable pédagogique peut imposer une validation avant publication aux familles.

Un cours doit pouvoir contenir :

- titre et objectifs ;
- matière, classe, section et période ;
- texte, document, lien ou vidéo ;
- date de publication ;
- date de retrait ;
- version ;
- statut brouillon, soumis, validé, publié ou archivé.

Un devoir doit contenir :

- consigne ;
- matière et classe ;
- date de publication ;
- date limite ;
- pièces jointes ;
- type de remise ;
- nombre de tentatives ;
- barème éventuel ;
- statut de correction ;
- visibilité du résultat.

Le dépôt d’un devoir doit enregistrer l’élève, la date, la version, le fichier, la taille, l’empreinte du fichier et le statut. Un dépôt après échéance doit être accepté ou refusé selon une règle paramétrable. Une modification après remise doit créer une nouvelle version sans effacer la précédente.

Les fichiers doivent être contrôlés par type, taille et analyse antivirus lorsque l’infrastructure le permet. Les documents doivent être téléchargés par une URL temporaire et autorisée, jamais par un chemin public permanent.

### 14.7 Communication avec la direction

Le portail doit proposer une messagerie institutionnelle organisée en demandes. Le parent choisit une catégorie : inscription, frais, absence, document, transport, discipline, santé, problème technique ou autre sujet administratif.

Chaque demande possède :

- un numéro ;
- un enfant concerné ;
- une catégorie ;
- un niveau de priorité ;
- une date de création ;
- un service destinataire ;
- un responsable interne ;
- un statut : nouveau, en traitement, en attente, répondu, clôturé ou archivé ;
- les messages et pièces jointes ;
- l’historique des changements.

Les messages des parents sont reçus par la direction ou le secrétariat. La direction peut les affecter au service compétent sans exposer au parent la messagerie interne. Une réponse officielle est publiée dans le fil de la demande et peut déclencher une notification.

Par défaut, le portail ne doit pas fournir :

- de chat privé parent-professeur ;
- de numéro personnel d’enseignant ;
- de groupe de discussion non modéré ;
- de publication libre par un parent sur un espace général ;
- de consultation des données d’un autre élève ou d’une autre famille.

La direction peut toutefois créer une communication collective, par exemple une annonce concernant une classe ou une section, sans révéler les coordonnées des familles.

### 14.8 Notifications

Le système doit gérer les notifications dans le portail et, selon les services activés, par courriel ou SMS. Les notifications prioritaires peuvent concerner une absence, une échéance de paiement, un devoir à remettre, une publication de bulletin, une annonce urgente ou une réponse de la direction.

Chaque notification doit comporter un événement source, un destinataire, une date, un canal, un statut d’envoi et un journal d’erreur. Le système doit éviter l’envoi répétitif du même message lorsque la synchronisation ou la connexion est interrompue.

Les données confidentielles ne doivent pas être placées intégralement dans le texte d’un SMS ou dans une notification non authentifiée. Le message doit inviter l’utilisateur à se connecter au portail.

### 14.9 Publication et validation

Le portail ne doit afficher que les données dont le statut est `Publié`. Les notes, bulletins, annonces, absences sensibles, décisions disciplinaires et documents officiels doivent utiliser un workflow de publication.

Exemple de workflow pour un bulletin :

```text
Brouillon → Saisi → Contrôlé → Validé pédagogiquement → Publié aux parents → Archivé
```

Exemple de workflow pour un devoir :

```text
Brouillon enseignant → Soumis → Validé ou publié selon la règle → Visible aux élèves → Clôturé
```

Une donnée corrigée après publication doit conserver sa version précédente, l’auteur de la correction, le motif et la date de republication.

### 14.10 Sécurité et confidentialité du portail

Le portail doit utiliser HTTPS, des sessions sécurisées, une expiration de session, une limitation des tentatives de connexion et une authentification multifactorielle optionnelle pour les parents et obligatoire pour les comptes de direction selon la politique de l’école.

Les pièces jointes doivent être protégées par autorisation. Les parents doivent pouvoir consulter les documents de leurs enfants, mais pas les documents internes de la direction. Les informations financières ne doivent être visibles que par le parent autorisé et les rôles administratifs habilités.

Le système doit enregistrer les consultations sensibles : bulletin consulté, document téléchargé, paiement initié, message créé et changement de profil. Les journaux d’audit ne doivent pas être modifiables par les parents, les élèves ou les enseignants.

### 14.11 Intégration avec les données existantes

Le portail doit réutiliser les mêmes objets métier que l’application interne : élève, responsable, classe, cours, devoir, absence, note, bulletin, facture, paiement, annonce et demande. Il ne faut pas créer une deuxième fiche élève indépendante.

Les données produites dans le portail suivent le même mécanisme offline-first lorsque cela est pertinent. Toutefois, les actions parentales nécessitant une confirmation centrale, telles qu’un paiement ou une demande officielle, doivent être envoyées à l’API centrale. L’interface doit afficher clairement l’état : reçu, en traitement, confirmé ou rejeté.

### 14.12 Rapports de la direction

La direction doit disposer d’un tableau de bord dédié présentant :

- nombre de parents et élèves actifs ;
- taux de comptes activés ;
- taux de consultation des bulletins ;
- devoirs publiés, remis et en retard ;
- demandes ouvertes par catégorie et par délai ;
- temps moyen de réponse ;
- annonces lues et non lues ;
- paiements initiés et confirmés ;
- absences nécessitant un suivi ;
- familles sans contact vérifié.

Les rapports doivent être agrégés. La direction ne doit pas avoir besoin de consulter les échanges privés d’une famille pour connaître les indicateurs de service, sauf procédure d’audit autorisée.

### 14.13 Prompt de développement du portail web

```text
À partir du cahier des charges SmartShule, ajoute un portail web sécurisé connecté à l’API centrale ASP.NET Core 8. Le portail comprend trois espaces : parent, élève et direction/secrétariat. Il ne doit jamais accéder directement à la base de données.

Un parent peut être rattaché à plusieurs élèves et ne voit que leurs informations publiées : classe, emploi du temps, absences, bulletins, devoirs, documents, frais académiques, annonces et demandes adressées à la direction. Un élève ne voit que les cours, devoirs, dépôts, résultats et annonces correspondant à sa classe, section, groupe et période. La direction gère les annonces, demandes, publications et réponses officielles.

La communication doit être institutionnelle. Ne crée pas de chat privé parent-professeur. Les parents et élèves envoient leurs demandes à la direction ou au secrétariat. La direction peut affecter la demande à un service interne, mais la réponse visible par la famille reste une réponse officielle contrôlée.

Implémente les comptes parent et élève, les rattachements validés, les permissions côté serveur, les cours publiés, les devoirs, les remises versionnées, les pièces jointes protégées, les annonces, la messagerie de demandes, les notifications, les tableaux de bord et l’audit. Utilise des statuts de publication et ne montre aucune donnée non validée. Ajoute les tests d’isolation entre familles, les tests de publication, les tests de téléchargement sécurisé et les tests de workflow des demandes.
```

---

## 14.2.24 Prompt maître pour un agent autonome de développement

Le prompt suivant peut être utilisé avec un agent de développement capable de planifier, d’exécuter des tâches en arrière-plan et de déléguer des sous-tâches à plusieurs agents spécialisés.

```text
Tu es le chef de programme autonome de SmartShule (SS), une solution complète de gestion scolaire en français. Ta mission est de transformer progressivement le cahier des charges en un produit logiciel de haute qualité, sécurisé, testé, documenté et livrable.

OBJECTIF PRINCIPAL
Construis SmartShule par tranches verticales réellement fonctionnelles. Chaque tranche doit être compilable, testée, sécurisée, documentée et intégrée au reste du système. Ne produis pas une grande quantité de code superficiel. Privilégie une petite fonctionnalité complète et vérifiée à une grande fonctionnalité incomplète.

MODE AUTONOME
Travaille de manière autonome pendant plusieurs cycles d’exécution, potentiellement pendant deux ou trois jours, sans attendre une validation intermédiaire pour les décisions réversibles et à faible risque. Maintiens un journal de travail persistant contenant : objectif courant, tâches terminées, tâches restantes, fichiers modifiés, décisions prises, risques, erreurs, tests exécutés et prochaine action.

Ne prétends jamais travailler lorsque l’exécution est arrêtée. Si l’environnement impose une limite de durée, sauvegarde proprement l’état dans le journal et reprends automatiquement au prochain cycle à partir de ce journal.

ARRÊT OBLIGATOIRE
Arrête-toi et demande une décision humaine uniquement si :
1. une information manquante change fortement l’architecture ou le périmètre ;
2. une permission, un secret, une approbation externe ou une connexion est nécessaire ;
3. une action risque de supprimer des données, modifier la sécurité, publier largement, engager une dépense ou créer une obligation légale ;
4. deux règles métier contradictoires ne peuvent pas être résolues par une hypothèse réversible ;
5. un test critique échoue et qu’une correction sûre n’est pas possible.

Dans tous les autres cas, choisis l’hypothèse la plus raisonnable, documente-la et continue. Ne demande pas une confirmation pour chaque commande, fichier, refactorisation, test ou décision de conception réversible.

PLANIFICATION INITIALE
Commence par :
1. lire entièrement le cahier des charges et les instructions du projet ;
2. inspecter le dépôt, la structure existante, les dépendances et les scripts ;
3. établir une carte des modules et des dépendances ;
4. identifier les risques techniques et métier ;
5. créer un backlog ordonné par priorité P0, P1, P2 et P3 ;
6. définir les critères d’acceptation de chaque tranche ;
7. créer un plan de travail avec des tâches assez petites pour être testées.

ARCHITECTURE CIBLE
Respecte la séparation entre Domain, Application, Infrastructure, Contracts, Api, Sync, Desktop, Portal et Tests. Utilise C# et .NET 8, ASP.NET Core 8, EF Core 8, SQLite pour le hors-ligne et SQL Server ou PostgreSQL pour le serveur central selon la configuration du projet.

Utilise une architecture en couches, des DTO, des validations serveur, des transactions, une concurrence optimiste, un audit immuable, une Outbox, une Inbox, une synchronisation idempotente et des permissions RBAC avec contrôle de périmètre. Ne retourne jamais directement les entités EF Core par l’API.

SOUS-AGENTS PARALLÈLES
Lorsque plusieurs tâches sont indépendantes, engage plusieurs sous-agents spécialisés en parallèle. N’utilise pas un seul sous-agent pour des sujets indépendants. Chaque sous-agent reçoit une mission précise, un périmètre limité, les fichiers concernés, les contraintes, les critères d’acceptation et le format de restitution.

Répartis notamment les rôles suivants lorsque cela est utile :
- agent architecture et modèle de données ;
- agent API et contrats REST ;
- agent sécurité et RBAC ;
- agent synchronisation hors-ligne ;
- agent interface desktop et design system ;
- agent portail parents-élèves ;
- agent comptabilité et règles financières ;
- agent tests et qualité ;
- agent documentation et installation.

Les sous-agents ne doivent pas modifier les mêmes fichiers en même temps. Attribue des chemins déterministes et collision-free. Après leur travail, un agent intégrateur examine les résultats, résout les conflits, vérifie les contrats et applique uniquement les changements cohérents.

Ne délègue pas une tâche sensible sans fournir au sous-agent les règles de sécurité et les critères de validation. Si un sous-agent échoue, conserve les autres résultats, inscris l’échec dans le journal et réessaie uniquement après avoir corrigé la cause.

ORDRE D’IMPLÉMENTATION
Implémente dans cet ordre, sauf dépendance justifiée :
P0. Solution, configuration, identité, rôles, permissions, audit, base centrale, migrations, sauvegarde et observabilité.
P0. Base locale SQLite, Outbox, Inbox, curseur et synchronisation idempotente.
P1. Élèves, responsables, années scolaires, directions, sections, classes et inscriptions.
P1. Enseignants, matières, affectations, cours, présences, évaluations et bulletins.
P1. Portail parent-élève-direction, annonces, demandes et devoirs publiés.
P1. Frais, factures, paiements, reçus, exports et comptabilité de base.
P2. RH, paie, documents, patrimoine, achats, budgets et maintenance.
P2. Locations de salles et véhicules, contrats, cautions, rentabilité et comptabilité analytique.
P2. Design system, branding, logo, thèmes, DataGrid/ListView et responsive.
P3. Bibliothèque, transport, cantine, santé confidentielle, signatures et intégrations externes.

RÈGLES DE QUALITÉ
Pour chaque fonctionnalité :
1. écrire ou mettre à jour les règles métier ;
2. définir les DTO et contrats ;
3. ajouter permissions et contrôle de périmètre ;
4. implémenter le cas d’utilisation ;
5. ajouter l’audit et les événements Outbox ;
6. créer ou mettre à jour les migrations ;
7. développer l’interface nécessaire ;
8. ajouter tests unitaires, intégration, sécurité et hors-ligne si concerné ;
9. documenter l’installation, l’utilisation et les limites ;
10. exécuter la compilation et corriger toutes les erreurs.

Ne considère pas une fonctionnalité terminée si elle n’a pas de gestion d’erreur, de permission, de test, d’audit et de documentation. Ne désactive jamais les tests, les analyseurs, la validation TLS ou les contrôles d’autorisation pour faire passer une compilation.

AUTO-ÉVALUATION APRÈS CHAQUE TRANCHE
Après chaque tranche, évalue-toi selon cette grille de 0 à 5 :
- conformité fonctionnelle au cahier des charges ;
- qualité de l’architecture ;
- sécurité et séparation des rôles ;
- qualité des tests ;
- résilience hors-ligne et reprise ;
- performance et pagination ;
- qualité de l’interface ;
- documentation et exploitabilité.

Une tranche est livrable seulement si aucune note critique n’est inférieure à 4/5, si les tests critiques réussissent et si les défauts bloquants sont corrigés. Pour chaque note inférieure à 5, inscris une amélioration dans le backlog. Ne falsifie jamais les résultats et ne transforme pas un avertissement en réussite.

VALIDATION INDÉPENDANTE
Après l’implémentation, lance une revue indépendante. Demande à un sous-agent de jouer le rôle d’un auditeur hostile : chercher accès hors périmètre, fuite de données, doublons de synchronisation, erreurs comptables, fichiers publics, régression et hypothèses non documentées.

Demande à un autre sous-agent de jouer le rôle d’un utilisateur final : tester secrétariat, professeur, direction, parent et élève avec des scénarios réalistes. Corrige les défauts trouvés, puis relance les tests concernés.

TESTS OBLIGATOIRES
Exécute au minimum :
- dotnet restore ;
- dotnet build avec avertissements traités sérieusement ;
- tests unitaires ;
- tests d’intégration API ;
- tests de permissions RBAC ;
- tests d’isolation entre familles ;
- tests de synchronisation avec coupure réseau ;
- tests d’idempotence et de conflits ;
- tests de paiements, écritures et réservations ;
- tests d’upload et de téléchargement sécurisé ;
- tests de restauration de sauvegarde ;
- vérifications de vulnérabilités des dépendances.

Pour chaque échec, reproduis le problème, identifie la cause, corrige au niveau approprié, ajoute un test de non-régression et relance la suite. N’accepte une anomalie que si elle est documentée avec son impact, son contournement et sa priorité.

SYNCHRONISATION DES SOUS-AGENTS
Utilise un workflow en étapes :
1. planification ;
2. exécution parallèle des tâches indépendantes ;
3. collecte des résultats ;
4. intégration et résolution des conflits ;
5. tests ;
6. revue hostile ;
7. correction ;
8. validation finale ;
9. documentation et livraison.

Le résultat d’un sous-agent doit indiquer : statut, fichiers modifiés, décisions, tests, problèmes connus et recommandations. Ne perds pas un résultat réussi parce qu’un autre sous-agent a échoué.

LIVRABLE FINAL
À la fin, livre :
- le code compilable ;
- les migrations ;
- les scripts de démarrage et de déploiement ;
- la configuration d’exemple sans secrets ;
- le guide d’installation ;
- le guide utilisateur par rôle ;
- le guide de sauvegarde et restauration ;
- le rapport de tests ;
- le rapport d’auto-évaluation ;
- la liste des hypothèses et limites restantes ;
- le backlog des améliorations futures ;
- un résumé clair de ce qui est réellement fonctionnel.

Avant de déclarer la mission terminée, vérifie que chaque fichier annoncé existe, que le dépôt est propre, que les tests ont été exécutés après la dernière modification et que le rapport final ne prétend pas qu’une fonctionnalité est livrée si elle n’est qu’un prototype.
```

### 14.2.25 Règle de gouvernance de l’autonomie

L’autonomie de l’agent doit porter sur l’exécution technique, la planification, les tests, les corrections et la documentation. Elle ne doit pas autoriser sans contrôle humain la publication publique, la suppression de données, la modification de comptes ou de sécurité, les opérations financières réelles, l’envoi massif de messages ou toute décision juridique et réglementaire.

L’agent doit utiliser un journal persistant avec le template [SmartShule — Journal de bord de l’agent autonome](/home/ubuntu/smartshule-progress-log-template.md). Il doit le mettre à jour après chaque cycle, avant tout arrêt et après chaque reprise. Le journal constitue la source de vérité pour l’état des tâches, les sous-agents, les tests, les risques, les décisions, les checkpoints et la décision finale de livraison.

Le prompt système complet prêt à copier-coller est disponible dans [SmartShule — Prompt système de l’agent autonome](/home/ubuntu/smartshule-system-prompt-autonomous-agent.md). Il impose la lecture du cahier des charges, l’utilisation du journal, la délégation parallèle, les tests, l’auto-évaluation et les limites d’autonomie.

## 15. Décisions à prendre avant le développement

Certaines décisions dépendent du contexte de l’école et doivent être confirmées avant le modèle final :

1. La comptabilité doit-elle suivre un plan comptable national précis ?
2. Le logiciel doit-il fonctionner sur un seul site ou plusieurs sites géographiques ?
3. Les postes sont-ils exclusivement sous Windows ?
4. Quelle base centrale est préférée : SQL Server ou PostgreSQL ?
5. Les paiements mobiles et bancaires doivent-ils être intégrés par API ?
6. Les bulletins et documents doivent-ils être signés électroniquement ?
7. Quelles données chaque direction peut-elle consulter hors connexion ?
8. Quel volume maximal d’élèves, d’employés, de documents et de transactions est prévu ?
9. Quelle politique de sauvegarde et de conservation est exigée ?
10. Quelles règles de paie, de réduction, de remboursement et de fiscalité doivent être paramétrées ?

Ces choix ne doivent pas bloquer la conception du socle, mais ils doivent être arrêtés avant la mise en production des modules financiers et de paie.

---

## 15. Conclusion

SmartShule doit être conçu comme un **système d’information intégré**, et non comme une simple application d’inscription scolaire. La réussite du projet dépend de trois éléments : un modèle de données central cohérent, une séparation stricte des responsabilités et une synchronisation offline-first conçue dès le départ.

La location de salles et la location de véhicules doivent être traitées comme des activités commerciales reliées aux contrats, aux clients, aux encaissements, au patrimoine et à la comptabilité. De la même manière, les cours doivent être modélisés à partir des affectations entre enseignants, matières, classes, sections, salles et périodes, afin de représenter correctement les enseignants qui travaillent dans plusieurs classes et plusieurs directions.

La mise en œuvre doit progresser par tranches verticales testées. Le premier objectif n’est pas de produire immédiatement tous les écrans, mais de prouver que le socle de données, les droits, les transactions et la synchronisation sont fiables. Les modules supplémentaires pourront alors s’appuyer sur une base technique stable.

## Références

[1]: https://learn.microsoft.com/en-us/dotnet/core/ "Microsoft .NET documentation"

[2]: https://learn.microsoft.com/en-us/ef/core/ "Microsoft Entity Framework Core documentation"

[3]: https://learn.microsoft.com/en-us/aspnet/core/ "Microsoft ASP.NET Core documentation"

[4]: https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/overview "System.Text.Json documentation"

[5]: https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/ "Microsoft architecture guidance for modern web applications"

---

# Partie II — Prompt système de l’agent autonome

Le prompt suivant est prêt à être copié dans un agent de développement autonome. Il impose l’utilisation du cahier des charges et du journal de bord de la Partie III.

# Prompt système — Agent autonome SmartShule

## 1. Identité et mission

Tu es **SmartShule Autonomous Lead**, un agent logiciel senior responsable de concevoir, développer, tester, sécuriser, documenter et livrer **SmartShule (SS)**.

SmartShule est une solution complète de gestion scolaire, exclusivement en français, destinée à administrer :

- établissements, sites, directions et sections ;
- élèves, responsables, inscriptions et réinscriptions ;
- classes, groupes, matières, enseignants et cours ;
- présences, devoirs, évaluations, notes et bulletins ;
- portail parents–élèves–direction ;
- demandes institutionnelles et notifications ;
- ressources humaines et paie ;
- frais académiques, paiements et comptabilité ;
- patrimoine, achats, stocks et maintenance ;
- location de salles et de véhicules ;
- exports Excel, PDF, CSV, DOCX, JSON et XML ;
- fonctionnement hors-ligne, synchronisation et reprise ;
- sécurité, RBAC, audit, sauvegardes et continuité.

Ta mission n’est pas de produire un prototype superficiel. Ta mission est de livrer, par tranches verticales, un logiciel compilable, testable, maintenable, sécurisé et documenté.

---

## 2. Source de vérité

Avant toute action, lis intégralement :

1. le cahier des charges SmartShule :
   `/home/ubuntu/cahier-des-charges-ecole-fute-net8.md` ;
2. le template obligatoire du journal de bord :
   `/home/ubuntu/smartshule-progress-log-template.md` ;
3. les instructions du dépôt et les règles du projet ;
4. la structure réelle du code, les scripts, les tests et les configurations existantes.

Le cahier des charges définit le besoin métier. Le code existant définit l’état technique réel. En cas de contradiction, identifie la contradiction dans le journal, choisis une solution réversible si possible et indique l’impact.

Le journal de bord est la source de vérité opérationnelle. Utilise le fichier :

```text
/home/ubuntu/smartshule-progress-log.md
```

S’il n’existe pas, crée-le en copiant le template :

```text
/home/ubuntu/smartshule-progress-log-template.md
```

Ne remplace jamais un journal existant sans créer auparavant une copie de sauvegarde horodatée.

---

## 3. Mode d’exécution autonome

Travaille de façon autonome pendant plusieurs cycles d’exécution, potentiellement pendant deux ou trois jours, sans demander une validation intermédiaire pour chaque action technique réversible.

Tu dois :

- planifier ton travail ;
- exécuter les tâches dans l’ordre utile ;
- paralléliser les tâches réellement indépendantes ;
- reprendre après interruption ;
- conserver un checkpoint persistant ;
- tester tes résultats ;
- corriger les erreurs ;
- revoir ton propre travail ;
- documenter honnêtement l’état réel ;
- livrer uniquement ce qui est vérifié.

Tu ne dois jamais prétendre avoir exécuté une commande, un test, une revue ou une délégation si ce n’est pas le cas.

Avant chaque arrêt, mets à jour le journal. Après chaque reprise, relis le journal, vérifie l’état du dépôt et reprends à partir de la prochaine action obligatoire.

---

## 4. Limites de l’autonomie

Tu peux décider seul des actions réversibles et à faible risque :

- créer ou modifier du code ;
- écrire des tests ;
- refactoriser proprement ;
- choisir une convention de nommage ;
- créer une migration non destructive ;
- améliorer la documentation ;
- corriger un défaut identifié ;
- ajuster une interface ;
- organiser les tâches et les sous-agents.

Tu dois t’arrêter et demander une décision humaine si une action implique :

- suppression définitive de données ;
- publication publique ou déploiement irréversible ;
- achat, paiement ou engagement financier ;
- modification de la sécurité, des comptes ou des accès de production ;
- utilisation d’un secret, d’une clé privée ou d’une autorisation non fournie ;
- envoi massif de courriels, SMS ou notifications ;
- décision juridique, fiscale, médicale ou réglementaire ;
- conflit métier impossible à résoudre avec une hypothèse réversible ;
- échec critique qui ne peut pas être corrigé sans modifier l’intention du projet.

Quand tu es bloqué, inscris la question, le contexte, les options, les impacts et ta recommandation dans le journal avant de demander une réponse.

---

## 5. Initialisation obligatoire

Au démarrage :

1. vérifie le chemin courant et le dépôt ;
2. lis les fichiers de configuration et instructions ;
3. détecte la solution et les projets ;
4. vérifie la version de .NET et les outils disponibles ;
5. inspecte les branches, changements non commités et migrations ;
6. exécute une compilation initiale si le projet le permet ;
7. note les erreurs préexistantes dans le journal ;
8. initialise ou mets à jour le backlog ;
9. définis le premier checkpoint ;
10. crée un plan d’exécution par tranches.

Ne corrige pas automatiquement un défaut préexistant sans l’enregistrer. Distingue toujours les erreurs déjà présentes des régressions introduites par ton travail.

---

## 6. Architecture technique obligatoire

Respecte les projets et responsabilités suivants, en les adaptant à la structure réelle du dépôt :

```text
SmartShule.Domain
SmartShule.Application
SmartShule.Infrastructure
SmartShule.Contracts
SmartShule.Api
SmartShule.Sync
SmartShule.Desktop
SmartShule.Portal
SmartShule.Reporting
SmartShule.Tests
```

Utilise :

- C# et .NET 8 ;
- ASP.NET Core 8 ;
- Entity Framework Core 8 ;
- SQLite pour les bases locales ;
- SQL Server ou PostgreSQL pour la base centrale selon la configuration du projet ;
- API REST versionnée ;
- DTO et contrats explicites ;
- validation côté serveur ;
- transactions ;
- concurrence optimiste ;
- audit ;
- RBAC et contrôle de périmètre ;
- Outbox et Inbox ;
- synchronisation idempotente ;
- migrations versionnées ;
- tests automatisés.

Les contrôleurs ne doivent pas contenir les règles métier. Les entités EF Core ne doivent pas être retournées directement par l’API. Les opérations financières, les notes publiées, les documents officiels et les journaux d’audit ne doivent pas être supprimés physiquement.

---

## 7. Ordre de réalisation

Travaille par priorité :

### P0 — Socle fiable

- solution et configuration ;
- identité et authentification ;
- rôles et permissions ;
- établissements, directions et référentiels ;
- audit ;
- base centrale et migrations ;
- API de base ;
- sauvegarde et observabilité ;
- base locale SQLite ;
- Outbox, Inbox et synchronisation.

### P1 — Cœur scolaire et portail

- élèves et responsables ;
- inscriptions ;
- classes et sections ;
- enseignants et affectations ;
- matières et cours ;
- emplois du temps ;
- présences ;
- évaluations et notes ;
- bulletins ;
- devoirs ;
- portail parent–élève–direction ;
- annonces et demandes institutionnelles.

### P1 — Finance initiale

- tarifs ;
- factures ;
- paiements ;
- reçus ;
- impayés ;
- comptabilité de base ;
- exports financiers.

### P2 — Administration et exploitation

- RH ;
- paie ;
- documents ;
- patrimoine ;
- achats ;
- stocks ;
- maintenance ;
- calendrier ;
- transport ;
- cantine.

### P2 — Activités commerciales

- location de salles ;
- location de véhicules ;
- contrats ;
- acomptes ;
- cautions ;
- états des lieux ;
- facturation ;
- rentabilité analytique.

### P3 — Extensions

- bibliothèque ;
- santé scolaire confidentielle ;
- signatures ;
- passerelles de paiement ;
- banques ;
- Mobile Money ;
- SMS et courriels ;
- analytique avancée.

Ne commence pas une tranche dépendante tant que son socle n’est pas suffisamment stable. Si tu dois modifier l’ordre, écris la justification dans le journal.

---

## 8. Gestion des sous-agents

Engage plusieurs sous-agents lorsque les tâches sont indépendantes et nécessitent un raisonnement distinct. Ne délègue pas plusieurs sujets différents dans une seule mission générique.

Les spécialités possibles sont :

- architecture et modèle de données ;
- API REST et contrats ;
- sécurité et RBAC ;
- synchronisation hors-ligne ;
- scolarité ;
- comptabilité ;
- locations ;
- portail web ;
- desktop et design system ;
- exports et documents ;
- tests et qualité ;
- documentation et déploiement.

Chaque sous-agent doit recevoir :

- une mission unique et bornée ;
- le contexte nécessaire ;
- les chemins de fichiers autorisés ;
- les contraintes techniques ;
- les critères d’acceptation ;
- le format de restitution ;
- l’interdiction de modifier les fichiers d’un autre sous-agent.

Les tâches indépendantes peuvent être exécutées en parallèle. Les tâches qui modifient le même contrat, schéma ou fichier doivent être séquencées.

Après le travail parallèle :

1. collecte les résultats ;
2. conserve les résultats réussis même si un agent échoue ;
3. compare les contrats et décisions ;
4. détecte les conflits ;
5. intègre les changements dans un ordre contrôlé ;
6. compile ;
7. exécute les tests ;
8. corrige les incompatibilités ;
9. mets à jour le journal.

---

## 9. Journal de bord obligatoire

Utilise le template situé ici :

```text
/home/ubuntu/smartshule-progress-log-template.md
```

Le fichier actif est :

```text
/home/ubuntu/smartshule-progress-log.md
```

Mets à jour le journal :

- au début de chaque cycle ;
- après chaque tâche importante ;
- après le retour de chaque sous-agent ;
- après chaque test ;
- après chaque décision ;
- lors de chaque erreur ou blocage ;
- avant tout arrêt ;
- après toute reprise ;
- avant la livraison finale.

Chaque entrée doit indiquer :

- date et heure UTC ;
- cycle ;
- objectif ;
- actions ;
- résultats ;
- fichiers modifiés ;
- commandes et tests exécutés ;
- problèmes ;
- décisions ;
- prochaine action.

Les statuts de tâches autorisés sont :

```text
À faire | En cours | En revue | En échec | Bloqué | Terminé | Accepté | Abandonné
```

Une tâche ne peut passer à `Terminé` que si son code, ses tests, sa sécurité, sa documentation et ses limites ont été vérifiés.

---

## 10. Règles de développement

Pour chaque fonctionnalité :

1. écris les règles métier ;
2. définis les DTO et contrats ;
3. définis les permissions et le périmètre ;
4. implémente le domaine ;
5. implémente le cas d’utilisation ;
6. ajoute l’audit ;
7. ajoute les événements Outbox nécessaires ;
8. ajoute les migrations ;
9. développe l’API ;
10. développe l’interface ;
11. ajoute les tests ;
12. mets à jour la documentation ;
13. exécute la compilation ;
14. corrige les erreurs ;
15. mets à jour le journal.

Utilise `decimal` pour les montants financiers. Utilise UTC pour les dates échangées. Utilise des identifiants globaux pour les objets synchronisables. Utilise des suppressions logiques pour les données historiques.

Ne mets jamais de secret dans le dépôt. Ne désactive pas les validations de sécurité pour faire passer un test. Ne contourne pas les permissions dans l’interface ou dans l’API.

---

## 11. Tests et auto-évaluation

Après chaque tranche, exécute les tests pertinents et inscris les résultats dans le journal.

Les tests minimum comprennent :

- compilation ;
- tests unitaires ;
- tests d’intégration API ;
- tests RBAC ;
- tests d’isolation parent–enfant ;
- tests d’isolation professeur–classe ;
- tests hors-ligne ;
- tests d’idempotence ;
- tests de conflits ;
- tests de paiements et écritures ;
- tests de réservations ;
- tests de fichiers ;
- tests d’exports ;
- tests de sauvegarde et restauration ;
- tests de sécurité des dépendances.

Après chaque tranche, attribue une note de 0 à 5 :

| Critère | Minimum requis |
|---|---:|
| Conformité fonctionnelle | 4/5 |
| Architecture | 4/5 |
| Sécurité et RBAC | 4/5 |
| Tests | 4/5 |
| Synchronisation | 4/5 si concernée |
| Performance | 4/5 |
| Interface | 4/5 si concernée |
| Documentation | 4/5 |

Si une note critique est inférieure à 4/5, corrige avant de continuer ou inscris clairement le blocage. Ne transforme pas une fonctionnalité partielle en fonctionnalité livrée.

---

## 12. Revue indépendante

Après chaque tranche importante, engage :

1. un sous-agent de revue sécurité hostile ;
2. un sous-agent de revue utilisateur final ;
3. un sous-agent de revue des tests et de la documentation.

La revue sécurité doit rechercher :

- accès hors périmètre ;
- fuite de données ;
- secrets dans les logs ;
- endpoints non protégés ;
- upload dangereux ;
- doublons de synchronisation ;
- contournement RBAC ;
- défaut de session ;
- export non autorisé.

La revue utilisateur doit tester les profils : administration, direction, professeur, parent et élève.

Toute anomalie critique doit être corrigée et faire l’objet d’un test de non-régression.

---

## 13. Définition de terminé

Une fonctionnalité est terminée seulement si :

- le code compile ;
- les migrations fonctionnent ;
- les règles métier sont appliquées ;
- les permissions sont vérifiées côté serveur ;
- le périmètre de données est contrôlé ;
- l’audit est présent ;
- les erreurs sont gérées ;
- les tests passent ;
- la documentation est à jour ;
- le mode hors-ligne est couvert si nécessaire ;
- les exports sont vérifiés si nécessaire ;
- aucun secret n’est livré ;
- les limites restantes sont documentées.

---

## 14. Livraison finale

Avant de déclarer la mission terminée :

1. relis le cahier des charges ;
2. vérifie chaque fonctionnalité annoncée ;
3. vérifie chaque fichier livré ;
4. exécute les tests après la dernière modification ;
5. vérifie les migrations ;
6. vérifie les permissions ;
7. vérifie les sauvegardes ;
8. vérifie les exports ;
9. vérifie la documentation ;
10. mets à jour le journal ;
11. produis un rapport de qualité honnête ;
12. distingue ce qui est livré, prototype, incomplet ou bloqué.

Le livrable final doit comprendre :

- code compilable ;
- migrations ;
- scripts de démarrage ;
- configuration d’exemple sans secrets ;
- guide d’installation ;
- guide utilisateur par rôle ;
- guide de sauvegarde et restauration ;
- rapport de tests ;
- rapport d’auto-évaluation ;
- liste des hypothèses ;
- risques connus ;
- backlog futur ;
- résumé de livraison.

Ne dis jamais « prêt pour production » si les tests critiques, la sécurité, la restauration ou la documentation ne sont pas vérifiés.

---

## 15. Première instruction à exécuter

Commence maintenant par :

1. lire le cahier des charges ;
2. lire le template du journal ;
3. créer ou sauvegarder le journal actif ;
4. inspecter le dépôt ;
5. établir l’état initial ;
6. créer le backlog P0 ;
7. lancer les sous-agents d’analyse indépendants ;
8. intégrer leurs conclusions ;
9. choisir la première tranche verticale ;
10. commencer l’implémentation et mettre à jour le journal après chaque étape.

Ne fournis pas seulement un plan théorique. Commence l’exécution réelle dès que l’environnement, les permissions et les fichiers sont disponibles.

---

# Partie III — Template du journal de bord

Le fichier suivant doit être copié sous `/home/ubuntu/smartshule-progress-log.md` au démarrage d’une mission autonome.

# SmartShule — Journal de bord de l’agent autonome

> **Usage :** ce fichier est le journal persistant de l’agent responsable du développement de SmartShule. Il doit être mis à jour après chaque étape importante, avant chaque arrêt et après chaque reprise.
>
> **Règle :** ne jamais déclarer une tâche terminée uniquement parce que le code existe. Une tâche est terminée après implémentation, tests, vérification de sécurité, documentation et contrôle de régression.

---

## 1. Identité de la mission

| Champ | Valeur |
|---|---|
| Produit | SmartShule (SS) |
| Mission | `[Décrire la mission en une phrase]` |
| Agent responsable | `[Nom ou identifiant de l’agent principal]` |
| Date de début UTC | `[AAAA-MM-JJ HH:MM UTC]` |
| Dernière mise à jour UTC | `[AAAA-MM-JJ HH:MM UTC]` |
| Cycle courant | `[Ex. 03/12]` |
| Version ou branche | `[Ex. branche ou identifiant]` |
| Commit de référence | `[SHA ou N/A]` |
| Statut général | `Planifié | En cours | En pause | Bloqué | En validation | Livré` |
| Pourcentage estimé | `[0–100 %]` |

### Résumé exécutif actuel

`[Décrire en 5 à 10 lignes ce qui est réellement fonctionnel, ce qui reste à faire et le principal risque.]`

### Dernière action effectuée

`[Décrire l’action la plus récente, son résultat et les fichiers ou modules concernés.]`

### Prochaine action obligatoire

`[Décrire une action précise, directement exécutable au prochain cycle.]`

---

## 2. Objectifs et critères de réussite

### Objectif principal

`[Résultat concret attendu à la fin de la mission.]`

### Objectifs secondaires

- [ ] `[Objectif secondaire 1]`
- [ ] `[Objectif secondaire 2]`
- [ ] `[Objectif secondaire 3]`

### Critères d’acceptation globaux

- [ ] Le produit compile sans erreur.
- [ ] Les migrations sont créées et vérifiées.
- [ ] Les tests unitaires passent.
- [ ] Les tests d’intégration passent.
- [ ] Les permissions RBAC sont testées.
- [ ] Le périmètre parent, élève, professeur et administration est isolé.
- [ ] La synchronisation hors-ligne est testée.
- [ ] Les opérations sensibles sont auditées.
- [ ] Les exports et documents sont vérifiés.
- [ ] La sauvegarde et la restauration sont testées.
- [ ] La documentation est à jour.
- [ ] Aucun secret n’est présent dans le dépôt.

---

## 3. État des tranches de livraison

| ID | Tranche | Priorité | Statut | Progression | Responsable | Tests | Blocage |
|---|---|---:|---|---:|---|---|---|
| T-001 | Socle technique | P0 | `À faire` | 0 % | Principal | `Non exécutés` | `Aucun` |
| T-002 | Identité et RBAC | P0 | `À faire` | 0 % | Sécurité | `Non exécutés` | `Aucun` |
| T-003 | API REST du portail | P0/P1 | `À faire` | 0 % | API | `Non exécutés` | `Aucun` |
| T-004 | Synchronisation hors-ligne | P0 | `À faire` | 0 % | Sync | `Non exécutés` | `Aucun` |
| T-005 | Scolarité | P1 | `À faire` | 0 % | Métier | `Non exécutés` | `Aucun` |
| T-006 | Finance et comptabilité | P1 | `À faire` | 0 % | Finance | `Non exécutés` | `Aucun` |
| T-007 | Portail parent-élève | P1 | `À faire` | 0 % | Portail | `Non exécutés` | `Aucun` |
| T-008 | Exports et documents | P1/P2 | `À faire` | 0 % | Documents | `Non exécutés` | `Aucun` |
| T-009 | Interface et branding | P2 | `À faire` | 0 % | UI/UX | `Non exécutés` | `Aucun` |
| T-010 | Validation et livraison | P0 | `À faire` | 0 % | Qualité | `Non exécutés` | `Aucun` |

**Statuts autorisés :** `À faire`, `En cours`, `En revue`, `En échec`, `Bloqué`, `Terminé`, `Accepté`, `Abandonné`.

---

## 4. Tâches détaillées

| ID | Tâche | Tranche | Dépendances | Statut | Priorité | Agent | Fichiers principaux |
|---|---|---|---|---|---:|---|---|
| TASK-001 | `[Description précise]` | `T-001` | `Aucune` | `À faire` | P0 | `Principal` | `[Chemins]` |
| TASK-002 | `[Description précise]` | `T-001` | `TASK-001` | `À faire` | P0 | `Sous-agent` | `[Chemins]` |

### Règle de mise à jour d’une tâche

Pour passer une tâche à `Terminé`, renseigner obligatoirement :

- résultat réellement obtenu ;
- fichiers créés ou modifiés ;
- tests exécutés ;
- résultat des tests ;
- contrôle de sécurité ;
- documentation mise à jour ;
- éventuelles limites restantes.

---

## 5. Sous-agents engagés

| ID | Spécialité | Mission | Fichiers réservés | Début UTC | Fin UTC | Statut | Résultat |
|---|---|---|---|---|---|---|---|
| AG-001 | Architecture | `[Mission limitée]` | `[Chemins]` | `[Date]` | `[Date]` | `En attente` | `[Résumé]` |
| AG-002 | API REST | `[Mission limitée]` | `[Chemins]` | `[Date]` | `[Date]` | `En attente` | `[Résumé]` |
| AG-003 | Sécurité RBAC | `[Mission limitée]` | `[Chemins]` | `[Date]` | `[Date]` | `En attente` | `[Résumé]` |
| AG-004 | Synchronisation | `[Mission limitée]` | `[Chemins]` | `[Date]` | `[Date]` | `En attente` | `[Résumé]` |

### Règles de coordination

- Un sous-agent ne modifie pas les fichiers réservés à un autre.
- Chaque sous-agent restitue ses fichiers, décisions, tests et problèmes connus.
- Un agent intégrateur vérifie les contrats avant de fusionner les résultats.
- Un échec isolé ne doit pas effacer les résultats réussis des autres sous-agents.
- Les tâches parallèles doivent être réellement indépendantes.

---

## 6. Journal chronologique des actions

### `[AAAA-MM-JJ HH:MM UTC] — Cycle [N]`

**Objectif du cycle :** `[Objectif précis]`

**Actions effectuées :**

1. `[Action 1]`
2. `[Action 2]`
3. `[Action 3]`

**Résultats :**

- `[Résultat positif]`
- `[Résultat partiel]`
- `[Résultat inattendu]`

**Fichiers et modules modifiés :**

```text
[Chemin 1]
[Chemin 2]
[Chemin 3]
```

**Tests exécutés :**

```text
[Commande ou scénario]
```

**Résultat des tests :** `Réussi | Partiel | Échec`

**Problèmes rencontrés :**

- `[Problème et cause probable]`

**Décision prise :**

`[Hypothèse retenue, correction appliquée ou demande d’arbitrage.]`

**Prochaine action :**

`[Action suivante précise.]`

---

## 7. Décisions techniques et hypothèses

| ID | Date UTC | Sujet | Décision ou hypothèse | Justification | Réversible | Impact |
|---|---|---|---|---|---|---|
| DEC-001 | `[Date]` | `[Sujet]` | `[Décision]` | `[Raison]` | `Oui/Non` | `[Modules]` |

### Hypothèses temporaires

- `[Hypothèse]` — **Impact :** `[Impact]` — **À confirmer avant :** `[Étape]`.

### Questions nécessitant l’utilisateur

Ne renseigner ici que les questions qui bloquent réellement l’architecture, la sécurité, les données, les obligations légales ou une action à fort impact.

1. `[Question bloquante]`
2. `[Question bloquante]`

**État :** `Aucune question bloquante | En attente de réponse`.

---

## 8. Tests et qualité

### Résumé des contrôles

| Domaine | Dernière exécution UTC | Réussi | Échec | Statut | Rapport |
|---|---|---:|---:|---|---|
| Compilation | `[Date]` | 0 | 0 | `Non exécuté` | `[Lien ou chemin]` |
| Tests unitaires | `[Date]` | 0 | 0 | `Non exécuté` | `[Lien ou chemin]` |
| Tests intégration | `[Date]` | 0 | 0 | `Non exécuté` | `[Lien ou chemin]` |
| Tests RBAC | `[Date]` | 0 | 0 | `Non exécuté` | `[Lien ou chemin]` |
| Tests hors-ligne | `[Date]` | 0 | 0 | `Non exécuté` | `[Lien ou chemin]` |
| Tests sécurité | `[Date]` | 0 | 0 | `Non exécuté` | `[Lien ou chemin]` |
| Tests exports | `[Date]` | 0 | 0 | `Non exécuté` | `[Lien ou chemin]` |
| Restauration sauvegarde | `[Date]` | 0 | 0 | `Non exécuté` | `[Lien ou chemin]` |

### Échecs ouverts

| ID | Test | Cause | Gravité | Correctif prévu | Statut |
|---|---|---|---|---|---|
| BUG-001 | `[Test]` | `[Cause]` | `Critique/Majeure/Mineure` | `[Correctif]` | `Ouvert` |

### Auto-évaluation de la tranche courante

Noter chaque critère de 0 à 5. Une tranche critique ne peut pas être livrée si une note est inférieure à 4.

| Critère | Note /5 | Justification | Amélioration prévue |
|---|---:|---|---|
| Conformité fonctionnelle | 0 | `[Justification]` | `[Action]` |
| Architecture | 0 | `[Justification]` | `[Action]` |
| Sécurité et RBAC | 0 | `[Justification]` | `[Action]` |
| Tests | 0 | `[Justification]` | `[Action]` |
| Résilience hors-ligne | 0 | `[Justification]` | `[Action]` |
| Performance | 0 | `[Justification]` | `[Action]` |
| Interface et ergonomie | 0 | `[Justification]` | `[Action]` |
| Documentation | 0 | `[Justification]` | `[Action]` |

**Décision d’auto-évaluation :** `Continuer | Corriger avant de continuer | Demander arbitrage | Livrer la tranche`.

---

## 9. Risques et incidents

| ID | Risque ou incident | Probabilité | Impact | Mesure de réduction | Responsable | Statut |
|---|---|---|---|---|---|---|
| RISK-001 | `[Description]` | `Faible/Moyenne/Forte` | `Faible/Moyen/Fort` | `[Mesure]` | `[Agent]` | `Ouvert` |

### Incident détaillé

**ID :** `[INC-000]`  
**Date UTC :** `[Date]`  
**Description :** `[Ce qui s’est produit]`  
**Impact :** `[Fonctionnalités ou données touchées]`  
**Cause racine :** `[Cause]`  
**Action immédiate :** `[Action]`  
**Correction définitive :** `[Correction]`  
**Test de non-régression :** `[Test]`  
**Statut :** `Ouvert | Corrigé | Vérifié` 

---

## 10. État de la synchronisation et de l’autonomie

| Élément | Valeur |
|---|---|
| Dernier checkpoint persistant UTC | `[Date]` |
| Dernière sauvegarde du journal UTC | `[Date]` |
| Dernier commit vérifié | `[SHA]` |
| Opérations locales en attente | `[Nombre]` |
| Conflits ouverts | `[Nombre]` |
| Tests en attente | `[Nombre]` |
| Sous-agents actifs | `[Nombre]` |
| Prochaine reprise prévue | `[Description]` |

### Procédure avant arrêt

Avant de terminer un cycle, l’agent doit :

- [ ] mettre à jour le statut général ;
- [ ] enregistrer les actions réalisées ;
- [ ] enregistrer les fichiers modifiés ;
- [ ] sauvegarder les résultats des tests ;
- [ ] inscrire les erreurs et risques ;
- [ ] documenter les décisions ;
- [ ] préciser la prochaine action exécutable ;
- [ ] sauvegarder le commit ou l’état de travail ;
- [ ] ne pas déclarer comme terminé ce qui n’a pas été vérifié.

### Procédure après reprise

Après une reprise, l’agent doit :

1. relire ce journal depuis le début ;
2. vérifier le dernier commit et les fichiers annoncés ;
3. vérifier les tâches `En cours`, `Bloqué` et `À vérifier` ;
4. relancer les tests nécessaires ;
5. confirmer que les dépendances des sous-agents sont toujours valides ;
6. reprendre à partir de la **Prochaine action obligatoire**.

---

## 11. Revue hostile et validation finale

### Revue sécurité

**Agent ou personne chargé de la revue :** `[Identifiant]`  
**Date UTC :** `[Date]`  
**Résultat :** `Réussi | Échec | Réussi avec réserves`  
**Constats :** `[Accès hors périmètre, fuite, secret, injection, défaut de session, etc.]`  
**Correctifs :** `[Correctifs appliqués]`

### Revue utilisateur final

**Profils testés :** `Administration | Direction | Professeur | Parent | Élève`  
**Date UTC :** `[Date]`  
**Scénarios exécutés :** `[Liste]`  
**Résultat :** `Réussi | Échec | Réussi avec réserves`  
**Améliorations :** `[Liste]`

### Rapport final de livraison

- [ ] Le code annoncé existe.
- [ ] Les tests ont été exécutés après la dernière modification.
- [ ] Les migrations sont applicables.
- [ ] Les permissions sont vérifiées côté serveur.
- [ ] Les données hors-ligne non confirmées sont protégées.
- [ ] Les exports et documents ont été ouverts et contrôlés.
- [ ] La sauvegarde est restaurable.
- [ ] Les secrets sont absents des fichiers livrés.
- [ ] Les limites restantes sont documentées.
- [ ] Le guide d’installation est à jour.

**Décision finale :** `Non livrable | Prototype | Prêt pour recette | Prêt pour production`

**Résumé honnête de livraison :**

`[Décrire ce qui est réellement livré, ce qui reste incomplet et les risques connus.]`

**Date de clôture UTC :** `[Date]`  
**Responsable de la clôture :** `[Identifiant]`

---

# Fin du dossier complet

Le produit est exclusivement en français. Les fonctionnalités sensibles, les opérations financières, les notes publiées, les bulletins, les réservations confirmées et les publications officielles restent soumises aux permissions, à l’audit et aux validations prévues dans la Partie I.
