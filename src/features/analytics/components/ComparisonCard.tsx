import type { Granularity, PeriodComparison } from '@/lib/analytics'
import type { MoneyDisplay } from '@/lib/money'
import { GlassCard } from '@/shared/components/GlassCard'
import { Money } from '@/shared/components/Money'
import { periodLabel } from '../labels'
import { DeltaChip } from './DeltaChip'

export interface ComparisonCardProps {
  comparison: PeriodComparison | null
  granularity: Granularity
  display: MoneyDisplay
}

/** The newest finished week (or month) against the one before it. */
export function ComparisonCard({ comparison, granularity, display }: ComparisonCardProps) {
  const byMonth = granularity === 'month'
  const title = byMonth ? 'Letzter Monat im Vergleich' : 'Letzte Woche im Vergleich'

  if (!comparison) {
    return (
      <GlassCard className="flex flex-col gap-1">
        <h2 className="text-h2">{title}</h2>
        <p className="text-label text-fg-muted">
          {byMonth
            ? 'Sobald zwei Monate abgeschlossene Wochen haben, siehst du hier, was sich verändert hat.'
            : 'Sobald zwei Wochen abgeschlossen sind, siehst du hier, was sich verändert hat.'}
        </p>
      </GlassCard>
    )
  }

  const rows = [
    {
      label: 'Verdient',
      cents: comparison.incomeCents,
      delta: comparison.incomeDeltaCents,
      upIsGood: true,
      ratio: null,
    },
    {
      label: 'Ausgegeben',
      cents: comparison.spentCents,
      delta: comparison.spentDeltaCents,
      upIsGood: false,
      ratio: comparison.spentDeltaRatio,
    },
    {
      label: 'Gespart',
      cents: comparison.savedCents,
      delta: comparison.savedDeltaCents,
      upIsGood: true,
      ratio: null,
    },
  ]

  return (
    <GlassCard className="flex flex-col gap-3">
      <div>
        <h2 className="text-h2">{title}</h2>
        <p className="text-label text-fg-muted">
          {periodLabel(comparison.currentKey, granularity)} gegenüber{' '}
          {periodLabel(comparison.previousKey, granularity)}
          {byMonth ? ' · Ø pro Woche' : ''}
        </p>
      </div>
      <dl className="flex flex-col divide-y">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
            <dt className="min-w-0 flex-1 text-fg-muted">{row.label}</dt>
            <dd className="flex items-center gap-2">
              <Money
                cents={row.cents}
                decimals={false}
                display={display}
                className="font-semibold"
              />
              <DeltaChip
                deltaCents={row.delta}
                upIsGood={row.upIsGood}
                ratio={row.ratio}
                display={display}
              />
            </dd>
          </div>
        ))}
      </dl>
    </GlassCard>
  )
}
