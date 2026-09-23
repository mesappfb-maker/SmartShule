'use client'

import * as React from 'react'
import { Check, RefreshCw, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type SyncState = 'SYNCED' | 'PENDING' | 'ERROR' | 'CONNECTING'

export function SyncStatus({ state = 'SYNCED' }: { state?: SyncState }) {
  const config: Record<
    SyncState,
    { icon: React.ReactNode; label: string; className: string }
  > = {
    SYNCED: {
      icon: <Check className="h-3.5 w-3.5" />,
      label: 'Synchronisé',
      className: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40',
    },
    PENDING: {
      icon: <RefreshCw className="h-3.5 w-3.5 ss-sync-pulse" />,
      label: 'En attente',
      className: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40',
    },
    ERROR: {
      icon: <AlertCircle className="h-3.5 w-3.5" />,
      label: 'Erreur sync',
      className: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40',
    },
    CONNECTING: {
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
      label: 'Connexion…',
      className: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40',
    },
  }

  const { icon, label, className } = config[state]

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        className
      )}
      title={`État de synchronisation : ${label}`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </div>
  )
}
