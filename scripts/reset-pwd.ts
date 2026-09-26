import { db } from '../src/lib/db'
import { hashPassword } from '../src/lib/auth'

async function main() {
  const email = 'sysadmin@demo.smartshule.com'
  const newPassword = process.argv[2] || 'demo123'
  
  console.log(`Reset password for ${email} → ${newPassword}`)
  const hash = await hashPassword(newPassword)
  console.log('New hash prefix:', hash.slice(0, 30))
  
  await db.user.update({
    where: { email },
    data: { passwordHash: hash }
  })
  
  // Vérification
  const updated = await db.user.findFirst({ where: { email } })
  console.log('Updated hash prefix:', updated?.passwordHash?.slice(0, 30))
  await db.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
