import { AnimatePresence, m } from 'motion/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { repos } from '@/db'
import {
  BUDGET_STEP_CENTS,
  budgetUsage,
  cleanCategoryLimits,
  sameBudget,
  sliderMaxCents,
  unallocatedCents,
  type ReservedItem,
  type ResolvedBudget,
} from '@/lib/budget'
import { formatWeekRange } from '@/lib/dates'
import { formatAUD } from '@/lib/money'
import type { Category, Cents, Expense, ISODate } from '@/lib/types'
import { GlassCard } from '@/shared/components/GlassCard'
import { errorMessage } from '@/shared/lib/errorMessages'
import { cn } from '@/shared/lib/utils'
import { spring } from '@/shared/motion'
import { Button } from '@/shared/ui/button'
import { CategoryLimitRow } from './CategoryLimitRow'
import { TotalLimitCard } from './TotalLimitCard'

/** Sliders for the weekly limit reach at least A$1,000. */
const TOTAL_SLIDER_FLOOR_CENTS = 100_000

export interface BudgetEditorProps {
  /** The budget that applies to the running week – the starting point of the draft. */
  stored: ResolvedBudget
  weekStart: ISODate
  today: ISODate
  categories: readonly Category[]
  weekExpenses: readonly Expense[]
  reserved: readonly ReservedItem[]
  onDiscard: () => void
}

/**
 * Draft of the budget "from this week on". Everything reacts live to the draft – usage bars,
 * colors, "unverteilt" – but nothing is written until "Speichern". Remount it (via `key`) to
 * start over from the stored budget.
 */
export function BudgetEditor({
  stored,
  weekStart,
  today,
  categories,
  weekExpenses,
  reserved,
  onDiscard,
}: BudgetEditorProps) {
  const [totalCents, setTotalCents] = useState<Cents | null>(stored.totalLimitCents)
  const [limits, setLimits] = useState<Record<string, Cents>>(stored.categoryLimits)
  // Fixed while dragging (a scale that grows under the thumb is unusable); typing a higher
  // amount extends it.
  const [totalMax, setTotalMax] = useState(() =>
    sliderMaxCents(stored.totalLimitCents, TOTAL_SLIDER_FLOOR_CENTS),
  )
  const [saving, setSaving] = useState(false)

  const draft: ResolvedBudget = {
    effectiveFrom: weekStart,
    totalLimitCents: totalCents ?? 0,
    categoryLimits: cleanCategoryLimits(limits),
  }
  const usage = budgetUsage(weekExpenses, draft, reserved)
  const unallocated = unallocatedCents(draft)
  const hasCategoryLimits = Object.keys(draft.categoryLimits).length > 0
  const changed = totalCents !== null && !sameBudget(stored, draft)

  const save = async () => {
    if (!changed || totalCents === null) return
    setSaving(true)
    try {
      await repos.budgets.set(today, {
        totalLimitCents: totalCents,
        categoryLimits: draft.categoryLimits,
      })
      toast.success('Budget gespeichert', {
        description: `Gilt ab dieser Woche (${formatWeekRange(weekStart)}).`,
      })
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* minmax(0,…) + min-w-0: grid tracks must not grow to fit long non-wrapping rows */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <TotalLimitCard
            valueCents={totalCents}
            maxCents={totalMax}
            usage={usage.total}
            onChange={(cents, source) => {
              setTotalCents(cents)
              if (source === 'input' && cents !== null && cents > totalMax) {
                setTotalMax(sliderMaxCents(cents, TOTAL_SLIDER_FLOOR_CENTS))
              }
            }}
          />
          <p className="px-1 text-label text-fg-muted">
            Änderungen gelten ab dieser Woche. Abgeschlossene Wochen und dein Streak behalten das
            Budget, das damals galt
            {stored.effectiveFrom === weekStart
              ? '.'
              : ` – das aktuelle gilt seit der Woche ${formatWeekRange(stored.effectiveFrom)}.`}
          </p>
        </div>

        {categories.length > 0 ? (
          <section className="flex min-w-0 flex-col gap-2">
            <header className="flex items-baseline justify-between gap-3 px-1">
              <h2 className="text-caption text-fg-subtle uppercase">Limits je Kategorie</h2>
              <p
                className={cn(
                  'text-label whitespace-nowrap',
                  unallocated < 0 ? 'text-warning' : 'text-fg-muted',
                )}
              >
                {!hasCategoryLimits
                  ? 'optional'
                  : unallocated > 0
                    ? `${formatAUD(unallocated)} unverteilt`
                    : unallocated < 0
                      ? `${formatAUD(-unallocated)} überbucht`
                      : 'alles verteilt'}
              </p>
            </header>
            <GlassCard padded={false} className="divide-y divide-border overflow-hidden">
              {categories.map((category) => (
                <CategoryLimitRow
                  key={category.id}
                  category={category}
                  limitCents={limits[category.id] ?? 0}
                  // never an empty scale, even with a total of 0
                  maxCents={Math.max(
                    draft.totalLimitCents,
                    limits[category.id] ?? 0,
                    BUDGET_STEP_CENTS,
                  )}
                  usage={usage.byCategory[category.id]}
                  onChange={(cents) =>
                    setLimits((current) => ({ ...current, [category.id]: cents }))
                  }
                />
              ))}
            </GlassCard>
          </section>
        ) : null}
      </div>

      <AnimatePresence>
        {changed ? (
          <m.div
            key="save-bar"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={spring.snappy}
            className="sticky bottom-[calc(var(--tabbar-height)+env(safe-area-inset-bottom)+0.75rem)] z-10 mt-4 lg:bottom-4"
          >
            <div className="flex flex-col gap-2 rounded-lg border border-border-strong bg-surface-2 p-2 shadow-sheet">
              <p className="px-2 pt-1 text-label text-fg-muted">
                Gilt ab dieser Woche – vergangene Wochen bleiben, wie sie waren.
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="touch" onClick={onDiscard}>
                  Verwerfen
                </Button>
                <Button
                  type="button"
                  size="touch"
                  className="min-w-0 flex-1"
                  disabled={saving}
                  onClick={() => void save()}
                >
                  Speichern
                </Button>
              </div>
            </div>
          </m.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}
