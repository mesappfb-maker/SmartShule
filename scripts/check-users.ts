import { db } from '../src/lib/db'
async function main() {
  const users = await db.user.findMany({
    where: { OR: [
      { email: { contains: 'demo.smartshule' } },
      { email: { contains: 'sysadmin' } },
      { email: { contains: 'promoter' } },
      { email: { contains: 'auditor' } },
    ] },
    select: { email: true, role: true, active: true, isDemoAccount: true }
  })
  console.log('Users:', JSON.stringify(users, null, 2))
  await db.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
