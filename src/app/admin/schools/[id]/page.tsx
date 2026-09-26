// SmartShule — Page détail d'une école cliente
// ============================================================
// /admin/schools/[id] — Affiche toutes les infos d'une école :
// - Infos générales (nom, slogan, adresse, contact)
// - Branding (couleurs, logo)
// - Licences associées
// - Statistiques (utilisateurs, élèves, employés)
// - Bouton modifier

import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft, Building2, Mail, Phone, MapPin, Calendar, Users,
  KeyRound, GraduationCap, Briefcase, Palette, Edit, ExternalLink,
} from 'lucide-react'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function SchoolDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const school = await db.school.findUnique({
    where: { id: params.id },
  }).catch(() => null)

  if (!school) {
    notFound()
  }

  // Récupère les licences associées (séquentiel — anti EMAXCONNSESSION)
  const licenses = await db.license.findMany({
    where: { schoolId: school.id },
    orderBy: { issuedAt: 'desc' },
  }).catch(() => [])

  // Statistiques
  const userCount = await db.user.count().catch(() => 0) // pas de schoolId sur User
  const studentCount = await db.student.count({ where: { schoolId: school.id } }).catch(() => 0)
  const employeeCount = await db.employee.count({ where: { schoolId: school.id } }).catch(() => 0)
  const classroomCount = await db.directorate.count({ where: { schoolId: school.id } }).catch(() => 0)

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/schools" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="h-4 w-4" /> Retour aux écoles
          </Link>
          <h1 className="text-2xl font-bold">{school.name}</h1>
          {school.slogan && <p className="text-sm text-muted-foreground mt-1">{school.slogan}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/admin/schools/${school.id}/edit`}>
              <Edit className="h-4 w-4 mr-2" /> Modifier
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats rapides */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-950/30 rounded-md">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{userCount}</p>
                <p className="text-xs text-muted-foreground">Utilisateurs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-950/30 rounded-md">
                <GraduationCap className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{studentCount}</p>
                <p className="text-xs text-muted-foreground">Élèves</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-950/30 rounded-md">
                <Briefcase className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{employeeCount}</p>
                <p className="text-xs text-muted-foreground">Employés</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-950/30 rounded-md">
                <Building2 className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{classroomCount}</p>
                <p className="text-xs text-muted-foreground">Classes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Infos générales */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Informations générales
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-muted-foreground text-xs">Nom</p>
                <p className="font-medium">{school.name}</p>
              </div>
            </div>
            {school.slogan && (
              <div className="flex items-start gap-2">
                <Palette className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">Slogan</p>
                  <p className="font-medium">{school.slogan}</p>
                </div>
              </div>
            )}
            {school.address && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">Adresse</p>
                  <p className="font-medium">{school.address}</p>
                </div>
              </div>
            )}
            {school.email && (
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">Email</p>
                  <a href={`mailto:${school.email}`} className="font-medium text-primary hover:underline">{school.email}</a>
                </div>
              </div>
            )}
            {school.phone && (
              <div className="flex items-start gap-2">
                <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">Téléphone</p>
                  <p className="font-medium">{school.phone}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-muted-foreground text-xs">Membre depuis</p>
                <p className="font-medium">{new Date(school.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-muted-foreground text-xs">Devise</p>
                <p className="font-medium">{school.currency} · {school.locale}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Branding */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="h-5 w-5" /> Identité visuelle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg border-2 border-border overflow-hidden flex items-center justify-center"
                style={{ backgroundColor: school.primaryColor ? `${school.primaryColor}15` : '#f3f4f6' }}>
                {school.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={school.logoUrl} alt={school.name} className="w-full h-full object-contain" />
                ) : (
                  <Building2 className="h-8 w-8" style={{ color: school.primaryColor || '#2563EB' }} />
                )}
              </div>
              <div>
                <p className="font-medium text-sm">{school.name}</p>
                <p className="text-xs text-muted-foreground">{school.slogan || 'Pas de slogan'}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Primaire</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-md border" style={{ backgroundColor: school.primaryColor }} />
                  <code className="text-xs">{school.primaryColor}</code>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Secondaire</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-md border" style={{ backgroundColor: school.secondaryColor }} />
                  <code className="text-xs">{school.secondaryColor}</code>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Tertiaire</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-md border" style={{ backgroundColor: school.tertiaryColor }} />
                  <code className="text-xs">{school.tertiaryColor}</code>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Licences associées */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-5 w-5" /> Licences associées ({licenses.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {licenses.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <KeyRound className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucune licence associée à cette école</p>
              <Button asChild className="mt-4" size="sm">
                <Link href="/admin/licenses">
                  <KeyRound className="h-4 w-4 mr-2" /> Générer une licence
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {licenses.map(l => (
                <div key={l.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <p className="font-mono text-sm font-medium">{l.licenseKey}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.clientName} · {l.clientEmail}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant={l.status === 'ACTIVE' ? 'default' : l.status === 'PENDING' ? 'secondary' : 'destructive'}>
                      {l.status}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {l.expiresAt ? `Expire le ${new Date(l.expiresAt).toLocaleDateString('fr-FR')}` : 'À vie'}
                    </p>
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
