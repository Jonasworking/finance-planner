import { formatDate } from '@/lib/dates'
import type { ISODate } from '@/lib/types'
import type { Scenario, WhatIfBase } from '@/lib/whatif'
import { GlassCard } from '@/shared/components/GlassCard'
import { Money } from '@/shared/components/Money'
import { SegmentedControl } from '@/shared/components/SegmentedControl'
import { Input } from '@/shared/ui/input'
import type { HorizonMonths } from '../whatIfStore'

const HORIZONS: { value: HorizonMonths; label: string; ariaLabel: string }[] = [
  { value: 3, label: '3 Mon.', ariaLabel: '3 Monate' },
  { value: 6, label: '6 Mon.', ariaLabel: '6 Monate' },
  { value: 12, label: '1 Jahr', ariaLabel: '1 Jahr' },
  { value: 24, label: '2 Jahre', ariaLabel: '2 Jahre' },
]

export interface ResultCardProps {
  base: WhatIfBase
  scenario: Scenario
  today: ISODate
  until: ISODate
  horizon: HorizonMonths | ISODate
  onHorizonChange: (horizon: HorizonMonths | ISODate) => void
}

/** Target date on top, the answer below: "+A$Z bis Datum Y" – or where the pots end up anyway. */
export function ResultCard({
  base,
  scenario,
  today,
  until,
  horizon,
  onHorizonChange,
}: ResultCardProps) {
  const last = scenario.points.at(-1)
  const baselineEnd = last?.baselineCents ?? base.startBalanceCents
  const scenarioEnd = last?.scenarioCents ?? base.startBalanceCents
  const hasCuts = scenario.extraPerWeekCents > 0

  return (
    <GlassCard className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="whatif-until" className="text-caption text-fg-subtle uppercase">
          Zieldatum
        </label>
        <SegmentedControl<number>
          label="Zeitraum"
          options={HORIZONS}
          value={typeof horizon === 'number' ? horizon : -1}
          onChange={(months) => onHorizonChange(months as HorizonMonths)}
        />
        <Input
          id="whatif-until"
          type="date"
          value={until}
          min={today}
          onChange={(event) => {
            const picked = event.target.value
            if (picked !== '' && picked >= today) onHorizonChange(picked)
          }}
          className="h-11 rounded-md"
        />
      </div>

      <div aria-live="polite">
        {hasCuts ? (
          <>
            <p className="text-label text-fg-muted">Bis {formatDate(until)} mehr gespart</p>
            <p className="text-display font-bold tracking-tight text-saved">
              +<Money cents={scenario.gainCents} decimals={false} />
            </p>
            <p className="text-label text-fg-muted">
              <Money cents={scenarioEnd} decimals={false} className="text-fg" /> statt{' '}
              <Money cents={baselineEnd} decimals={false} /> in allen Töpfen ·{' '}
              <Money cents={scenario.extraPerWeekCents} decimals={false} /> pro Woche ×{' '}
              {scenario.weeks} {scenario.weeks === 1 ? 'Woche' : 'Wochen'}
            </p>
          </>
        ) : (
          <>
            <p className="text-label text-fg-muted">Bis {formatDate(until)} in allen Töpfen</p>
            <p className="text-display font-bold tracking-tight">
              <Money cents={baselineEnd} decimals={false} />
            </p>
            <p className="text-label text-fg-muted">
              Wenn alles so bleibt. Zieh bei „Weniger ausgeben" an einem Regler, um zu sehen, was
              weniger Ausgaben bringen.
            </p>
          </>
        )}
      </div>

      <p className="border-t pt-3 text-label text-fg-muted">
        Start: <Money cents={base.startBalanceCents} decimals={false} /> in allen Töpfen · Basis:{' '}
        <Money cents={base.baselineWeeklySavingCents} decimals={false} /> pro Woche{' '}
        {base.basisWeeks > 0
          ? `(Ø der letzten ${base.basisWeeks === 1 ? 'abgeschlossenen Woche' : `${base.basisWeeks} abgeschlossenen Wochen`})`
          : '(Standard-Einkommen minus Wochenbudget, bis du eine Woche abschließt)'}
      </p>
    </GlassCard>
  )
}
