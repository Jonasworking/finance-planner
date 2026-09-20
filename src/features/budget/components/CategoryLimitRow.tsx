import { useState } from 'react'
import { BUDGET_STEP_CENTS, type Usage } from '@/lib/budget'
import { formatAUD } from '@/lib/money'
import type { Category, Cents } from '@/lib/types'
import { AmountSlider } from '@/shared/components/AmountSlider'
import { CategoryIcon } from '@/shared/components/CategoryIcon'
import { MoneyInput } from '@/shared/components/MoneyInput'
import { ProgressBar } from '@/shared/components/ProgressBar'
import { cn } from '@/shared/lib/utils'
import { LEVEL_TEXT, LEVEL_TONE } from '../levelStyle'

export interface CategoryLimitRowProps {
  category: Category
  /** 0 = no limit for this category. */
  limitCents: Cents
  maxCents: Cents
  /** The running week in this category against the limit as currently set; undefined = nothing yet. */
  usage: Usage | undefined
  onChange: (cents: Cents) => void
}

/** One category: optional weekly limit by slider or typed amount, colored by this week's usage. */
export function CategoryLimitRow({
  category,
  limitCents,
  maxCents,
  usage,
  onChange,
}: CategoryLimitRowProps) {
  const [inputRevision, setInputRevision] = useState(0)
  const level = usage?.level ?? 'ok'
  const remaining = usage?.remainingCents ?? null

  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <div className="flex items-center gap-3">
        <CategoryIcon icon={category.icon} color={category.color} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate">{category.name}</span>
          <span className="block truncate text-label text-fg-muted">
            {formatAUD(usage?.spentCents ?? 0)} diese Woche
            {usage && usage.reservedCents > 0
              ? ` + ${formatAUD(usage.reservedCents)} reserviert`
              : ''}
            {remaining === null ? (
              ' · kein Limit'
            ) : (
              <>
                {' · '}
                <span className={LEVEL_TEXT[level]}>
                  {remaining >= 0
                    ? `${formatAUD(remaining)} übrig`
                    : `${formatAUD(-remaining)} drüber`}
                </span>
              </>
            )}
          </span>
        </span>
        <MoneyInput
          key={inputRevision}
          defaultValue={limitCents > 0 ? limitCents : null}
          onValueChange={(cents) => onChange(cents ?? 0)}
          aria-label={`Limit ${category.name}`}
          placeholder="–"
          className="w-32 shrink-0"
        />
      </div>
      <AmountSlider
        valueCents={limitCents}
        maxCents={maxCents}
        stepCents={BUDGET_STEP_CENTS}
        onValueChange={(cents) => {
          setInputRevision((revision) => revision + 1)
          onChange(cents)
        }}
        tone={LEVEL_TONE[level]}
        aria-label={`Limit ${category.name}`}
      />
      <ProgressBar
        value={usage?.ratio ?? 0}
        tone={LEVEL_TONE[level]}
        label={`${category.name}: Limit verbraucht`}
        className={cn(limitCents > 0 ? undefined : 'invisible')}
      />
    </div>
  )
}
