'use client'

import * as React from 'react'
import { useActionState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { PageHeader } from '@/components/ss/page-header'
import { StatusBadge } from '@/components/ss/status-badge'
import { EmptyState } from '@/components/ss/empty-state'
import {
  User, Mail, Lock, Shield, Clock, Eye, EyeOff, Loader2, Save,
  KeyRound, History,
} from 'lucide-react'
import { updateProfileAction, changePasswordAction } from '@/lib/profile-actions'
import { formatDate, formatRelative, initials } from '@/lib/format'

export interface ProfileData {
  user: {
    id: string
    email: string
    displayName: string
    role: string
    active: boolean
    lastLoginAt: Date | null
    createdAt: Date
  }
  roleData: {
    type: string
    name?: string
    phone?: string | null
    address?: string | null
    profession?: string | null
    function?: string | null
    matricule?: string | null
  } | null
  recentAudits: Array<{
    id: string
    action: string
    description: string
    createdAt: Date
  }>
}

const ROLE_LABELS: Record<string, string> = {
  PARENT: 'Parent', STUDENT: 'Élève', DIRECTION: 'Direction',
  TEACHER: 'Enseignant', ACCOUNTANT: 'Comptable', SERVER: 'PromoServeur', ADMIN: 'Administrateur',
}

export function ProfilePage({ data, onBack }: { data: ProfileData; onBack: () => void }) {
  return (
    <div className="space-y-6">
      <PageHeader title="Mon profil" description="Gérez vos informations et votre sécurité"
        breadcrumbs={[{ label: 'Mon profil' }]}
        actions={<Button variant="outline" onClick={onBack}>← Retour</Button>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <ProfileCard data={data} />
          <PasswordCard />
        </div>
        <div className="space-y-6">
          <ActivityCard data={data} />
        </div>
      </div>
    </div>
  )
}

function ProfileCard({ data }: { data: ProfileData }) {
  const [state, formAction, isPending] = useActionState(updateProfileAction, null)
  React.useEffect(() => {
    if (state?.ok) toast.success('Profil mis à jour.')
    else if (state && !state.ok) toast.error(state.error)
  }, [state])
  const { user, roleData } = data
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-primary/10 text-primary text-xl">{initials(user.displayName)}</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-lg">{user.displayName}</CardTitle>
            <CardDescription>{ROLE_LABELS[user.role] || user.role}
              {roleData?.name && roleData.name !== user.displayName && ` · ${roleData.name}`}</CardDescription>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge variant={user.active ? 'success' : 'danger'} dot>{user.active ? 'Actif' : 'Désactivé'}</StatusBadge>
              {roleData?.matricule && <Badge variant="outline">{roleData.matricule}</Badge>}
              {roleData?.function && <Badge variant="outline">{roleData.function}</Badge>}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Nom affiché</Label>
              <Input id="displayName" name="displayName" defaultValue={user.displayName} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="email" name="email" type="email" defaultValue={user.email} required className="pl-9" />
              </div>
            </div>
          </div>
          {roleData?.phone !== undefined && (
            <div className="space-y-2"><Label>Téléphone</Label>
              <Input value={roleData.phone || '—'} disabled className="bg-muted/50" />
              <p className="text-xs text-muted-foreground">Géré par l'administration.</p></div>
          )}
          {roleData?.address && (
            <div className="space-y-2"><Label>Adresse</Label><Input value={roleData.address} disabled className="bg-muted/50" /></div>
          )}
          {roleData?.profession && (
            <div className="space-y-2"><Label>Profession</Label><Input value={roleData.profession} disabled className="bg-muted/50" /></div>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Enregistrer
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function PasswordCard() {
  const [state, formAction, isPending] = useActionState(changePasswordAction, null)
  const [showCurrent, setShowCurrent] = React.useState(false)
  const [showNew, setShowNew] = React.useState(false)
  const [showConfirm, setShowConfirm] = React.useState(false)
  React.useEffect(() => {
    if (state?.ok) { toast.success('Mot de passe changé.'); const f = document.getElementById('pwForm') as HTMLFormElement; if (f) f.reset(); }
    else if (state && !state.ok) toast.error(state.error)
  }, [state])
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" />
          <div><CardTitle className="text-base">Sécurité — Mot de passe</CardTitle>
          <CardDescription>Minimum 8 caractères.</CardDescription></div>
        </div>
      </CardHeader>
      <CardContent>
        <form id="pwForm" action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Mot de passe actuel</Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="currentPassword" name="currentPassword" type={showCurrent ? 'text' : 'password'} required placeholder="••••••••" className="pl-9 pr-10" />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground" tabIndex={-1}>{showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nouveau</Label>
              <div className="relative">
                <Input id="newPassword" name="newPassword" type={showNew ? 'text' : 'password'} required minLength={8} placeholder="••••••••" className="pr-10" />
                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground" tabIndex={-1}>{showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer</Label>
              <div className="relative">
                <Input id="confirmPassword" name="confirmPassword" type={showConfirm ? 'text' : 'password'} required minLength={8} placeholder="••••••••" className="pr-10" />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground" tabIndex={-1}>{showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
              </div>
            </div>
          </div>
          <div className="p-3 bg-muted/40 rounded-md flex items-start gap-2">
            <Shield className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">Le changement est journalisé dans l'audit immuable.</p>
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
            Changer le mot de passe
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function ActivityCard({ data }: { data: ProfileData }) {
  const { user, recentAudits } = data
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2"><History className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-base">Activité</CardTitle></div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between"><span className="text-muted-foreground flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />Dernière connexion</span><span className="font-medium">{user.lastLoginAt ? formatRelative(user.lastLoginAt) : 'Jamais'}</span></div>
          <div className="flex items-center justify-between"><span className="text-muted-foreground flex items-center gap-1.5"><User className="h-3.5 w-3.5" />Compte créé</span><span className="font-medium">{formatDate(user.createdAt)}</span></div>
        </div>
        <Separator />
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Audit (10 dernières)</p>
          {recentAudits.length === 0 ? <EmptyState title="Aucune activité" /> : (
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {recentAudits.map((a) => (
                <li key={a.id} className="text-xs space-y-0.5">
                  <div className="flex items-center justify-between"><span className="font-medium">{a.action}</span><span className="text-muted-foreground">{formatRelative(a.createdAt)}</span></div>
                  <p className="text-muted-foreground line-clamp-2">{a.description}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
