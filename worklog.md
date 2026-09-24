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

---
Task ID: student-edit-and-dossier-pdf
Agent: main (Super Z)
Task: Suite du drawer élève — (1) Permettre l'édition directe depuis le drawer (modifier le téléphone d'un parent, etc.) et (2) Ajouter un bouton "Imprimer tout le dossier" qui génère un PDF synthèse complet de l'élève.

Work Log:
- Exploration des patterns PDF existants dans `src/lib/exports.ts` (generatePaymentReceiptPDF via pdfkit, formatage Intl, branding école)
- Lecture de `src/app/api/exports/attestation/route.ts` comme modèle pour la nouvelle route PDF
- Vérification du modèle StudentFinancialStatus dans schema.prisma (champs status, reason, blockedAt, updatedById, updatedAt, @@unique [schoolId, studentId])

- Ajout du PATCH sur `/api/students/[id]/route.ts` :
  * 3 cas gérés : édition du parent (body.guardianId + body.fields), édition du statut financier (body.financialStatus), édition de l'élève (firstName, lastName, gender, birthDate, status, photoUrl)
  * RBAC strict : DIRECTION, SECRETAIRE, ADMIN seulement
  * Vérification de l'appartenance (élève+école, parent+élève+école)
  * Upsert sur StudentFinancialStatus (create si pas existant, sinon update)
  * Journalisation logAudit pour chaque modification (action UPDATE, entityType STUDENT ou GUARDIAN)
  * Champs photoUrl et birthDate nullable
  * Validation des enums (status ACTIVE|ARCHIVED|TRANSFERRED, financialStatus REGULAR|LITIGATION|BLOCKED)

- Création de `/api/exports/student-dossier/route.ts` :
  * Génération PDF multi-pages via pdfkit avec bufferPages pour le pied de page global
  * Page 1 : En-tête école + Identité élève + Affectation + Statut financier (si non régulier)
  * Page 2 : Dossier familial complet (parents, tuteurs, contacts, profession, adresse)
  * Page 3 : Synthèse financière (4 cartes KPI colorées) + tableau des dettes (jusqu'à 20) + 10 derniers reçus
  * Page 4 : Notes & Bulletins (bulletins officiels + notes par période et matière avec moyennes)
  * Page 5 : Présences (IQA coloré selon seuils 90/75/50 + compteurs + 12 dernières absences)
  * Pied de page sur toutes les pages : "Dossier générétique de X (matricule) · École · Date · Page i/N · SmartShule © 2026-2027"
  * RBAC : DIRECTION, SECRETAIRE, ADMIN, ACCOUNTANT, TEACHER
  * Journalisation audit EXPORT avec pages count et studentMatricule

- Mise à jour de `student-detail-drawer.tsx` :
  * Imports : Input, Label, Textarea, Pencil, Save, X en plus
  * Nouvelle fonction `reload()` (sans repasser par loading) appelée après chaque édition
  * Création de 3 sous-composants d'édition inline :
    - EditableGuardianCard : bouton ✏️ sur chaque parent → formulaire inline (prénom, nom, téléphone, email, profession, adresse) + boutons Save (✓) et Annuler (✕)
    - EditableStudentIdentity : bouton ✏️ sur la Card identité → formulaire (prénom, nom, genre, date naissance, statut, photo URL)
    - EditableFinancialStatus : carte ambre avec édition du statut (REGULAR|LITIGATION|BLOCKED) + motif (Textarea)
  * Remplacement des Cards statiques par les composants éditables dans les onglets Identité et Famille
  * Ajout du bouton "Imprimer le dossier" dans le SheetHeader (en haut à droite, icône Printer)
  * Ajout d'un encart "Dossier complet de l'élève (PDF synthèse)" en haut de l'onglet Documents avec bouton "Générer le dossier PDF complet"
  * Messages toast.success / toast.error après chaque opération
  * Spinners Loader2 pendant les sauvegardes

- Vérification TypeScript : 0 erreur sur les nouveaux fichiers
- Build Next.js : OK, la nouvelle route `/api/exports/student-dossier` est bien détectée
- Toutes les routes /api/students/[id] (GET + PATCH) et /api/exports/student-dossier sont compilées

Stage Summary:
- 3 fichiers créés/modifiés :
  * `/home/z/my-project/src/app/api/students/[id]/route.ts` (MODIFIÉ - ajout PATCH pour édition élève/parent/statut financier)
  * `/home/z/my-project/src/app/api/exports/student-dossier/route.ts` (NOUVEAU - PDF synthèse 5 pages)
  * `/home/z/my-project/src/modules/secretary/student-detail-drawer.tsx` (MODIFIÉ - 3 composants d'édition inline + bouton Imprimer + bouton dossier PDF)
- Édition directe disponible sur : identité élève (prénom/nom/genre/naissance/statut/photo), informations parent (téléphone/email/profession/adresse/nom), statut financier (statut + motif)
- Bouton "Imprimer le dossier" visible à 2 endroits : en-tête du drawer (toujours visible) + onglet Documents (encart dédié)
- Sécurité RBAC respectée : PATCH réservé à DIRECTION/SECRETAIRE/ADMIN, PDF réservé au personnel autorisé
- Audit trail : chaque modification est journalisée avec userId, entityId, description et metadata

---
Task ID: 1
Agent: Main Agent
Task: Module Secrétariat centralisé avancé (Étape 11)

Work Log:
- Analyzed existing codebase: 60+ Prisma models, 25+ API routes, 7 secretary UI components
- Added 9 new Prisma models: StudentDocument, Certificate, CertificateTemplate, Transfer, Communication, CallLog, VisitorLog, Appointment, AbsenceJustification, MassOperation
- Added relations to School and Student models
- Generated Prisma client successfully
- Created 7 new API routes: search, absences, communications, transfers, documents, enrollments, reports
- Created 5 new UI components: AbsencesCenter, CommunicationsCenter, DocumentsCenter, TransfersCenter, ReportsCenter
- Enhanced Secretary portal shell with: universal search, 3 navigation sections, 10 views
- Enhanced dashboard with clickable KPIs linking to specialized centers
- Updated dashboard API to compute transfersToProcess and documentsToProduce
- Build passed successfully with all new routes visible

Stage Summary:
- 9 new Prisma models added without breaking existing schema
- 7 new API routes with server-side RBAC
- 5 new specialized center UIs (Absences, Communications, Documents, Transfers, Reports)
- Universal search across students, admissions, guardians, classrooms
- Enhanced secretary portal with 3 nav sections and 10 views
- All existing functionality preserved (non-regression)
- No breaking changes to existing API routes or UI components
