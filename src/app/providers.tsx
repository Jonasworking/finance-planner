import { LazyMotion, MotionConfig } from 'motion/react'
import { useEffect, type ReactNode } from 'react'
import { watchSystemTheme } from '@/shared/stores/themeStore'
import { Toaster } from '@/shared/ui/sonner'
import { TooltipProvider } from '@/shared/ui/tooltip'

/*
 * `m.*` components carry no animation code of their own; the features (~30 KB gzip) arrive in a
 * separate chunk right after the first render instead of sitting in the start chunk.
 */
const loadMotionFeatures = () => import('./motionFeatures').then((module) => module.default)

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => watchSystemTheme(), [])

  return (
    <LazyMotion features={loadMotionFeatures}>
      <MotionConfig reducedMotion="user">
        <TooltipProvider>
          {children}
          <Toaster position="top-center" />
        </TooltipProvider>
      </MotionConfig>
    </LazyMotion>
  )
}
