import { db } from '../src/lib/db'
async function main() {
  const user = await db.user.findFirst({ where: { email: 'sysadmin@demo.smartshule.com' } })
  if (!user) { console.log('NOT FOUND'); return }
  console.log('Email:', user.email)
  console.log('Role:', user.role)
  console.log('PasswordHash length:', user.passwordHash?.length)
  console.log('PasswordHash starts with $2:', user.passwordHash?.startsWith('$2'))
  // Affiche juste les 20 premiers chars pour ne pas exposer le hash
  console.log('Hash prefix:', user.passwordHash?.slice(0, 30))
  await db.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
