// SmartShule — Seed Démo Runner (importable par API + CLI)
// ============================================================
// Contient toute la logique de seed démo.
// Utilisable par :
//   - scripts/seed-demo.ts (CLI)
//   - src/app/api/seed-demo/route.ts (API Vercel)

import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { seedDefaultTemplates } from '@/lib/notifications'
import crypto from 'crypto'

export interface SeedDemoOptions {
  reset?: boolean
  force?: boolean
  allowProduction?: boolean // Vercel = production mais on veut seed démo
}

export interface SeedDemoResult {
  ok: boolean
  message: string
  schoolName?: string
  counts: {
    students: number
    guardians: number
    employees: number
    invoices: number
    receipts: number
    demoAccounts: number
    classes: number
    notifications: number
    auditLogs: number
  }
  demoAccounts: Array<{ role: string; email: string }>
  defaultPassword: string
}

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo2026!'
const DEMO_SCHOOL_EMAIL_DOMAIN = 'demo.smartshule.com'

// ============================================================
// Utilitaires
// ============================================================

function randomChoice<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function randomInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min }
function randomDate(start: Date, end: Date): Date { return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())) }
function generateMatricule(index: number): string { return `SS-2026-${String(index + 1).padStart(5, '0')}` }
function generatePhone(): string {
  const prefixes = ['+24381', '+24382', '+24385', '+24389', '+24384', '+24399']
  return `${randomChoice(prefixes)}${randomInt(1000000, 9999999)}`
}

const FIRST_NAMES_M = ['Jean', 'Pierre', 'Paul', 'Marc', 'Luc', 'David', 'Joseph', 'Moïse', 'Daniel', 'Samuel', 'Éric', 'Patrick', 'Olivier', 'Christian', 'Bernard', 'André', 'François', 'Michel', 'Jacques', 'Thomas']
const FIRST_NAMES_F = ['Marie', 'Anne', 'Jeanne', 'Lucie', 'Sarah', 'Esther', 'Ruth', 'Grace', 'Julie', 'Sylvie', 'Nathalie', 'Christine', 'Brigitte', 'Monique', 'Claudine', 'Béatrice', 'Caroline', 'Danielle', 'Émilie', 'Florence']
const LAST_NAMES = ['Kabongo', 'Mukendi', 'Tshibangu', 'Kasongo', 'Mwamba', 'Ilunga', 'Kalonji', 'Mbuyi', 'Banza', 'Mukeba', 'Lukusa', 'Kabwasa', 'Tshisekedi', 'Mobutu', 'Lumumba', 'Kabila', 'Bemba', 'Katumbi', 'Fayulu', 'Madidi', 'Kayembe']
const BIRTH_PLACES = ['Lubumbashi', 'Kinshasa', 'Kolwezi', 'Likasi', 'Kipushi', 'Bukavu', 'Goma', 'Matadi', 'Mbuji-Mayi', 'Kananga']

const DEMO_ACCOUNTS = [
  { email: `sysadmin@${DEMO_SCHOOL_EMAIL_DOMAIN}`, displayName: 'Super Admin Démo', role: 'SYSTEM_ADMIN' },
  { email: `schooladmin@${DEMO_SCHOOL_EMAIL_DOMAIN}`, displayName: 'Admin École Démo', role: 'SCHOOL_ADMIN' },
  { email: `director@${DEMO_SCHOOL_EMAIL_DOMAIN}`, displayName: 'Directeur Démo', role: 'DIRECTOR' },
  { email: `promoter@${DEMO_SCHOOL_EMAIL_DOMAIN}`, displayName: 'Promoteur Démo', role: 'PROMOTER' },
  { email: `secretary@${DEMO_SCHOOL_EMAIL_DOMAIN}`, displayName: 'Secrétaire Démo', role: 'SECRETARY' },
  { email: `admissions@${DEMO_SCHOOL_EMAIL_DOMAIN}`, displayName: 'Agent Admission Démo', role: 'ADMISSIONS_OFFICER' },
  { email: `accountant@${DEMO_SCHOOL_EMAIL_DOMAIN}`, displayName: 'Comptable Démo', role: 'ACCOUNTANT' },
  { email: `cashier@${DEMO_SCHOOL_EMAIL_DOMAIN}`, displayName: 'Caissier Démo', role: 'CASHIER' },
  { email: `hrmanager@${DEMO_SCHOOL_EMAIL_DOMAIN}`, displayName: 'RH Démo', role: 'HR_MANAGER' },
  { email: `payroll@${DEMO_SCHOOL_EMAIL_DOMAIN}`, displayName: 'Paie Démo', role: 'PAYROLL_OFFICER' },
  { email: `teacher@${DEMO_SCHOOL_EMAIL_DOMAIN}`, displayName: 'Enseignant Démo', role: 'TEACHER' },
  { email: `parent@${DEMO_SCHOOL_EMAIL_DOMAIN}`, displayName: 'Parent Démo', role: 'PARENT' },
  { email: `student@${DEMO_SCHOOL_EMAIL_DOMAIN}`, displayName: 'Élève Démo', role: 'STUDENT' },
  { email: `auditor@${DEMO_SCHOOL_EMAIL_DOMAIN}`, displayName: 'Auditeur Démo', role: 'AUDITOR' },
]

const DIRECTORATES = [
  { name: 'Maternelle', code: 'MAT' },
  { name: 'Primaire', code: 'PRI' },
  { name: 'Secondaire', code: 'SEC' },
]

const CLASSES = [
  { name: 'Petite Section A', directorate: 'Maternelle', capacity: 15 },
  { name: 'Grande Section A', directorate: 'Maternelle', capacity: 15 },
  { name: '1re Primaire A', directorate: 'Primaire', capacity: 30 },
  { name: '2e Primaire A', directorate: 'Primaire', capacity: 30 },
  { name: '3e Primaire A', directorate: 'Primaire', capacity: 30 },
  { name: '4e Primaire A', directorate: 'Primaire', capacity: 30 },
  { name: '5e Primaire A', directorate: 'Primaire', capacity: 30 },
  { name: '6e Primaire A', directorate: 'Primaire', capacity: 30 },
  { name: '1re Secondaire A', directorate: 'Secondaire', capacity: 35 },
  { name: '2e Secondaire A', directorate: 'Secondaire', capacity: 35 },
]

// ============================================================
// Fonction principale exportable
// ============================================================

export async function runSeedDemo(options: SeedDemoOptions = {}): Promise<SeedDemoResult> {
  const { reset = false, force = false, allowProduction = false } = options

  // Vérification environnement (sauf si allowProduction explicit)
  if (process.env.NODE_ENV === 'production' && !allowProduction) {
    throw new Error('Seed démo refusé en production sans allowProduction=true')
  }

  // Reset si demandé
  if (reset || force) {
    await resetDemoData()
  }

  // Étape 1 : École
  const school = await createDemoSchool()
  // Étape 2 : Année scolaire
  const year = await createAcademicYear(school.id)
  // Étape 3 : Classes
  const { classMap } = await createClasses(school.id, year.id)
  // Étape 4 : Comptes démo
  const accounts = await createDemoAccounts(school.id)
  // Étape 5 : Employés
  await createEmployees(school.id, accounts)
  // Étape 6 : Parents
  const parents = await createParents(school.id)
  // Étape 7 : Élèves
  const students = await createStudents(school.id, year.id, classMap, parents)
  // Étape 8 : Données financières
  await createFinancialData(school.id, year.id, students, accounts)
  // Étape 9 : Présences
  await createAttendance(school.id, students, accounts)
  // Étape 10 : Notifications
  await createDemoNotifications(school.id, accounts)
  // Étape 11 : Audit logs
  await createAuditLogs(school.id, accounts)
  // Étape 12 : Liaison comptes
  await linkDemoAccountsToData(school.id, accounts)

  // Compter les résultats
  const [studentCount, guardianCount, employeeCount, invoiceCount, receiptCount, demoCount, classCount, notifCount, auditCount] = await Promise.all([
    db.student.count({ where: { schoolId: school.id } }),
    db.guardian.count({ where: { schoolId: school.id } }),
    db.employee.count({ where: { schoolId: school.id } }),
    db.invoice.count({ where: { schoolId: school.id } }),
    db.receipt.count({ where: { schoolId: school.id } }),
    db.user.count({ where: { isDemoAccount: true } }),
    db.classroom.count(),
    db.notificationLog.count({ where: { schoolId: school.id } }),
    db.auditLog.count({ where: { schoolId: school.id } }),
  ])

  return {
    ok: true,
    message: 'Seed démo terminé avec succès',
    schoolName: school.name,
    counts: {
      students: studentCount,
      guardians: guardianCount,
      employees: employeeCount,
      invoices: invoiceCount,
      receipts: receiptCount,
      demoAccounts: demoCount,
      classes: classCount,
      notifications: notifCount,
      auditLogs: auditCount,
    },
    demoAccounts: DEMO_ACCOUNTS.map((a) => ({ role: a.role, email: a.email })),
    defaultPassword: DEMO_PASSWORD,
  }
}

// ============================================================
// Reset
// ============================================================

async function resetDemoData() {
  const demoSchool = await db.school.findFirst({ where: { email: `contact@${DEMO_SCHOOL_EMAIL_DOMAIN}` } })
  if (!demoSchool) return

  const schoolId = demoSchool.id

  // Supprimer dans l'ordre strict des dépendances (sans catch pour voir les erreurs)
  // D'abord les enfants qui référencent d'autres tables
  await db.auditLog.deleteMany({ where: { schoolId } })
  await db.notificationLog.deleteMany({ where: { schoolId } })
  await db.notificationConsent.deleteMany({ where: { schoolId } })
  await db.notificationTemplate.deleteMany({ where: { schoolId } })
  await db.notificationProviderConfig.deleteMany({ where: { schoolId } })

  // Attendance (lien vers Course)
  await db.attendance.deleteMany({ where: { schoolId } })

  // Receipts (lien vers Student + Employee)
  await db.receipt.deleteMany({ where: { schoolId } })

  // InvoiceLines (lien vers Invoice)
  await db.invoiceLine.deleteMany({ where: { invoice: { schoolId } } })

  // Invoices (lien vers Student)
  await db.invoice.deleteMany({ where: { schoolId } })

  // GuardianStudentLink (lien vers Guardian + Student) — supprimer EN PREMIER
  await db.guardianStudentLink.deleteMany({
    where: { OR: [{ guardian: { schoolId } }, { student: { schoolId } }] },
  })

  // Enrollments (lien vers Student + Classroom)
  await db.enrollment.deleteMany({ where: { student: { schoolId } } })

  // Tables académiques liées à Student
  await db.grade.deleteMany({ where: { student: { schoolId } } })
  await db.reportCard.deleteMany({ where: { student: { schoolId } } })
  await db.submission.deleteMany({ where: { student: { schoolId } } }).catch(() => {})
  await db.parentRequest.deleteMany({ where: { student: { schoolId } } }).catch(() => {})
  await db.studentDocument.deleteMany({ where: { schoolId } }).catch(() => {})
  await db.certificate.deleteMany({ where: { schoolId } }).catch(() => {})
  await db.transfer.deleteMany({ where: { schoolId } }).catch(() => {})
  await db.absenceJustification.deleteMany({ where: { schoolId } }).catch(() => {})
  await db.studentFinancialStatus.deleteMany({ where: { schoolId } }).catch(() => {})
  await db.studentAttendanceCall.deleteMany({}).catch(() => {})
  await db.iqaSnapshot.deleteMany({}).catch(() => {})
  await db.canteenReservation.deleteMany({ where: { student: { schoolId } } }).catch(() => {})
  await db.periscolarEnrollment.deleteMany({ where: { student: { schoolId } } }).catch(() => {})
  await db.encashment.deleteMany({ where: { schoolId } }).catch(() => {})

  // Students
  await db.student.deleteMany({ where: { schoolId } })

  // Guardians
  await db.guardian.deleteMany({ where: { schoolId } })

  // Employees — supprimer d'abord les tables qui référencent Employee
  await db.teacherAssignment.deleteMany({}).catch(() => {})
  await db.course.deleteMany({ where: { schoolId } }).catch(() => {})
  await db.employeeSchedule.deleteMany({}).catch(() => {})
  await db.employeeAttendance.deleteMany({}).catch(() => {})
  await db.teacherAgenda.deleteMany({}).catch(() => {})
  await db.teacherEmargement.deleteMany({}).catch(() => {})
  await db.lessonLog.deleteMany({}).catch(() => {})
  await db.classIncident.deleteMany({}).catch(() => {})
  await db.employee.deleteMany({ where: { schoolId } })

  // Expenses
  await db.expense.deleteMany({ where: { schoolId } })

  // Classrooms + Directorates
  await db.classroom.deleteMany({ where: { directorate: { schoolId } } })
  await db.directorate.deleteMany({ where: { schoolId } })

  // AcademicYear
  await db.academicYear.deleteMany({ where: { schoolId } })

  // Fee definitions
  await db.feeDefinition.deleteMany({ where: { schoolId } })
  await db.invoiceLineConfig.deleteMany({ where: { schoolId } })

  // Branding
  await db.branding.deleteMany({ where: { schoolId } })

  // Demo accounts (isDemoAccount = true) — supprimer les sessions d'abord
  // Puis les auditLogs liés (déjà supprimés ci-dessus)
  // Les users démo peuvent avoir des sessions — on delete cascade via Session.userId
  // Mais Session n'a pas de schoolId, donc on doit supprimer par userId
  const demoUsers = await db.user.findMany({ where: { isDemoAccount: true }, select: { id: true } })
  for (const u of demoUsers) {
    await db.session.deleteMany({ where: { userId: u.id } }).catch(() => {})
  }
  await db.user.deleteMany({ where: { isDemoAccount: true } }).catch(() => {})
}

// ============================================================
// Étapes
// ============================================================

async function createDemoSchool() {
  const existing = await db.school.findFirst({ where: { email: `contact@${DEMO_SCHOOL_EMAIL_DOMAIN}` } })
  if (existing) return existing

  const school = await db.school.create({
    data: {
      name: 'Complexe Scolaire Horizon Démo',
      slogan: 'Excellence · Discipline · Travail — ENVIRONNEMENT DE DÉMONSTRATION',
      primaryColor: '#1e40af',
      secondaryColor: '#0e7490',
      tertiaryColor: '#475569',
      address: 'Avenue de l\'Éducation N° 100, Lubumbashi, Haut-Katanga, RDC',
      phone: '+243 81 000 0000',
      email: `contact@${DEMO_SCHOOL_EMAIL_DOMAIN}`,
      currency: 'CDF',
      locale: 'fr-FR',
    },
  })

  await db.branding.create({
    data: {
      schoolId: school.id,
      status: 'PUBLISHED',
      version: 1,
      primaryColor: '#1e40af',
      secondaryColor: '#0e7490',
      tertiaryColor: '#475569',
      schoolName: school.name,
      slogan: school.slogan,
      publishedAt: new Date(),
    },
  })

  return school
}

async function createAcademicYear(schoolId: string) {
  const existing = await db.academicYear.findFirst({ where: { schoolId, label: '2026-2027' } })
  if (existing) return existing

  return db.academicYear.create({
    data: {
      schoolId,
      label: '2026-2027',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2027-07-15'),
      active: true,
    },
  })
}

async function createClasses(schoolId: string, yearId: string) {
  const directorateMap: Record<string, string> = {}
  for (const d of DIRECTORATES) {
    let dir = await db.directorate.findFirst({ where: { schoolId, name: d.name } })
    if (!dir) dir = await db.directorate.create({ data: { schoolId, name: d.name, code: d.code } })
    directorateMap[d.name] = dir.id
  }

  const classMap: Record<string, string> = {}
  for (const c of CLASSES) {
    let classroom = await db.classroom.findFirst({ where: { name: c.name, directorateId: directorateMap[c.directorate] } })
    if (!classroom) {
      classroom = await db.classroom.create({
        data: {
          directorateId: directorateMap[c.directorate],
          academicYearId: yearId,
          name: c.name,
          capacity: c.capacity,
        },
      })
    }
    classMap[c.name] = classroom.id
  }

  return { directorateMap, classMap }
}

async function createDemoAccounts(schoolId: string) {
  const passwordHash = await hashPassword(DEMO_PASSWORD)
  const accounts: Record<string, string> = {}

  for (const acc of DEMO_ACCOUNTS) {
    let user = await db.user.findUnique({ where: { email: acc.email } })
    if (!user) {
      user = await db.user.create({
        data: {
          email: acc.email,
          passwordHash,
          role: acc.role,
          accountStatus: 'ACTIVE',
          displayName: acc.displayName,
          phone: generatePhone(),
          active: true,
          isDemoAccount: true,
        },
      })
    }
    accounts[acc.role] = user.id
  }

  return accounts
}

async function createEmployees(schoolId: string, accounts: Record<string, string>) {
  const employees = [
    { firstName: 'Jean-Pierre', lastName: 'Kabongo', function: 'DIRECTION', globalRole: 'DIRECTION', demoEmail: 'director@demo.smartshule.com' },
    { firstName: 'Marie-Claire', lastName: 'Mukendi', function: 'DIRECTION', globalRole: 'DIRECTION', demoEmail: null },
    { firstName: 'Sarah', lastName: 'Tshibangu', function: 'SECRETAIRE', globalRole: 'ADMINISTRATIF', demoEmail: 'secretary@demo.smartshule.com' },
    { firstName: 'Esther', lastName: 'Kasongo', function: 'SECRETAIRE', globalRole: 'ADMINISTRATIF', demoEmail: null },
    { firstName: 'Grace', lastName: 'Mwamba', function: 'SECRETAIRE', globalRole: 'ADMINISTRATIF', demoEmail: 'admissions@demo.smartshule.com' },
    { firstName: 'Daniel', lastName: 'Ilunga', function: 'COMPTABLE', globalRole: 'ADMINISTRATIF', demoEmail: 'accountant@demo.smartshule.com' },
    { firstName: 'Samuel', lastName: 'Kalonji', function: 'COMPTABLE', globalRole: 'ADMINISTRATIF', demoEmail: 'cashier@demo.smartshule.com' },
    { firstName: 'Anne', lastName: 'Mbuyi', function: 'SECRETAIRE', globalRole: 'ADMINISTRATIF', demoEmail: 'hrmanager@demo.smartshule.com' },
    { firstName: 'Lucie', lastName: 'Banza', function: 'SECRETAIRE', globalRole: 'ADMINISTRATIF', demoEmail: 'payroll@demo.smartshule.com' },
    { firstName: 'Pierre', lastName: 'Mukeba', function: 'ENSEIGNANT', globalRole: 'ENSEIGNANT', demoEmail: 'teacher@demo.smartshule.com' },
    { firstName: 'Paul', lastName: 'Lukusa', function: 'ENSEIGNANT', globalRole: 'ENSEIGNANT', demoEmail: null },
    { firstName: 'Marc', lastName: 'Kabwasa', function: 'ENSEIGNANT', globalRole: 'ENSEIGNANT', demoEmail: null },
    { firstName: 'Luc', lastName: 'Tshisekedi', function: 'ENSEIGNANT', globalRole: 'ENSEIGNANT', demoEmail: null },
    { firstName: 'David', lastName: 'Mobutu', function: 'ENSEIGNANT', globalRole: 'ENSEIGNANT', demoEmail: null },
    { firstName: 'Joseph', lastName: 'Lumumba', function: 'ENSEIGNANT', globalRole: 'ENSEIGNANT', demoEmail: null },
    { firstName: 'Moïse', lastName: 'Kabila', function: 'ENSEIGNANT', globalRole: 'ENSEIGNANT', demoEmail: null },
    { firstName: 'Éric', lastName: 'Bemba', function: 'ENSEIGNANT', globalRole: 'ENSEIGNANT', demoEmail: null },
    { firstName: 'Patrick', lastName: 'Katumbi', function: 'ENSEIGNANT', globalRole: 'ENSEIGNANT', demoEmail: null },
    { firstName: 'Olivier', lastName: 'Fayulu', function: 'ENSEIGNANT', globalRole: 'ENSEIGNANT', demoEmail: null },
    { firstName: 'Christian', lastName: 'Madidi', function: 'ENSEIGNANT', globalRole: 'ENSEIGNANT', demoEmail: null },
    { firstName: 'Bernard', lastName: 'Kayembe', function: 'ENSEIGNANT', globalRole: 'ENSEIGNANT', demoEmail: null },
    { firstName: 'André', lastName: 'Kasongo', function: 'ENSEIGNANT', globalRole: 'OUVRIER', demoEmail: null },
    { firstName: 'François', lastName: 'Mwamba', function: 'ENSEIGNANT', globalRole: 'OUVRIER', demoEmail: null },
    { firstName: 'Michel', lastName: 'Ilunga', function: 'ENSEIGNANT', globalRole: 'OUVRIER', demoEmail: null },
    { firstName: 'Jacques', lastName: 'Kalonji', function: 'ENSEIGNANT', globalRole: 'OUVRIER', demoEmail: null },
    { firstName: 'Thomas', lastName: 'Mbuyi', function: 'ENSEIGNANT', globalRole: 'OUVRIER', demoEmail: null },
    { firstName: 'Philippe', lastName: 'Banza', function: 'ENSEIGNANT', globalRole: 'OUVRIER', demoEmail: null },
  ]

  for (const emp of employees) {
    const existing = await db.employee.findFirst({ where: { schoolId, firstName: emp.firstName, lastName: emp.lastName } })
    if (!existing) {
      await db.employee.create({
        data: {
          schoolId,
          firstName: emp.firstName,
          lastName: emp.lastName,
          email: emp.demoEmail,
          function: emp.function,
          globalRole: emp.globalRole,
          hireDate: randomDate(new Date('2020-01-01'), new Date('2026-08-01')),
          status: 'ACTIVE',
          phone: generatePhone(),
        },
      })
    } else if (emp.demoEmail && existing.email !== emp.demoEmail) {
      await db.employee.update({ where: { id: existing.id }, data: { email: emp.demoEmail } })
    }
  }
}

async function createParents(schoolId: string) {
  const parents = []
  for (let i = 0; i < 85; i++) {
    const isMale = Math.random() > 0.5
    const firstName = isMale ? randomChoice(FIRST_NAMES_M) : randomChoice(FIRST_NAMES_F)
    const lastName = randomChoice(LAST_NAMES)
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@parent.${DEMO_SCHOOL_EMAIL_DOMAIN}`
    const phone = generatePhone()

    let guardian = await db.guardian.findFirst({ where: { schoolId, phone } })
    if (!guardian) {
      guardian = await db.guardian.create({
        data: {
          schoolId,
          firstName,
          lastName,
          phone,
          email,
          profession: randomChoice(['Commerçant', 'Enseignant', 'Médecin', 'Ingénieur', 'Fonctionnaire', 'Chauffeur', 'Ménagère', 'Comptable', 'Juriste', 'Agriculteur']),
        },
      })
    }
    parents.push(guardian)
  }
  return parents
}

async function createStudents(schoolId: string, yearId: string, classMap: Record<string, string>, parents: any[]) {
  const classNames = Object.keys(classMap)
  let studentIndex = 0
  const students: any[] = []

  for (const className of classNames) {
    const classroomId = classMap[className]
    for (let i = 0; i < 10; i++) {
      const isMale = Math.random() > 0.5
      const firstName = isMale ? randomChoice(FIRST_NAMES_M) : randomChoice(FIRST_NAMES_F)
      const lastName = randomChoice(LAST_NAMES)
      const matricule = generateMatricule(studentIndex)
      const birthDate = randomDate(new Date('2010-01-01'), new Date('2021-12-31'))

      let status = 'ACTIVE'
      if (studentIndex >= 95 && studentIndex < 98) status = 'TRANSFERRED'
      if (studentIndex === 98) status = 'ARCHIVED'

      let student = await db.student.findFirst({ where: { schoolId, matricule } })
      if (!student) {
        student = await db.student.create({
          data: {
            schoolId,
            firstName,
            lastName,
            matricule,
            gender: isMale ? 'M' : 'F',
            birthDate,
            status,
          },
        })

        await db.enrollment.create({
          data: {
            studentId: student.id,
            classroomId,
            academicYearId: yearId,
            status: status === 'ACTIVE' ? 'ACTIVE' : status === 'TRANSFERRED' ? 'TRANSFERRED' : 'ARCHIVED',
          },
        })

        const numParents = Math.random() > 0.7 ? 2 : 1
        const shuffled = [...parents].sort(() => Math.random() - 0.5)
        for (let p = 0; p < numParents; p++) {
          const guardian = shuffled[p]
          const relation = p === 0 ? (isMale ? 'PERE' : 'MERE') : randomChoice(['TUTEUR', 'AUTRE'])
          await db.guardianStudentLink.create({
            data: {
              guardianId: guardian.id,
              studentId: student.id,
              relationship: relation,
              isPrimary: p === 0,
            },
          })
        }

        students.push(student)
        studentIndex++
      }
    }
  }

  return students
}

async function createFinancialData(schoolId: string, yearId: string, students: any[], accounts: Record<string, string>) {
  const feeTypes = [
    { name: 'Frais d\'inscription', code: 'INSCR', amountCents: 50000 },
    { name: 'Minerval primaire', code: 'MIN-P', amountCents: 150000 },
    { name: 'Minerval secondaire', code: 'MIN-S', amountCents: 200000 },
    { name: 'Frais d\'examen', code: 'EXAM', amountCents: 30000 },
    { name: 'Carte élève', code: 'CARTE', amountCents: 5000 },
    { name: 'Transport', code: 'TRANS', amountCents: 40000 },
    { name: 'Cantine', code: 'CANTINE', amountCents: 35000 },
    { name: 'Laboratoire', code: 'LABO', amountCents: 20000 },
  ]

  for (const fee of feeTypes) {
    const existing = await db.invoiceLineConfig.findFirst({ where: { schoolId, code: fee.code } })
    if (!existing) {
      await db.invoiceLineConfig.create({
        data: {
          schoolId,
          name: fee.name,
          code: fee.code,
          amountCents: fee.amountCents,
          currency: 'CDF',
          isMandatory: true,
        },
      })
    }
  }

  const cashierEmployee = await db.employee.findFirst({ where: { schoolId, function: 'COMPTABLE' } })
  if (!cashierEmployee) return

  for (let i = 0; i < students.length; i++) {
    const student = students[i]
    if (student.status !== 'ACTIVE') continue

    const invoiceNumber = `INV-2026-${String(i + 1).padStart(5, '0')}`
    const existing = await db.invoice.findFirst({ where: { schoolId, invoiceNumber } })
    if (existing) continue

    let totalCents = 200000
    let paidCents = 0
    let dueDateOffset = 30 // 30 jours dans le futur par défaut

    if (i < 45) paidCents = totalCents
    else if (i < 60) paidCents = Math.floor(totalCents * 0.5)
    else if (i < 70) { paidCents = 0; dueDateOffset = -15 } // Échues il y a 15 jours
    else if (i < 75) { totalCents = Math.floor(totalCents * 0.8); paidCents = totalCents }
    else paidCents = totalCents

    const invoice = await db.invoice.create({
      data: {
        schoolId,
        studentId: student.id,
        academicYearId: yearId,
        invoiceNumber,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + dueDateOffset * 24 * 60 * 60 * 1000),
        totalAmount: totalCents / 100,
        paidAmount: paidCents / 100,
        totalAmountCents: totalCents,
        paidAmountCents: paidCents,
        currency: 'CDF',
        status: paidCents === totalCents ? 'PAID' : paidCents > 0 ? 'PARTIALLY_PAID' : 'UNPAID',
      },
    })

    await db.invoiceLine.create({
      data: {
        invoiceId: invoice.id,
        description: 'Minerval annuelle 2026-2027',
        quantity: 1,
        unitPrice: totalCents / 100,
        total: totalCents / 100,
        quantityCents: 100,
        unitPriceCents: totalCents,
        totalAmountCents: totalCents,
      },
    })

    if (paidCents > 0) {
      const receiptNumber = `REC-2026-${String(i + 1).padStart(6, '0')}`
      const qrCodeData = JSON.stringify({ ref: receiptNumber, student: student.matricule, amount: paidCents })
      const signature = crypto.createHmac('sha256', process.env.SESSION_SECRET || 'demo-secret').update(qrCodeData).digest('hex')

      try {
        await db.receipt.create({
          data: {
            schoolId,
            studentId: student.id,
            receiptNumber,
            amountCents: paidCents,
            currency: 'CDF',
            paymentMethod: i < 30 ? 'CASH' : i < 50 ? 'MOBILE_MONEY' : 'BANK',
            paymentProvider: i < 50 && i >= 30 ? randomChoice(['MPESA', 'ORANGE', 'AIRTEL']) : null,
            payerName: `${student.firstName} ${student.lastName}`,
            qrCodeData,
            signature,
            accountantId: cashierEmployee.id,
            accountantUserId: accounts['CASHIER'],
            issuedAt: new Date(),
          },
        })
      } catch {}
    }
  }
}

async function createAttendance(schoolId: string, students: any[], accounts: Record<string, string>) {
  const teacherId = accounts['TEACHER']
  const today = new Date()
  const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000)

  for (const student of students) {
    if (student.status !== 'ACTIVE') continue
    const isAbsence = student.matricule >= 'SS-2026-00076' && student.matricule <= 'SS-2026-00080'
    const isLate = student.matricule >= 'SS-2026-00081' && student.matricule <= 'SS-2026-00084'

    for (let day = 0; day < 10; day++) {
      const date = new Date(twoWeeksAgo.getTime() + day * 24 * 60 * 60 * 1000)
      if (date.getDay() === 0 || date.getDay() === 6) continue

      let status = 'PRESENT'
      if (isAbsence && Math.random() > 0.4) status = 'ABSENT'
      else if (isLate && Math.random() > 0.5) status = 'LATE'
      else if (Math.random() > 0.95) status = 'ABSENT'
      else if (Math.random() > 0.97) status = 'LATE'

      await db.attendance.create({
        data: { schoolId, studentId: student.id, date, status, recordedById: teacherId },
      }).catch(() => {})
    }
  }
}

async function createDemoNotifications(schoolId: string, accounts: Record<string, string>) {
  await seedDefaultTemplates(schoolId, accounts['SCHOOL_ADMIN'] || accounts['SYSTEM_ADMIN'], 'Admin École Démo')

  const existingConfig = await db.notificationProviderConfig.findFirst({ where: { schoolId } })
  if (!existingConfig) {
    await db.notificationProviderConfig.create({
      data: {
        schoolId,
        providerName: 'TWILIO',
        sandboxMode: true,
        sandboxWhitelist: JSON.stringify([]),
        rateLimitPerMin: 10,
        rateLimitPerDay: 500,
        isActive: true,
        createdById: accounts['SCHOOL_ADMIN'],
        createdByName: 'Admin École Démo',
      },
    })
  }

  const logCount = await db.notificationLog.count({ where: { schoolId } })
  if (logCount === 0) {
    const templates = ['ADMISSION_SUBMITTED', 'DOSSIER_INCOMPLET', 'ADMISSION_ACCEPTED', 'ABSENCE_ALERT', 'PAYMENT_CONFIRMED']
    for (let i = 0; i < 10; i++) {
      const tplCode = randomChoice(templates)
      const tpl = await db.notificationTemplate.findFirst({ where: { schoolId, code: tplCode } })
      if (tpl) {
        await db.notificationLog.create({
          data: {
            schoolId,
            templateId: tpl.id,
            templateCode: tplCode,
            templateVersion: 1,
            senderId: accounts['SECRETARY'],
            senderName: 'Secrétaire Démo',
            senderRole: 'SECRETARY',
            recipientName: `Parent Démo ${i + 1}`,
            recipientPhone: generatePhone(),
            channel: randomChoice(['SMS', 'WHATSAPP', 'APP']),
            priority: 'NORMAL',
            renderedBody: `[DÉMO] Notification ${tplCode} — contenu fictif`,
            status: randomChoice(['SENT', 'DELIVERED', 'PENDING']),
            isSandbox: true,
            providerName: 'SANDBOX',
            consentChecked: true,
          },
        })
      }
    }
  }
}

async function createAuditLogs(schoolId: string, accounts: Record<string, string>) {
  const auditActions = [
    { action: 'LOGIN', entityType: 'SESSION', desc: 'Connexion démo' },
    { action: 'CREATE', entityType: 'STUDENT', desc: 'Création élève démo' },
    { action: 'UPDATE', entityType: 'STUDENT', desc: 'Modification élève démo' },
    { action: 'CREATE', entityType: 'INVOICE', desc: 'Création facture démo' },
    { action: 'PAYMENT_CONFIRMED', entityType: 'PAYMENT', desc: 'Paiement confirmé démo' },
    { action: 'EXPORT', entityType: 'EXPORT', desc: 'Export XLSX démo' },
  ]

  const roles = Object.keys(accounts)
  for (let i = 0; i < 50; i++) {
    const audit = randomChoice(auditActions)
    const role = randomChoice(roles)
    await db.auditLog.create({
      data: {
        schoolId,
        userId: accounts[role],
        userName: `${role} Démo`,
        userRole: role,
        action: audit.action,
        entityType: audit.entityType,
        description: audit.desc,
        ipAddress: `192.168.1.${randomInt(1, 254)}`,
        metadata: JSON.stringify({ demo: true }),
      },
    })
  }
}

async function linkDemoAccountsToData(schoolId: string, accounts: Record<string, string>) {
  // Lier PARENT démo à un Guardian
  // userId est @unique sur Guardian → on doit d'abord délier l'ancien guardian lié
  const parentUserId = accounts['PARENT']
  if (parentUserId) {
    // 1. Retirer userId de l'ancien guardian lié à ce compte parent
    await db.guardian.updateMany({
      where: { userId: parentUserId },
      data: { userId: null },
    })
    // 2. Trouver un guardian sans userId
    const guardian = await db.guardian.findFirst({
      where: { schoolId, userId: null },
    })
    if (guardian) {
      await db.guardian.update({
        where: { id: guardian.id },
        data: { userId: parentUserId, email: 'parent@demo.smartshule.com' },
      })
    }
  }

  // Lier STUDENT démo à un Student actif (userId est @unique sur Student aussi)
  const studentUserId = accounts['STUDENT']
  if (studentUserId) {
    // 1. Retirer userId de l'ancien student lié
    await db.student.updateMany({
      where: { userId: studentUserId },
      data: { userId: null },
    })
    // 2. Trouver un student sans userId
    const student = await db.student.findFirst({
      where: { schoolId, status: 'ACTIVE', userId: null },
    })
    if (student) {
      await db.student.update({
        where: { id: student.id },
        data: { userId: studentUserId },
      })
    }
  }

  for (const role of ['SCHOOL_ADMIN', 'SYSTEM_ADMIN', 'PROMOTER', 'AUDITOR']) {
    const userId = accounts[role]
    if (!userId) continue
    const existingAudit = await db.auditLog.findFirst({ where: { userId, schoolId } })
    if (!existingAudit) {
      await db.auditLog.create({
        data: {
          schoolId,
          userId,
          userName: `${role} Démo`,
          userRole: role,
          action: 'LOGIN',
          entityType: 'SESSION',
          description: 'Connexion démo initiale',
          metadata: JSON.stringify({ demo: true }),
        },
      })
    }
  }
}
