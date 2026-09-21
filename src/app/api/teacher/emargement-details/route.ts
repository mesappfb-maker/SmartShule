// SmartShule — API Route : Détails d'un émargement pour le portail prof
// Étape 4 RDC
//
// Retourne l'émargement + la liste des élèves avec leur IQA snapshot

import { NextRequest, NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth'
import { getEmargementDetails } from '@/lib/teacher-portal-queries-v2'

export async function GET(req: NextRequest) {
  const user = await getUserFromSession()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Session expirée.' }, { status: 401 })
  }

  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ ok: false, error: 'ID émargement manquant.' }, { status: 400 })
  }

  const details = await getEmargementDetails(id)
  if (!details) {
    return NextResponse.json({ ok: false, error: 'Émargement introuvable.' }, { status: 404 })
  }

  // Sérialisation : convertir les Date en ISO
  return NextResponse.json({
    ok: true,
    details: {
      ...details,
      emargement: {
        ...details.emargement,
        signatureAt: details.emargement.signatureAt.toISOString(),
        startDateTime: details.emargement.startDateTime.toISOString(),
        endDateTime: details.emargement.endDateTime.toISOString(),
      },
    },
  })
}
