'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const statusBadgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-muted text-muted-foreground',
        success:
          'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
        warning:
          'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
        danger:
          'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
        info: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
        primary:
          'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary',
        outline: 'border border-border text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  dot?: boolean
}

export function StatusBadge({
  className,
  variant,
  dot,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            variant === 'success' && 'bg-emerald-500',
            variant === 'warning' && 'bg-amber-500',
            variant === 'danger' && 'bg-red-500',
            variant === 'info' && 'bg-blue-500',
            variant === 'primary' && 'bg-primary',
            (!variant || variant === 'default') && 'bg-muted-foreground',
            variant === 'outline' && 'bg-border'
          )}
        />
      )}
      {children}
    </span>
  )
}
