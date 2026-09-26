// SmartShule — Page gestion des écoles clientes
// ============================================================
// Liste des écoles installées avec bouton "Voir détail"

import { db } from '@/lib/db'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Building2, MapPin, Mail, Phone, Eye, Plus } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function SchoolsPage() {
  const schools = await db.school.findMany({
    orderBy: { name: 'asc' },
  }).catch(() => [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Écoles clientes</h1>
          <p className="text-sm text-muted-foreground">{schools.length} école(s) enregistrée(s)</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/licenses">
            <Plus className="h-4 w-4 mr-2" /> Associer une licence
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          {schools.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Aucune école enregistrée pour le moment.</p>
              <p className="text-xs mt-2">
                Les écoles apparaîtront ici une fois qu'elles auront activé leur licence via l'installateur.
              </p>
              <Button asChild className="mt-4" size="sm">
                <Link href="/admin/licenses">
                  <Plus className="h-4 w-4 mr-2" /> Générer une licence
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {schools.map(s => (
                <div key={s.id} className="p-4 rounded-lg border hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden shrink-0"
                        style={{ backgroundColor: s.primaryColor ? `${s.primaryColor}15` : '#f3f4f6' }}
                      >
                        {s.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.logoUrl} alt={s.name} className="w-full h-full object-contain" />
                        ) : (
                          <Building2 className="h-6 w-6" style={{ color: s.primaryColor || '#2563EB' }} />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold">{s.name}</p>
                        {s.slogan && <p className="text-xs text-muted-foreground">{s.slogan}</p>}
                      </div>
                    </div>
                    <Badge variant="outline">{s.currency}</Badge>
                  </div>

                  <div className="space-y-1 text-xs text-muted-foreground mb-4">
                    {s.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3 w-3" /> {s.address}
                      </div>
                    )}
                    {s.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3" /> {s.email}
                      </div>
                    )}
                    {s.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3" /> {s.phone}
                      </div>
                    )}
                  </div>

                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href={`/admin/schools/${s.id}`}>
                      <Eye className="h-4 w-4 mr-2" /> Voir le détail
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
