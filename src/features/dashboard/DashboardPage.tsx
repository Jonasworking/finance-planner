import { useLiveQuery } from 'dexie-react-hooks'
import { db, loadDashboard } from '@/db'
import { resolveBudget, runningWeekBudget } from '@/lib/budget'
import { nextStep, projectWeek, weekProgress } from '@/lib/dashboard'
import { formatWeekRange, weekStartOf } from '@/lib/dates'
import { groupByWeek } from '@/lib/expenses'
import { pendingWeeks, summarizeWeek } from '@/lib/savings'
import { computeStreak } from '@/lib/streak'
import { Page } from '@/shared/components/Page'
import { useToday } from '@/shared/hooks/useToday'
import { Skeleton } from '@/shared/ui/skeleton'
import { NextStepCard } from './components/NextStepCard'
import { RecentExpensesCard } from './components/RecentExpensesCard'
import { SavingsCard } from './components/SavingsCard'
import { StreakCard } from './components/StreakCard'
import { WeekHero } from './components/WeekHero'
import { WeeksCard } from './components/WeeksCard'

const RECENT_EXPENSES = 4
const RECENT_WEEKS = 6

export function DashboardPage() {
  const today = useToday()
  const data = useLiveQuery(() => loadDashboard(db), [])
  const currentWeek = weekStartOf(today)

  if (!data?.settings) {
    return (
      <Page title="Diese Woche" subtitle={formatWeekRange(currentWeek)}>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-36 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </Page>
    )
  }

  const { settings } = data
  const expensesByWeek = groupByWeek(data.expenses)
  const summarize = (weekStart: string) =>
    summarizeWeek({
      weekStart,
      week: data.weeks.find((week) => week.id === weekStart),
      expenses: expensesByWeek.get(weekStart) ?? [],
      budget: resolveBudget(data.budgets, weekStart),
    })

  const summary = summarize(currentWeek)
  const weekRow = data.weeks.find((week) => week.id === currentWeek)
  // Same calculation as the budget screen and the warnings – they can never disagree.
  const { usage, reserved } = runningWeekBudget({
    budgets: data.budgets,
    weekExpenses: expensesByWeek.get(currentWeek) ?? [],
    templates: data.templates,
    weekStart: currentWeek,
    today,
    weekClosed: summary.closed,
  })
  const projection = projectWeek({
    incomeCents: weekRow?.incomeCents ?? null,
    defaultIncomeCents: settings.defaultWeeklyIncomeCents,
    spentCents: summary.spentCents,
    reservedCents: reserved.totalCents,
  })

  const closedWeeks = data.weeks
    .filter((week) => week.closedAt !== null)
    .sort((a, b) => (a.id < b.id ? 1 : -1))
    .map((week) => summarize(week.id))
  const streak = computeStreak(closedWeeks, today)

  const step = nextStep({
    today,
    pendingWeeks: pendingWeeks(data.weeks, settings.trackingSince, today),
    hasAnyExpense: data.hasAnyExpense,
    hasRecurring: data.templates.length > 0,
    currentWeekClosed: summary.closed,
    closedWeeks: data.weeks.filter((week) => week.closedAt !== null).length,
  })

  const recentExpenses = [...(expensesByWeek.get(currentWeek) ?? [])]
    .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))
    .slice(0, RECENT_EXPENSES)

  return (
    <Page title="Diese Woche" subtitle={formatWeekRange(currentWeek)}>
      {/* minmax(0,…) + min-w-0: grid tracks must not grow to fit long non-wrapping rows */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <WeekHero
            summary={summary}
            usage={usage?.total ?? null}
            projection={projection}
            reserved={reserved}
            daysLeft={weekProgress(today).daysLeft}
            today={today}
          />
          <NextStepCard step={step} today={today} />
          {recentExpenses.length > 0 ? (
            <RecentExpensesCard
              expenses={recentExpenses}
              categories={data.categories}
              today={today}
            />
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <SavingsCard
            balanceCents={data.primaryBalanceCents}
            lastClosed={closedWeeks[0] ?? null}
          />
          {closedWeeks.length > 0 ? <StreakCard streak={streak} /> : null}
          <WeeksCard
            closedWeeks={closedWeeks.slice(0, RECENT_WEEKS)}
            hasAnyExpense={data.hasAnyExpense}
          />
        </div>
      </div>
    </Page>
  )
}
