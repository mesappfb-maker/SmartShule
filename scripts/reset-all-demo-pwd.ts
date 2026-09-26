import { db } from '../src/lib/db'
import { hashPassword } from '../src/lib/auth'

async function main() {
  const newPassword = 'demo123'
  const hash = await hashPassword(newPassword)
  
  const result = await db.user.updateMany({
    where: { email: { contains: '@demo.smartshule.com' } },
    data: { passwordHash: hash }
  })
  console.log(`${result.count} utilisateurs démo mis à jour avec mot de passe "${newPassword}"`)
  
  // Also reset admin@smartshule
  const adminResult = await db.user.updateMany({
    where: { email: 'admin@smartshule.com' },
    data: { passwordHash: hash }
  }).catch(() => ({ count: 0 }))
  console.log(`${adminResult.count} admin mis à jour`)
  
  await db.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
