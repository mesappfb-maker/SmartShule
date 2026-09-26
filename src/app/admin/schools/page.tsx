// SmartShule — Page gestion des écoles clientes
// ============================================================
// Liste des écoles installées + leur statut

import { db } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, MapPin, Mail, Phone } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function SchoolsPage() {
  const schools = await db.school.findMany({
    orderBy: { name: 'asc' },
  }).catch(() => [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Écoles clientes</h1>
        <p className="text-sm text-muted-foreground">{schools.length} école(s) enregistrée(s)</p>
      </div>

      <Card>
        <CardContent className="p-6">
          {schools.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Aucune école enregistrée.</p>
              <p className="text-xs mt-2">Les écoles apparaîtront ici une fois qu'elles auront activé leur licence.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {schools.map(s => (
                <div key={s.id} className="p-4 rounded-lg border hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold">{s.name}</p>
                      {s.slogan && <p className="text-xs text-muted-foreground">{s.slogan}</p>}
                    </div>
                    <Badge variant="outline">{s.currency}</Badge>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
