'use client'

import * as React from 'react'
import Link from 'next/link'
import { GraduationCap, Bell, Search, User, LogOut, ChevronDown, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SyncStatus } from './sync-status'
import { ThemeToggle } from './theme-toggle'
import { cn } from '@/lib/utils'

export interface TopBarProps {
  user: { displayName: string; role: string; email: string }
  unreadNotifications: number
  schoolName: string
  onNavigate: (view: string) => void
  onLogout: () => void
  onOpenNotifications: () => void
  onOpenSearch: () => void
  onToggleSidebar: () => void
}

export function TopBar({
  user,
  unreadNotifications,
  schoolName,
  onNavigate,
  onLogout,
  onOpenNotifications,
  onOpenSearch,
  onToggleSidebar,
}: TopBarProps) {
  const initials = user.displayName
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-3 sm:px-4">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onToggleSidebar}
        aria-label="Basculer le menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex items-center gap-2 min-w-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <GraduationCap className="h-4 w-4" />
        </div>
        <div className="hidden sm:block min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            SmartShule
          </p>
          <p className="text-[10px] text-muted-foreground truncate">{schoolName}</p>
        </div>
      </div>

      <div className="flex-1" />

      <SyncStatus state="SYNCED" />

      <Button
        variant="ghost"
        size="icon"
        onClick={onOpenSearch}
        aria-label="Recherche"
        title="Recherche"
      >
        <Search className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={onOpenNotifications}
        aria-label="Notifications"
        className="relative"
      >
        <Bell className="h-4 w-4" />
        {unreadNotifications > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--ss-color-danger)] px-1 text-[10px] font-semibold text-white">
            {unreadNotifications > 9 ? '9+' : unreadNotifications}
          </span>
        )}
      </Button>

      <ThemeToggle />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2 px-2 hover:bg-muted">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-primary/10 text-primary text-[11px] font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden md:block text-left leading-tight">
              <p className="text-xs font-medium text-foreground">
                {user.displayName}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {roleLabel(user.role)}
              </p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{user.displayName}</span>
              <span className="text-xs text-muted-foreground font-normal">
                {user.email}
              </span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onNavigate('profile')}>
            <User className="h-4 w-4 mr-2" />
            Mon profil
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onNavigate('settings')}
            className="md:hidden"
          >
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onLogout}
            className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Se déconnecter
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}

function roleLabel(role: string): string {
  switch (role) {
    case 'PARENT':
      return 'Parent'
    case 'STUDENT':
      return 'Élève'
    case 'DIRECTION':
      return 'Direction'
    case 'ADMIN':
      return 'Administrateur'
    default:
      return role
  }
}
