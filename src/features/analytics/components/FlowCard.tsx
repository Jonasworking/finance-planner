import { lazy, useMemo } from 'react'
import type { FlowPoint, Granularity } from '@/lib/analytics'
import { formatWeekRange } from '@/lib/dates'
import type { MoneyDisplay } from '@/lib/money'
import { Money } from '@/shared/components/Money'
import { toFlowRows } from '../chartData'
import { periodLabel, weeksLabel } from '../labels'
import { ChartCard, type ChartTable, type LegendItem } from '@/shared/components/ChartCard'

const FlowChart = lazy(() => import('../charts').then((module) => ({ default: module.FlowChart })))

const LEGEND: readonly LegendItem[] = [
  { label: 'Ausgegeben', swatch: 'bg-chart-spent' },
  { label: 'Gespart', swatch: 'bg-chart-saved' },
  { label: 'Verdient', swatch: 'bg-chart-income', mark: 'line' },
]
const OPEN_LEGEND: LegendItem = {
  label: 'noch offen: bisher ausgegeben',
  swatch: 'bg-chart-spent',
  pale: true,
}

/** Table cells are narrow on a phone: the week without its year. */
const shortWeek = (weekStart: string) => formatWeekRange(weekStart, { year: false })

export interface FlowCardProps {
  points: readonly FlowPoint[]
  granularity: Granularity
  display: MoneyDisplay
}

/** "Verdient · Ausgegeben · Gespart" per week or month. */
export function FlowCard({ points, granularity, display }: FlowCardProps) {
  const byMonth = granularity === 'month'
  const rows = useMemo(
    () => toFlowRows(points, granularity, display),
    [points, granularity, display],
  )
  const hasOpen = points.some((point) => point.openBarCents > 0)
  const hasAnything = points.some((point) => point.weeks > 0 || point.openBarCents > 0)

  const amount = (cents: number) => <Money cents={cents} decimals={false} display={display} />
  const table: ChartTable = {
    columns: [byMonth ? 'Monat' : 'Woche', 'Verdient', 'Ausgegeben', 'Gespart'],
    rows: [...points].reverse().map((point) => ({
      key: point.key,
      cells:
        point.weeks > 0
          ? [
              <>
                {byMonth ? periodLabel(point.key, granularity) : shortWeek(point.key)}
                {byMonth ? (
                  <span className="block text-fg-subtle">Ø aus {weeksLabel(point.weeks)}</span>
                ) : null}
              </>,
              amount(point.incomeCents),
              amount(point.spentCents),
              amount(point.savedCents),
            ]
          : [
              <>
                {byMonth ? periodLabel(point.key, granularity) : shortWeek(point.key)}
                <span className="block text-fg-subtle">noch offen</span>
              </>,
              '–',
              amount(point.openSpentCents),
              '–',
            ],
    })),
  }

  return (
    <ChartCard
      title="Verdient, ausgegeben, gespart"
      subtitle={
        byMonth
          ? 'Ø pro Woche je Monat – Monate haben vier oder fünf Wochen.'
          : 'Ausgegeben und gespart ergeben zusammen, was du verdient hast.'
      }
      legend={hasOpen ? [...LEGEND, OPEN_LEGEND] : LEGEND}
      table={table}
      empty={
        hasAnything
          ? undefined
          : 'Hier erscheint jede Woche als Säule, sobald du Ausgaben erfasst oder eine Woche abschließt.'
      }
    >
      <FlowChart rows={rows} granularity={granularity} display={display} />
    </ChartCard>
  )
}
