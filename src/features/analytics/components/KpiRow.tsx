import type { RangeTotals } from '@/lib/analytics'
import type { Cents, MoneyDisplay } from '@/lib/money'
import { GlassCard } from '@/shared/components/GlassCard'
import { Money } from '@/shared/components/Money'
import { cn } from '@/shared/lib/utils'
import { weeksLabel } from '../labels'

const percent = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 0 })

interface TileProps {
  label: string
  /** Series swatch next to the label – the value itself stays in text color. */
  swatch?: string
  children: React.ReactNode
}

function Tile({ label, swatch, children }: TileProps) {
  return (
    <GlassCard className="flex min-w-0 flex-col gap-1 p-3 sm:p-4">
      <p className="flex items-center gap-1.5 text-label text-fg-muted">
        {swatch ? (
          <span className={cn('size-2 shrink-0 rounded-full', swatch)} aria-hidden />
        ) : null}
        <span className="truncate">{label}</span>
      </p>
      <p className="truncate text-h2">{children}</p>
    </GlassCard>
  )
}

export interface KpiRowProps {
  totals: RangeTotals
  display: MoneyDisplay
}

/** Headline numbers of the selection – sums over CLOSED weeks, open ones are named below. */
export function KpiRow({ totals, display }: KpiRowProps) {
  const amount = (cents: Cents) => <Money cents={cents} decimals={false} display={display} />
  return (
    <section aria-label="Summen im Zeitraum" className="flex flex-col gap-2">
      <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2 lg:grid-cols-[repeat(4,minmax(0,1fr))] lg:gap-4">
        <Tile label="Verdient" swatch="bg-chart-income">
          {amount(totals.incomeCents)}
        </Tile>
        <Tile label="Ausgegeben" swatch="bg-chart-spent">
          {amount(totals.spentCents)}
        </Tile>
        <Tile label="Gespart" swatch="bg-chart-saved">
          {amount(totals.savedCents)}
        </Tile>
        <Tile label="Sparquote">
          <span className="tabular-nums">
            {totals.incomeCents > 0 ? percent.format(totals.savingsRate) : '–'}
          </span>
        </Tile>
      </div>
      <p className="px-1 text-label text-fg-muted">
        {totals.closedWeeks === 0
          ? 'Noch keine Woche abgeschlossen – die Summen füllen sich mit dem ersten Abschluss.'
          : `Aus ${weeksLabel(totals.closedWeeks)} mit Abschluss.`}
        {totals.openWeeks > 0 ? (
          <>
            {' '}
            {totals.openWeeks === 1 ? '1 Woche ist' : `${totals.openWeeks} Wochen sind`} noch offen
            (<Money cents={totals.openSpentCents} decimals={false} display={display} /> ausgegeben)
            und {totals.openWeeks === 1 ? 'zählt' : 'zählen'} erst nach dem Abschluss mit.
          </>
        ) : null}
      </p>
    </section>
  )
}
