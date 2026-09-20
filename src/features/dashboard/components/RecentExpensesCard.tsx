import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { formatDayLabel } from '@/lib/dates'
import type { Category, Expense, ISODate } from '@/lib/types'
import { CategoryIcon } from '@/shared/components/CategoryIcon'
import { GlassCard } from '@/shared/components/GlassCard'
import { Money } from '@/shared/components/Money'
import { useUiStore } from '@/shared/stores/uiStore'

export interface RecentExpensesCardProps {
  /** This week's expenses, newest first (already limited by the caller). */
  expenses: readonly Expense[]
  categories: readonly Category[]
  today: ISODate
}

/** Rendered only when the week has expenses – the "first expense" prompt covers the empty case. */
export function RecentExpensesCard({ expenses, categories, today }: RecentExpensesCardProps) {
  const openExpense = useUiStore((state) => state.openExpense)
  const categoryById = new Map(categories.map((category) => [category.id, category]))

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-caption text-fg-subtle uppercase">Zuletzt ausgegeben</h2>
        <Link
          to="/expenses"
          className="flex items-center gap-0.5 rounded-sm text-label text-fg-muted outline-none hover:text-fg focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Alle
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
      <GlassCard padded={false} className="divide-y divide-border overflow-hidden">
        {expenses.map((expense) => {
          const category = categoryById.get(expense.categoryId)
          return (
            <button
              key={expense.id}
              type="button"
              onClick={() => openExpense(expense.id)}
              className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left outline-none hover:bg-surface-3/40 focus-visible:bg-surface-3/60"
            >
              <CategoryIcon
                icon={category?.icon ?? 'Ellipsis'}
                color={category?.color ?? 'cat-10'}
                size="sm"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate">
                  {expense.note ?? category?.name ?? 'Ausgabe'}
                </span>
                <span className="block text-label text-fg-muted">
                  {formatDayLabel(expense.date, today)}
                </span>
              </span>
              <Money cents={expense.amountCents} className="font-semibold" />
            </button>
          )
        })}
      </GlassCard>
    </section>
  )
}
