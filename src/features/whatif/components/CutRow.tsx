import { formatDate } from '@/lib/dates'
import type { Category, Cents, ISODate } from '@/lib/types'
import { WHATIF_STEP_CENTS, type WhatIfCategory } from '@/lib/whatif'
import { AmountSlider } from '@/shared/components/AmountSlider'
import { CategoryIcon } from '@/shared/components/CategoryIcon'
import { Money } from '@/shared/components/Money'

export interface CutRowProps {
  category: Category
  range: WhatIfCategory
  cutCents: Cents
  /** What this cut alone adds by `until`. */
  gainCents: Cents
  until: ISODate
  onChange: (cents: Cents) => void
}

/** One category: "−A$X pro Woche" by slider, with what it costs now and what the cut brings. */
export function CutRow({ category, range, cutCents, gainCents, until, onChange }: CutRowProps) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <div className="flex items-center gap-3">
        <CategoryIcon icon={category.icon} color={category.color} size="sm" />
        <span className="min-w-0 flex-1 truncate">{category.name}</span>
        <span className="shrink-0 text-right tabular-nums">
          {cutCents > 0 ? (
            <>
              −<Money cents={cutCents} decimals={false} />
              <span className="text-label text-fg-muted"> / Woche</span>
            </>
          ) : (
            <span className="text-label text-fg-muted">unverändert</span>
          )}
        </span>
      </div>
      <AmountSlider
        valueCents={cutCents}
        maxCents={range.maxCents}
        stepCents={WHATIF_STEP_CENTS}
        onValueChange={onChange}
        aria-label={`Weniger für ${category.name} pro Woche`}
      />
      <p className="text-label text-fg-muted">
        {range.averageCents > 0 ? (
          <>
            Ø <Money cents={range.averageCents} decimals={false} /> pro Woche
          </>
        ) : (
          'Noch keine Ausgaben'
        )}
        {range.limitCents !== null ? (
          <>
            {' · Limit '}
            <Money cents={range.limitCents} decimals={false} />
          </>
        ) : null}
        {cutCents > 0 ? (
          <>
            {' · '}
            <span className="whitespace-nowrap text-fg">
              +<Money cents={gainCents} decimals={false} /> bis {formatDate(until)}
            </span>
          </>
        ) : null}
      </p>
    </div>
  )
}
