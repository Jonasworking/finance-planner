import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'motion/react'
import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { db } from '@/db'
import { useBudgetWarnings } from '@/features/budget'
import { EditExpenseSheet, QuickAddSheet, useMaterializeRecurring } from '@/features/expenses'
import { CloseWeekSheet } from '@/features/income'
import { OnboardingFlow } from '@/features/onboarding'
import { EurRateSheet } from '@/features/settings'
import { TaskSheet } from '@/features/tasks'
import { resolveBudget } from '@/lib/budget'
import { weekStartOf } from '@/lib/dates'
import { SETTINGS_ID } from '@/lib/types'
import { useToday } from '@/shared/hooks/useToday'
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
 * Until the onboarding is done it shows that instead – full screen, without navigation.
 */
export function AppShell() {
  const { pathname } = useLocation()
  const today = useToday()
  const setQuickAddOpen = useUiStore((state) => state.setQuickAddOpen)

  const boot = useLiveQuery(async () => {
    const [settings, budgets] = await Promise.all([
      db.settings.get(SETTINGS_ID),
      db.budgets.toArray(),
    ])
    return { settings: settings ?? null, budgets }
  }, [])
  const onboarded = boot?.settings?.onboardingDone === true

  useMaterializeRecurring(today, onboarded)
  useBudgetWarnings(today)

  useEffect(() => {
    if (!onboarded) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'n' || event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target)) return
      // Not while a sheet is open: there "n" is just a letter or does nothing.
      if (document.querySelector('[role="dialog"]')) return
      event.preventDefault()
      setQuickAddOpen(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onboarded, setQuickAddOpen])

  // Still reading the settings: keep the (dark) background, no flash of the wrong screen.
  if (boot === undefined) return <div className="h-dvh bg-bg" />

  if (!onboarded) {
    return (
      <OnboardingFlow
        defaults={{
          defaultWeeklyIncomeCents: boot.settings?.defaultWeeklyIncomeCents ?? 200_000,
          totalLimitCents:
            resolveBudget(boot.budgets, weekStartOf(today))?.totalLimitCents ?? 40_000,
        }}
      />
    )
  }

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
      <EditExpenseSheet />
      <CloseWeekSheet />
      <EurRateSheet />
      <TaskSheet />
    </div>
  )
}
