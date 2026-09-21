// SmartShule — Auto-seed pour PostgreSQL Supabase
// ============================================================
// Exécuté au démarrage de Render/Railway/Vercel
// Vérifie si la base est vide, et si oui, crée :
//   - École "Institution SmartShule"
//   - Comptes démo (Direction, Prof, Comptable, Parent, Élève, Serveur)
//   - Année académique active
//   - Quelques classes et élèves de démo
//
// Idempotent : ne recrée pas ce qui existe déjà.

const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')

const db = new PrismaClient()

async function pbkdf2(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derived) => {
      if (err) reject(err)
      else resolve(derived.toString('hex'))
    })
  })
}

async function main() {
  console.log('🌱 Vérification du seed...')

  // Vérifier si l'école existe déjà
  let school = await db.school.findFirst()
  if (school) {
    console.log('✅ École déjà existante — seed ignoré')
    return
  }

  console.log('🏗️ Création de l\'école et des comptes démo...')

  // 1. École
  school = await db.school.create({
    data: {
      name: 'Institution SmartShule',
      slogan: 'L\'intelligence qui rapproche l\'école et la famille',
      primaryColor: '#2563EB',
      secondaryColor: '#0F766E',
      tertiaryColor: '#F59E0B',
      currency: 'CDF',
      locale: 'fr-FR',
      address: 'Kinshasa, RDC',
    },
  })
  console.log('  ✅ École créée:', school.name)

  // 2. Année académique
  const year = await db.academicYear.create({
    data: {
      schoolId: school.id,
      label: '2025-2026',
      startDate: new Date('2025-09-01'),
      endDate: new Date('2026-07-31'),
      active: true,
    },
  })
  console.log('  ✅ Année académique:', year.label)

  // 3. Direction
  const direction = await db.directorate.create({
    data: { schoolId: school.id, name: 'Secondaire', code: 'SEC' },
  })
  console.log('  ✅ Direction:', direction.name)

  // 4. Classe
  const classroom = await db.classroom.create({
    data: {
      directorateId: direction.id,
      academicYearId: year.id,
      name: '6ème A',
      capacity: 40,
      academicYearLabel: '2025-2026',
    },
  })
  console.log('  ✅ Classe:', classroom.name)

  // 5. Comptes utilisateurs (mots de passe : tous "Test1234!")
  const password = 'Test1234!'
  const users = [
    { email: 'direction@smartshule.demo', role: 'DIRECTION', displayName: 'Directeur Général' },
    { email: 'prof@smartshule.demo', role: 'TEACHER', displayName: 'Professeur Test' },
    { email: 'comptable@smartshule.demo', role: 'ACCOUNTANT', displayName: 'Comptable Test' },
    { email: 'secretaire@smartshule.demo', role: 'SECRETARY', displayName: 'Secrétaire Test' },
    { email: 'parent@smartshule.demo', role: 'PARENT', displayName: 'Parent Test' },
    { email: 'eleve@smartshule.demo', role: 'STUDENT', displayName: 'Élève Test' },
    { email: 'server@smartshule.demo', role: 'SERVER', displayName: 'PromoServeur Admin' },
  ]

  for (const u of users) {
    const salt = crypto.randomBytes(16).toString('hex')
    const passwordHash = await pbkdf2(password, salt)
    await db.user.create({
      data: {
        email: u.email,
        passwordHash: `${salt}:${passwordHash}`,
        role: u.role,
        displayName: u.displayName,
        active: true,
      },
    })
    console.log(`  ✅ User: ${u.email} (${u.role})`)
  }

  // 6. Employé prof (lié au user prof)
  const profUser = await db.user.findUnique({ where: { email: 'prof@smartshule.demo' } })
  if (profUser) {
    await db.employee.create({
      data: {
        schoolId: school.id,
        directorateId: direction.id,
        firstName: 'Professeur',
        lastName: 'Test',
        email: 'prof@smartshule.demo',
        function: 'ENSEIGNANT',
        status: 'ACTIVE',
        globalRole: 'ENSEIGNANT',
      },
    })
    console.log('  ✅ Employé prof créé')
  }

  // 7. Élève de démo
  const student = await db.student.create({
    data: {
      schoolId: school.id,
      matricule: 'ELV-001',
      firstName: 'Jean',
      lastName: 'Dupont',
      status: 'ACTIVE',
    },
  })
  await db.enrollment.create({
    data: {
      studentId: student.id,
      classroomId: classroom.id,
      academicYearId: year.id,
      status: 'ACTIVE',
    },
  })
  console.log('  ✅ Élève démo:', student.matricule)

  // 8. Parent lié à l'élève
  const parentUser = await db.user.findUnique({ where: { email: 'parent@smartshule.demo' } })
  if (parentUser) {
    const guardian = await db.guardian.create({
      data: {
        schoolId: school.id,
        firstName: 'Marie',
        lastName: 'Dupont',
        phone: '+243 800 000 000',
        email: 'parent@smartshule.demo',
        userId: parentUser.id,
      },
    })
    await db.guardianStudentLink.create({
      data: {
        guardianId: guardian.id,
        studentId: student.id,
        relationship: 'MERE',
        isPrimary: true,
      },
    })
    console.log('  ✅ Parent lié à l\'élève')
  }

  console.log('\n🎉 Seed terminé avec succès !')
  console.log('\n📋 Comptes de connexion démo (mot de passe: Test1234!) :')
  users.forEach((u) => console.log(`   - ${u.email} (${u.role})`))
}

main()
  .catch((err) => {
    console.error('❌ Erreur de seed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
