// SmartShule — Audit complet des routes API + pages UI
// ============================================================
// Teste toutes les routes principales pour chaque rôle
// Identifie les erreurs 500, 403 injustifiés, et pages vides

import { db } from '../src/lib/db'

interface RouteTest {
  route: string
  role: string
  expectedStatus: number
  actualStatus?: number
  method: 'GET' | 'POST'
  body?: any
  ok: boolean
  error?: string
}

const BASE = 'http://localhost:3000'

const ROUTES: RouteTest[] = [
  // Auth
  { route: '/api/auth/login', role: 'public', expectedStatus: 200, method: 'POST', body: { email: 'director@demo.smartshule.com', password: 'Demo2026!' } },
  { route: '/api/health', role: 'public', expectedStatus: 200, method: 'GET' },

  // Director routes
  { route: '/api/secretariat/dashboard', role: 'director', expectedStatus: 200, method: 'GET' },
  { route: '/api/secretariat/admissions', role: 'director', expectedStatus: 200, method: 'GET' },
  { route: '/api/secretariat/absences', role: 'director', expectedStatus: 200, method: 'GET' },
  { route: '/api/secretariat/communications', role: 'director', expectedStatus: 200, method: 'GET' },
  { route: '/api/secretariat/documents', role: 'director', expectedStatus: 200, method: 'GET' },
  { route: '/api/secretariat/enrollments', role: 'director', expectedStatus: 200, method: 'GET' },
  { route: '/api/secretariat/reports', role: 'director', expectedStatus: 200, method: 'GET' },
  { route: '/api/secretariat/search?q=test', role: 'director', expectedStatus: 200, method: 'GET' },
  { route: '/api/secretariat/tasks', role: 'director', expectedStatus: 200, method: 'GET' },
  { route: '/api/secretariat/transfers', role: 'director', expectedStatus: 200, method: 'GET' },
  { route: '/api/accountant/dashboard', role: 'director', expectedStatus: 200, method: 'GET' },
  { route: '/api/accountant', role: 'director', expectedStatus: 200, method: 'GET' },
  { route: '/api/exports/students?format=csv', role: 'director', expectedStatus: 200, method: 'GET' },
  { route: '/api/exports/journal-entries', role: 'director', expectedStatus: 200, method: 'GET' },
  { route: '/api/direction/setup', role: 'director', expectedStatus: 200, method: 'GET' },
  { route: '/api/direction/classrooms', role: 'director', expectedStatus: 200, method: 'GET' },
  { route: '/api/direction/audit-data', role: 'director', expectedStatus: 200, method: 'GET' },
  { route: '/api/documents/types', role: 'director', expectedStatus: 200, method: 'GET' },
  { route: '/api/notifications/templates', role: 'director', expectedStatus: 200, method: 'GET' },
  { route: '/api/notifications/log', role: 'director', expectedStatus: 200, method: 'GET' },
  { route: '/api/notifications/consent', role: 'director', expectedStatus: 200, method: 'GET' },
  { route: '/api/notifications/config', role: 'director', expectedStatus: 200, method: 'GET' },
  { route: '/api/sync/status', role: 'director', expectedStatus: 200, method: 'GET' },
  { route: '/api/sync/conflicts', role: 'director', expectedStatus: 200, method: 'GET' },

  // Secretary routes
  { route: '/api/secretariat/dashboard', role: 'secretary', expectedStatus: 200, method: 'GET' },
  { route: '/api/secretariat/admissions', role: 'secretary', expectedStatus: 200, method: 'GET' },
  { route: '/api/secretariat/absences', role: 'secretary', expectedStatus: 200, method: 'GET' },
  { route: '/api/secretariat/communications', role: 'secretary', expectedStatus: 200, method: 'GET' },
  { route: '/api/secretariat/documents', role: 'secretary', expectedStatus: 200, method: 'GET' },
  { route: '/api/secretariat/enrollments', role: 'secretary', expectedStatus: 200, method: 'GET' },
  { route: '/api/secretariat/reports', role: 'secretary', expectedStatus: 200, method: 'GET' },
  { route: '/api/secretariat/tasks', role: 'secretary', expectedStatus: 200, method: 'GET' },
  { route: '/api/secretariat/transfers', role: 'secretary', expectedStatus: 200, method: 'GET' },

  // Accountant routes
  { route: '/api/accountant/dashboard', role: 'accountant', expectedStatus: 200, method: 'GET' },
  { route: '/api/accountant', role: 'accountant', expectedStatus: 200, method: 'GET' },
  { route: '/api/accountant/bulletins', role: 'accountant', expectedStatus: 200, method: 'GET' },

  // Teacher routes
  { route: '/api/secretariat/dashboard', role: 'teacher', expectedStatus: 403, method: 'GET' }, // Teacher blocked from secretary

  // Parent routes
  { route: '/api/secretariat/dashboard', role: 'parent', expectedStatus: 403, method: 'GET' }, // Parent blocked from secretary

  // Student routes
  { route: '/api/secretariat/dashboard', role: 'student', expectedStatus: 403, method: 'GET' }, // Student blocked from secretary
]

async function login(role: string): Promise<string> {
  if (role === 'public') return ''
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `${role}@demo.smartshule.com`, password: 'Demo2026!' }),
  })
  const cookie = res.headers.get('set-cookie') || ''
  return cookie.split(';')[0]
}

async function testRoute(test: RouteTest, cookie: string): Promise<RouteTest> {
  try {
    const res = await fetch(`${BASE}${test.route}`, {
      method: test.method,
      headers: {
        'Cookie': cookie,
        'Content-Type': 'application/json',
      },
      body: test.body ? JSON.stringify(test.body) : undefined,
    })
    test.actualStatus = res.status
    // Accepter 200 ou 403 selon le contexte
    if (test.expectedStatus === 200) {
      test.ok = res.status === 200
    } else {
      test.ok = res.status === test.expectedStatus
    }
    if (!test.ok && res.status === 500) {
      const text = await res.text()
      test.error = text.slice(0, 200)
    }
  } catch (err) {
    test.actualStatus = 0
    test.ok = false
    test.error = (err as Error).message
  }
  return test
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║  SmartShule — Audit Complet Routes API                   ║')
  console.log('╚══════════════════════════════════════════════════════════╝\n')

  const results: RouteTest[] = []
  const cookies: Record<string, string> = {}

  // Login pour chaque rôle
  const roles = ['director', 'secretary', 'accountant', 'teacher', 'parent', 'student']
  for (const role of roles) {
    cookies[role] = await login(role)
    console.log(`  Login ${role}: ${cookies[role] ? 'OK' : 'FAIL'}`)
  }

  // Tester chaque route
  console.log('\nTest des routes:')
  for (const test of ROUTES) {
    const cookie = cookies[test.role] || ''
    const result = await testRoute(test, cookie)
    results.push(result)
    const icon = result.ok ? '✓' : '✗'
    console.log(`  ${icon} [${result.role.padEnd(10)}] ${result.method} ${result.route} → ${result.actualStatus} ${result.error ? '(ERROR: ' + result.error.slice(0, 80) + ')' : ''}`)
  }

  // Résumé
  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length
  const errors500 = results.filter((r) => r.actualStatus === 500).length

  console.log('\n' + '═'.repeat(60))
  console.log(`Total: ${results.length} | PASS: ${passed} | FAIL: ${failed} | 500-errors: ${errors500}`)
  console.log('═'.repeat(60))

  if (failed > 0) {
    console.log('\nÉchecs:')
    for (const r of results.filter((r) => !r.ok)) {
      console.log(`  ✗ [${r.role}] ${r.method} ${r.route} → ${r.actualStatus} ${r.error || ''}`)
    }
  }

  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Erreur fatale:', err)
  process.exit(1)
})
