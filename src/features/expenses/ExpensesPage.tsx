import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Plus, ReceiptText } from 'lucide-react'
import { useState } from 'react'
import { db, loadExpensesOfWeek } from '@/db'
import { addWeeksISO, formatWeekRange, weekStartOf } from '@/lib/dates'
import { isBudgetRelevant, sumAmounts } from '@/lib/expenses'
import { GlassCard } from '@/shared/components/GlassCard'
import { Money } from '@/shared/components/Money'
import { Page } from '@/shared/components/Page'
import { useToday } from '@/shared/hooks/useToday'
import { useUiStore } from '@/shared/stores/uiStore'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'
import { ExpenseList } from './components/ExpenseList'

function weekTitle(weekStart: string, currentWeek: string): string {
  if (weekStart === currentWeek) return 'Diese Woche'
  if (weekStart === addWeeksISO(currentWeek, -1)) return 'Letzte Woche'
  return 'Woche'
}

export function ExpensesPage() {
  const today = useToday()
  const currentWeek = weekStartOf(today)
  // Offset instead of a date: "this week" keeps meaning this week when the day rolls over.
  const [weekOffset, setWeekOffset] = useState(0)
  const weekStart = addWeeksISO(currentWeek, weekOffset)
  const setQuickAddOpen = useUiStore((state) => state.setQuickAddOpen)

  const data = useLiveQuery(() => loadExpensesOfWeek(db, weekStart), [weekStart])
  const spentCents = data ? sumAmounts(data.expenses.filter(isBudgetRelevant)) : 0

  return (
    <Page title="Ausgaben">
      <div className="flex flex-col gap-5">
        <GlassCard className="flex items-center gap-2 p-2 sm:p-3">
          <Button
            variant="ghost"
            size="icon-touch"
            onClick={() => setWeekOffset((offset) => offset - 1)}
            aria-label="Vorherige Woche"
          >
            <ChevronLeft aria-hidden />
          </Button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-caption text-fg-subtle uppercase">
              {weekTitle(weekStart, currentWeek)}
            </p>
            <p className="truncate text-label text-fg-muted">{formatWeekRange(weekStart)}</p>
            {data ? (
              <Money cents={spentCents} className="text-h1" />
            ) : (
              <Skeleton className="mx-auto mt-1 h-8 w-32" />
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-touch"
            onClick={() => setWeekOffset((offset) => Math.min(0, offset + 1))}
            disabled={weekOffset >= 0}
            aria-label="Nächste Woche"
          >
            <ChevronRight aria-hidden />
          </Button>
        </GlassCard>

        {data === undefined ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        ) : data.expenses.length === 0 ? (
          <GlassCard className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-surface-3 text-fg-muted">
              <ReceiptText className="size-6" aria-hidden />
            </span>
            <div>
              <p className="text-h2">Noch keine Ausgaben</p>
              <p className="text-label text-fg-muted">
                {weekOffset === 0
                  ? 'Erfasse deine erste Ausgabe dieser Woche.'
                  : 'In dieser Woche wurde nichts erfasst.'}
              </p>
            </div>
            {weekOffset === 0 ? (
              <Button size="touch" onClick={() => setQuickAddOpen(true)}>
                <Plus aria-hidden />
                Ausgabe erfassen
              </Button>
            ) : null}
          </GlassCard>
        ) : (
          <ExpenseList expenses={data.expenses} categories={data.categories} today={today} />
        )}
      </div>
    </Page>
  )
}
