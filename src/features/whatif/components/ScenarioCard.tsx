import { lazy, useMemo } from 'react'
import { formatWeekRange } from '@/lib/dates'
import type { ScenarioPoint } from '@/lib/whatif'
import { ChartCard, type ChartTable, type LegendItem } from '@/shared/components/ChartCard'
import { Money } from '@/shared/components/Money'
import { SegmentedControl } from '@/shared/components/SegmentedControl'
import { scenarioTableRows, toScenarioRows } from '../chartData'
import type { ScenarioView } from '../whatIfStore'

const ScenarioChart = lazy(() =>
  import('../charts').then((module) => ({ default: module.ScenarioChart })),
)

const LEGEND: Record<ScenarioView, LegendItem[]> = {
  gain: [
    { label: 'Mehr gespart', swatch: 'bg-chart-saved', mark: 'line' },
    { label: 'Basis', swatch: 'bg-fg-subtle', mark: 'line' },
  ],
  total: [
    { label: 'Mit Szenario', swatch: 'bg-chart-saved', mark: 'line' },
    { label: 'Basis', swatch: 'bg-fg-subtle', mark: 'line' },
  ],
}

const SUBTITLE: Record<ScenarioView, string> = {
  gain: 'Wie weit das Szenario vor der Basis liegt.',
  total: 'Alle Töpfe zusammen, Woche für Woche.',
}

const VIEWS = [
  { value: 'gain', label: 'Unterschied' },
  { value: 'total', label: 'Gesamt' },
] as const

export interface ScenarioCardProps {
  /** May trail the sliders by a frame (deferred) – what the card SAYS comes from the props below. */
  points: readonly ScenarioPoint[]
  weeks: number
  hasGain: boolean
  view: ScenarioView
  onViewChange: (view: ScenarioView) => void
}

/** "Verlauf": baseline against scenario – as the lead the cuts build up, or both balances. */
export function ScenarioCard({ points, weeks, hasGain, view, onViewChange }: ScenarioCardProps) {
  const rows = useMemo(() => toScenarioRows(points), [points])

  const table: ChartTable = {
    columns: ['Bis Woche', 'Basis', 'Szenario', 'Mehr'],
    rows: scenarioTableRows(rows).map((row) => ({
      key: row.key,
      cells: [
        formatWeekRange(row.key),
        <Money key="baseline" cents={row.baselineCents} decimals={false} />,
        <Money key="scenario" cents={row.scenarioCents} decimals={false} />,
        <Money key="gain" cents={row.scenarioCents - row.baselineCents} decimals={false} />,
      ],
    })),
  }

  return (
    <ChartCard
      title="Verlauf"
      subtitle={SUBTITLE[view]}
      legend={LEGEND[view]}
      table={table}
      plotClassName="h-56"
      before={
        <SegmentedControl<ScenarioView>
          label="Darstellung"
          options={VIEWS}
          value={view}
          onChange={onViewChange}
        />
      }
      empty={
        weeks < 2
          ? 'Wähle ein Zieldatum ab nächster Woche, dann zeigt sich hier die Kurve.'
          : view === 'gain' && !hasGain
            ? 'Noch kein Unterschied: Zieh bei „Weniger ausgeben" an einem Regler, dann wächst hier der Vorsprung.'
            : undefined
      }
    >
      <ScenarioChart rows={rows} view={view} />
    </ChartCard>
  )
}
