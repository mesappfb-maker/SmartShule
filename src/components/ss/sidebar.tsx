'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

export interface NavItem {
  key: string
  label: string
  icon: React.ReactNode
  badge?: number
  section?: string
}

export interface NavSection {
  id: string
  label?: string
  items: NavItem[]
}

export function Sidebar({
  sections,
  activeView,
  onNavigate,
  isOpen,
  onClose,
  footer,
}: {
  sections: NavSection[]
  activeView: string
  onNavigate: (key: string) => void
  isOpen: boolean
  onClose: () => void
  footer?: React.ReactNode
}) {
  return (
    <>
      {/* Overlay mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed lg:sticky top-0 left-0 z-50 lg:z-auto h-screen lg:h-[calc(100vh-3.5rem)] w-64 shrink-0 border-r border-border bg-sidebar overflow-y-auto transition-transform duration-200 lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-4 py-3 lg:hidden">
            <span className="text-sm font-semibold">Menu</span>
            <button
              onClick={onClose}
              className="rounded-md p-1 hover:bg-muted"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav className="flex-1 px-3 py-3 space-y-4">
            {sections.map((section) => (
              <div key={section.id}>
                {section.label && (
                  <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                    {section.label}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {section.items.map((item) => {
                    const isActive = activeView === item.key
                    return (
                      <li key={item.key}>
                        <button
                          onClick={() => onNavigate(item.key)}
                          className={cn(
                            'w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors text-left',
                            isActive
                              ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
                              : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                          )}
                        >
                          <span className="shrink-0">{item.icon}</span>
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.badge != null && item.badge > 0 && (
                            <span
                              className={cn(
                                'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold',
                                isActive
                                  ? 'bg-sidebar-primary-foreground/20 text-sidebar-primary-foreground'
                                  : 'bg-[var(--ss-color-danger)] text-white'
                              )}
                            >
                              {item.badge > 9 ? '9+' : item.badge}
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>

          {footer && (
            <div className="border-t border-border p-3 text-xs text-muted-foreground">
              {footer}
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
