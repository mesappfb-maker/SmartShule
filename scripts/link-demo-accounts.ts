// SmartShule — Lier les comptes démo aux données (employés, parents, élèves)
// ============================================================
// Corrige le problème : les comptes démo ne sont pas liés à l'école démo
// via Employee.email / Guardian.userId / Student.userId
// ce qui empêche getSchoolIdForUser de trouver la bonne école.

import { db } from '../src/lib/db'

async function main() {
  console.log('🔗 Liaison des comptes démo aux données...\n')

  const demoSchool = await db.school.findFirst({
    where: { email: 'contact@demo.smartshule.com' },
  })
  if (!demoSchool) {
    console.error('❌ École démo introuvable. Exécutez d\'abord seed-demo.ts')
    process.exit(1)
  }
  console.log(`École démo: ${demoSchool.name} (${demoSchool.id})`)

  // Mapping rôle démo → employé correspondant
  const roleToEmployee: Record<string, { firstName: string; lastName: string }> = {
    DIRECTOR: { firstName: 'Jean-Pierre', lastName: 'Kabongo' },
    SECRETARY: { firstName: 'Sarah', lastName: 'Tshibangu' },
    ADMISSIONS_OFFICER: { firstName: 'Grace', lastName: 'Mwamba' },
    ACCOUNTANT: { firstName: 'Daniel', lastName: 'Ilunga' },
    CASHIER: { firstName: 'Samuel', lastName: 'Kalonji' },
    HR_MANAGER: { firstName: 'Anne', lastName: 'Mbuyi' },
    PAYROLL_OFFICER: { firstName: 'Lucie', lastName: 'Banza' },
    TEACHER: { firstName: 'Pierre', lastName: 'Mukeba' },
  }

  // Lier les employés aux comptes démo (par email)
  console.log('\n👔 Liaison employés...')
  for (const [role, empInfo] of Object.entries(roleToEmployee)) {
    const email = `${role.toLowerCase().replace(/_/g, '')}@demo.smartshule.com`
    // Pour ADMISSIONS_OFFICER, l'email est admissions@ (pas admissionsofficer@)
    const actualEmail = role === 'ADMISSIONS_OFFICER' ? 'admissions@demo.smartshule.com' : email
    const user = await db.user.findUnique({ where: { email: actualEmail } })
    if (!user) {
      console.log(`   ⚠️  Compte ${role} (${actualEmail}) introuvable`)
      continue
    }

    const employee = await db.employee.findFirst({
      where: { schoolId: demoSchool.id, firstName: empInfo.firstName, lastName: empInfo.lastName },
    })
    if (!employee) {
      console.log(`   ⚠️  Employé ${empInfo.firstName} ${empInfo.lastName} introuvable`)
      continue
    }

    await db.employee.update({
      where: { id: employee.id },
      data: { email: actualEmail },
    })
    console.log(`   ✓ ${role} → ${empInfo.firstName} ${empInfo.lastName} (${actualEmail})`)
  }

  // Lier le compte PARENT à un Guardian
  console.log('\n👨‍👩‍👧‍👦 Liaison parent...')
  const parentUser = await db.user.findUnique({ where: { email: 'parent@demo.smartshule.com' } })
  if (parentUser) {
    // Prendre le premier guardian de l'école démo
    const guardian = await db.guardian.findFirst({
      where: { schoolId: demoSchool.id },
    })
    if (guardian) {
      await db.guardian.update({
        where: { id: guardian.id },
        data: {
          userId: parentUser.id,
          email: 'parent@demo.smartshule.com',
          phone: parentUser.phone || guardian.phone,
        },
      })
      console.log(`   ✓ Parent démo → Guardian ${guardian.firstName} ${guardian.lastName}`)
    }
  }

  // Lier le compte STUDENT à un Student
  console.log('\n🎓 Liaison élève...')
  const studentUser = await db.user.findUnique({ where: { email: 'student@demo.smartshule.com' } })
  if (studentUser) {
    // Prendre le premier élève actif de l'école démo
    const student = await db.student.findFirst({
      where: { schoolId: demoSchool.id, status: 'ACTIVE' },
    })
    if (student) {
      await db.student.update({
        where: { id: student.id },
        data: { userId: studentUser.id },
      })
      console.log(`   ✓ Élève démo → Student ${student.firstName} ${student.lastName} (${student.matricule})`)
    }
  }

  // SCHOOL_ADMIN et SYSTEM_ADMIN : pas besoin de lien employé, le fallback prend la 1ère école
  // Mais on peut créer un audit log pour les lier à l'école démo
  console.log('\n📝 Création audit logs pour SCHOOL_ADMIN et SYSTEM_ADMIN...')
  for (const email of ['schooladmin@demo.smartshule.com', 'sysadmin@demo.smartshule.com', 'promoter@demo.smartshule.com', 'auditor@demo.smartshule.com']) {
    const user = await db.user.findUnique({ where: { email } })
    if (!user) continue

    const existingAudit = await db.auditLog.findFirst({
      where: { userId: user.id, schoolId: demoSchool.id },
    })
    if (!existingAudit) {
      await db.auditLog.create({
        data: {
          schoolId: demoSchool.id,
          userId: user.id,
          userName: user.displayName,
          userRole: user.role,
          action: 'LOGIN',
          entityType: 'SESSION',
          description: 'Connexion démo',
          metadata: JSON.stringify({ demo: true }),
        },
      })
      console.log(`   ✓ Audit créé pour ${user.role}`)
    } else {
      console.log(`   → ${user.role} déjà lié via audit`)
    }
  }

  // Vérification finale
  console.log('\n' + '═'.repeat(50))
  console.log('✅ LIAISON TERMINÉE')
  console.log('═'.repeat(50))

  // Test : vérifier que getSchoolIdForUser trouve la bonne école pour chaque compte
  console.log('\n🔍 Vérification getSchoolIdForUser...')
  const { getSchoolIdForUser } = await import('../src/lib/school-context')
  for (const acc of [
    'director@demo.smartshule.com',
    'secretary@demo.smartshule.com',
    'teacher@demo.smartshule.com',
    'parent@demo.smartshule.com',
    'student@demo.smartshule.com',
    'accountant@demo.smartshule.com',
    'schooladmin@demo.smartshule.com',
    'sysadmin@demo.smartshule.com',
  ]) {
    const user = await db.user.findUnique({ where: { email: acc } })
    if (user) {
      const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
      const school = schoolId ? await db.school.findUnique({ where: { id: schoolId } }) : null
      const isDemoSchool = school?.id === demoSchool.id
      console.log(`   ${isDemoSchool ? '✓' : '✗'} ${acc} → ${school?.name || 'AUCUNE ÉCOLE'}`)
    }
  }

  await db.$disconnect()
}

main().catch((err) => {
  console.error('❌ Erreur:', err)
  process.exit(1)
})
