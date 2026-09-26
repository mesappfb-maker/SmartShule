import { db } from '../src/lib/db'
async function main() {
  console.log('=== Comptage par table ===')
  console.log(`Schools : ${await db.school.count()}`)
  console.log(`Users : ${await db.user.count()}`)
  console.log(`Demo accounts : ${await db.user.count({ where: { isDemoAccount: true } })}`)
  console.log(`Students : ${await db.student.count()}`)
  
  console.log('=== Test login admin@mon-ecole.cd ===')
  const admin = await db.user.findFirst({ where: { email: 'admin@mon-ecole.cd' } })
  console.log('Admin trouvé:', admin ? `${admin.email} (${admin.role})` : 'NON TROUVÉ')
  
  await db.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
