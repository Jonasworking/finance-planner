import { PiggyBank, Repeat } from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'
import { formatDayLabel } from '@/lib/dates'
import { groupByDay, isPotFunded } from '@/lib/expenses'
import type { Category, Expense, ISODate } from '@/lib/types'
import { CategoryIcon } from '@/shared/components/CategoryIcon'
import { GlassCard } from '@/shared/components/GlassCard'
import { Money } from '@/shared/components/Money'
import { SwipeRow } from '@/shared/components/SwipeRow'
import { spring } from '@/shared/motion'
import { useUiStore } from '@/shared/stores/uiStore'
import { deleteExpenseWithUndo } from './deleteExpenseWithUndo'

interface ExpenseRowProps {
  expense: Expense
  category: Category | undefined
}

function ExpenseRow({ expense, category }: ExpenseRowProps) {
  const openExpense = useUiStore((state) => state.openExpense)
  const title = expense.note ?? category?.name ?? 'Ausgabe'
  const meta = [
    expense.note ? category?.name : null,
    ...expense.tags.map((tag) => `#${tag}`),
  ].filter(Boolean)

  return (
    <SwipeRow onDelete={() => void deleteExpenseWithUndo(expense)} deleteLabel={`${title} löschen`}>
      <button
        type="button"
        onClick={() => openExpense(expense.id)}
        className="flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left outline-none hover:bg-surface-3/40 focus-visible:bg-surface-3/60"
      >
        <CategoryIcon icon={category?.icon ?? 'Ellipsis'} color={category?.color ?? 'cat-10'} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate">{title}</span>
            {expense.recurringId ? (
              <Repeat className="size-3.5 shrink-0 text-fg-subtle" aria-label="Dauerauftrag" />
            ) : null}
            {isPotFunded(expense) ? (
              <PiggyBank className="size-3.5 shrink-0 text-saved" aria-label="Aus Topf bezahlt" />
            ) : null}
          </span>
          {meta.length > 0 ? (
            <span className="block truncate text-label text-fg-muted">{meta.join(' · ')}</span>
          ) : null}
        </span>
        <Money cents={expense.amountCents} className="font-semibold" />
      </button>
    </SwipeRow>
  )
}

export interface ExpenseListProps {
  expenses: readonly Expense[]
  categories: readonly Category[]
  today: ISODate
}

/** Expenses grouped by calendar day, newest first. Swipe left (or use the edit sheet) to delete. */
export function ExpenseList({ expenses, categories, today }: ExpenseListProps) {
  const categoryById = new Map(categories.map((category) => [category.id, category]))

  return (
    <div className="flex flex-col gap-5">
      {groupByDay(expenses).map((day) => (
        <section
          key={day.date}
          aria-label={formatDayLabel(day.date, today)}
          className="flex flex-col gap-2"
        >
          <header className="flex items-baseline justify-between px-1">
            <h2 className="text-caption text-fg-subtle uppercase">
              {formatDayLabel(day.date, today)}
            </h2>
            <Money cents={day.totalCents} tone="muted" className="text-label" />
          </header>
          <GlassCard padded={false} className="divide-y divide-border overflow-hidden">
            <AnimatePresence initial={false}>
              {day.expenses.map((expense) => (
                <m.div
                  key={expense.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={spring.soft}
                >
                  <ExpenseRow expense={expense} category={categoryById.get(expense.categoryId)} />
                </m.div>
              ))}
            </AnimatePresence>
          </GlassCard>
        </section>
      ))}
    </div>
  )
}
