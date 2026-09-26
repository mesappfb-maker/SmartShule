import { db } from '../src/lib/db'
import { verifyPassword } from '../src/lib/auth'

async function main() {
  const user = await db.user.findFirst({ where: { email: 'fabricefb@gmail.com' } })
  if (!user) { console.log('❌ Utilisateur non trouvé'); return }
  console.log('Email:', user.email)
  console.log('Rôle:', user.role)
  console.log('Hash prefix:', user.passwordHash?.slice(0, 30))
  console.log('Hash length:', user.passwordHash?.length)
  
  // Test vérification directe
  const valid = await verifyPassword('Wazengafb@007', user.passwordHash)
  console.log('Test verifyPassword("Wazengafb@007"):', valid)
  
  await db.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
