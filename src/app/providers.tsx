import { MotionConfig } from 'motion/react'
import { useEffect, type ReactNode } from 'react'
import { watchSystemTheme } from '@/shared/stores/themeStore'
import { Toaster } from '@/shared/ui/sonner'
import { TooltipProvider } from '@/shared/ui/tooltip'

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => watchSystemTheme(), [])

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider>
        {children}
        <Toaster position="top-center" />
      </TooltipProvider>
    </MotionConfig>
  )
}
