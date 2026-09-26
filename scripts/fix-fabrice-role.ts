// Corrige le rôle de fabricefb@gmail.com sur Vercel (via API Supabase)

const SUPABASE_URL = 'https://aws-0-eu-central-1.pooler.supabase.com'
const SUPABASE_DB = 'postgres'

async function main() {
  // On doit passer par une API route pour modifier le rôle
  // (pas d'accès direct à Supabase depuis ce script)
  
  const res = await fetch('https://smart-shule-seven.vercel.app/api/admin/seed-owner')
  const data = await res.json()
  console.log('État actuel :', JSON.stringify(data, null, 2))
}

main().catch(console.error)
