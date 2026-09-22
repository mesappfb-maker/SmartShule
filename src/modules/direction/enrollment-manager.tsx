'use client'

// SmartShule — Composant : Inscription élève/prof depuis le Portail Direction
// Étape démo — Permet de tester l'application avec de vraies données

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, UserPlus, GraduationCap, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

export function EnrollmentManager({ schoolId }: { schoolId: string }) {
  const [tab, setTab] = React.useState<'student' | 'teacher'>('student')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Inscription rapide</h2>
        <p className="text-xs text-muted-foreground">
          Ajoutez de nouveaux élèves ou professeurs pour tester l&apos;application en conditions réelles.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'student' | 'teacher')}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="student" className="gap-2">
            <GraduationCap className="h-4 w-4" /> Élève
          </TabsTrigger>
          <TabsTrigger value="teacher" className="gap-2">
            <UserPlus className="h-4 w-4" /> Enseignant
          </TabsTrigger>
        </TabsList>

        <TabsContent value="student">
          <EnrollStudentForm schoolId={schoolId} />
        </TabsContent>

        <TabsContent value="teacher">
          <EnrollTeacherForm schoolId={schoolId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function EnrollStudentForm({ schoolId }: { schoolId: string }) {
  const [firstName, setFirstName] = React.useState('')
  const [lastName, setLastName] = React.useState('')
  const [matricule, setMatricule] = React.useState('')
  const [gender, setGender] = React.useState('M')
  const [classroomId, setClassroomId] = React.useState('')
  const [guardianFirstName, setGuardianFirstName] = React.useState('')
  const [guardianLastName, setGuardianLastName] = React.useState('')
  const [guardianPhone, setGuardianPhone] = React.useState('')
  const [guardianEmail, setGuardianEmail] = React.useState('')
  const [createAccount, setCreateAccount] = React.useState(true)
  const [pending, setPending] = React.useState(false)
  const [classrooms, setClassrooms] = React.useState<any[]>([])

  React.useEffect(() => {
    fetchClassrooms()
  }, [])

  async function fetchClassrooms() {
    try {
      const res = await fetch('/api/direction/classrooms')
      const data = await res.json()
      if (data.ok) setClassrooms(data.classrooms || [])
    } catch (err) {
      console.error('Erreur chargement classes:', err)
    }
  }

  async function submit() {
    if (!firstName || !lastName || !matricule || !classroomId) {
      toast.error('Veuillez remplir tous les champs obligatoires.')
      return
    }
    setPending(true)
    try {
      const res = await fetch('/api/direction/enroll-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          matricule,
          gender,
          classroomId,
          guardianFirstName,
          guardianLastName,
          guardianPhone,
          guardianEmail,
          guardianRelationship: 'PERE',
          createGuardianAccount: createAccount,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success(data.message)
        if (data.guardianCreated) {
          toast.info(`Compte parent créé : ${data.guardianEmail} / ${data.guardianPassword}`)
        }
        // Reset form
        setFirstName('')
        setLastName('')
        setMatricule('')
        setGuardianFirstName('')
        setGuardianLastName('')
        setGuardianPhone('')
        setGuardianEmail('')
      } else {
        toast.error(data.error)
      }
    } catch (err) {
      toast.error('Erreur réseau : ' + (err as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Inscription d&apos;un élève</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Prénom *</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jean" />
          </div>
          <div>
            <Label>Nom *</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Dupont" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Matricule *</Label>
            <Input value={matricule} onChange={(e) => setMatricule(e.target.value)} placeholder="ELV-002" />
          </div>
          <div>
            <Label>Sexe</Label>
            <select
              className="w-full p-2 border rounded-md bg-background text-sm"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
            >
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </select>
          </div>
        </div>
        <div>
          <Label>Classe *</Label>
          <select
            className="w-full p-2 border rounded-md bg-background text-sm"
            value={classroomId}
            onChange={(e) => setClassroomId(e.target.value)}
          >
            <option value="">— Sélectionner —</option>
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.directorateName || '—'})
              </option>
            ))}
          </select>
          {classrooms.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">
              ⚠️ Aucune classe disponible. Créez d&apos;abord une classe dans la section Gestion.
            </p>
          )}
        </div>

        <div className="pt-3 border-t">
          <p className="text-xs font-medium mb-2">Parent / Tuteur (optionnel)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Prénom du parent</Label>
              <Input value={guardianFirstName} onChange={(e) => setGuardianFirstName(e.target.value)} placeholder="Marie" />
            </div>
            <div>
              <Label>Nom du parent</Label>
              <Input value={guardianLastName} onChange={(e) => setGuardianLastName(e.target.value)} placeholder="Dupont" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div>
              <Label>Téléphone</Label>
              <Input value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} placeholder="+243 ..." />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} placeholder="parent@email.com" />
            </div>
          </div>
          <label className="flex items-center gap-2 mt-2 text-sm">
            <input
              type="checkbox"
              checked={createAccount}
              onChange={(e) => setCreateAccount(e.target.checked)}
            />
            <span>Créer un compte parent (mot de passe : SmartShule2026!)</span>
          </label>
        </div>

        <Button onClick={submit} disabled={pending} className="w-full">
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Inscription…
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" /> Inscrire l&apos;élève
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

function EnrollTeacherForm({ schoolId }: { schoolId: string }) {
  const [firstName, setFirstName] = React.useState('')
  const [lastName, setLastName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [pending, setPending] = React.useState(false)

  async function submit() {
    if (!firstName || !lastName || !email) {
      toast.error('Veuillez remplir tous les champs obligatoires.')
      return
    }
    setPending(true)
    try {
      const res = await fetch('/api/direction/enroll-teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
          function: 'ENSEIGNANT',
        }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success(data.message)
        toast.info(`Compte créé : ${email} / ${data.password}`)
        setFirstName('')
        setLastName('')
        setEmail('')
        setPhone('')
      } else {
        toast.error(data.error)
      }
    } catch (err) {
      toast.error('Erreur réseau : ' + (err as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Inscription d&apos;un enseignant</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Prénom *</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Pierre" />
          </div>
          <div>
            <Label>Nom *</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Mukendi" />
          </div>
        </div>
        <div>
          <Label>Email professionnel *</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="professeur@smartshule.demo" />
        </div>
        <div>
          <Label>Téléphone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+243 ..." />
        </div>
        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            💡 Le compte sera créé avec le mot de passe par défaut <code className="font-mono font-semibold">SmartShule2026!</code>.
            L&apos;enseignant pourra se connecter immédiatement.
          </p>
        </div>
        <Button onClick={submit} disabled={pending} className="w-full">
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Inscription…
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4 mr-2" /> Inscrire l&apos;enseignant
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
