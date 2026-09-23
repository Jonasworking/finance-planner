import { ArrowRight } from 'lucide-react'
import { formatWeekRange, weekStartOf } from '@/lib/dates'
import type { Category, ISODate } from '@/lib/types'
import type { ScenarioBudget } from '@/lib/whatif'
import { CategoryIcon } from '@/shared/components/CategoryIcon'
import { Money } from '@/shared/components/Money'
import { ResponsiveSheet } from '@/shared/components/ResponsiveSheet'
import { Button } from '@/shared/ui/button'

export interface AdoptBudgetSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Snapshot taken when the sheet opened – it must not change while the sheet closes. */
  proposal: ScenarioBudget | null
  categories: readonly Category[]
  today: ISODate
  busy: boolean
  onConfirm: () => void
}

/** "Als Budget übernehmen": what changes, from this week on. */
export function AdoptBudgetSheet({
  open,
  onOpenChange,
  proposal,
  categories,
  today,
  busy,
  onConfirm,
}: AdoptBudgetSheetProps) {
  const byId = new Map(categories.map((category) => [category.id, category]))

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Als Budget übernehmen"
      description={`Gilt ab dieser Woche (${formatWeekRange(weekStartOf(today))}). Frühere Wochen bleiben, wie sie sind.`}
      footer={
        <Button type="button" size="touch" disabled={!proposal || busy} onClick={onConfirm}>
          Übernehmen
        </Button>
      }
    >
      <ul className="flex flex-col divide-y">
        {proposal?.changes.map((change) => {
          const category = change.categoryId === null ? null : byId.get(change.categoryId)
          return (
            <li key={change.categoryId ?? 'total'} className="flex items-center gap-3 py-3">
              {category ? (
                <CategoryIcon icon={category.icon} color={category.color} size="sm" />
              ) : null}
              <span className="min-w-0 flex-1 truncate">
                {change.categoryId === null ? 'Wochenbudget' : (category?.name ?? 'Kategorie')}
              </span>
              <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
                {change.fromCents === null ? (
                  <span className="text-label text-fg-muted">kein Limit</span>
                ) : (
                  <Money cents={change.fromCents} decimals={false} tone="muted" />
                )}
                <ArrowRight className="size-4 text-fg-subtle" aria-label="wird zu" />
                <Money cents={change.toCents} decimals={false} className="font-semibold" />
              </span>
            </li>
          )
        })}
      </ul>
    </ResponsiveSheet>
  )
}
