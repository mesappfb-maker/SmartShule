// SmartShule — /dashboard redirige vers / (tout est sur une seule page)
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  redirect('/')
}
