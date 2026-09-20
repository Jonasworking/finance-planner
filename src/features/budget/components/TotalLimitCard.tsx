import { useState } from 'react'
import { BUDGET_STEP_CENTS, type Usage } from '@/lib/budget'
import { formatAUD } from '@/lib/money'
import type { Cents } from '@/lib/types'
import { AmountSlider } from '@/shared/components/AmountSlider'
import { GlassCard } from '@/shared/components/GlassCard'
import { MoneyInput } from '@/shared/components/MoneyInput'
import { ProgressBar } from '@/shared/components/ProgressBar'
import { cn } from '@/shared/lib/utils'
import { LEVEL_TEXT, LEVEL_TONE } from '../levelStyle'

export interface TotalLimitCardProps {
  /** null while the typed amount is empty or invalid. */
  valueCents: Cents | null
  maxCents: Cents
  /** The running week against the limit as currently set (not yet saved). */
  usage: Usage
  onChange: (cents: Cents | null, source: 'slider' | 'input') => void
}

/** The weekly limit: slider in A$5 steps, or type the amount. Shows what it means right now. */
export function TotalLimitCard({ valueCents, maxCents, usage, onChange }: TotalLimitCardProps) {
  // The field keeps its own text; remount it whenever the slider moved the value.
  const [inputRevision, setInputRevision] = useState(0)
  const remaining = usage.remainingCents ?? 0

  return (
    <GlassCard className="flex flex-col gap-3">
      <p className="text-caption text-fg-subtle uppercase">Wochenbudget</p>
      <MoneyInput
        key={inputRevision}
        defaultValue={valueCents}
        onValueChange={(cents) => onChange(cents, 'input')}
        aria-label="Wochenbudget"
        size="lg"
      />
      <AmountSlider
        valueCents={valueCents ?? 0}
        maxCents={maxCents}
        stepCents={BUDGET_STEP_CENTS}
        onValueChange={(cents) => {
          setInputRevision((revision) => revision + 1)
          onChange(cents, 'slider')
        }}
        tone={LEVEL_TONE[usage.level]}
        aria-label="Wochenbudget"
      />

      <div className="flex flex-col gap-1.5 pt-1">
        <ProgressBar
          value={usage.ratio}
          tone={LEVEL_TONE[usage.level]}
          label="Wochenbudget verbraucht"
        />
        <p className="text-label text-fg-muted">
          Diese Woche: {formatAUD(usage.spentCents)} ausgegeben
          {usage.reservedCents > 0 ? ` · ${formatAUD(usage.reservedCents)} reserviert` : ''} ·{' '}
          <span className={cn('whitespace-nowrap', LEVEL_TEXT[usage.level])}>
            {remaining >= 0 ? `${formatAUD(remaining)} übrig` : `${formatAUD(-remaining)} drüber`}
          </span>
        </p>
      </div>
    </GlassCard>
  )
}
