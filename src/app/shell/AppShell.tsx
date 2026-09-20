import { motion } from 'motion/react'
import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { QuickAddSheet } from '@/features/expenses'
import { spring } from '@/shared/motion'
import { useUiStore } from '@/shared/stores/uiStore'
import { BottomTabs } from './BottomTabs'
import { Sidebar } from './Sidebar'

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

/**
 * Grid shell with an inner scroller instead of a `position: fixed` tab bar (robust on iOS):
 * the scroller and the tab bar share one grid cell, so content scrolls underneath the glass bar.
 */
export function AppShell() {
  const { pathname } = useLocation()
  const setQuickAddOpen = useUiStore((state) => state.setQuickAddOpen)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'n' || event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target)) return
      event.preventDefault()
      setQuickAddOpen(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setQuickAddOpen])

  return (
    <div className="grid h-dvh lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]">
      <Sidebar className="hidden lg:flex" />

      <div className="grid min-h-0 min-w-0 [grid-template-areas:'stack']">
        <main className="min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain pb-[calc(var(--tabbar-height)+env(safe-area-inset-bottom)+1.5rem)] [grid-area:stack] lg:pb-10">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring.soft}
          >
            <Outlet />
          </motion.div>
        </main>
        <BottomTabs className="z-20 self-end [grid-area:stack] lg:hidden" />
      </div>

      <QuickAddSheet />
    </div>
  )
}
