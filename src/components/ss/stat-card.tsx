'use client'

import * as React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'

export interface StatCardProps {
  label: string
  value: string | number
  hint?: string
  icon?: React.ReactNode
  trend?: { value: string; direction: 'up' | 'down' | 'neutral' }
  tone?: 'primary' | 'secondary' | 'tertiary' | 'success' | 'warning' | 'danger' | 'info'
  className?: string
}

const toneClasses: Record<NonNullable<StatCardProps['tone']>, string> = {
  primary: 'bg-primary/10 text-primary',
  secondary: 'bg-[var(--ss-color-secondary)]/10 text-[var(--ss-color-secondary)]',
  tertiary: 'bg-[var(--ss-color-tertiary)]/10 text-[var(--ss-color-tertiary)]',
  success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  warning: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  danger: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400',
  info: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  trend,
  tone = 'primary',
  className,
}: StatCardProps) {
  return (
    <Card className={cn('ss-shadow-card hover:ss-shadow-card-hover transition-shadow', className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
              {label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground truncate">
              {value}
            </p>
            {hint && (
              <p className="mt-1 text-xs text-muted-foreground truncate">{hint}</p>
            )}
            {trend && (
              <div className="mt-2 flex items-center gap-1 text-xs">
                {trend.direction === 'up' && (
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                )}
                {trend.direction === 'down' && (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span
                  className={
                    trend.direction === 'up'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : trend.direction === 'down'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-muted-foreground'
                  }
                >
                  {trend.value}
                </span>
              </div>
            )}
          </div>
          {icon && (
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                toneClasses[tone]
              )}
            >
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
