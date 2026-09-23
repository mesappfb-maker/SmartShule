'use client'

import * as React from 'react'
import { Sidebar, NavSection } from './sidebar'
import { TopBar } from './topbar'

export interface AppShellProps {
  user: { displayName: string; role: string; email: string }
  schoolName: string
  unreadNotifications: number
  sections: NavSection[]
  activeView: string
  onNavigate: (view: string) => void
  onLogout: () => void
  onOpenNotifications: () => void
  onOpenSearch: () => void
  sidebarFooter?: React.ReactNode
  children: React.ReactNode
}

export function AppShell({
  user,
  schoolName,
  unreadNotifications,
  sections,
  activeView,
  onNavigate,
  onLogout,
  onOpenNotifications,
  onOpenSearch,
  sidebarFooter,
  children,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false)

  const handleNavigate = (view: string) => {
    onNavigate(view)
    setSidebarOpen(false)
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        sections={sections}
        activeView={activeView}
        onNavigate={handleNavigate}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        footer={sidebarFooter}
      />
      <div className="flex flex-1 flex-col min-w-0">
        <TopBar
          user={user}
          unreadNotifications={unreadNotifications}
          schoolName={schoolName}
          onNavigate={onNavigate}
          onLogout={onLogout}
          onOpenNotifications={onOpenNotifications}
          onOpenSearch={onOpenSearch}
          onToggleSidebar={() => setSidebarOpen((s) => !s)}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
