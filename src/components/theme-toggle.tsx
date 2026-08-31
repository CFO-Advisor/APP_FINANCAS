'use client'

import { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'

const emptySubscribe = () => () => {}

/** True only after hydration — avoids a manual mounted-flag effect. */
function useIsClient() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false)
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const mounted = useIsClient()

  if (!mounted) return <div className="h-8 w-8" />

  const isDark = theme === 'dark'

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-yellow-500" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  )
}
