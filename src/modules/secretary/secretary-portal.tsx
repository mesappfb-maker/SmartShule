'use client'

// SmartShule — Portail Secrétariat CENTRALISÉ (Étape 11)
// ============================================================
// Centre opérationnel administratif avec :
//   - Tableau de bord avec 15 indicateurs cliquables
//   - Recherche universelle (élèves, admissions, parents, classes)
//   - Module Admissions V2 (DataGrid multi-enfants)
//   - Liste des élèves (DataGrid avec filtres)
//   - Inscriptions annuelles & affectations
//   - Centre Absences & Retards
//   - Centre Documents & Certificats
//   - Centre Communications (messagerie, appels, visiteurs, RDV)
//   - Centre Transferts & Sorties
//   - Rapports & Opérations de masse
//   - File d'attente administrative

import * as React from 'react'
import { AppShell, NavSection } from '@/components/ss/app-shell'
import { PageHeader } from '@/components/ss/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ss/empty-state'
import {
  Home, Users, FileText, User, Plus, TrendingUp, ClipboardList,
  XCircle, Clock, Mail, CalendarClock, ArrowRightLeft, Award,
  BarChart3, Search, Loader2, GraduationCap, PhoneCall,
} from 'lucide-react'
import { logoutAction } from '@/lib/actions'
import { formatRelative } from '@/lib/format'
import { toast } from 'sonner'
import { ProfilePage, type ProfileData } from '@/modules/shared/profile-page'
import { EnrollmentManager } from '@/modules/direction/enrollment-manager'
import { StudentsList } from './students-list'
import { ClassListsDynamic } from './class-lists-dynamic'
import { AdmissionsManagerV2 } from './admissions-manager-v2'
import { SecretaryDashboardV2 } from './secretary-dashboard-v2'
import { AbsencesCenter } from './absences-center'
import { CommunicationsCenter } from './communications-center'
import { DocumentsCenter } from './documents-center'
import { TransfersCenter } from './transfers-center'
import { ReportsCenter } from './reports-center'

type SecretaryData = NonNullable<Awaited<ReturnType<typeof import('@/lib/secretary-portal-queries').getSecretaryPortalData>>>

type SearchResult = {
  type: 'STUDENT' | 'ADMISSION' | 'GUARDIAN' | 'CLASSROOM'
  id: string
  title: string
  subtitle: string
  badge: string
  meta: any
}

export function SecretaryPortal({
  user, schoolName, data, profileData,
}: {
  user: { displayName: string; role: string; email: string }
  schoolName: string
  data: SecretaryData
  profileData?: ProfileData
}) {
  const [view, setView] = React.useState('dashboard')
  const [showSearch, setShowSearch] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = React.useState(false)
  const pendingRequests = data.stats.pendingParentRequests

  // Recherche universelle avec debounce
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const handleSearch = React.useCallback((q: string) => {
    setSearchQuery(q)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    if (q.length < 2) { setSearchResults([]); return }
    searchTimeoutRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetch(`/api/secretariat/search?q=${encodeURIComponent(q)}&limit=20`, { cache: 'no-store' })
        const json = await res.json()
        if (json.ok) setSearchResults(json.results)
      } catch { setSearchResults([]) }
      finally { setSearchLoading(false) }
    }, 300)
  }, [])

  // Navigation vers un résultat de recherche
  const navigateToResult = React.useCallback((result: SearchResult) => {
    setShowSearch(false)
    setSearchQuery('')
    setSearchResults([])
    if (result.type === 'STUDENT') setView('students')
    else if (result.type === 'ADMISSION') setView('admissions')
    else if (result.type === 'CLASSROOM') setView('classes')
    // Pour les guardians, on reste sur students
    else setView('students')
  }, [])

  const sections: NavSection[] = [
    {
      id: 'main', label: 'Centre opérationnel',
      items: [
        { key: 'dashboard', label: 'Tableau de bord', icon: <Home className="h-4 w-4" /> },
        { key: 'admissions', label: 'Admissions', icon: <FileText className="h-4 w-4" /> },
        { key: 'students', label: 'Élèves', icon: <Users className="h-4 w-4" /> },
        { key: 'enrollment', label: 'Inscriptions', icon: <Plus className="h-4 w-4" /> },
        { key: 'classes', label: 'Classes', icon: <ClipboardList className="h-4 w-4" /> },
      ],
    },
    {
      id: 'centers', label: 'Centres spécialisés',
      items: [
        { key: 'absences', label: 'Absences & Retards', icon: <XCircle className="h-4 w-4" /> },
        { key: 'documents', label: 'Documents', icon: <Award className="h-4 w-4" /> },
        { key: 'communications', label: 'Communications', icon: <Mail className="h-4 w-4" /> },
        { key: 'transfers', label: 'Transferts', icon: <ArrowRightLeft className="h-4 w-4" /> },
        { key: 'reports', label: 'Rapports', icon: <BarChart3 className="h-4 w-4" /> },
      ],
    },
    {
      id: 'other', label: 'Autre',
      items: [
        { key: 'recent', label: 'Inscriptions récentes', icon: <TrendingUp className="h-4 w-4" /> },
        { key: 'profile', label: 'Mon profil', icon: <User className="h-4 w-4" /> },
      ],
    },
  ]

  return (
    <AppShell
      user={user} schoolName={schoolName} unreadNotifications={pendingRequests}
      sections={sections} activeView={view} onNavigate={setView}
      onLogout={logoutAction}
      onOpenNotifications={() => toast.info(`${pendingRequests} demande(s) en attente`)}
      onOpenSearch={() => setShowSearch(true)}
      sidebarFooter={<div className="space-y-1"><p className="font-medium text-xs">{schoolName}</p><p className="text-[10px] text-muted-foreground">Secrétariat — Centre opérationnel</p></div>}
    >
      {/* Panneau de recherche universelle */}
      {showSearch && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setShowSearch(false)}>
          <div className="fixed top-0 left-0 right-0 bg-background border-b border-border p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="max-w-2xl mx-auto space-y-3">
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="Rechercher un élève, admission, parent ou classe..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="text-lg h-12 border-0 focus-visible:ring-0"
                />
                <Button variant="ghost" onClick={() => setShowSearch(false)}>Fermer</Button>
              </div>
              {searchLoading && <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
              {!searchLoading && searchResults.length > 0 && (
                <div className="max-h-[60vh] overflow-y-auto space-y-1">
                  {searchResults.map((r, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                      onClick={() => navigateToResult(r)}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        r.type === 'STUDENT' ? 'bg-blue-100 text-blue-700' :
                        r.type === 'ADMISSION' ? 'bg-orange-100 text-orange-700' :
                        r.type === 'GUARDIAN' ? 'bg-purple-100 text-purple-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {r.type === 'STUDENT' ? 'É' : r.type === 'ADMISSION' ? 'A' : r.type === 'GUARDIAN' ? 'P' : 'C'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{r.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {r.type === 'STUDENT' ? 'Élève' : r.type === 'ADMISSION' ? 'Admission' : r.type === 'GUARDIAN' ? 'Parent' : 'Classe'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
              {!searchLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">Aucun résultat pour &quot;{searchQuery}&quot;</p>
              )}
            </div>
          </div>
        </div>
      )}

      {view === 'dashboard' && <SecretaryDashboardV2 onNavigate={setView} />}
      {view === 'admissions' && <AdmissionsManagerV2 />}
      {view === 'students' && <StudentsList />}
      {view === 'enrollment' && <EnrollmentManager schoolId="" />}
      {view === 'classes' && <ClassListsDynamic />}
      {view === 'absences' && <AbsencesCenter />}
      {view === 'documents' && <DocumentsCenter />}
      {view === 'communications' && <CommunicationsCenter />}
      {view === 'transfers' && <TransfersCenter />}
      {view === 'reports' && <ReportsCenter />}
      {view === 'recent' && (
        <div className="space-y-6">
          <PageHeader title="Inscriptions récentes" breadcrumbs={[{ label: 'Secrétariat' }, { label: 'Inscriptions récentes' }]} />
          <Card>
            <CardContent className="space-y-2">
              {data.recentEnrollments.length === 0 ? <EmptyState icon={<TrendingUp className="h-5 w-5" />} title="Aucune inscription récente" /> : (
                data.recentEnrollments.map((e, i) => (
                  <div key={i} className="flex items-center justify-between text-sm p-3 rounded-md border border-border">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{e.studentName}</p>
                        <p className="text-xs text-muted-foreground">{e.matricule} · {e.classroomName}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatRelative(e.enrolledAt)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
      {view === 'profile' && profileData && <ProfilePage data={profileData} onBack={() => setView('dashboard')} />}
    </AppShell>
  )
}
