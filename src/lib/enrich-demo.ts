// SmartShule — Enrichissement seed démo (données relationnelles complètes)
// ============================================================
// Ajoute : admissions, matières, affectations, cours, notes, bulletins,
// annonces, communications, dépenses, budget, et plus.
// Complète le seed-demo-runner pour une démo vivante de bout en bout.

import { db } from '@/lib/db'

export interface EnrichDemoResult {
  ok: boolean
  message: string
  created: {
    admissions: number
    subjects: number
    teacherAssignments: number
    courses: number
    grades: number
    reportCards: number
    announcements: number
    messages: number
    expenses: number
    appointments: number
    documents: number
    adminTasks: number
  }
}

// ============================================================
// Données de référence
// ============================================================

const SUBJECTS_BY_LEVEL = {
  Maternelle: [
    { name: 'Éveil', code: 'EVEIL', coefficient: 1 },
    { name: 'Langage', code: 'LANG', coefficient: 1 },
    { name: 'Graphisme', code: 'GRAPH', coefficient: 1 },
    { name: 'Motricité', code: 'MOTR', coefficient: 1 },
    { name: 'Activités créatives', code: 'CREAT', coefficient: 1 },
  ],
  Primaire: [
    { name: 'Français', code: 'FR-P', coefficient: 3 },
    { name: 'Mathématiques', code: 'MATH-P', coefficient: 3 },
    { name: 'Sciences', code: 'SCI-P', coefficient: 2 },
    { name: 'Histoire-Géographie', code: 'HG-P', coefficient: 2 },
    { name: 'Éducation civique', code: 'CIV-P', coefficient: 1 },
    { name: 'Anglais', code: 'ANG-P', coefficient: 2 },
    { name: 'Informatique', code: 'INFO-P', coefficient: 1 },
    { name: 'EPS', code: 'EPS-P', coefficient: 1 },
  ],
  Secondaire: [
    { name: 'Français', code: 'FR-S', coefficient: 3 },
    { name: 'Mathématiques', code: 'MATH-S', coefficient: 4 },
    { name: 'Physique', code: 'PHY-S', coefficient: 3 },
    { name: 'Chimie', code: 'CHIM-S', coefficient: 3 },
    { name: 'Biologie', code: 'BIO-S', coefficient: 3 },
    { name: 'Histoire', code: 'HIST-S', coefficient: 2 },
    { name: 'Géographie', code: 'GEO-S', coefficient: 2 },
    { name: 'Anglais', code: 'ANG-S', coefficient: 2 },
    { name: 'Informatique', code: 'INFO-S', coefficient: 1 },
    { name: 'EPS', code: 'EPS-S', coefficient: 1 },
  ],
}

const CLASSES_BY_DIRECTORATE: Record<string, string[]> = {
  Maternelle: ['Petite Section A', 'Grande Section A'],
  Primaire: ['1re Primaire A', '2e Primaire A', '3e Primaire A', '4e Primaire A', '5e Primaire A', '6e Primaire A'],
  Secondaire: ['1re Secondaire A', '2e Secondaire A'],
}

// ============================================================
// Runner principal
// ============================================================

export async function enrichDemoData(): Promise<EnrichDemoResult> {
  const school = await db.school.findFirst({ where: { email: 'contact@demo.smartshule.com' } })
  if (!school) throw new Error('École démo introuvable. Exécutez seed-demo d\'abord.')

  const schoolId = school.id

  const created = {
    admissions: 0,
    subjects: 0,
    teacherAssignments: 0,
    courses: 0,
    grades: 0,
    reportCards: 0,
    announcements: 0,
    messages: 0,
    expenses: 0,
    appointments: 0,
    documents: 0,
    adminTasks: 0,
  }

  // 1. Matières par niveau
  created.subjects = await createSubjects(schoolId)

  // 2. Affectations enseignants → matières → classes
  created.teacherAssignments = await createTeacherAssignments(schoolId)

  // 3. Cours (Course = classe + matière + enseignant)
  created.courses = await createCourses(schoolId)

  // 4. Notes pour élèves (4e, 5e, 6e primaire + secondaire)
  created.grades = await createGrades(schoolId)

  // 5. Bulletins
  created.reportCards = await createReportCards(schoolId)

  // 6. Admissions avec statuts variés
  created.admissions = await createAdmissions(schoolId)

  // 7. Annonces
  created.announcements = await createAnnouncements(schoolId)

  // 8. Communications/Messages
  created.messages = await createMessages(schoolId)

  // 9. Dépenses
  created.expenses = await createExpenses(schoolId)

  // 10. Rendez-vous
  created.appointments = await createAppointments(schoolId)

  // 11. Tâches admin
  created.adminTasks = await createAdminTasks(schoolId)

  // 12. Absences et retards du JOUR (pour dashboard)
  await createTodayAttendance(schoolId)

  // 13. Transferts entrants/sortants
  await createTransfers(schoolId)

  // 14. Demandes parents (parentsToContact)
  await createParentRequests(schoolId)

  // 15. Certificats en attente de validation (documentsToProduce)
  await createCertificatesPending(schoolId)

  // 16. Rendez-vous via Reception (appointmentsToday)
  await createReceptions(schoolId)

  return { ok: true, message: 'Enrichissement terminé', created }
}

// ============================================================
// 1. Matières
// ============================================================

async function createSubjects(schoolId: string): Promise<number> {
  let count = 0

  for (const [level, subjects] of Object.entries(SUBJECTS_BY_LEVEL)) {
    for (const subj of subjects) {
      const existing = await db.subject.findFirst({ where: { schoolId, code: subj.code } })
      if (!existing) {
        await db.subject.create({
          data: {
            schoolId,
            name: subj.name,
            code: subj.code,
          },
        })
        count++
      }
    }
  }

  return count
}

// ============================================================
// 2. Affectations enseignants → matières → classes
// ============================================================

async function createTeacherAssignments(schoolId: string): Promise<number> {
  const teachers = await db.employee.findMany({
    where: { schoolId, function: 'ENSEIGNANT', globalRole: 'ENSEIGNANT' },
  })

  const subjects = await db.subject.findMany({ where: { schoolId } })
  const directorates = await db.directorate.findMany({ where: { schoolId } })

  const directorateMap: Record<string, string> = {}
  for (const d of directorates) directorateMap[d.name] = d.id

  const classrooms = await db.classroom.findMany({
    where: { directorate: { schoolId } },
    include: { directorate: true },
  })

  let count = 0

  // Pour chaque classe, assigner les matières du niveau correspondant
  for (const classroom of classrooms) {
    const directorateName = classroom.directorate.name
    const levelKey = directorateName === 'Maternelle' ? 'Maternelle'
      : directorateName === 'Primaire' ? 'Primaire'
      : 'Secondaire'

    const subjectsForLevel = subjects.filter((s) =>
      SUBJECTS_BY_LEVEL[levelKey].some((sl) => sl.code === s.code)
    )

    for (const subject of subjectsForLevel) {
      // Assigner un enseignant rotativement
      const teacher = teachers[count % teachers.length]
      if (!teacher) continue

      const existing = await db.teacherAssignment.findFirst({
        where: { employeeId: teacher.id, subjectId: subject.id, classroomId: classroom.id },
      })
      if (!existing) {
        await db.teacherAssignment.create({
          data: {
            employeeId: teacher.id,
            subjectId: subject.id,
            classroomId: classroom.id,
          },
        })
        count++
      }
    }
  }

  return count
}

// ============================================================
// 3. Cours (Course = classe + matière)
// ============================================================

async function createCourses(schoolId: string): Promise<number> {
  const assignments = await db.teacherAssignment.findMany({
    where: { classroom: { directorate: { schoolId } } },
    include: { subject: true, classroom: true, employee: true },
  })

  let count = 0

  for (const assignment of assignments) {
    if (!assignment?.classroomId) continue

    const existing = await db.course.findFirst({
      where: {
        schoolId,
        classroomId: assignment?.classroomId,
        subjectId: assignment.subjectId,
      },
    })

    if (!existing) {
      await db.course.create({
        data: {
          schoolId,
          classroomId: assignment?.classroomId,
          subjectId: assignment.subjectId,
          teacherId: assignment.employeeId,
          title: `${assignment.subject.name} - ${assignment?.classroom.name}`,
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      })
      count++
    }
  }

  return count
}

// ============================================================
// 4. Notes
// ============================================================

async function createGrades(schoolId: string): Promise<number> {
  // Créer des notes pour les classes primaire (4e, 5e, 6e) et secondaire
  const classrooms = await db.classroom.findMany({
    where: {
      directorate: { schoolId },
      name: { in: ['4e Primaire A', '5e Primaire A', '6e Primaire A', '1re Secondaire A', '2e Secondaire A'] },
    },
    include: { directorate: true },
  })

  let count = 0

  for (const classroom of classrooms) {
    const directorateName = classroom.directorate.name
    const levelKey = directorateName === 'Maternelle' ? 'Maternelle'
      : directorateName === 'Primaire' ? 'Primaire'
      : 'Secondaire'

    const subjects = await db.subject.findMany({ where: { schoolId } })
    const subjectsForLevel = subjects.filter((s) =>
      SUBJECTS_BY_LEVEL[levelKey].some((sl) => sl.code === s.code)
    )

    const enrollments = await db.enrollment.findMany({
      where: { classroomId: classroom.id, status: 'ACTIVE' },
      include: { student: true },
    })

    for (const enrollment of enrollments) {
      // Pour chaque matière, créer 2-3 notes
      for (const subject of subjectsForLevel.slice(0, 5)) {
        const existingGrade = await db.grade.findFirst({
          where: { studentId: enrollment.studentId, subjectId: subject.id },
        })
        if (existingGrade) continue

        // 2 notes par matière
        for (let i = 1; i <= 2; i++) {
          const score = Math.round((Math.random() * 40 + 40)) // 40-80 sur 100
          await db.grade.create({
            data: {
              schoolId,
              studentId: enrollment.studentId,
              subjectId: subject.id,
              classroomId: classroom.id,
              title: `Devoir ${i}`,
              score: score / 10,
              maxScore: 10,
              weight: 1,
              status: 'PUBLISHED',
              publishedAt: new Date(),
              scoreCents: score * 10,
              maxScoreCents: 1000,
              weightCents: 100,
            },
          })
          count++
        }
      }
    }
  }

  return count
}

// ============================================================
// 5. Bulletins
// ============================================================

async function createReportCards(schoolId: string): Promise<number> {
  const enrollments = await db.enrollment.findMany({
    where: { student: { schoolId }, status: 'ACTIVE' },
    take: 50,
  })

  let count = 0

  for (const enrollment of enrollments) {
    const existing = await db.reportCard.findFirst({
      where: { studentId: enrollment.studentId },
    })
    if (existing) continue

    await db.reportCard.create({
      data: {
        studentId: enrollment.studentId,
        period: 'T1',
        academicYearId: enrollment.academicYearId,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        average: Math.round((Math.random() * 30 + 50)) / 10, // 50-80%
        rank: Math.floor(Math.random() * 30 + 1),
      },
    })
    count++
  }

  return count
}

// ============================================================
// 6. Admissions (statuts variés)
// ============================================================

async function createAdmissions(schoolId: string): Promise<number> {
  // Récupérer des comptes parent existants ou en créer
  const parentUsers = await db.user.findMany({
    where: { isDemoAccount: false, role: 'PARENT' },
    take: 20,
  })

  const admissionsData = [
    // 4 en attente (SUBMITTED)
    { parentName: 'Kabeya', childName: 'Junior', status: 'SUBMITTED', type: 'NEW_ADMISSION' },
    { parentName: 'Lukusa', childName: 'Sarah', status: 'SUBMITTED', type: 'NEW_ADMISSION' },
    { parentName: 'Mwamba', childName: 'David', status: 'SUBMITTED', type: 'NEW_ADMISSION' },
    { parentName: 'Ilunga', childName: 'Esther', status: 'SUBMITTED', type: 'NEW_ADMISSION' },
    // 4 incomplets
    { parentName: 'Kalonji', childName: 'Marc', status: 'INCOMPLETE', type: 'NEW_ADMISSION' },
    { parentName: 'Mbuyi', childName: 'Lucie', status: 'INCOMPLETE', type: 'NEW_ADMISSION' },
    { parentName: 'Banza', childName: 'Paul', status: 'INCOMPLETE', type: 'NEW_ADMISSION' },
    { parentName: 'Mukeba', childName: 'Anne', status: 'INCOMPLETE', type: 'NEW_ADMISSION' },
    // 2 doublons potentiels
    { parentName: 'Kabongo', childName: 'Jean', status: 'DUPLICATE_SUSPECTED', type: 'NEW_ADMISSION' },
    { parentName: 'Mukendi', childName: 'Marie', status: 'DUPLICATE_SUSPECTED', type: 'NEW_ADMISSION' },
    // 2 transmis au directeur
    { parentName: 'Tshibangu', childName: 'Pierre', status: 'TRANSMITTED', type: 'NEW_ADMISSION' },
    { parentName: 'Kasongo', childName: 'Grace', status: 'TRANSMITTED', type: 'NEW_ADMISSION' },
    // 5 acceptés
    { parentName: 'Mwamba', childName: 'Daniel', status: 'ACCEPTED', type: 'NEW_ADMISSION' },
    { parentName: 'Ilunga', childName: 'Sarah', status: 'ACCEPTED', type: 'NEW_ADMISSION' },
    { parentName: 'Kalonji', childName: 'Joseph', status: 'ACCEPTED', type: 'NEW_ADMISSION' },
    { parentName: 'Mbuyi', childName: 'Ruth', status: 'ACCEPTED', type: 'NEW_ADMISSION' },
    { parentName: 'Banza', childName: 'Moïse', status: 'ACCEPTED', type: 'NEW_ADMISSION' },
    // 2 refusés
    { parentName: 'Madidi', childName: 'Éric', status: 'REFUSED', type: 'NEW_ADMISSION' },
    { parentName: 'Kayembe', childName: 'Patrick', status: 'REFUSED', type: 'NEW_ADMISSION' },
  ]

  let count = 0
  const secretaryUser = await db.user.findUnique({ where: { email: 'secretary@demo.smartshule.com' } })

  for (let i = 0; i < admissionsData.length; i++) {
    const adm = admissionsData[i]
    const ref = `ADM-2026-${String(i + 1).padStart(6, '0')}`

    const existing = await db.admissionApplication.findUnique({ where: { referenceNumber: ref } })
    if (existing) continue

    // Utiliser un parent user existant ou le compte parent démo
    const parentUser = parentUsers[i % parentUsers.length] || secretaryUser
    if (!parentUser) continue

    await db.admissionApplication.create({
      data: {
        schoolId,
        userId: parentUser.id,
        referenceNumber: ref,
        applicationType: adm.type,
        status: adm.status,
        parentFirstName: adm.parentName,
        parentLastName: 'Parent',
        parentEmail: `${adm.parentName.toLowerCase()}${i}@demo.smartshule.com`,
        parentPhone: `+24381${String(1000000 + i).slice(-7)}`,
        parentRelationship: 'PERE',
        emailVerified: adm.status !== 'SUBMITTED' && adm.status !== 'INCOMPLETE',
        phoneVerified: ['ACCEPTED', 'TRANSMITTED'].includes(adm.status),
        submittedAt: adm.status !== 'DRAFT' ? new Date() : null,
        reviewedAt: ['ACCEPTED', 'REFUSED', 'INCOMPLETE', 'TRANSMITTED'].includes(adm.status) ? new Date() : null,
        reviewedById: secretaryUser?.id,
        reviewedByName: secretaryUser?.displayName,
        decisionReason: adm.status === 'REFUSED' ? 'Dossier incomplet - pièces manquantes' : adm.status === 'ACCEPTED' ? 'Dossier conforme - admission acceptée' : null,
      },
    })
    count++
  }

  return count
}

// ============================================================
// 7. Annonces
// ============================================================

async function createAnnouncements(schoolId: string): Promise<number> {
  const directorUser = await db.user.findUnique({ where: { email: 'director@demo.smartshule.com' } })
  const secretaryUser = await db.user.findUnique({ where: { email: 'secretary@demo.smartshule.com' } })
  const classrooms = await db.classroom.findMany({ where: { directorate: { schoolId } } })

  const announcements = [
    { title: 'Réunion de parents - Rentrée 2026', content: 'Nous vous informons qu\'une réunion de parents se tiendra le 15 octobre 2026 à 10h00 dans la salle polyvalente.', targetType: 'ALL', status: 'PUBLISHED', priority: 'NORMAL' },
    { title: 'Ouverture de l\'année scolaire 2026-2027', content: 'L\'année scolaire 2026-2027 débute officiellement le 1er septembre 2026.', targetType: 'ALL', status: 'PUBLISHED', priority: 'NORMAL' },
    { title: 'Journée pédagogique', content: 'Une journée pédagogique est prévue le 20 octobre. Pas de cours ce jour-là.', targetType: 'ALL', status: 'PUBLISHED', priority: 'NORMAL' },
    { title: 'Fermeture exceptionnelle', content: 'L\'école sera fermée le 25 octobre pour cause de force majeure.', targetType: 'ALL', status: 'PUBLISHED', priority: 'URGENT' },
    { title: 'Activité primaire - Sortie éducative', content: 'Une sortie éducative est organisée pour les élèves du primaire.', targetType: 'DIRECTION', status: 'PUBLISHED', priority: 'NORMAL' },
    { title: 'Réunion secondaire - Orientation', content: 'Réunion d\'orientation pour les élèves du secondaire.', targetType: 'DIRECTION', status: 'PUBLISHED', priority: 'NORMAL' },
    { title: 'Réunion pédagogique enseignants', content: 'Réunion pédagogique obligatoire pour tous les enseignants le 10 octobre à 14h.', targetType: 'DIRECTION', status: 'PUBLISHED', priority: 'HIGH' },
    { title: 'Dépôt des notes T1', content: 'Rappel : les notes du premier trimestre doivent être saisies avant le 30 novembre.', targetType: 'DIRECTION', status: 'PUBLISHED', priority: 'HIGH' },
    { title: 'Annonce brouillon 1', content: 'Ceci est un brouillon non encore publié.', targetType: 'ALL', status: 'DRAFT', priority: 'LOW' },
    { title: 'Annonce brouillon 2', content: 'Autre brouillon en attente de validation.', targetType: 'DIRECTION', status: 'DRAFT', priority: 'LOW' },
  ]

  let count = 0
  for (let i = 0; i < announcements.length; i++) {
    const ann = announcements[i]
    const existing = await db.announcement.findFirst({ where: { schoolId, title: ann.title } })
    if (existing) continue

    await db.announcement.create({
      data: {
        schoolId,
        classroomId: i < 5 && classrooms[i % classrooms.length] ? classrooms[i % classrooms.length].id : null,
        title: ann.title,
        content: ann.content,
        targetType: ann.targetType,
        status: ann.status,
        priority: ann.priority,
        publishedAt: ann.status === 'PUBLISHED' ? new Date() : null,
        authorId: (i % 2 === 0 ? directorUser : secretaryUser)?.id,
      },
    })
    count++
  }

  return count
}

// ============================================================
// 8. Messages/Communications
// ============================================================

async function createMessages(schoolId: string): Promise<number> {
  const secretaryUser = await db.user.findUnique({ where: { email: 'secretary@demo.smartshule.com' } })
  if (!secretaryUser) return 0

  const messages = [
    { recipient: 'Marie Lukusa', subject: 'Absence de votre enfant', body: 'Votre enfant était absent aujourd\'hui. Merci de fournir un justificatif.' },
    { recipient: 'Pierre Kabongo', subject: 'Dossier incomplet', body: 'Il manque l\'acte de naissance dans le dossier de votre enfant.' },
    { recipient: 'Anne Mwamba', subject: 'Facture en attente', body: 'Un rappel pour la facture de septembre 2026.' },
    { recipient: 'Jean Kasongo', subject: 'Rendez-vous proposé', body: 'Un rendez-vous est proposé le 10 octobre à 14h.' },
    { recipient: 'Sarah Ilunga', subject: 'Certificat prêt', body: 'Le certificat de scolarité est prêt à être retiré.' },
    { recipient: 'David Kalume', subject: 'Réunion parents', body: 'Rappel : réunion de parents le 15 octobre.' },
  ]

  let count = 0
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    const existing = await db.communication.findFirst({ where: { schoolId, recipientName: msg.recipient, subject: msg.subject } })
    if (existing) continue

    await db.communication.create({
      data: {
        schoolId,
        senderId: secretaryUser.id,
        senderName: secretaryUser.displayName,
        senderRole: 'SECRETARY',
        recipientName: msg.recipient,
        recipientPhone: `+24381${String(2000000 + i).slice(-7)}`,
        channel: 'APP',
        subject: msg.subject,
        body: msg.body,
        status: 'NEW',
        category: 'GENERAL',
        deliveredAt: new Date(),
        deliveryStatus: 'DELIVERED',
      },
    })
    count++
  }

  return count
}

// ============================================================
// 9. Dépenses
// ============================================================

async function createExpenses(schoolId: string): Promise<number> {
  const expenses = [
    { description: 'Achat matériel didactique', amountCents: 150000, status: 'APPROVED', category: 'PÉDAGOGIE' },
    { description: 'Réparation photocopieur', amountCents: 45000, status: 'APPROVED', category: 'MAINTENANCE' },
    { description: 'Facture électricité', amountCents: 120000, status: 'APPROVED', category: 'UTILITAIRES' },
    { description: 'Achat tables', amountCents: 350000, status: 'PENDING', category: 'MOBILIER' },
    { description: 'Transport excursion', amountCents: 80000, status: 'PENDING', category: 'TRANSPORT' },
    { description: 'Peinture salles', amountCents: 250000, status: 'REFUSED', category: 'MAINTENANCE' },
    { description: 'Fournitures bureau', amountCents: 35000, status: 'APPROVED', category: 'FOURNITURES' },
    { description: 'Internet mensuel', amountCents: 55000, status: 'APPROVED', category: 'UTILITAIRES' },
  ]

  let count = 0
  for (let i = 0; i < expenses.length; i++) {
    const exp = expenses[i]
    const expenseNumber = `DEP-2026-${String(i + 1).padStart(6, '0')}`
    const existing = await db.expense.findFirst({ where: { schoolId, description: exp.description } })
    if (existing) continue

    await db.expense.create({
      data: {
        schoolId,
        expenseNumber,
        description: exp.description,
        amountCents: exp.amountCents,
        currency: 'CDF',
        status: exp.status,
        category: exp.category,
        expenseDate: new Date(),
      },
    })
    count++
  }

  return count
}

// ============================================================
// 10. Rendez-vous
// ============================================================

async function createAppointments(schoolId: string): Promise<number> {
  const today = new Date()
  const appointments = [
    { title: 'RDV Mr Kabongo - Inscription', withName: 'Pierre Kabongo', type: 'ENROLLMENT', hourOffset: 1 },
    { title: 'RDV Mme Lukusa - Absence', withName: 'Marie Lukusa', type: 'GENERAL', hourOffset: 2 },
    { title: 'RDV Mr Mwamba - Paiement', withName: 'Jean Mwamba', type: 'FINANCIAL', hourOffset: 3 },
    { title: 'RDV Mme Ilunga - Dossier', withName: 'Sarah Ilunga', type: 'ADMISSION', hourOffset: 4 },
  ]

  let count = 0
  for (const appt of appointments) {
    const existing = await db.appointment.findFirst({ where: { schoolId, title: appt.title } })
    if (existing) continue

    await db.appointment.create({
      data: {
        schoolId,
        title: appt.title,
        date: new Date(today.getTime() + appt.hourOffset * 60 * 60 * 1000),
        durationMinutes: 30,
        withName: appt.withName,
        withPhone: '+243812345678',
        appointmentType: appt.type,
        status: 'SCHEDULED',
      },
    })
    count++
  }

  return count
}

// ============================================================
// 11. Tâches admin
// ============================================================

async function createAdminTasks(schoolId: string): Promise<number> {
  const secretaryUser = await db.user.findUnique({ where: { email: 'secretary@demo.smartshule.com' } })
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const tasks = [
    { title: 'Valider admission ADM-2026-000003', category: 'ADMISSION', priority: 'HIGH', dueDate: yesterday, status: 'IN_PROGRESS' },
    { title: 'Préparer certificats', category: 'DOCUMENT', priority: 'NORMAL', dueDate: lastWeek, status: 'PENDING' },
    { title: 'Relancer parents impayés', category: 'FINANCE', priority: 'HIGH', dueDate: yesterday, status: 'PENDING' },
    { title: 'Mettre à jour liste élèves', category: 'STUDENT', priority: 'NORMAL', dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), status: 'PENDING' },
    { title: 'Organiser réunion parents', category: 'GENERAL', priority: 'NORMAL', dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), status: 'PENDING' },
  ]

  let count = 0
  for (const task of tasks) {
    const existing = await db.adminTask.findFirst({ where: { schoolId, title: task.title } })
    if (existing) continue

    await db.adminTask.create({
      data: {
        schoolId,
        title: task.title,
        description: `Tâche: ${task.title}`,
        category: task.category,
        priority: task.priority,
        status: task.status,
        dueDate: task.dueDate,
        createdById: secretaryUser?.id,
        createdByName: secretaryUser?.displayName,
      },
    })
    count++
  }

  return count
}

// ============================================================
// 12. Absences et retards du JOUR (pour dashboard secretary)
// ============================================================

async function createTodayAttendance(schoolId: string): Promise<void> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const students = await db.student.findMany({
    where: { schoolId, status: 'ACTIVE' },
    take: 20,
  })

  const teacherUser = await db.user.findUnique({ where: { email: 'teacher@demo.smartshule.com' } })

  // Récupérer un cours existant pour lier l'attendance
  const course = await db.course.findFirst({ where: { schoolId } })

  // 8 absences non justifiées
  for (let i = 0; i < 8 && i < students.length; i++) {
    if (!course) break
    const existing = await db.attendance.findFirst({
      where: { schoolId, studentId: students[i].id, date: today },
    })
    if (existing) continue

    await db.attendance.create({
      data: {
        schoolId,
        studentId: students[i].id,
        courseId: course.id,
        date: today,
        status: 'ABSENT',
        recordedById: teacherUser?.id,
      },
    })
  }

  // 6 retards
  for (let i = 8; i < 14 && i < students.length; i++) {
    if (!course) break
    const existing = await db.attendance.findFirst({
      where: { schoolId, studentId: students[i].id, date: today },
    })
    if (existing) continue

    await db.attendance.create({
      data: {
        schoolId,
        studentId: students[i].id,
        courseId: course.id,
        date: today,
        status: 'LATE',
        recordedById: teacherUser?.id,
      },
    })
  }
}

// ============================================================
// 13. Transferts entrants/sortants
// ============================================================

async function createTransfers(schoolId: string): Promise<void> {
  const students = await db.student.findMany({
    where: { schoolId, status: 'ACTIVE' },
    take: 4,
  })

  const transfers = [
    { type: 'INCOMING', origin: 'École Saint-Joseph', studentIdx: 0, status: 'PENDING' },
    { type: 'INCOMING', origin: 'Complexe Scolaire Béréa', studentIdx: 1, status: 'PENDING' },
    { type: 'OUTGOING', destination: 'Lycée Mwanga', studentIdx: 2, status: 'PENDING' },
    { type: 'OUTGOING', destination: 'Institut Maaji', studentIdx: 3, status: 'PENDING' },
  ]

  for (let i = 0; i < transfers.length; i++) {
    const t = transfers[i]
    const student = students[t.studentIdx]
    if (!student) continue

    const existing = await db.transfer.findFirst({
      where: { schoolId, studentId: student.id, transferType: t.type },
    })
    if (existing) continue

    await db.transfer.create({
      data: {
        schoolId,
        studentId: student.id,
        transferType: t.type,
        originSchool: t.origin || null,
        destinationSchool: t.destination || null,
        reason: t.type === 'INCOMING' ? 'Transfert entrant - déménagement familial' : 'Transfert sortant - déménagement familial',
        effectiveDate: new Date(),
        status: t.status,
      },
    })
  }
}

// ============================================================
// 14. Demandes parents (parentsToContact)
// ============================================================

async function createParentRequests(schoolId: string): Promise<void> {
  const guardians = await db.guardian.findMany({ where: { schoolId }, take: 10 })
  const students = await db.student.findMany({ where: { schoolId, status: 'ACTIVE' }, take: 10 })

  const categories = ['INSCRIPTION', 'FRAIS', 'ABSENCE', 'DOCUMENT', 'TRANSPORT', 'DISCIPLINE']
  const priorities = ['NORMAL', 'HIGH', 'URGENT']

  for (let i = 0; i < 10; i++) {
    const guardian = guardians[i % guardians.length]
    const student = students[i % students.length]
    if (!guardian || !student) continue

    const reqNum = `REQ-2026-${String(i + 1).padStart(6, '0')}`
    const existing = await db.parentRequest.findUnique({ where: { requestNumber: reqNum } })
    if (existing) continue

    await db.parentRequest.create({
      data: {
        schoolId,
        requestNumber: reqNum,
        guardianId: guardian.id,
        studentId: student.id,
        category: categories[i % categories.length],
        priority: priorities[i % priorities.length],
        subject: `Demande ${categories[i % categories.length].toLowerCase()} - ${student.firstName}`,
        status: 'NEW',
      },
    })
  }
}

// ============================================================
// 15. Certificats en attente de validation (documentsToProduce)
// ============================================================

async function createCertificatesPending(schoolId: string): Promise<void> {
  const students = await db.student.findMany({ where: { schoolId, status: 'ACTIVE' }, take: 7 })
  const secretaryUser = await db.user.findUnique({ where: { email: 'secretary@demo.smartshule.com' } })

  const certTypes = [
    { type: 'SCHOOL_CERTIFICATE', title: 'Certificat de scolarité' },
    { type: 'ENROLLMENT_ATTESTATION', title: 'Attestation d\'inscription' },
    { type: 'STUDENT_CARD', title: 'Carte élève' },
    { type: 'TRANSFER_ATTESTATION', title: 'Attestation de transfert' },
    { type: 'PARENT_CONVOCATION', title: 'Convocation parent' },
    { type: 'SCHOOL_CERTIFICATE', title: 'Certificat de scolarité (duplicate)' },
    { type: 'ATTENDANCE_ATTESTATION', title: 'Attestation de fréquentation' },
  ]

  for (let i = 0; i < certTypes.length && i < students.length; i++) {
    const student = students[i]
    const cert = certTypes[i]

    const year = new Date().getFullYear()
    const referenceNumber = `CERT-${year}-${String(i + 100).padStart(6, '0')}`

    const existing = await db.certificate.findUnique({ where: { referenceNumber } })
    if (existing) continue

    await db.certificate.create({
      data: {
        schoolId,
        studentId: student.id,
        certificateType: cert.type,
        referenceNumber,
        title: cert.title,
        generatedById: secretaryUser?.id,
        generatedByName: secretaryUser?.displayName,
        requiresValidation: true,
      },
    })
  }
}

// ============================================================
// 16. Réceptions/Rendez-vous du jour (appointmentsToday)
// ============================================================

async function createReceptions(schoolId: string): Promise<void> {
  const today = new Date()
  today.setHours(10, 0, 0, 0)

  const receptions = [
    { visitorName: 'Pierre Kabongo', purpose: 'Inscription enfant', visitedName: 'Secrétariat', hour: 9 },
    { visitorName: 'Marie Lukusa', purpose: 'Justificatif absence', visitedName: 'Direction', hour: 10 },
    { visitorName: 'Jean Mwamba', purpose: 'Paiement facture', visitedName: 'Comptabilité', hour: 11 },
    { visitorName: 'Sarah Ilunga', purpose: 'Retrait certificat', visitedName: 'Secrétariat', hour: 14 },
  ]

  for (let i = 0; i < receptions.length; i++) {
    const r = receptions[i]
    const scheduledDate = new Date(today)
    scheduledDate.setHours(r.hour, 0, 0, 0)

    const existing = await db.reception.findFirst({
      where: { schoolId, visitorName: r.visitorName, scheduledDate },
    })
    if (existing) continue

    await db.reception.create({
      data: {
        schoolId,
        visitorName: r.visitorName,
        visitorPhone: `+24381${String(3000000 + i).slice(-7)}`,
        purpose: r.purpose,
        targetPersonName: r.visitedName,
        scheduledDate,
        status: 'SCHEDULED',
      },
    })
  }
}
