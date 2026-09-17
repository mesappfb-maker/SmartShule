// SmartShule — Script de seed avec jeu de données complet
// 1 école, 2 directions, 4 classes, 30 élèves, 5 enseignants, 5 factures,
// 3 paiements, annonces, devoirs, notes, demandes

import { db } from '../src/lib/db'
import { hashPassword } from '../src/lib/auth'

async function main() {
  console.log('🔄 Nettoyage de la base...')
  await wipeDatabase()

  console.log('🏫 Création de l\'école...')
  const school = await db.school.create({
    data: {
      name: 'Institution SmartShule',
      slogan: 'SmartShule — L\'intelligence qui rapproche l\'école et la famille.',
      primaryColor: '#2563EB',
      secondaryColor: '#0F766E',
      tertiaryColor: '#F59E0B',
      address: 'Avenue de l\'Éducation, Kinshasa',
      phone: '+243 81 000 0000',
      email: 'contact@smartshule.demo',
      currency: 'CDF',
      locale: 'fr-FR',
    },
  })

  await db.branding.create({
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

  console.log('📅 Création de l\'année scolaire...')
  const academicYear = await db.academicYear.create({
    data: {
      schoolId: school.id,
      label: '2025-2026',
      startDate: new Date('2025-09-01'),
      endDate: new Date('2026-07-15'),
      active: true,
    },
  })

  console.log('🏛️  Création des directions et sections...')
  const dirMaternelle = await db.directorate.create({
    data: { schoolId: school.id, name: 'Maternelle', code: 'MAT' },
  })
  const dirPrimaire = await db.directorate.create({
    data: { schoolId: school.id, name: 'Primaire', code: 'PRI' },
  })
  const dirSecondaire = await db.directorate.create({
    data: { schoolId: school.id, name: 'Secondaire', code: 'SEC' },
  })

  const sectionMaths = await db.section.create({
    data: { directorateId: dirSecondaire.id, name: 'Mathématiques', code: 'MATH' },
  })
  const sectionLettres = await db.section.create({
    data: { directorateId: dirSecondaire.id, name: 'Lettres et Langues', code: 'LETT' },
  })
  const sectionSciences = await db.section.create({
    data: { directorateId: dirSecondaire.id, name: 'Biologie-Chimie', code: 'SCI' },
  })

  console.log('🏫 Création des classes...')
  const cp1 = await db.classroom.create({
    data: {
      directorateId: dirPrimaire.id,
      academicYearId: academicYear.id,
      name: 'CP1',
      capacity: 35,
    },
  })
  const cm2 = await db.classroom.create({
    data: {
      directorateId: dirPrimaire.id,
      academicYearId: academicYear.id,
      name: 'CM2',
      capacity: 35,
    },
  })
  const sixiemeA = await db.classroom.create({
    data: {
      directorateId: dirSecondaire.id,
      sectionId: sectionMaths.id,
      academicYearId: academicYear.id,
      name: '6ème A',
      capacity: 40,
    },
  })
  const troisiemeB = await db.classroom.create({
    data: {
      directorateId: dirSecondaire.id,
      sectionId: sectionSciences.id,
      academicYearId: academicYear.id,
      name: '3ème B',
      capacity: 40,
    },
  })

  console.log('📚 Création des matières...')
  const subjects = await Promise.all(
    [
      ['Mathématiques', 'MATH'],
      ['Français', 'FR'],
      ['Histoire-Géographie', 'HG'],
      ['Sciences', 'SCI'],
      ['Anglais', 'EN'],
    ].map(([name, code]) =>
      db.subject.create({ data: { schoolId: school.id, name, code } })
    )
  )
  const [maths, francais, histoireGeo, sciences, anglais] = subjects

  console.log('👥 Création du personnel...')
  const empDirection = await db.employee.create({
    data: {
      schoolId: school.id,
      directorateId: dirSecondaire.id,
      firstName: 'Aimé',
      lastName: 'Mukendi',
      email: 'a.mukendi@smartshule.demo',
      phone: '+243 81 100 0001',
      function: 'DIRECTION',
      status: 'ACTIVE',
    },
  })
  const empBerthe = await db.employee.create({
    data: {
      schoolId: school.id,
      directorateId: dirSecondaire.id,
      firstName: 'Berthe',
      lastName: 'Kalala',
      email: 'b.kalala@smartshule.demo',
      phone: '+243 81 100 0002',
      function: 'ENSEIGNANT',
      status: 'ACTIVE',
    },
  })
  const empChristian = await db.employee.create({
    data: {
      schoolId: school.id,
      directorateId: dirSecondaire.id,
      firstName: 'Christian',
      lastName: 'Tshibangu',
      email: 'c.tshibangu@smartshule.demo',
      phone: '+243 81 100 0003',
      function: 'ENSEIGNANT',
      status: 'ACTIVE',
    },
  })
  const empDorcas = await db.employee.create({
    data: {
      schoolId: school.id,
      directorateId: dirPrimaire.id,
      firstName: 'Dorcas',
      lastName: 'Mwamba',
      email: 'd.mwamba@smartshule.demo',
      phone: '+243 81 100 0004',
      function: 'ENSEIGNANT',
      status: 'ACTIVE',
    },
  })
  const empEric = await db.employee.create({
    data: {
      schoolId: school.id,
      directorateId: dirPrimaire.id,
      firstName: 'Éric',
      lastName: 'Kabongo',
      email: 'e.kabongo@smartshule.demo',
      phone: '+243 81 100 0005',
      function: 'ENSEIGNANT',
      status: 'ACTIVE',
    },
  })

  await db.teacherAssignment.createMany({
    data: [
      { employeeId: empBerthe.id, subjectId: maths.id, classroomId: sixiemeA.id },
      { employeeId: empBerthe.id, subjectId: maths.id, classroomId: troisiemeB.id },
      { employeeId: empChristian.id, subjectId: francais.id, classroomId: sixiemeA.id },
      { employeeId: empChristian.id, subjectId: histoireGeo.id, classroomId: troisiemeB.id },
      { employeeId: empDorcas.id, subjectId: francais.id, classroomId: cp1.id },
      { employeeId: empDorcas.id, subjectId: francais.id, classroomId: cm2.id },
      { employeeId: empEric.id, subjectId: maths.id, classroomId: cp1.id },
      { employeeId: empEric.id, subjectId: maths.id, classroomId: cm2.id },
      { employeeId: empBerthe.id, subjectId: sciences.id, classroomId: sixiemeA.id },
      { employeeId: empChristian.id, subjectId: anglais.id, classroomId: sixiemeA.id },
    ],
  })

  console.log('🔐 Création des comptes utilisateurs de démo...')
  const pwd = await hashPassword('SmartShule2026!')

  const userDirection = await db.user.create({
    data: {
      email: 'direction@smartshule.demo',
      passwordHash: pwd,
      role: 'DIRECTION',
      displayName: 'Aimé Mukendi',
      active: true,
    },
  })

  const parentUsers = await Promise.all(
    [
      ['parent1@smartshule.demo', 'Jean Mbumba'],
      ['parent2@smartshule.demo', 'Marie Ilunga'],
      ['parent3@smartshule.demo', 'Paul Kasongo'],
      ['parent4@smartshule.demo', 'Esther Nkashama'],
    ].map(([email, name]) =>
      db.user.create({
        data: { email, passwordHash: pwd, role: 'PARENT', displayName: name, active: true },
      })
    )
  )

  const studentUsers = await Promise.all(
    [
      ['eleve1@smartshule.demo', 'Sarah Mbumba'],
      ['eleve2@smartshule.demo', 'Daniel Ilunga'],
      ['eleve3@smartshule.demo', 'Grace Kasongo'],
    ].map(([email, name]) =>
      db.user.create({
        data: { email, passwordHash: pwd, role: 'STUDENT', displayName: name, active: true },
      })
    )
  )

  console.log('👨‍👩‍👧 Création des responsables (guardians)...')
  const guardians = await Promise.all(
    parentUsers.map((u, i) =>
      db.guardian.create({
        data: {
          schoolId: school.id,
          userId: u.id,
          firstName: u.displayName.split(' ')[0],
          lastName: u.displayName.split(' ')[1] || '',
          phone: `+243 81 200 000${i + 1}`,
          email: u.email,
          address: `Adresse ${i + 1}, Commune de Gombe`,
          profession: ['Commerçant', 'Médecin', 'Ingénieur', 'Enseignante'][i],
        },
      })
    )
  )

  console.log('🧒 Création des 30 élèves...')
  const firstNamesM = ['Aaron', 'Béni', 'Christian', 'David', 'Éric', 'Fiston', 'Gloria', 'Henri', 'Israël', 'Joël', 'Kévin', 'Lionel', 'Marc', 'Noé', 'Olivier']
  const firstNamesF = ['Alice', 'Béatrice', 'Chantal', 'Dorcas', 'Esther', 'Fatima', 'Grâce', 'Hélène', 'Irène', 'Jeannette', 'Kathy', 'Lina', 'Marie', 'Nadia', 'Olive']
  const lastNames = ['Mbumba', 'Ilunga', 'Kasongo', 'Nkashama', 'Mukendi', 'Kalala', 'Tshibangu', 'Mwamba', 'Kabongo', 'Lukusa', 'Mbuyi', 'Ngalula', 'Kanku', 'Tshala', 'Bakambu']

  const students: any[] = []
  const distribution = [
    { classroom: cp1, count: 8 },
    { classroom: cm2, count: 8 },
    { classroom: sixiemeA, count: 7 },
    { classroom: troisiemeB, count: 7 },
  ]

  let studentIdx = 0
  for (const { classroom, count } of distribution) {
    for (let i = 0; i < count; i++) {
      const isMale = studentIdx % 2 === 0
      const firstName = isMale
        ? firstNamesM[studentIdx % firstNamesM.length]
        : firstNamesF[studentIdx % firstNamesF.length]
      const lastName = lastNames[studentIdx % lastNames.length]
      const matricule = `SS-2025-${String(studentIdx + 1).padStart(4, '0')}`

      const userId = studentIdx < studentUsers.length ? studentUsers[studentIdx].id : null

      const student = await db.student.create({
        data: {
          schoolId: school.id,
          matricule,
          firstName,
          lastName,
          birthDate: new Date(2010 - (studentIdx % 6), (studentIdx % 12) + 1, (studentIdx % 27) + 1),
          gender: isMale ? 'M' : 'F',
          status: 'ACTIVE',
          userId,
        },
      })
      students.push(student)

      await db.enrollment.create({
        data: {
          studentId: student.id,
          classroomId: classroom.id,
          academicYearId: academicYear.id,
          status: 'ACTIVE',
        },
      })

      const guardian = guardians[studentIdx % guardians.length]
      const relationship =
        studentIdx % 3 === 0 ? 'PERE' : studentIdx % 3 === 1 ? 'MERE' : 'TUTEUR'
      await db.guardianStudentLink.create({
        data: {
          guardianId: guardian.id,
          studentId: student.id,
          relationship,
          isPrimary: true,
        },
      })

      if (studentIdx % 4 === 0) {
        const guardian2 = guardians[(studentIdx + 1) % guardians.length]
        if (guardian2.id !== guardian.id) {
          await db.guardianStudentLink.create({
            data: {
              guardianId: guardian2.id,
              studentId: student.id,
              relationship: 'MERE',
              isPrimary: false,
            },
          })
        }
      }

      studentIdx++
    }
  }

  // S'assurer que eleve1, eleve2, eleve3 sont respectivement liés à parent1, parent2, parent3
  for (let i = 0; i < 3; i++) {
    const s = students[i]
    const g = guardians[i]
    await db.guardianStudentLink.deleteMany({ where: { studentId: s.id } })
    await db.guardianStudentLink.create({
      data: {
        guardianId: g.id,
        studentId: s.id,
        relationship: 'PERE',
        isPrimary: true,
      },
    })
  }

  console.log('📚 Création des cours...')
  const courses = await Promise.all([
    db.course.create({
      data: {
        schoolId: school.id,
        classroomId: sixiemeA.id,
        subjectId: maths.id,
        teacherId: empBerthe.id,
        title: 'Mathématiques 6ème — Nombres et opérations',
        description: 'Les nombres entiers, les fractions, les décimaux et les opérations de base.',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    }),
    db.course.create({
      data: {
        schoolId: school.id,
        classroomId: sixiemeA.id,
        subjectId: francais.id,
        teacherId: empChristian.id,
        title: 'Français 6ème — Grammaire et conjugaison',
        description: 'Les classes de mots, les fonctions, la conjugaison des verbes du 3e groupe.',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    }),
    db.course.create({
      data: {
        schoolId: school.id,
        classroomId: sixiemeA.id,
        subjectId: anglais.id,
        teacherId: empChristian.id,
        title: 'Anglais 6ème — First steps',
        description: 'Vocabulary, greetings, present tense.',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    }),
    db.course.create({
      data: {
        schoolId: school.id,
        classroomId: troisiemeB.id,
        subjectId: maths.id,
        teacherId: empBerthe.id,
        title: 'Mathématiques 3ème — Équations et géométrie',
        description: 'Résolution d\'équations, théorème de Thalès, trigonométrie.',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    }),
    db.course.create({
      data: {
        schoolId: school.id,
        classroomId: troisiemeB.id,
        subjectId: histoireGeo.id,
        teacherId: empChristian.id,
        title: 'Histoire-Géographie 3ème — Indépendances et Afrique',
        description: 'Les indépendances africaines, géographie du continent.',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    }),
    db.course.create({
      data: {
        schoolId: school.id,
        classroomId: cp1.id,
        subjectId: francais.id,
        teacherId: empDorcas.id,
        title: 'Français CP1 — Apprentissage de la lecture',
        description: 'Les lettres, les syllabes, les premiers mots.',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    }),
    db.course.create({
      data: {
        schoolId: school.id,
        classroomId: cm2.id,
        subjectId: maths.id,
        teacherId: empEric.id,
        title: 'Mathématiques CM2 — Problèmes et mesures',
        description: 'Résolution de problèmes, conversions, aires et périmètres.',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    }),
  ])

  const today = new Date()
  for (const course of courses) {
    for (let d = 0; d < 4; d++) {
      const date = new Date(today)
      date.setDate(date.getDate() - d * 7)
      await db.courseSession.create({
        data: {
          courseId: course.id,
          date,
          startTime: '08:00',
          endTime: '10:00',
          room: `Salle ${100 + d}`,
        },
      })
    }
  }

  console.log('📝 Création des devoirs...')
  const assignments = await Promise.all([
    db.assignment.create({
      data: {
        schoolId: school.id,
        classroomId: sixiemeA.id,
        courseId: courses[0].id,
        subjectId: maths.id,
        title: 'Devoir 1 — Fractions',
        description: 'Exercices 1 à 5 page 24 du manuel. Rendre sur feuille ou via le portail.',
        dueDate: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000),
        maxScore: 20,
        status: 'PUBLISHED',
        publishedAt: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
      },
    }),
    db.assignment.create({
      data: {
        schoolId: school.id,
        classroomId: sixiemeA.id,
        courseId: courses[1].id,
        subjectId: francais.id,
        title: 'Rédaction — Mes vacances',
        description: 'Rédiger un texte de 15 lignes décrivant vos dernières vacances.',
        dueDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
        maxScore: 20,
        status: 'PUBLISHED',
        publishedAt: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000),
      },
    }),
    db.assignment.create({
      data: {
        schoolId: school.id,
        classroomId: troisiemeB.id,
        courseId: courses[3].id,
        subjectId: maths.id,
        title: 'Exercices — Théorème de Thalès',
        description: 'Exercices d\'application du théorème de Thalès.',
        dueDate: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000),
        maxScore: 20,
        status: 'PUBLISHED',
        publishedAt: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000),
      },
    }),
  ])

  await db.submission.create({
    data: {
      assignmentId: assignments[0].id,
      studentId: students[0].id,
      content: 'J\'ai résolu les 5 exercices sur les fractions. Voir fichier joint.',
      fileName: 'devoir_fractions.pdf',
      fileSize: 245760,
      status: 'SUBMITTED',
      submittedAt: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
    },
  })
  await db.submission.create({
    data: {
      assignmentId: assignments[1].id,
      studentId: students[0].id,
      content: 'Pendant les vacances, je suis allé chez mes grands-parents...',
      status: 'SUBMITTED',
      submittedAt: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000),
    },
  })

  console.log('📊 Création des notes...')
  for (let sIdx = 0; sIdx < 8; sIdx++) {
    const s = students[sIdx]
    const enr = await db.enrollment.findFirst({
      where: { studentId: s.id, status: 'ACTIVE' },
    })
    if (!enr) continue

    const subjPool = [maths, francais, anglais, histoireGeo, sciences]
    for (let m = 0; m < 3; m++) {
      const subj = subjPool[(sIdx + m) % subjPool.length]
      const score = 9 + Math.floor(Math.random() * 11)
      await db.grade.create({
        data: {
          schoolId: school.id,
          studentId: s.id,
          subjectId: subj.id,
          classroomId: enr.classroomId,
          title: `Évaluation ${m + 1}`,
          score,
          maxScore: 20,
          weight: 1,
          status: 'PUBLISHED',
          publishedAt: new Date(today.getTime() - (m + 1) * 7 * 24 * 60 * 60 * 1000),
          draftedAt: new Date(today.getTime() - (m + 1) * 7 * 24 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000),
          submittedAt: new Date(today.getTime() - (m + 1) * 7 * 24 * 60 * 60 * 1000 - 12 * 60 * 60 * 1000),
          controlledAt: new Date(today.getTime() - (m + 1) * 7 * 24 * 60 * 60 * 1000 - 6 * 60 * 60 * 1000),
          scoreCents: Math.round(score * 100),
          maxScoreCents: 2000,
          weightCents: 100,
          teacherComment:
            score >= 16
              ? 'Très bon travail, continuez ainsi.'
              : score >= 12
              ? 'Travail satisfaisant, des progrès à faire.'
              : 'Travail insuffisant, revoir les bases.',
        },
      })
    }
  }

  await db.reportCard.create({
    data: {
      studentId: students[0].id,
      academicYearId: academicYear.id,
      period: 'T1',
      status: 'PUBLISHED',
      publishedAt: new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000),
      average: 14.5,
      rank: 3,
      appreciation: 'Trimestre satisfaisant. Sarah montre de bonnes capacités en mathématiques et en français. À encourager en sciences.',
    },
  })
  await db.reportCard.create({
    data: {
      studentId: students[1].id,
      academicYearId: academicYear.id,
      period: 'T1',
      status: 'PUBLISHED',
      publishedAt: new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000),
      average: 11.8,
      rank: 8,
      appreciation: 'Trimestre correct. Des efforts sont attendus en mathématiques.',
    },
  })

  console.log('📅 Création des présences...')
  for (let sIdx = 0; sIdx < 8; sIdx++) {
    const s = students[sIdx]
    for (let c = 0; c < courses.length; c++) {
      const course = courses[c]
      const enr = await db.enrollment.findFirst({
        where: { studentId: s.id, classroomId: course.classroomId },
      })
      if (!enr) continue

      const session = await db.courseSession.findFirst({
        where: { courseId: course.id },
      })
      if (!session) continue

      const status = ['PRESENT', 'PRESENT', 'PRESENT', 'LATE', 'ABSENT'][sIdx % 5]
      const justified = status === 'ABSENT' && sIdx % 2 === 0
      await db.attendance.create({
        data: {
          schoolId: school.id,
          studentId: s.id,
          courseId: course.id,
          sessionId: session.id,
          date: session.date,
          status,
          justified,
          justification: justified ? 'Certificat médical fourni.' : null,
        },
      })
    }
  }

  console.log('💰 Création des tarifs...')
  const feeInscription = await db.feeDefinition.create({
    data: {
      schoolId: school.id,
      academicYearId: academicYear.id,
      label: 'Frais d\'inscription',
      amount: 50000,
      currency: 'CDF',
      appliesTo: 'ALL',
    },
  })
  const feeScolariteT1 = await db.feeDefinition.create({
    data: {
      schoolId: school.id,
      academicYearId: academicYear.id,
      label: 'Scolarité T1',
      amount: 120000,
      currency: 'CDF',
      appliesTo: 'ALL',
    },
  })

  console.log('🧾 Création des factures (5)...')
  for (let i = 0; i < 5; i++) {
    const s = students[i]
    const enr = await db.enrollment.findFirst({ where: { studentId: s.id, status: 'ACTIVE' } })
    if (!enr) continue

    const guardian = await db.guardianStudentLink.findFirst({
      where: { studentId: s.id, isPrimary: true },
      include: { guardian: true },
    })

    const invoiceNumber = `FAC-2025-${String(i + 1).padStart(4, '0')}`
    const total = 170000
    const status = i < 2 ? 'PAID' : i === 2 ? 'PARTIALLY_PAID' : 'UNPAID'
    const paidAmount = i < 2 ? 170000 : i === 2 ? 70000 : 0

    const invoice = await db.invoice.create({
      data: {
        schoolId: school.id,
        studentId: s.id,
        guardianId: guardian?.guardianId,
        invoiceNumber,
        academicYearId: academicYear.id,
        issueDate: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
        dueDate: new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000),
        status,
        totalAmount: total,
        paidAmount,
        currency: 'CDF',
        lines: {
          create: [
            {
              feeDefinitionId: feeInscription.id,
              description: 'Frais d\'inscription',
              quantity: 1,
              unitPrice: 50000,
              discount: 0,
              taxRate: 0,
              total: 50000,
            },
            {
              feeDefinitionId: feeScolariteT1.id,
              description: 'Scolarité T1',
              quantity: 1,
              unitPrice: 120000,
              discount: 0,
              taxRate: 0,
              total: 120000,
            },
          ],
        },
      },
    })

    if (i < 2) {
      await db.payment.create({
        data: {
          schoolId: school.id,
          invoiceId: invoice.id,
          receiptNumber: `REC-2025-${String(i + 1).padStart(4, '0')}`,
          amount: 170000,
          method: i === 0 ? 'BANK' : 'MOBILE_MONEY',
          payerName: guardian?.guardian
            ? `${guardian.guardian.firstName} ${guardian.guardian.lastName}`
            : undefined,
          status: 'CONFIRMED',
          paidAt: new Date(today.getTime() - 20 * 24 * 60 * 60 * 1000),
        },
      })
    } else if (i === 2) {
      await db.payment.create({
        data: {
          schoolId: school.id,
          invoiceId: invoice.id,
          receiptNumber: `REC-2025-${String(i + 1).padStart(4, '0')}`,
          amount: 70000,
          method: 'CASH',
          payerName: guardian?.guardian
            ? `${guardian.guardian.firstName} ${guardian.guardian.lastName}`
            : undefined,
          status: 'CONFIRMED',
          paidAt: new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000),
        },
      })
    }
  }

  console.log('📢 Création des annonces...')
  await db.announcement.create({
    data: {
      schoolId: school.id,
      title: 'Bienvenue dans SmartShule',
      content: 'Chères familles, nous avons le plaisir de vous accueillir pour l\'année scolaire 2025-2026. Le portail SmartShule vous permet de suivre la scolarité de vos enfants, de consulter leurs résultats et de communiquer avec la direction. Bonne année à toutes et à tous !',
      targetType: 'ALL',
      status: 'PUBLISHED',
      priority: 'NORMAL',
      publishedAt: new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000),
      authorId: userDirection.id,
    },
  })
  await db.announcement.create({
    data: {
      schoolId: school.id,
      title: 'Réunion parents-professeurs',
      content: 'La réunion parents-professeurs du premier trimestre se tiendra le samedi 27 septembre 2025 à 10h dans la salle polyvalente. La présence d\'au moins un parent par élève est vivement recommandée.',
      targetType: 'ALL',
      status: 'PUBLISHED',
      priority: 'HIGH',
      publishedAt: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000),
      authorId: userDirection.id,
    },
  })
  await db.announcement.create({
    data: {
      schoolId: school.id,
      title: 'Échéance des frais de scolarité T1',
      content: 'Nous rappelons aux familles que la date limite de paiement des frais de scolarité du premier trimestre est fixée au 30 septembre 2025. Tout retard peut entraîner des pénalités selon le règlement intérieur.',
      targetType: 'ALL',
      status: 'PUBLISHED',
      priority: 'URGENT',
      publishedAt: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000),
      authorId: userDirection.id,
    },
  })
  await db.announcement.create({
    data: {
      schoolId: school.id,
      classroomId: sixiemeA.id,
      title: 'Sortie pédagogique 6ème A',
      content: 'Une sortie pédagogique est organisée pour la classe de 6ème A le 15 octobre 2025 au Parc de la Vallée. L\'autorisation parentale est obligatoire et à remettre au plus tard le 8 octobre.',
      targetType: 'CLASSROOM',
      status: 'PUBLISHED',
      priority: 'NORMAL',
      publishedAt: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000),
      authorId: userDirection.id,
    },
  })
  await db.announcement.create({
    data: {
      schoolId: school.id,
      title: 'Bulletins du premier trimestre disponibles',
      content: 'Les bulletins du premier trimestre sont désormais publiés sur le portail SmartShule. Vous pouvez les consulter dans la section « Bulletins » de l\'espace parent.',
      targetType: 'ALL',
      status: 'PUBLISHED',
      priority: 'HIGH',
      publishedAt: new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000),
      authorId: userDirection.id,
    },
  })

  console.log('📨 Création des demandes parentales...')
  const req1 = await db.parentRequest.create({
    data: {
      schoolId: school.id,
      requestNumber: 'REQ-2025-0001',
      guardianId: guardians[0].id,
      studentId: students[0].id,
      category: 'ABSENCE',
      priority: 'NORMAL',
      subject: 'Absence prévue le 25 septembre',
      status: 'ANSWERED',
      createdAt: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
      messages: {
        create: [
          {
            authorId: parentUsers[0].id,
            authorName: parentUsers[0].displayName,
            authorRole: 'PARENT',
            content: 'Bonjour, mon enfant Sarah sera absente le 25 septembre pour un rendez-vous médical. Merci de bien vouloir excuser cette absence.',
            createdAt: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000),
          },
          {
            authorId: userDirection.id,
            authorName: userDirection.displayName,
            authorRole: 'DIRECTION',
            content: 'Bonjour, nous avons bien pris note de l\'absence de Sarah. Merci de fournir un certificat médical à son retour. Bonne journée.',
            createdAt: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
          },
        ],
      },
    },
  })

  const req2 = await db.parentRequest.create({
    data: {
      schoolId: school.id,
      requestNumber: 'REQ-2025-0002',
      guardianId: guardians[1].id,
      studentId: students[1].id,
      category: 'FRAIS',
      priority: 'HIGH',
      subject: 'Demande d\'échéancier pour les frais de scolarité',
      status: 'IN_PROGRESS',
      createdAt: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000),
      messages: {
        create: [
          {
            authorId: parentUsers[1].id,
            authorName: parentUsers[1].displayName,
            authorRole: 'PARENT',
            content: 'Bonjour, suite à des difficultés temporaires, je sollicite un échéancier pour le paiement des frais de scolarité de Daniel. Merci de votre compréhension.',
            createdAt: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000),
          },
        ],
      },
    },
  })

  const req3 = await db.parentRequest.create({
    data: {
      schoolId: school.id,
      requestNumber: 'REQ-2025-0003',
      guardianId: guardians[2].id,
      studentId: students[2].id,
      category: 'DOCUMENT',
      priority: 'LOW',
      subject: 'Demande de certificat de scolarité',
      status: 'NEW',
      createdAt: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000),
      messages: {
        create: [
          {
            authorId: parentUsers[2].id,
            authorName: parentUsers[2].displayName,
            authorRole: 'PARENT',
            content: 'Bonjour, je souhaiterais obtenir un certificat de scolarité pour mon enfant Grace, à des fins administratives. Merci.',
            createdAt: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000),
          },
        ],
      },
    },
  })

  const req4 = await db.parentRequest.create({
    data: {
      schoolId: school.id,
      requestNumber: 'REQ-2025-0004',
      guardianId: guardians[3].id,
      studentId: students[3].id,
      category: 'TECHNIQUE',
      priority: 'NORMAL',
      subject: 'Problème d\'accès au portail',
      status: 'CLOSED',
      createdAt: new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(today.getTime() - 8 * 24 * 60 * 60 * 1000),
      closedAt: new Date(today.getTime() - 8 * 24 * 60 * 60 * 1000),
      messages: {
        create: [
          {
            authorId: parentUsers[3].id,
            authorName: parentUsers[3].displayName,
            authorRole: 'PARENT',
            content: 'Bonjour, je n\'arrive pas à me connecter au portail.',
            createdAt: new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000),
          },
          {
            authorId: userDirection.id,
            authorName: userDirection.displayName,
            authorRole: 'DIRECTION',
            content: 'Bonjour, votre mot de passe a été réinitialisé. Vous devriez recevoir un email. Merci de contacter le secrétariat si le problème persiste.',
            createdAt: new Date(today.getTime() - 8 * 24 * 60 * 60 * 1000),
          },
        ],
      },
    },
  })

  console.log('🔔 Création des notifications...')
  for (const u of [...parentUsers, ...studentUsers]) {
    await db.notification.create({
      data: {
        userId: u.id,
        type: 'ANNOUNCEMENT',
        title: 'Nouvelle annonce : Réunion parents-professeurs',
        message: 'La réunion parents-professeurs se tiendra le 27 septembre 2025 à 10h.',
        read: false,
        createdAt: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000),
      },
    })
    await db.notification.create({
      data: {
        userId: u.id,
        type: 'GRADE_PUBLISHED',
        title: 'Nouvelle note publiée',
        message: 'Une nouvelle note a été publiée pour votre enfant.',
        read: u.id !== parentUsers[0].id,
        createdAt: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
    })
  }
  await db.notification.create({
    data: {
      userId: userDirection.id,
      type: 'REQUEST_REPLY',
      title: 'Nouvelle demande parentale',
      message: 'Une nouvelle demande a été reçue de la part d\'un parent.',
      read: false,
      createdAt: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000),
    },
  })

  console.log('📋 Création de quelques entrées d\'audit...')
  await db.auditLog.create({
    data: {
      schoolId: school.id,
      userId: userDirection.id,
      userName: userDirection.displayName,
      userRole: 'DIRECTION',
      action: 'PUBLISH_ANNOUNCEMENT',
      entityType: 'ANNOUNCEMENT',
      description: 'Publication de l\'annonce « Échéance des frais de scolarité T1 »',
      createdAt: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000),
    },
  })
  await db.auditLog.create({
    data: {
      schoolId: school.id,
      userId: userDirection.id,
      userName: userDirection.displayName,
      userRole: 'DIRECTION',
      action: 'REPLY_REQUEST',
      entityType: 'PARENT_REQUEST',
      entityId: req1.id,
      description: 'Réponse à la demande REQ-2025-0001 (absence prévue)',
      createdAt: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
    },
  })
  await db.auditLog.create({
    data: {
      schoolId: school.id,
      userId: parentUsers[0].id,
      userName: parentUsers[0].displayName,
      userRole: 'PARENT',
      action: 'CREATE_REQUEST',
      entityType: 'PARENT_REQUEST',
      entityId: req1.id,
      description: 'Création de la demande REQ-2025-0001 (absence prévue)',
      createdAt: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000),
    },
  })
  await db.auditLog.create({
    data: {
      schoolId: school.id,
      userId: parentUsers[0].id,
      userName: parentUsers[0].displayName,
      userRole: 'PARENT',
      action: 'READ_REPORT_CARD',
      entityType: 'REPORT_CARD',
      description: 'Consultation du bulletin T1 de l\'élève Sarah Mbumba',
      createdAt: new Date(today.getTime() - 12 * 24 * 60 * 60 * 1000),
    },
  })

  console.log('✅ Seed terminé !')
  console.log('')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  COMPTES DE DÉMONSTRATION')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  Direction :  direction@smartshule.demo')
  console.log('  Parent 1  :  parent1@smartshule.demo  (élève Sarah Mbumba)')
  console.log('  Parent 2  :  parent2@smartshule.demo  (élève Daniel Ilunga)')
  console.log('  Parent 3  :  parent3@smartshule.demo  (élève Grace Kasongo)')
  console.log('  Élève 1   :  eleve1@smartshule.demo   (Sarah Mbumba)')
  console.log('  Élève 2   :  eleve2@smartshule.demo   (Daniel Ilunga)')
  console.log('  Élève 3   :  eleve3@smartshule.demo   (Grace Kasongo)')
  console.log('  Mot de passe pour tous : SmartShule2026!')
  console.log('═══════════════════════════════════════════════════════════════')
}

async function wipeDatabase() {
  // Ordre : d'abord les feuilles, puis les parents
  // Inclut les nouvelles tables du Cycle 02 (Accounting) et Cycle 03 (AttendanceSession, GradeCorrection)
  await db.journalEntryLine.deleteMany()
  await db.journalEntry.deleteMany()
  await db.gradeCorrection.deleteMany()
  await db.attendance.deleteMany()
  await db.attendanceSession.deleteMany()
  await db.accountingJournal.deleteMany()
  await db.chartOfAccount.deleteMany()
  await db.auditLog.deleteMany()
  await db.notification.deleteMany()
  await db.requestMessage.deleteMany()
  await db.parentRequest.deleteMany()
  await db.announcement.deleteMany()
  await db.payment.deleteMany()
  await db.invoiceLine.deleteMany()
  await db.invoice.deleteMany()
  await db.feeDefinition.deleteMany()
  await db.submission.deleteMany()
  await db.assignment.deleteMany()
  await db.reportCard.deleteMany()
  await db.grade.deleteMany()
  await db.courseSession.deleteMany()
  await db.course.deleteMany()
  await db.teacherAssignment.deleteMany()
  await db.subject.deleteMany()
  await db.employee.deleteMany()
  await db.enrollment.deleteMany()
  await db.guardianStudentLink.deleteMany()
  await db.student.deleteMany()
  await db.guardian.deleteMany()
  await db.classroom.deleteMany()
  await db.section.deleteMany()
  await db.directorate.deleteMany()
  await db.academicYear.deleteMany()
  await db.branding.deleteMany()
  await db.session.deleteMany()
  await db.school.deleteMany()
  await db.user.deleteMany()
}

main()
  .then(() => {
    console.log('Fin du script.')
    process.exit(0)
  })
  .catch((e) => {
    console.error('Erreur lors du seed:', e)
    process.exit(1)
  })
