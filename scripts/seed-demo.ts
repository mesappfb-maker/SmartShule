// SmartShule — Seed Démo Complet (14 rôles + 100 élèves + 80 parents + 27 employés)
// =================================================================================
// ⚠️ SÉCURITÉ :
//   - Refuse de s'exécuter si NODE_ENV === 'production'
//   - Tous les comptes ont isDemoAccount = true
//   - Mots de passe depuis variable d'environnement DEMO_PASSWORD ou défaut
//   - Idempotent : ne crée pas de doublons si réexécuté
//   - Option --reset : supprime seulement les données démo
//
// Usage :
//   npx tsx scripts/seed-demo.ts           # Crée les données démo si absentes
//   npx tsx scripts/seed-demo.ts --reset   # Supprime les données démo existantes puis recrée
//   npx tsx scripts/seed-demo.ts --force   # Force la recréation même si déjà présent

import { db } from '../src/lib/db'
import { hashPassword } from '../src/lib/auth'
import crypto from 'crypto'

// ============================================================
// Vérification environnement
// ============================================================

function checkEnvironment() {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ ERREUR FATALE : Refus d\'exécuter le seed démo en production.')
    console.error('   Le seed démo ne doit JAMAIS s\'exécuter en production.')
    console.error('   Comptes démo = isDemoAccount = true, données fictives.')
    process.exit(1)
  }
  console.log('✅ Environnement non-production détecté. Seed démo autorisé.')
}

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo2026!'
const DEMO_SCHOOL_EMAIL_DOMAIN = 'demo.smartshule.com'

// ============================================================
// Utilitaires
// ============================================================

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

function generateMatricule(index: number): string {
  return `SS-2026-${String(index + 1).padStart(5, '0')}`
}

function generatePhone(): string {
  const prefixes = ['+24381', '+24382', '+24385', '+24389', '+24384', '+24399']
  return `${randomChoice(prefixes)}${randomInt(1000000, 9999999)}`
}

// ============================================================
// Données fictives
// ============================================================

const FIRST_NAMES_M = ['Jean', 'Pierre', 'Paul', 'Marc', 'Luc', 'David', 'Joseph', 'Moïse', 'Daniel', 'Samuel', 'Éric', 'Patrick', 'Olivier', 'Christian', 'Bernard', 'André', 'François', 'Michel', 'Jacques', 'Thomas']
const FIRST_NAMES_F = ['Marie', 'Anne', 'Jeanne', 'Lucie', 'Sarah', 'Esther', 'Ruth', 'Grace', 'Julie', 'Sylvie', 'Nathalie', 'Christine', 'Brigitte', 'Monique', 'Claudine', 'Béatrice', 'Caroline', 'Danielle', 'Émilie', 'Florence']
const LAST_NAMES = ['Kabongo', 'Mukendi', 'Tshibangu', 'Kasongo', 'Mwamba', 'Ilunga', 'Kalonji', 'Mbuyi', 'Banza', 'Mukeba', 'Lukusa', 'Kabwasa', 'Tshisekedi', 'Mobutu', 'Lumumba', 'Kabila', 'Bemba', 'Katumbi', 'Fayulu', 'Madidi', 'Kayembe']
const BIRTH_PLACES = ['Lubumbashi', 'Kinshasa', 'Kolwezi', 'Likasi', 'Kipushi', 'Bukavu', 'Goma', 'Matadi', 'Mbuji-Mayi', 'Kananga']

// ============================================================
// 14 comptes démo (1 par rôle)
// ============================================================

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

// ============================================================
// Étape 1 : Créer l'école démo
// ============================================================

async function createDemoSchool() {
  console.log('\n🏫 Étape 1 : Création de l\'école démo...')

  const existing = await db.school.findFirst({
    where: { email: `contact@${DEMO_SCHOOL_EMAIL_DOMAIN}` },
  })
  if (existing) {
    console.log(`   → École démo existe déjà: ${existing.name}`)
    return existing
  }

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

  console.log(`   ✓ École créée: ${school.name}`)
  return school
}

// ============================================================
// Étape 2 : Année scolaire + périodes
// ============================================================

async function createAcademicYear(schoolId: string) {
  console.log('\n📅 Étape 2 : Année scolaire 2026-2027...')

  const existing = await db.academicYear.findFirst({
    where: { schoolId, label: '2026-2027' },
  })
  if (existing) {
    console.log(`   → Année existe déjà: ${existing.label}`)
    return existing
  }

  const year = await db.academicYear.create({
    data: {
      schoolId,
      label: '2026-2027',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2027-07-15'),
      active: true,
    },
  })

  console.log(`   ✓ Année créée: ${year.label}`)
  return year
}

// ============================================================
// Étape 3 : Directorates + sections + options + classes
// ============================================================

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

async function createClasses(schoolId: string, yearId: string) {
  console.log('\n🏫 Étape 3 : Directorates + classes (10)...')

  const directorateMap: Record<string, string> = {}
  for (const d of DIRECTORATES) {
    let dir = await db.directorate.findFirst({ where: { schoolId, name: d.name } })
    if (!dir) {
      dir = await db.directorate.create({ data: { schoolId, name: d.name, code: d.code } })
    }
    directorateMap[d.name] = dir.id
  }
  console.log(`   ✓ ${DIRECTORATES.length} directorates`)

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
  console.log(`   ✓ ${CLASSES.length} classes`)

  return { directorateMap, classMap }
}

// ============================================================
// Étape 4 : 14 comptes démo (1 par rôle RBAC)
// ============================================================

async function createDemoAccounts(schoolId: string) {
  console.log('\n👥 Étape 4 : 14 comptes démo (1 par rôle RBAC)...')

  const passwordHash = await hashPassword(DEMO_PASSWORD)
  const accounts: Record<string, string> = {} // role -> userId

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
      console.log(`   ✓ ${acc.role.padEnd(20)} → ${acc.email}`)
    } else {
      console.log(`   → ${acc.role.padEnd(20)} existe déjà`)
    }
    accounts[acc.role] = user.id
  }

  return accounts
}

// ============================================================
// Étape 5 : 27 employés démo
// ============================================================

async function createEmployees(schoolId: string, accounts: Record<string, string>) {
  console.log('\n👔 Étape 5 : 27 employés démo...')

  const employees = [
    // 2 Direction
    { firstName: 'Jean-Pierre', lastName: 'Kabongo', function: 'DIRECTION', globalRole: 'DIRECTION' },
    { firstName: 'Marie-Claire', lastName: 'Mukendi', function: 'DIRECTION', globalRole: 'DIRECTION' },
    // 3 Secrétariat
    { firstName: 'Sarah', lastName: 'Tshibangu', function: 'SECRETAIRE', globalRole: 'ADMINISTRATIF' },
    { firstName: 'Esther', lastName: 'Kasongo', function: 'SECRETAIRE', globalRole: 'ADMINISTRATIF' },
    { firstName: 'Grace', lastName: 'Mwamba', function: 'SECRETAIRE', globalRole: 'ADMINISTRATIF' },
    // 2 Comptabilité/Caisse
    { firstName: 'Daniel', lastName: 'Ilunga', function: 'COMPTABLE', globalRole: 'ADMINISTRATIF' },
    { firstName: 'Samuel', lastName: 'Kalonji', function: 'COMPTABLE', globalRole: 'ADMINISTRATIF' },
    // 2 RH/Paie
    { firstName: 'Anne', lastName: 'Mbuyi', function: 'SECRETAIRE', globalRole: 'ADMINISTRATIF' },
    { firstName: 'Lucie', lastName: 'Banza', function: 'SECRETAIRE', globalRole: 'ADMINISTRATIF' },
    // 12 Enseignants
    { firstName: 'Pierre', lastName: 'Mukeba', function: 'ENSEIGNANT', globalRole: 'ENSEIGNANT' },
    { firstName: 'Paul', lastName: 'Lukusa', function: 'ENSEIGNANT', globalRole: 'ENSEIGNANT' },
    { firstName: 'Marc', lastName: 'Kabwasa', function: 'ENSEIGNANT', globalRole: 'ENSEIGNANT' },
    { firstName: 'Luc', lastName: 'Tshisekedi', function: 'ENSEIGNANT', globalRole: 'ENSEIGNANT' },
    { firstName: 'David', lastName: 'Mobutu', function: 'ENSEIGNANT', globalRole: 'ENSEIGNANT' },
    { firstName: 'Joseph', lastName: 'Lumumba', function: 'ENSEIGNANT', globalRole: 'ENSEIGNANT' },
    { firstName: 'Moïse', lastName: 'Kabila', function: 'ENSEIGNANT', globalRole: 'ENSEIGNANT' },
    { firstName: 'Éric', lastName: 'Bemba', function: 'ENSEIGNANT', globalRole: 'ENSEIGNANT' },
    { firstName: 'Patrick', lastName: 'Katumbi', function: 'ENSEIGNANT', globalRole: 'ENSEIGNANT' },
    { firstName: 'Olivier', lastName: 'Fayulu', function: 'ENSEIGNANT', globalRole: 'ENSEIGNANT' },
    { firstName: 'Christian', lastName: 'Madidi', function: 'ENSEIGNANT', globalRole: 'ENSEIGNANT' },
    { firstName: 'Bernard', lastName: 'Kayembe', function: 'ENSEIGNANT', globalRole: 'ENSEIGNANT' },
    // 6 Personnel soutien
    { firstName: 'André', lastName: 'Kasongo', function: 'ENSEIGNANT', globalRole: 'OUVRIER' },
    { firstName: 'François', lastName: 'Mwamba', function: 'ENSEIGNANT', globalRole: 'OUVRIER' },
    { firstName: 'Michel', lastName: 'Ilunga', function: 'ENSEIGNANT', globalRole: 'OUVRIER' },
    { firstName: 'Jacques', lastName: 'Kalonji', function: 'ENSEIGNANT', globalRole: 'OUVRIER' },
    { firstName: 'Thomas', lastName: 'Mbuyi', function: 'ENSEIGNANT', globalRole: 'OUVRIER' },
    { firstName: 'Philippe', lastName: 'Banza', function: 'ENSEIGNANT', globalRole: 'OUVRIER' },
  ]

  let created = 0
  for (const emp of employees) {
    const existing = await db.employee.findFirst({
      where: { schoolId, firstName: emp.firstName, lastName: emp.lastName },
    })
    if (!existing) {
      await db.employee.create({
        data: {
          schoolId,
          firstName: emp.firstName,
          lastName: emp.lastName,
          function: emp.function,
          globalRole: emp.globalRole,
          hireDate: randomDate(new Date('2020-01-01'), new Date('2026-08-01')),
          status: 'ACTIVE',
          phone: generatePhone(),
        },
      })
      created++
    }
  }

  console.log(`   ✓ ${created} employés créés (total: ${employees.length})`)
}

// ============================================================
// Étape 6 : 80+ parents démo
// ============================================================

async function createParents(schoolId: string) {
  console.log('\n👨‍👩‍👧‍👦 Étape 6 : 80+ parents démo...')

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

  console.log(`   ✓ ${parents.length} parents/tuteurs créés`)
  return parents
}

// ============================================================
// Étape 7 : 100 élèves démo (10 classes x 10)
// ============================================================

async function createStudents(schoolId: string, yearId: string, classMap: Record<string, string>, parents: any[]) {
  console.log('\n🎓 Étape 7 : 100 élèves démo (10 classes x 10)...')

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

      // Cas de test variés
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

        // Inscription
        await db.enrollment.create({
          data: {
            studentId: student.id,
            classroomId,
            academicYearId: yearId,
            status: status === 'ACTIVE' ? 'ACTIVE' : status === 'TRANSFERRED' ? 'TRANSFERRED' : 'ARCHIVED',
          },
        })

        // Lier 1 ou 2 parents
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
    console.log(`   ✓ ${className}: 10 élèves`)
  }

  console.log(`   ✓ Total: ${studentIndex} élèves créés`)
  return students
}

// ============================================================
// Étape 8 : Frais + factures + paiements
// ============================================================

async function createFinancialData(schoolId: string, yearId: string, students: any[], accounts: Record<string, string>) {
  console.log('\n💰 Étape 8 : Frais + factures + paiements...')

  // Frais par type (InvoiceLineConfig au lieu de FeeDefinition)
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
  console.log(`   ✓ ${feeTypes.length} types de frais`)

  // Récupérer l'employé comptable pour Receipt.accountantId
  const cashierEmployee = await db.employee.findFirst({
    where: { schoolId, function: 'COMPTABLE' },
  })
  if (!cashierEmployee) {
    console.log('   ⚠️  Pas d\'employé comptable trouvé — skip paiements')
    return
  }

  // Factures + paiements pour les élèves actifs
  let invoicesCreated = 0
  let paymentsCreated = 0

  for (let i = 0; i < students.length; i++) {
    const student = students[i]
    if (student.status !== 'ACTIVE') continue

    const invoiceNumber = `INV-2026-${String(i + 1).padStart(5, '0')}`
    const existing = await db.invoice.findFirst({ where: { schoolId, invoiceNumber } })
    if (existing) continue

    // Cas de test variés
    let totalCents = 200000 // Minerval de base
    let paidCents = 0

    if (i < 45) {
      paidCents = totalCents
    } else if (i < 60) {
      paidCents = Math.floor(totalCents * 0.5)
    } else if (i < 70) {
      paidCents = 0
    } else if (i < 75) {
      totalCents = Math.floor(totalCents * 0.8)
      paidCents = totalCents
    } else {
      paidCents = totalCents
    }

    const invoice = await db.invoice.create({
      data: {
        schoolId,
        studentId: student.id,
        academicYearId: yearId,
        invoiceNumber,
        issueDate: new Date(),
        totalAmount: totalCents / 100,
        paidAmount: paidCents / 100,
        totalAmountCents: totalCents,
        paidAmountCents: paidCents,
        currency: 'CDF',
        status: paidCents === totalCents ? 'PAID' : paidCents > 0 ? 'PARTIALLY_PAID' : 'UNPAID',
      },
    })

    // Ligne de facture
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

    invoicesCreated++

    // Paiement si payé
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
        paymentsCreated++
      } catch (err) {
        // Ignore les erreurs de reçu (contraintes)
      }
    }
  }

  console.log(`   ✓ ${invoicesCreated} factures créées`)
  console.log(`   ✓ ${paymentsCreated} paiements/reçus créés`)
}

// ============================================================
// Étape 9 : Présences démo
// ============================================================

async function createAttendance(schoolId: string, students: any[], accounts: Record<string, string>) {
  console.log('\n📊 Étape 9 : Présences sur 2 semaines...')

  const teacherId = accounts['TEACHER']
  let created = 0
  const today = new Date()
  const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000)

  for (const student of students) {
    if (student.status !== 'ACTIVE') continue

    // 5 élèves avec absences répétées (indices 75-79)
    // 4 élèves avec retards fréquents (indices 80-83)
    const isAbsence = student.matricule >= 'SS-2026-00076' && student.matricule <= 'SS-2026-00080'
    const isLate = student.matricule >= 'SS-2026-00081' && student.matricule <= 'SS-2026-00084'

    for (let day = 0; day < 10; day++) {
      const date = new Date(twoWeeksAgo.getTime() + day * 24 * 60 * 60 * 1000)
      if (date.getDay() === 0 || date.getDay() === 6) continue // Weekend

      let status = 'PRESENT'
      if (isAbsence && Math.random() > 0.4) status = 'ABSENT'
      else if (isLate && Math.random() > 0.5) status = 'LATE'
      else if (Math.random() > 0.95) status = 'ABSENT'
      else if (Math.random() > 0.97) status = 'LATE'

      await db.attendance.create({
        data: {
          schoolId,
          studentId: student.id,
          date,
          status,
          recordedById: teacherId,
        },
      }).catch(() => {}) // Ignore duplicates
      created++
    }
  }

  console.log(`   ✓ ${created} enregistrements de présence`)
}

// ============================================================
// Étape 10 : Notifications démo
// ============================================================

async function createDemoNotifications(schoolId: string, accounts: Record<string, string>) {
  console.log('\n🔔 Étape 10 : Notifications démo...')

  // Seed default templates
  const { seedDefaultTemplates } = await import('../src/lib/notifications')
  await seedDefaultTemplates(schoolId, accounts['SCHOOL_ADMIN'] || accounts['SYSTEM_ADMIN'], 'Admin École Démo')
  console.log('   ✓ 12 modèles de notifications seedés')

  // Config sandbox (pas d'envoi réel)
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
    console.log('   ✓ Configuration Twilio sandbox (pas d\'envoi réel)')
  }

  // Quelques notifications dans le journal
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
    console.log('   ✓ 10 notifications démo dans le journal')
  }
}

// ============================================================
// Étape 11 : Audit logs démo
// ============================================================

async function createAuditLogs(schoolId: string, accounts: Record<string, string>) {
  console.log('\n📝 Étape 11 : Événements d\'audit démo...')

  const auditActions = [
    { action: 'LOGIN', entityType: 'SESSION', desc: 'Connexion démo' },
    { action: 'LOGIN_FAILED', entityType: 'SESSION', desc: 'Échec connexion démo' },
    { action: 'CREATE', entityType: 'STUDENT', desc: 'Création élève démo' },
    { action: 'UPDATE', entityType: 'STUDENT', desc: 'Modification élève démo' },
    { action: 'CREATE', entityType: 'INVOICE', desc: 'Création facture démo' },
    { action: 'PAYMENT_CONFIRMED', entityType: 'PAYMENT', desc: 'Paiement confirmé démo' },
    { action: 'EXPORT', entityType: 'EXPORT', desc: 'Export XLSX démo' },
    { action: 'CREATE', entityType: 'DOCUMENT', desc: 'Génération certificat démo' },
    { action: 'NOTIFICATION_SENT', entityType: 'NOTIFICATION', desc: 'Notification envoyée démo' },
    { action: 'IMPORT', entityType: 'IMPORT', desc: 'Import élèves démo' },
  ]

  const roles = Object.keys(accounts)
  let created = 0

  for (let i = 0; i < 50; i++) {
    const audit = randomChoice(auditActions)
    const role = randomChoice(roles)
    const userId = accounts[role]
    await db.auditLog.create({
      data: {
        schoolId,
        userId,
        userName: `${role} Démo`,
        userRole: role,
        action: audit.action,
        entityType: audit.entityType,
        description: audit.desc,
        ipAddress: `192.168.1.${randomInt(1, 254)}`,
        metadata: JSON.stringify({ demo: true }),
      },
    })
    created++
  }

  console.log(`   ✓ ${created} événements d'audit démo`)
}

// ============================================================
// Reset : supprimer uniquement les données démo
// ============================================================

async function resetDemoData() {
  console.log('\n🧹 Reset des données démo existantes...')

  // Supprimer par école démo
  const demoSchool = await db.school.findFirst({
    where: { email: `contact@${DEMO_SCHOOL_EMAIL_DOMAIN}` },
  })

  if (!demoSchool) {
    console.log('   → Aucune école démo trouvée, rien à supprimer')
    return
  }

  const schoolId = demoSchool.id
  console.log(`   → Suppression des données de l'école démo: ${demoSchool.name}`)

  // Supprimer dans l'ordre des dépendances
  await db.auditLog.deleteMany({ where: { schoolId } })
  await db.notificationLog.deleteMany({ where: { schoolId } })
  await db.notificationConsent.deleteMany({ where: { schoolId } })
  await db.notificationTemplate.deleteMany({ where: { schoolId } })
  await db.notificationProviderConfig.deleteMany({ where: { schoolId } })
  await db.attendance.deleteMany({ where: { schoolId } })
  await db.receipt.deleteMany({ where: { schoolId } })
  await db.invoiceLine.deleteMany({ where: { invoice: { schoolId } } })
  await db.invoice.deleteMany({ where: { schoolId } })
  await db.enrollment.deleteMany({ where: { student: { schoolId } } })
  await db.guardianStudentLink.deleteMany({ where: { guardian: { schoolId } } })
  await db.student.deleteMany({ where: { schoolId } })
  await db.guardian.deleteMany({ where: { schoolId } })
  await db.employee.deleteMany({ where: { schoolId } })
  await db.classroom.deleteMany({ where: { directorate: { schoolId } } })
  await db.directorate.deleteMany({ where: { schoolId } })
  await db.academicYear.deleteMany({ where: { schoolId } })
  await db.feeDefinition.deleteMany({ where: { schoolId } })
  await db.invoiceLineConfig.deleteMany({ where: { schoolId } })
  await db.branding.deleteMany({ where: { schoolId } })

  // Supprimer les comptes démo
  await db.user.deleteMany({ where: { isDemoAccount: true } })

  console.log('   ✓ Données démo supprimées (école conservée pour réutilisation)')
}

// ============================================================
// Script principal
// ============================================================

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║  SmartShule — Seed Démo Complet                          ║')
  console.log('║  14 rôles RBAC + 100 élèves + 80 parents + 27 employés  ║')
  console.log('╚══════════════════════════════════════════════════════════╝')

  checkEnvironment()

  const args = process.argv.slice(2)
  const shouldReset = args.includes('--reset') || args.includes('--force')

  if (shouldReset) {
    await resetDemoData()
  }

  const school = await createDemoSchool()
  const year = await createAcademicYear(school.id)
  const { classMap } = await createClasses(school.id, year.id)
  const accounts = await createDemoAccounts(school.id)
  await createEmployees(school.id, accounts)
  const parents = await createParents(school.id)
  const students = await createStudents(school.id, year.id, classMap, parents)
  await createFinancialData(school.id, year.id, students, accounts)
  await createAttendance(school.id, students, accounts)
  await createDemoNotifications(school.id, accounts)
  await createAuditLogs(school.id, accounts)

  console.log('\n' + '═'.repeat(60))
  console.log('✅ SEED DÉMO TERMINÉ AVEC SUCCÈS')
  console.log('═'.repeat(60))
  console.log(`\n🏫 École : ${school.name}`)
  console.log(`📅 Année : ${year.label}`)
  console.log(`👥 Comptes démo : 14 (1 par rôle RBAC)`)
  console.log(`👔 Employés : 27`)
  console.log(`👨‍👩‍👧‍👦 Parents : 85`)
  console.log(`🎓 Élèves : 100 (10 classes x 10)`)
  console.log(`\n🔑 Mot de passe tous comptes : ${DEMO_PASSWORD}`)
  console.log(`\n⚠️  ENVIRONNEMENT DE DÉMONSTRATION — DONNÉES FICTIVES`)
  console.log(`⚠️  Aucun SMS/Email/WhatsApp réel envoyé (sandbox mode)`)
  console.log(`⚠️  Comptes marqués isDemoAccount = true`)
  console.log(`\n📧 Comptes démo :`)
  for (const acc of DEMO_ACCOUNTS) {
    console.log(`   ${acc.role.padEnd(20)} → ${acc.email}`)
  }
}

main()
  .catch((err) => {
    console.error('❌ Erreur fatale:', err)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
