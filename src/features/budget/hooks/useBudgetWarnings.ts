import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { db, loadBudget } from '@/db'
import {
  dueBudgetWarnings,
  runningWeekBudget,
  TOTAL_SCOPE,
  withAnnounced,
  type BudgetWarning,
} from '@/lib/budget'
import { formatAUD } from '@/lib/money'
import type { Category, ISODate } from '@/lib/types'
import { readWarningLog, writeWarningLog } from '../warningLog'

function copyFor(warning: BudgetWarning, categories: readonly Category[]) {
  const { usage, level, scope } = warning
  const remaining = usage.remainingCents ?? 0
  const reserved =
    usage.reservedCents > 0 ? ` (inkl. ${formatAUD(usage.reservedCents)} reserviert)` : ''
  const description =
    level === 'over'
      ? remaining < 0
        ? `${formatAUD(-remaining)} drüber${reserved}.`
        : `Genau aufgebraucht${reserved}.`
      : `Noch ${formatAUD(remaining)} übrig${reserved}.`

  if (scope === TOTAL_SCOPE) {
    return {
      title: level === 'over' ? 'Wochenbudget aufgebraucht' : '80 % des Wochenbudgets erreicht',
      description,
    }
  }
  const name = categories.find((category) => category.id === scope)?.name ?? 'Kategorie'
  return {
    title: level === 'over' ? `${name}: Limit aufgebraucht` : `${name}: 80 % des Limits erreicht`,
    description,
  }
}

/**
 * Toasts when the running week reaches 80 % / 100 % of the budget (overall and per category
 * limit) – exactly once per threshold and week, whatever caused it: a new expense, a standing
 * order that was booked, or a lowered budget. It goes by the same number as the hero ring.
 * Mounted once in the app shell.
 */
export function useBudgetWarnings(today: ISODate): void {
  const navigate = useNavigate()
  const data = useLiveQuery(() => loadBudget(db, today), [today])

  useEffect(() => {
    if (!data?.onboardingDone) return
    const { usage } = runningWeekBudget({
      budgets: data.budgets,
      weekExpenses: data.expenses,
      templates: data.templates,
      weekStart: data.weekStart,
      today,
      weekClosed: data.weekClosed,
      activeCategoryIds: new Set(data.categories.map((category) => category.id)),
    })
    if (!usage) return

    // Read, decide and write in one go: a second run of this effect finds the log updated.
    const log = readWarningLog(data.weekStart)
    const due = dueBudgetWarnings(usage, log)
    if (due.length === 0) return
    writeWarningLog(data.weekStart, withAnnounced(log, due))

    for (const warning of due) {
      const { title, description } = copyFor(warning, data.categories)
      const show = warning.level === 'over' ? toast.error : toast.warning
      show(title, {
        description,
        action: { label: 'Budget', onClick: () => void navigate('/budget') },
      })
    }
  }, [data, today, navigate])
}
