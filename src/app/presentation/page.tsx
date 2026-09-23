// SmartShule — Page de présentation marketing (séparée de l'app)
// ============================================================

import { db } from '@/lib/db'
import { LandingPage } from '@/modules/landing/landing-page'

export const dynamic = 'force-dynamic'

export default async function PresentationPage() {
  const school = await db.school.findFirst({
    select: {
      id: true, name: true, slogan: true,
      primaryColor: true, secondaryColor: true, tertiaryColor: true,
      address: true, phone: true, email: true,
    },
  })
  return <LandingPage school={school} />
}
