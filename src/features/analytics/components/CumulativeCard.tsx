import { lazy, useMemo } from 'react'
import { formatWeekRange } from '@/lib/dates'
import type { Cents, MoneyDisplay } from '@/lib/money'
import type { ISODate } from '@/lib/types'
import { Money } from '@/shared/components/Money'
import { toCumulativeRows } from '../chartData'
import { weeksLabel } from '../labels'
import { ChartCard, type ChartTable } from '@/shared/components/ChartCard'

const CumulativeChart = lazy(() =>
  import('../charts').then((module) => ({ default: module.CumulativeChart })),
)

export interface CumulativeCardProps {
  /** Running total per closed week of the selection, oldest first. */
  cumulative: readonly { weekStart: ISODate; totalCents: Cents }[]
  display: MoneyDisplay
}

/** "Sparverlauf": what the weekly closes of the selection have added up to. */
export function CumulativeCard({ cumulative, display }: CumulativeCardProps) {
  const rows = useMemo(() => toCumulativeRows(cumulative, display), [cumulative, display])
  const total = cumulative.at(-1)?.totalCents ?? 0

  const table: ChartTable = {
    columns: ['Bis Woche', 'Gespart insgesamt'],
    rows: [...cumulative].reverse().map((point) => ({
      key: point.weekStart,
      cells: [
        formatWeekRange(point.weekStart, { year: false }),
        <Money key="total" cents={point.totalCents} display={display} />,
      ],
    })),
  }

  return (
    <ChartCard
      title="Sparverlauf"
      subtitle={
        cumulative.length >= 2 ? (
          <>
            <Money cents={total} decimals={false} display={display} /> aus{' '}
            {weeksLabel(cumulative.length)} mit Abschluss – Woche für Woche aufsummiert.
          </>
        ) : undefined
      }
      table={table}
      plotClassName="h-52"
      empty={
        cumulative.length >= 2
          ? undefined
          : 'Ab zwei abgeschlossenen Wochen siehst du hier, wie dein Erspartes Woche für Woche wächst.'
      }
    >
      <CumulativeChart rows={rows} display={display} />
    </ChartCard>
  )
}
