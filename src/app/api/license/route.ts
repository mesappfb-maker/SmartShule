// SmartShule — API Gestion des Licences
// ============================================================
// Actions :
//   - create-license : crée une licence pour une école cliente
//   - generate-code : génère un code d'activation pour une licence
//   - verify-license : vérifie une licence (appelé par l'app desktop)
//   - activate : active une licence avec un code (appelé par l'app desktop)
//   - list-licenses : liste toutes les licences (promoteur)
//   - suspend / revoke : suspendre ou révoquer une licence

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { logAudit, getClientIP } from '@/lib/audit'
import { headers } from 'next/headers'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ============================================================
// Générateurs de codes
// ============================================================

function generateLicenseKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Pas de 0, O, 1, I (confusion)
  const segments: string[] = []
  for (let s = 0; s < 5; s++) {
    let seg = ''
    for (let i = 0; i < 4; i++) {
      seg += chars[Math.floor(Math.random() * chars.length)]
    }
    segments.push(seg)
  }
  return segments.join('-')
}

function generateActivationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const parts: string[] = []
  for (let p = 0; p < 3; p++) {
    let part = ''
    for (let i = 0; i < 6; i++) {
      part += chars[Math.floor(Math.random() * chars.length)]
    }
    parts.push(part)
  }
  return `AC-${parts.join('-')}`
}

function generateMachineId(): string {
  // En production desktop, ce sera basé sur hardware (CPU + MAC + disk)
  // Ici on génère un hash aléatoire pour la démo web
  return crypto.randomBytes(16).toString('hex')
}

// ============================================================
// POST : actions dispatch
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    const h = await headers()
    const ip = getClientIP(h)

    switch (action) {
      // ============================================================
      // CRÉER UNE LICENCE (Promoteur only)
      // ============================================================
      case 'create-license': {
        const user = await getUserFromSession()
        if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
        if (user.role !== 'ADMIN') {
          return NextResponse.json({ ok: false, error: 'Réservé au Promoteur.' }, { status: 403 })
        }

        const { clientName, clientEmail, clientPhone, clientCity, clientCountry, planType, maxStudents, maxDirections, modules, durationMonths, notes } = body
        if (!clientName || !clientEmail) {
          return NextResponse.json({ ok: false, error: 'Nom et email du client obligatoires.' }, { status: 400 })
        }

        // Générer clé unique
        let licenseKey = generateLicenseKey()
        let existing = await db.license.findUnique({ where: { licenseKey } })
        while (existing) {
          licenseKey = generateLicenseKey()
          existing = await db.license.findUnique({ where: { licenseKey } })
        }

        // Calculer expiration
        let expiresAt: Date | null = null
        if (planType !== 'LIFETIME' && durationMonths) {
          expiresAt = new Date()
          expiresAt.setMonth(expiresAt.getMonth() + durationMonths)
        }

        const license = await db.license.create({
          data: {
            licenseKey,
            clientName,
            clientEmail,
            clientPhone: clientPhone || null,
            clientCity: clientCity || null,
            clientCountry: clientCountry || 'RDC',
            planType: planType || 'ANNUAL',
            maxStudents: maxStudents || 500,
            maxDirections: maxDirections || 3,
            modules: modules || 'ALL',
            expiresAt,
            status: 'PENDING',
            createdById: user.id,
            createdByName: user.displayName,
            notes: notes || null,
          },
        })

        await logAudit({
          userId: user.id, userName: user.displayName, userRole: user.role,
          action: 'CREATE', entityType: 'OTHER', entityId: license.id,
          description: `Licence créée : ${licenseKey} pour ${clientName}`,
          ipAddress: ip,
        })

        return NextResponse.json({
          ok: true,
          licenseKey,
          licenseId: license.id,
          message: `Licence créée pour ${clientName}. Clé : ${licenseKey}`,
        })
      }

      // ============================================================
      // GÉNÉRER UN CODE D'ACTIVATION (Promoteur only)
      // ============================================================
      case 'generate-code': {
        const user = await getUserFromSession()
        if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
        if (user.role !== 'ADMIN') {
          return NextResponse.json({ ok: false, error: 'Réservé au Promoteur.' }, { status: 403 })
        }

        const { licenseId, codeType, validDays } = body
        if (!licenseId) return NextResponse.json({ ok: false, error: 'licenseId obligatoire.' }, { status: 400 })

        const license = await db.license.findUnique({ where: { id: licenseId } })
        if (!license) return NextResponse.json({ ok: false, error: 'Licence introuvable.' }, { status: 404 })

        // Générer code unique
        let code = generateActivationCode()
        let existingCode = await db.activationCode.findUnique({ where: { code } })
        while (existingCode) {
          code = generateActivationCode()
          existingCode = await db.activationCode.findUnique({ where: { code } })
        }

        let expiresAt: Date | null = null
        if (validDays) {
          expiresAt = new Date()
          expiresAt.setDate(expiresAt.getDate() + validDays)
        }

        const activationCode = await db.activationCode.create({
          data: {
            licenseId,
            code,
            codeType: codeType || 'ACTIVATION',
            expiresAt,
          },
        })

        return NextResponse.json({
          ok: true,
          code,
          activationCodeId: activationCode.id,
          message: `Code d'activation généré : ${code}`,
        })
      }

      // ============================================================
      // ACTIVER UNE LICENCE (appelé par l'app desktop)
      // ============================================================
      case 'activate': {
        const { licenseKey, activationCode, machineId, machineName } = body
        if (!licenseKey || !activationCode) {
          return NextResponse.json({ ok: false, error: 'Clé de licence et code d\'activation obligatoires.' }, { status: 400 })
        }

        const license = await db.license.findUnique({ where: { licenseKey } })
        if (!license) {
          return NextResponse.json({ ok: false, error: 'Clé de licence invalide.' }, { status: 404 })
        }

        if (license.status === 'REVOKED') {
          return NextResponse.json({ ok: false, error: 'Cette licence a été révoquée.' }, { status: 403 })
        }

        if (license.status === 'ACTIVE' && license.machineId && license.machineId !== machineId) {
          return NextResponse.json({
            ok: false,
            error: `Cette licence est déjà activée sur un autre ordinateur (${license.machineName}). Contactez le fournisseur.`,
          }, { status: 403 })
        }

        // Vérifier le code d'activation
        const code = await db.activationCode.findUnique({ where: { code: activationCode } })
        if (!code) {
          return NextResponse.json({ ok: false, error: 'Code d\'activation invalide.' }, { status: 404 })
        }

        if (code.licenseId !== license.id) {
          return NextResponse.json({ ok: false, error: 'Ce code d\'activation ne correspond pas à cette licence.' }, { status: 403 })
        }

        if (code.isUsed) {
          return NextResponse.json({ ok: false, error: 'Ce code d\'activation a déjà été utilisé.' }, { status: 403 })
        }

        if (code.expiresAt && code.expiresAt < new Date()) {
          return NextResponse.json({ ok: false, error: 'Ce code d\'activation a expiré.' }, { status: 403 })
        }

        // Activer
        await db.$transaction(async (tx) => {
          await tx.license.update({
            where: { id: license.id },
            data: {
              status: 'ACTIVE',
              activatedAt: new Date(),
              machineId: machineId || null,
              machineName: machineName || null,
              activationCount: { increment: 1 },
            },
          })

          await tx.activationCode.update({
            where: { id: code.id },
            data: {
              isUsed: true,
              usedAt: new Date(),
              usedByMachine: machineId || null,
            },
          })

          await tx.licenseAudit.create({
            data: {
              licenseId: license.id,
              action: 'ACTIVATED',
              machineId: machineId || null,
              machineName: machineName || null,
              ipAddress: ip,
              details: `Licence activée avec le code ${activationCode}`,
            },
          })
        })

        return NextResponse.json({
          ok: true,
          message: 'Licence activée avec succès !',
          license: {
            licenseKey: license.licenseKey,
            clientName: license.clientName,
            planType: license.planType,
            maxStudents: license.maxStudents,
            expiresAt: license.expiresAt?.toISOString() || null,
            modules: license.modules,
          },
        })
      }

      // ============================================================
      // VÉRIFIER UNE LICENCE (appelé par l'app desktop au démarrage)
      // ============================================================
      case 'verify': {
        const { licenseKey, machineId } = body
        if (!licenseKey) {
          return NextResponse.json({ ok: false, error: 'Clé de licence obligatoire.' }, { status: 400 })
        }

        const license = await db.license.findUnique({ where: { licenseKey } })
        if (!license) {
          return NextResponse.json({ ok: false, error: 'Licence introuvable.' }, { status: 404 })
        }

        // Vérifier statut
        if (license.status === 'REVOKED') {
          return NextResponse.json({ ok: false, error: 'Licence révoquée.' }, { status: 403 })
        }
        if (license.status === 'SUSPENDED') {
          return NextResponse.json({ ok: false, error: 'Licence suspendue.' }, { status: 403 })
        }

        // Vérifier expiration
        if (license.expiresAt && license.expiresAt < new Date()) {
          await db.license.update({ where: { id: license.id }, data: { status: 'EXPIRED' } })
          await db.licenseAudit.create({
            data: {
              licenseId: license.id,
              action: 'EXPIRED',
              machineId: machineId || null,
              ipAddress: ip,
              details: 'Licence expirée',
            },
          })
          return NextResponse.json({ ok: false, error: 'Licence expirée.' }, { status: 403 })
        }

        // Vérifier machine
        if (license.machineId && machineId && license.machineId !== machineId) {
          return NextResponse.json({
            ok: false,
            error: `Licence liée à un autre ordinateur (${license.machineName}).`,
          }, { status: 403 })
        }

        // Audit vérification
        await db.licenseAudit.create({
          data: {
            licenseId: license.id,
            action: 'VERIFIED',
            machineId: machineId || null,
            ipAddress: ip,
            success: true,
          },
        })

        return NextResponse.json({
          ok: true,
          license: {
            licenseKey: license.licenseKey,
            clientName: license.clientName,
            planType: license.planType,
            maxStudents: license.maxStudents,
            maxDirections: license.maxDirections,
            modules: license.modules,
            status: license.status,
            expiresAt: license.expiresAt?.toISOString() || null,
          },
        })
      }

      // ============================================================
      // SUSPENDRE / RÉVOQUER (Promoteur only)
      // ============================================================
      case 'suspend': {
        const user = await getUserFromSession()
        if (!user || user.role !== 'ADMIN') {
          return NextResponse.json({ ok: false, error: 'Réservé au Promoteur.' }, { status: 403 })
        }
        const { licenseId, reason } = body
        await db.license.update({ where: { id: licenseId }, data: { status: 'SUSPENDED' } })
        await db.licenseAudit.create({
          data: { licenseId, action: 'SUSPENDED', details: reason || 'Suspendue par le promoteur', ipAddress: ip },
        })
        return NextResponse.json({ ok: true, message: 'Licence suspendue' })
      }

      case 'revoke': {
        const user = await getUserFromSession()
        if (!user || user.role !== 'ADMIN') {
          return NextResponse.json({ ok: false, error: 'Réservé au Promoteur.' }, { status: 403 })
        }
        const { licenseId, reason } = body
        await db.license.update({ where: { id: licenseId }, data: { status: 'REVOKED' } })
        await db.licenseAudit.create({
          data: { licenseId, action: 'REVOKED', details: reason || 'Révoquée par le promoteur', ipAddress: ip },
        })
        return NextResponse.json({ ok: true, message: 'Licence révoquée' })
      }

      default:
        return NextResponse.json({ ok: false, error: `Action "${action}" inconnue.` }, { status: 400 })
    }
  } catch (err) {
    console.error('[api/license] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

// ============================================================
// GET : liste des licences (Promoteur)
// ============================================================

export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'Réservé au Promoteur.' }, { status: 403 })
    }

    const licenses = await db.license.findMany({
      include: {
        _count: { select: { activations: true, audits: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      ok: true,
      licenses: licenses.map((l) => ({
        id: l.id,
        licenseKey: l.licenseKey,
        clientName: l.clientName,
        clientEmail: l.clientEmail,
        clientPhone: l.clientPhone,
        clientCity: l.clientCity,
        planType: l.planType,
        maxStudents: l.maxStudents,
        modules: l.modules,
        status: l.status,
        machineName: l.machineName,
        activatedAt: l.activatedAt?.toISOString() || null,
        expiresAt: l.expiresAt?.toISOString() || null,
        activationCodesCount: l._count.activations,
        auditCount: l._count.audits,
        createdAt: l.createdAt.toISOString(),
      })),
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
