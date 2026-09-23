---
Task ID: student-detail-drawer
Agent: main (Super Z)
Task: Création d'un dossier élève centralisé complexe (Drawer plein écran avec 7 onglets) accessible en cliquant sur le nom d'un élève dans la liste. Doit contenir : Identité, Famille, Scolarité, Finances (états de paye + restes), Notes & Bulletins, Présences, Documents.

Work Log:
- Analyse du contexte projet SmartShule (suite d'une session précédente)
- Lecture du schéma Prisma (60+ modèles) pour comprendre Student, Guardian, GuardianStudentLink, Enrollment, StudentDebt, Receipt, MobileMoneyPayment, Scholarship, InvoiceLineConfig, Grade, ReportCard, Attendance
- Lecture du fichier `src/modules/secretary/students-list.tsx` existant (DataGrid avec petit modal)
- Création de l'API `src/app/api/students/[id]/route.ts` :
  * Récupère l'identité (Student + User + GuardianLinks)
  * Récupère l'historique des inscriptions (Enrollment avec classroom, directorate, section, option)
  * Récupère toutes les dettes (StudentDebt) avec relations (InvoiceLineConfig, Scholarship, Receipts)
  * Récupère tous les reçus (Receipt) avec MobileMoneyPayment
  * Récupère les factures legacy (Invoice + Lines + Payments)
  * Calcule les bourses appliquées (uniques, via StudentDebt.scholarship)
  * Récupère les notes publiées (Grade) et bulletins (ReportCard)
  * Groupe les notes par période puis par matière avec calcul des moyennes
  * Récupère les présences (Attendance groupBy status + 30 dernières absences/retards)
  * Calcule l'IQA (Indicateur Qualité d'Assiduité)
  * Retourne un JSON structuré complet
- Création du composant `src/modules/secretary/student-detail-drawer.tsx` :
  * Drawer plein écran (Sheet) s'ouvrant à droite
  * 7 onglets avec icônes : Identité, Famille, Scolarité, Finances, Notes, Présences, Documents
  * Onglet Identité : infos perso + compte utilisateur + affectation + alerte statut financier
  * Onglet Famille : cartes parents/tuteurs avec contact, profession, adresse
  * Onglet Scolarité : historique chronologique des inscriptions
  * Onglet Finances : 4 cartes KPI (Dû/Payé/Reste/Réductions) + table des dettes avec totaux + reçus émis + bourses + factures
  * Onglet Notes : KPIs + bulletins officiels + notes par période et matière avec moyennes colorées
  * Onglet Présences : IQA avec progress bar + taux présence + absences + retards + justificatifs
  * Onglet Documents : génération PDF (attestation, carte, bulletin, reçu)
- Modification de `src/modules/secretary/students-list.tsx` :
  * Import du composant StudentDetailDrawer
  * Ajout du state `detailStudentId` / `detailStudentName`
  * Rendu du nom de l'élève cliquable (button + hover underline)
  * Remplacement du bouton Eye par FolderOpen (icône dossier)
  * Ajout du bouton "Dossier complet" dans le petit modal existant
  * Ajout du drawer en bas du composant
- Vérification TypeScript : 0 erreur dans les nouveaux fichiers (114 erreurs pré-existantes dans d'autres fichiers non modifiés)
- Alignement avec le schéma Prisma réel :
  * InvoiceLineConfig.name (pas label)
  * Scholarship (school-level, pas student-level) → récupéré via StudentDebt.scholarship
  * MobileMoneyPayment.providerTransactionId (pas transactionId)
  * Receipt n'a pas de champ `status` → dérivé de `cancelledAt`
  * ReportCard.academicYearId (pas de relation directe)

Stage Summary:
- 3 fichiers créés/modifiés :
  * `/home/z/my-project/src/app/api/students/[id]/route.ts` (NOUVEAU - API complète)
  * `/home/z/my-project/src/modules/secretary/student-detail-drawer.tsx` (NOUVEAU - composant drawer)
  * `/home/z/my-project/src/modules/secretary/students-list.tsx` (MODIFIÉ - nom cliquable)
- Fonctionnalité livrée : clic sur le nom d'un élève dans la liste → ouverture d'un drawer plein écran avec 7 onglets contenant TOUTES les informations (dossier familial, états de paye, restes à payer, notes par matière et par période, présences avec IQA, génération de documents PDF)
- Aucune régression : la liste existante et le petit modal rapide sont conservés
- TypeScript propre sur les nouveaux fichiers
