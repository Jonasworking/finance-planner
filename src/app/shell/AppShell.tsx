import { useLiveQuery } from 'dexie-react-hooks'
import { m } from 'motion/react'
import { lazy, Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { db } from '@/db'
import { useBudgetWarnings } from '@/features/budget'
import { useMaterializeRecurring } from '@/features/expenses'
import { useDeviceSetup } from '@/features/setup'
import { resolveBudget } from '@/lib/budget'
import { weekStartOf } from '@/lib/dates'
import { SETTINGS_ID } from '@/lib/types'
import { useToday } from '@/shared/hooks/useToday'
import { useDeviceStore } from '@/shared/stores/deviceStore'
import { spring } from '@/shared/motion'
import { useUiStore } from '@/shared/stores/uiStore'
import { BottomTabs } from './BottomTabs'
import { Sidebar } from './Sidebar'

/*
 * The sheets and the onboarding are not needed for the first paint: they load in their own chunks
 * right after it (the shell mounts them at once, so the chunk request starts immediately and the
 * first tap on "+" finds them ready). This keeps vaul, the dialog and scroll lock out of the
 * start chunk.
 */
const QuickAddSheet = lazy(() =>
  import('@/features/expenses/sheets').then((module) => ({ default: module.QuickAddSheet })),
)
const EditExpenseSheet = lazy(() =>
  import('@/features/expenses/sheets').then((module) => ({ default: module.EditExpenseSheet })),
)
const CloseWeekSheet = lazy(() =>
  import('@/features/income/sheets').then((module) => ({ default: module.CloseWeekSheet })),
)
const EurRateSheet = lazy(() =>
  import('@/features/settings/sheets').then((module) => ({ default: module.EurRateSheet })),
)
const TaskSheet = lazy(() =>
  import('@/features/tasks/sheets').then((module) => ({ default: module.TaskSheet })),
)
const InstallGuide = lazy(() =>
  import('@/features/setup/sheets').then((module) => ({ default: module.InstallGuide })),
)
const OnboardingFlow = lazy(() =>
  import('@/features/onboarding').then((module) => ({ default: module.OnboardingFlow })),
)

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

  useDeviceSetup()
  const installFirst = useDeviceStore((state) => state.ios && !state.standalone)

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

  // iPhone in the browser: Safari and the installed app keep separate data – install first.
  if (installFirst && boot.settings?.installHintDismissedAt == null) {
    return (
      <Suspense fallback={<div className="h-dvh bg-bg" />}>
        <InstallGuide />
      </Suspense>
    )
  }

  if (!onboarded) {
    return (
      <Suspense fallback={<div className="h-dvh bg-bg" />}>
        <OnboardingFlow
          defaults={{
            defaultWeeklyIncomeCents: boot.settings?.defaultWeeklyIncomeCents ?? 200_000,
            totalLimitCents:
              resolveBudget(boot.budgets, weekStartOf(today))?.totalLimitCents ?? 40_000,
          }}
        />
      </Suspense>
    )
  }

  return (
    <div className="grid h-dvh lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]">
      <Sidebar className="hidden lg:flex" />

      <div className="grid min-h-0 min-w-0 [grid-template-areas:'stack']">
        <main className="min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain pb-[calc(var(--tabbar-height)+env(safe-area-inset-bottom)+1.5rem)] [grid-area:stack] lg:pb-10">
          <m.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring.soft}
          >
            <Outlet />
          </m.div>
        </main>
        <BottomTabs className="z-20 self-end [grid-area:stack] lg:hidden" />
      </div>

      <Suspense fallback={null}>
        <QuickAddSheet />
        <EditExpenseSheet />
        <CloseWeekSheet />
        <EurRateSheet />
        <TaskSheet />
      </Suspense>
    </div>
  )
}
