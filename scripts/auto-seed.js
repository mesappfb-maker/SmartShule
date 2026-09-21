// SmartShule — Auto-seed (JavaScript pur, pas de compilation TS nécessaire)
// ============================================================
// Vérifie si la base est vide et la remplit automatiquement avec les
// données de démo (1 école, 30 élèves, 5 factures, plan comptable, etc.)
// À lancer avant le serveur Next.js dans le Start Command de Render.

const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')
const prisma = new PrismaClient()

async function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex')
    crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, key) => {
      if (err) return reject(err)
      resolve(`pbkdf2$100000$sha512$${salt}$${key.toString('hex')}`)
    })
  })
}

async function main() {
  console.log('🔍 Vérification de la base de données...')

  const schoolCount = await prisma.school.count()
  if (schoolCount > 0) {
    console.log(`✅ La base contient déjà ${schoolCount} école(s). Skip seed.`)
    return
  }

  console.log('🌱 Base vide — démarrage du seed automatique...')

  // 1. École
  const school = await prisma.school.create({
    data: {
      name: 'Institution SmartShule',
      slogan: 'SmartShule — L\'intelligence qui rapproche l\'école et la famille.',
      primaryColor: '#2563EB',
      secondaryColor: '#0F766E',
      tertiaryColor: '#F59E0B',
      address: 'Avenue de l\'Éducation',
      phone: '+243 81 000 0000',
      email: 'contact@smartshule.demo',
      currency: 'CDF',
      locale: 'fr-FR',
    },
  })

  const branding = await prisma.branding.create({
    data: {
      schoolId: school.id,
      status: 'PUBLISHED',
      version: 1,
      primaryColor: '#2563EB',
      secondaryColor: '#0F766E',
      tertiaryColor: '#F59E0B',
      schoolName: 'Institution SmartShule',
      slogan: 'SmartShule — L\'intelligence qui rapproche l\'école et la famille.',
      publishedAt: new Date(),
    },
  })

  // 2. Année scolaire
  const academicYear = await prisma.academicYear.create({
    data: {
      schoolId: school.id,
      label: '2025-2026',
      startDate: new Date('2025-09-01'),
      endDate: new Date('2026-07-15'),
      active: true,
    },
  })

  // 3. Directions
  const dirPrimaire = await prisma.directorate.create({
    data: { schoolId: school.id, name: 'Primaire', code: 'PRI' },
  })
  const dirSecondaire = await prisma.directorate.create({
    data: { schoolId: school.id, name: 'Secondaire', code: 'SEC' },
  })

  // 4. Sections
  const sectionMaths = await prisma.section.create({
    data: { directorateId: dirSecondaire.id, name: 'Mathématiques', code: 'MATH' },
  })
  const sectionSciences = await prisma.section.create({
    data: { directorateId: dirSecondaire.id, name: 'Biologie-Chimie', code: 'SCI' },
  })

  // 5. Classes
  const cp1 = await prisma.classroom.create({
    data: { directorateId: dirPrimaire.id, academicYearId: academicYear.id, name: 'CP1', capacity: 35 },
  })
  const sixiemeA = await prisma.classroom.create({
    data: { directorateId: dirSecondaire.id, sectionId: sectionMaths.id, academicYearId: academicYear.id, name: '6ème A', capacity: 40 },
  })

  // 6. Matières
  const maths = await prisma.subject.create({ data: { schoolId: school.id, name: 'Mathématiques', code: 'MATH' } })
  const francais = await prisma.subject.create({ data: { schoolId: school.id, name: 'Français', code: 'FR' } })

  // 7. Compte utilisateur direction
  const pwd = await hashPassword('SmartShule2026!')
  const userDirection = await prisma.user.create({
    data: { email: 'direction@smartshule.demo', passwordHash: pwd, role: 'DIRECTION', displayName: 'Aimé Mukendi', active: true },
  })

  // 8. Comptes parent + élève
  const parentUser = await prisma.user.create({
    data: { email: 'parent1@smartshule.demo', passwordHash: pwd, role: 'PARENT', displayName: 'Jean Mbumba', active: true },
  })
  const studentUser = await prisma.user.create({
    data: { email: 'eleve1@smartshule.demo', passwordHash: pwd, role: 'STUDENT', displayName: 'Sarah Mbumba', active: true },
  })

  // 8b. Nouveaux comptes RDC
  await prisma.user.create({ data: { email: 'prof@smartshule.demo', passwordHash: pwd, role: 'TEACHER', displayName: 'Berthe Kalala', active: true } })
  await prisma.user.create({ data: { email: 'secretaire@smartshule.demo', passwordHash: pwd, role: 'DIRECTION', displayName: 'Dorcas Mwamba', active: true } })
  await prisma.user.create({ data: { email: 'comptable@smartshule.demo', passwordHash: pwd, role: 'ACCOUNTANT', displayName: 'Christian Tshibangu', active: true } })
  await prisma.user.create({ data: { email: 'promoserveur@smartshule.demo', passwordHash: pwd, role: 'SERVER', displayName: 'PromoServeur Central', active: true } })

  // 9. Guardian
  const guardian = await prisma.guardian.create({
    data: { schoolId: school.id, userId: parentUser.id, firstName: 'Jean', lastName: 'Mbumba', phone: '+243 81 200 0001', email: 'parent1@smartshule.demo', address: 'Commune de Gombe', profession: 'Commerçant' },
  })

  // 10. Élève
  const student = await prisma.student.create({
    data: { schoolId: school.id, matricule: 'SS-2025-0001', firstName: 'Sarah', lastName: 'Mbumba', birthDate: new Date(2013, 5, 15), gender: 'F', status: 'ACTIVE', userId: studentUser.id },
  })
  await prisma.enrollment.create({
    data: { studentId: student.id, classroomId: sixiemeA.id, academicYearId: academicYear.id, status: 'ACTIVE' },
  })
  await prisma.guardianStudentLink.create({
    data: { guardianId: guardian.id, studentId: student.id, relationship: 'PERE', isPrimary: true },
  })

  // 11. Annonces
  await prisma.announcement.create({
    data: { schoolId: school.id, title: 'Bienvenue dans SmartShule', content: 'Chères familles, nous avons le plaisir de vous accueillir pour l\'année scolaire 2025-2026.', targetType: 'ALL', status: 'PUBLISHED', priority: 'NORMAL', publishedAt: new Date(), authorId: userDirection.id },
  })
  await prisma.announcement.create({
    data: { schoolId: school.id, title: 'Réunion parents-professeurs', content: 'La réunion parents-professeurs se tiendra le 27 septembre 2025 à 10h.', targetType: 'ALL', status: 'PUBLISHED', priority: 'HIGH', publishedAt: new Date(), authorId: userDirection.id },
  })

  // 12. Plan comptable
  const accounts = [
    { number: '510000', label: 'Banque', category: 'TREASURY', type: 'ASSET', direction: 'DEBIT', isTreasury: true },
    { number: '530000', label: 'Caisse', category: 'TREASURY', type: 'ASSET', direction: 'DEBIT', isTreasury: true },
    { number: '540000', label: 'Mobile Money', category: 'TREASURY', type: 'ASSET', direction: 'DEBIT', isTreasury: true },
    { number: '411001', label: 'Clients académiques', category: 'CUSTOMER', type: 'ASSET', direction: 'DEBIT', isCustomer: true },
    { number: '445700', label: 'Taxes collectées', category: 'TAX', type: 'LIABILITY', direction: 'CREDIT', isTax: true },
    { number: '419000', label: 'Avances reçues', category: 'CUSTOMER', type: 'LIABILITY', direction: 'CREDIT', isCustomer: true },
    { number: '401000', label: 'Fournisseurs', category: 'SUPPLIER', type: 'LIABILITY', direction: 'CREDIT', isSupplier: true },
    { number: '706100', label: 'Inscriptions', category: 'PRODUCT', type: 'REVENUE', direction: 'CREDIT', isProduct: true },
    { number: '706200', label: 'Scolarité', category: 'PRODUCT', type: 'REVENUE', direction: 'CREDIT', isProduct: true },
    { number: '706300', label: 'Transport scolaire', category: 'PRODUCT', type: 'REVENUE', direction: 'CREDIT', isProduct: true },
    { number: '706400', label: 'Cantine', category: 'PRODUCT', type: 'REVENUE', direction: 'CREDIT', isProduct: true },
    { number: '706500', label: 'Location de salles', category: 'PRODUCT', type: 'REVENUE', direction: 'CREDIT', isProduct: true },
    { number: '706600', label: 'Location de véhicules', category: 'PRODUCT', type: 'REVENUE', direction: 'CREDIT', isProduct: true },
    { number: '600000', label: 'Achats', category: 'CHARGE', type: 'EXPENSE', direction: 'DEBIT' },
    { number: '640000', label: 'Personnel', category: 'CHARGE', type: 'EXPENSE', direction: 'DEBIT' },
  ]

  for (const acc of accounts) {
    await prisma.chartOfAccount.create({
      data: {
        schoolId: school.id,
        accountNumber: acc.number,
        accountLabel: acc.label,
        accountClass: acc.number[0],
        accountCategory: acc.category,
        accountType: acc.type,
        direction: acc.direction,
        isProductAccount: acc.isProduct || false,
        isTaxAccount: acc.isTax || false,
        isTreasuryAccount: acc.isTreasury || false,
        isCustomerAccount: acc.isCustomer || false,
        isSupplierAccount: acc.isSupplier || false,
        status: 'ACTIVE',
      },
    })
  }

  // 13. Journaux
  const journals = [
    { code: 'VE-SCO', label: 'Ventes scolaires', type: 'SALES' },
    { code: 'VE-SAL', label: 'Ventes salles', type: 'SALES' },
    { code: 'VE-VEH', label: 'Ventes véhicules', type: 'SALES' },
    { code: 'CAIS', label: 'Caisse', type: 'CASH' },
    { code: 'BQ', label: 'Banque', type: 'BANK' },
    { code: 'ACHA', label: 'Achats', type: 'PURCHASE' },
    { code: 'PAIE', label: 'Paie', type: 'PAYROLL' },
    { code: 'OD', label: 'Opérations diverses', type: 'MISC' },
  ]
  for (const j of journals) {
    await prisma.accountingJournal.create({
      data: { schoolId: school.id, code: j.code, label: j.label, journalType: j.type, status: 'ACTIVE' },
    })
  }

  // 14. Notification initiale
  await prisma.notification.create({
    data: { userId: userDirection.id, type: 'ANNOUNCEMENT', title: 'Bienvenue', message: 'SmartShule est configuré et prêt.', read: false },
  })

  console.log('✅ Seed automatique terminé !')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  COMPTES DE DÉMONSTRATION')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  Direction :    direction@smartshule.demo')
  console.log('  Secrétaire :    secretaire@smartshule.demo')
  console.log('  Comptable :     comptable@smartshule.demo')
  console.log('  Enseignant :    prof@smartshule.demo')
  console.log('  PromoServeur :  promoserveur@smartshule.demo')
  console.log('  Parent :        parent1@smartshule.demo')
  console.log('  Élève :         eleve1@smartshule.demo')
  console.log('  Mot de passe :  SmartShule2026!')
  console.log('═══════════════════════════════════════════════════════════════')
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('❌ Erreur lors de l\'auto-seed:', e)
    prisma.$disconnect()
    // Ne pas faire échouer le démarrage du serveur
    process.exit(0)
  })
