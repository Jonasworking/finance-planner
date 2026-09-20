import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, loadBudget } from '@/db'
import { runningWeekBudget } from '@/lib/budget'
import { formatWeekRange, weekStartOf } from '@/lib/dates'
import { Page } from '@/shared/components/Page'
import { useToday } from '@/shared/hooks/useToday'
import { Skeleton } from '@/shared/ui/skeleton'
import { BudgetEditor } from './components/BudgetEditor'

export function BudgetPage() {
  const today = useToday()
  const data = useLiveQuery(() => loadBudget(db, today), [today])
  const [session, setSession] = useState(0)
  const weekStart = weekStartOf(today)

  const running = data
    ? runningWeekBudget({
        budgets: data.budgets,
        weekExpenses: data.expenses,
        templates: data.templates,
        weekStart,
        today,
        weekClosed: data.weekClosed,
        activeCategoryIds: new Set(data.categories.map((category) => category.id)),
      })
    : undefined
  const storedRow = data?.budgets.find((row) => row.id === running?.budget?.effectiveFrom)

  return (
    <Page title="Budget" subtitle={`Gilt ab dieser Woche · ${formatWeekRange(weekStart)}`}>
      {data && running?.budget ? (
        <BudgetEditor
          // Start over from the stored budget after every save (new row version) and on discard.
          key={`${weekStart}:${storedRow?.updatedAt ?? 0}:${session}`}
          stored={running.budget}
          weekStart={weekStart}
          today={today}
          categories={data.categories}
          weekExpenses={data.expenses}
          reserved={running.reserved.items}
          onDiscard={() => setSession((current) => current + 1)}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-52 w-full rounded-lg" />
          <Skeleton className="h-96 w-full rounded-lg" />
        </div>
      )}
    </Page>
  )
}
