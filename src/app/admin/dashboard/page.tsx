// SmartShule — Dashboard central admin (Fabrice)
// ============================================================
// Stats globales : nb écoles, nb licences, revenus, etc.

import { db } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, KeyRound, CheckCircle2, XCircle, Clock, DollarSign } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function AdminDashboardPage() {
  // Stats séquentielles (anti EMAXCONNSESSION)
  const totalSchools = await db.school.count().catch(() => 0)
  const totalLicenses = await db.license.count().catch(() => 0)
  const activeLicenses = await db.license.count({ where: { status: 'ACTIVE' } }).catch(() => 0)
  const pendingLicenses = await db.license.count({ where: { status: 'PENDING' } }).catch(() => 0)
  const expiredLicenses = await db.license.count({ where: { status: 'EXPIRED' } }).catch(() => 0)
  const revokedLicenses = await db.license.count({ where: { status: 'REVOKED' } }).catch(() => 0)

  // Revenus estimés (1 licence active = 250 000 FC/an en moyenne)
  const estimatedRevenue = activeLicenses * 250000

  const stats = [
    { label: 'Écoles clientes', value: totalSchools, icon: Building2, color: 'text-blue-600' },
    { label: 'Licences émises', value: totalLicenses, icon: KeyRound, color: 'text-purple-600' },
    { label: 'Licences actives', value: activeLicenses, icon: CheckCircle2, color: 'text-green-600' },
    { label: 'En attente d\'activation', value: pendingLicenses, icon: Clock, color: 'text-orange-600' },
    { label: 'Licences expirées', value: expiredLicenses, icon: XCircle, color: 'text-red-600' },
    { label: 'Revenus annuels estimés', value: `${(estimatedRevenue / 1000).toFixed(0)}k FC`, icon: DollarSign, color: 'text-emerald-600' },
  ]

  // Licences récentes
  const recentLicenses = await db.license.findMany({
    orderBy: { issuedAt: 'desc' },
    take: 5,
  }).catch(() => [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Vue d'ensemble de votre activité SmartShule</p>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {stats.map((stat, i) => {
          const Icon = stat.icon
          return (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Licences récentes</CardTitle>
        </CardHeader>
        <CardContent>
          {recentLicenses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune licence émise pour le moment.
              <br />
              <a href="/admin/licenses" className="text-primary hover:underline">Générer la première licence →</a>
            </p>
          ) : (
            <div className="space-y-2">
              {recentLicenses.map(l => (
                <div key={l.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <p className="font-mono text-sm font-medium">{l.licenseKey}</p>
                    <p className="text-xs text-muted-foreground">{l.clientName} ({l.clientEmail})</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{new Date(l.issuedAt).toLocaleDateString('fr-FR')}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      l.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                      l.status === 'PENDING' ? 'bg-orange-100 text-orange-700' :
                      l.status === 'EXPIRED' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {l.status}
                    </span>
                  </div>
                </div>
              ))}
              <a href="/admin/licenses" className="block text-center text-sm text-primary hover:underline mt-3">
                Voir toutes les licences →
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actions rapides</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <a href="/admin/licenses" className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90">
            Gérer les licences
          </a>
          <a href="/admin/schools" className="px-4 py-2 border rounded-md text-sm hover:bg-muted/50">
            Gérer les écoles
          </a>
          <a href="/" target="_blank" className="px-4 py-2 border rounded-md text-sm hover:bg-muted/50">
            Voir le site démo
          </a>
        </CardContent>
      </Card>
    </div>
  )
}
