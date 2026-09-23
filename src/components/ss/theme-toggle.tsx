'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  // Pendant le SSR et avant mount, on rend un placeholder déterministe
  // pour éviter les erreurs d'hydration (title et icône doivent correspondre
  // entre serveur et client).
  // Une fois monté, on utilise le thème réel.
  const isDark = mounted && theme === 'dark'

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label="Basculer le thème"
      // Title déterministe : on évite de dépendre de `theme` avant mount
      title={isDark ? 'Mode clair' : 'Mode sombre'}
      suppressHydrationWarning
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
