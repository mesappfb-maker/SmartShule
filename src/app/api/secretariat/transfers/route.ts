// API : Centre Transferts, Sorties, Réintégrations
// ============================================================
// GET : liste des transferts
// POST : créer, approuver, exécuter, annuler un transfert

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import { getSchoolIdForUser } from '@/lib/school-context'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
    if (user.role !== 'SECRETARY' && user.role !== 'DIRECTION' && user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
    }

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const url = new URL(req.url)
    const transferType = url.searchParams.get('transferType') // INCOMING | OUTGOING | VOLUNTARY_WITHDRAWAL | DEFINITIVE_EXIT | ADMINISTRATIVE_SUSPENSION | REINTEGRATION
    const status = url.searchParams.get('status')
    const studentId = url.searchParams.get('studentId')
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = parseInt(url.searchParams.get('limit') || '50', 10)

    const where: any = { schoolId }
    if (transferType) where.transferType = transferType
    if (status) where.status = status
    if (studentId) where.studentId = studentId

    const [transfers, total] = await Promise.all([
      db.transfer.findMany({
        where,
        include: {
          student: {
            select: {
              id: true, firstName: true, lastName: true, matricule: true, status: true,
              enrollments: { where: { status: 'ACTIVE' }, take: 1, select: { classroom: { select: { name: true } } } },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.transfer.count({ where }),
    ])

    // Stats
    const [pendingCount, executedCount, thisMonth] = await Promise.all([
      db.transfer.count({ where: { schoolId, status: 'PENDING' } }),
      db.transfer.count({ where: { schoolId, status: 'EXECUTED' } }),
      db.transfer.count({
        where: {
          schoolId,
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
    ])

    return NextResponse.json({
      ok: true,
      transfers: transfers.map((t) => ({
        id: t.id,
        studentId: t.studentId,
        studentName: `${t.student.firstName} ${t.student.lastName}`,
        matricule: t.student.matricule,
        studentStatus: t.student.status,
        classroomName: t.student.enrollments[0]?.classroom?.name || '—',
        transferType: t.transferType,
        originSchool: t.originSchool,
        destinationSchool: t.destinationSchool,
        reason: t.reason,
        effectiveDate: t.effectiveDate.toISOString(),
        status: t.status,
        requestedByName: t.requestedByName,
        approvedByName: t.approvedByName,
        approvedAt: t.approvedAt?.toISOString() || null,
        decisionReason: t.decisionReason,
        originalMatricule: t.originalMatricule,
        createdAt: t.createdAt.toISOString(),
      })),
      stats: { pending: pendingCount, executed: executedCount, thisMonth },
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error('[api/secretariat/transfers] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })

    const schoolId = await getSchoolIdForUser(user.id, user.email || undefined)
    if (!schoolId) return NextResponse.json({ ok: false, error: 'École introuvable.' }, { status: 404 })

    const body = await req.json()
    const { action } = body

    // Créer un transfert
    if (action === 'create') {
      if (user.role !== 'SECRETARY' && user.role !== 'DIRECTION' && user.role !== 'ADMIN') {
        return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
      }

      const { studentId, transferType, reason, effectiveDate, originSchool, destinationSchool, classroomId, academicYearId } = body
      if (!studentId || !transferType || !reason || !effectiveDate) {
        return NextResponse.json({ ok: false, error: 'studentId, transferType, reason et effectiveDate requis.' }, { status: 400 })
      }

      // Vérifier que l'élève existe
      const student = await db.student.findUnique({ where: { id: studentId } })
      if (!student || student.schoolId !== schoolId) {
        return NextResponse.json({ ok: false, error: 'Élève introuvable dans cet établissement.' }, { status: 404 })
      }

      // Vérifier qu'il n'y a pas déjà un transfert PENDING pour cet élève
      const existingPending = await db.transfer.findFirst({
        where: { studentId, status: 'PENDING' },
      })
      if (existingPending) {
        return NextResponse.json({ ok: false, error: 'Un transfert est déjà en attente pour cet élève.' }, { status: 409 })
      }

      const transfer = await db.transfer.create({
        data: {
          schoolId,
          studentId,
          transferType,
          reason,
          effectiveDate: new Date(effectiveDate),
          originSchool: originSchool || null,
          destinationSchool: destinationSchool || null,
          originalMatricule: student.matricule,
          classroomId: classroomId || null,
          academicYearId: academicYearId || null,
          status: 'PENDING',
          requestedById: user.id,
          requestedByName: user.displayName,
        },
      })

      // Créer une tâche admin
      await db.adminTask.create({
        data: {
          schoolId,
          studentId,
          title: `Transfert ${transferType === 'INCOMING' ? 'entrant' : transferType === 'OUTGOING' ? 'sortant' : transferType === 'REINTEGRATION' ? 'réintégration' : transferType}`,
          description: reason,
          category: 'TRANSFER',
          priority: 'URGENT',
          status: 'WAITING_DIRECTION',
          createdById: user.id,
          createdByName: user.displayName,
        },
      })

      return NextResponse.json({ ok: true, id: transfer.id, message: 'Transfert créé, en attente de validation' })
    }

    // Approuver un transfert (Direction uniquement)
    if (action === 'approve') {
      if (user.role !== 'DIRECTION' && user.role !== 'ADMIN') {
        return NextResponse.json({ ok: false, error: 'Seul le directeur peut approuver un transfert.' }, { status: 403 })
      }

      const { transferId, decisionReason } = body
      if (!transferId) return NextResponse.json({ ok: false, error: 'transferId requis.' }, { status: 400 })

      const transfer = await db.transfer.findUnique({ where: { id: transferId } })
      if (!transfer || transfer.schoolId !== schoolId) {
        return NextResponse.json({ ok: false, error: 'Transfert introuvable.' }, { status: 404 })
      }
      if (transfer.status !== 'PENDING') {
        return NextResponse.json({ ok: false, error: 'Le transfert n\'est pas en attente.' }, { status: 400 })
      }

      await db.transfer.update({
        where: { id: transferId },
        data: {
          status: 'APPROVED',
          approvedById: user.id,
          approvedByName: user.displayName,
          approvedAt: new Date(),
          decisionReason: decisionReason || null,
        },
      })

      return NextResponse.json({ ok: true, message: 'Transfert approuvé' })
    }

    // Exécuter un transfert
    if (action === 'execute') {
      if (user.role !== 'SECRETARY' && user.role !== 'DIRECTION' && user.role !== 'ADMIN') {
        return NextResponse.json({ ok: false, error: 'Accès non autorisé.' }, { status: 403 })
      }

      const { transferId } = body
      if (!transferId) return NextResponse.json({ ok: false, error: 'transferId requis.' }, { status: 400 })

      const transfer = await db.transfer.findUnique({ where: { id: transferId } })
      if (!transfer || transfer.schoolId !== schoolId) {
        return NextResponse.json({ ok: false, error: 'Transfert introuvable.' }, { status: 404 })
      }
      if (transfer.status !== 'APPROVED') {
        return NextResponse.json({ ok: false, error: 'Le transfert doit être approuvé avant exécution.' }, { status: 400 })
      }

      // Mettre à jour le statut du transfert
      await db.transfer.update({
        where: { id: transferId },
        data: { status: 'EXECUTED' },
      })

      // Mettre à jour le statut de l'élève selon le type
      if (transfer.transferType === 'OUTGOING' || transfer.transferType === 'VOLUNTARY_WITHDRAWAL' || transfer.transferType === 'DEFINITIVE_EXIT') {
        await db.student.update({
          where: { id: transfer.studentId },
          data: { status: 'TRANSFERRED' },
        })
        // Désactiver les inscriptions actives
        await db.enrollment.updateMany({
          where: { studentId: transfer.studentId, status: 'ACTIVE' },
          data: { status: 'TRANSFERRED' },
        })
      } else if (transfer.transferType === 'ADMINISTRATIVE_SUSPENSION') {
        await db.student.update({
          where: { id: transfer.studentId },
          data: { status: 'ARCHIVED' },
        })
      } else if (transfer.transferType === 'REINTEGRATION') {
        await db.student.update({
          where: { id: transfer.studentId },
          data: { status: 'ACTIVE' },
        })
        // Recréer l'inscription si classroomId fourni
        if (transfer.classroomId && transfer.academicYearId) {
          await db.enrollment.create({
            data: {
              studentId: transfer.studentId,
              classroomId: transfer.classroomId,
              academicYearId: transfer.academicYearId,
              status: 'ACTIVE',
            },
          })
        }
      }

      // Marquer la tâche admin comme DONE
      await db.adminTask.updateMany({
        where: { studentId: transfer.studentId, category: 'TRANSFER', status: 'WAITING_DIRECTION' },
        data: { status: 'DONE', completedAt: new Date() },
      })

      return NextResponse.json({ ok: true, message: 'Transfert exécuté' })
    }

    // Annuler un transfert
    if (action === 'cancel') {
      const { transferId, decisionReason } = body
      if (!transferId) return NextResponse.json({ ok: false, error: 'transferId requis.' }, { status: 400 })

      await db.transfer.update({
        where: { id: transferId },
        data: { status: 'CANCELLED', decisionReason: decisionReason || 'Annulé' },
      })

      return NextResponse.json({ ok: true, message: 'Transfert annulé' })
    }

    return NextResponse.json({ ok: false, error: `Action "${action}" inconnue.` }, { status: 400 })
  } catch (err) {
    console.error('[api/secretariat/transfers POST] Error:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
