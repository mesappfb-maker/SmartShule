// API : Seed Démo Complet (14 rôles + 100 élèves)
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({
        ok: false,
        error: 'Seed démo refusé en production.',
      }, { status: 403 })
    }

    const seedSecret = process.env.SEED_SECRET
    if (seedSecret) {
      const provided = req.headers.get('x-seed-secret')
      if (provided !== seedSecret) {
        return NextResponse.json({ ok: false, error: 'Non autorisé.' }, { status: 401 })
      }
    }

    const body = await req.json().catch(() => ({}))
    const shouldReset = body?.reset === true

    const cmd = shouldReset
      ? 'npx tsx scripts/seed-demo.ts --reset'
      : 'npx tsx scripts/seed-demo.ts'

    const { stdout, stderr } = await execAsync(cmd, {
      cwd: process.cwd(),
      timeout: 240000,
      env: { ...process.env },
    })

    return NextResponse.json({
      ok: true,
      message: 'Seed démo terminé',
      output: stdout.slice(-2000),
      demoAccounts: [
        'sysadmin@demo.smartshule.com',
        'schooladmin@demo.smartshule.com',
        'director@demo.smartshule.com',
        'promoter@demo.smartshule.com',
        'secretary@demo.smartshule.com',
        'admissions@demo.smartshule.com',
        'accountant@demo.smartshule.com',
        'cashier@demo.smartshule.com',
        'hrmanager@demo.smartshule.com',
        'payroll@demo.smartshule.com',
        'teacher@demo.smartshule.com',
        'parent@demo.smartshule.com',
        'student@demo.smartshule.com',
        'auditor@demo.smartshule.com',
      ],
      defaultPassword: 'Demo2026!',
    })
  } catch (err) {
    console.error('[api/seed-demo] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return POST(req)
}
