import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AUD_DISPLAY, formatAUD, formatDisplayUnits } from '@/lib/money'
import { ChartTooltip } from '@/shared/components/ChartTooltip'
import { AXIS_TICK, BASELINE_STROKE, GRID_STROKE, SERIES } from '@/shared/lib/chartTheme'
import { monthTicks, type ScenarioRow } from '../chartData'
import type { ScenarioView } from '../whatIfStore'

/** The baseline is context, not a series of its own: the de-emphasis gray next to the accent. */
export const BASELINE_LINE = 'var(--fg-subtle)'

const LINE = { strokeWidth: 2, strokeLinejoin: 'round', strokeLinecap: 'round' } as const
const activeDot = (fill: string) => ({ r: 4, fill, stroke: 'var(--surface-1)', strokeWidth: 2 })

interface ScenarioTooltipProps {
  active?: boolean
  payload?: readonly { payload?: ScenarioRow }[]
}

function ScenarioTooltip({ active, payload }: ScenarioTooltipProps) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  const gain = row.scenarioCents - row.baselineCents
  return (
    <ChartTooltip
      title={row.title}
      rows={[
        { label: 'mit Szenario', value: formatAUD(row.scenarioCents), color: SERIES.saved },
        { label: 'Basis', value: formatAUD(row.baselineCents), color: BASELINE_LINE },
      ]}
      note={gain > 0 ? `+${formatAUD(gain)} mehr` : undefined}
    />
  )
}

export interface ScenarioChartProps {
  rows: readonly ScenarioRow[]
  view: ScenarioView
}

/**
 * `gain`: the baseline is the zero line and the scenario's lead grows above it – a cut of A$20 a
 * week is visible here, next to a four-figure weekly saving it would vanish. `total`: both
 * balances in full, the axis fitted to the data (lines, no bars – a zero base is not required).
 * No draw animation: the curve follows the sliders while they are dragged.
 */
export function ScenarioChart({ rows, view }: ScenarioChartProps) {
  const ticks = monthTicks(rows)
  const tickLabel = new Map(rows.map((row) => [row.key, row.tick]))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={rows as ScenarioRow[]} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <XAxis
          dataKey="key"
          ticks={ticks}
          tickFormatter={(key: string) => tickLabel.get(key) ?? ''}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={view === 'gain' ? false : { stroke: BASELINE_STROKE }}
          interval="preserveStartEnd"
          minTickGap={16}
          padding={{ left: 8, right: 12 }}
        />
        <YAxis
          width="auto"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          tickCount={5}
          domain={view === 'gain' ? [0, 'auto'] : ['auto', 'auto']}
          tickFormatter={(units: number) => formatDisplayUnits(units, AUD_DISPLAY)}
        />
        <Tooltip
          cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }}
          isAnimationActive={false}
          content={<ScenarioTooltip />}
        />
        {view === 'gain' ? (
          <>
            <ReferenceLine y={0} stroke={BASELINE_LINE} strokeWidth={2} />
            <Area
              type="linear"
              dataKey="diff"
              stroke={SERIES.saved}
              {...LINE}
              fill={SERIES.saved}
              fillOpacity={0.14}
              baseValue={0}
              dot={false}
              activeDot={activeDot(SERIES.saved)}
              isAnimationActive={false}
            />
          </>
        ) : (
          <>
            <Area
              type="linear"
              dataKey="gain"
              stroke="none"
              fill={SERIES.saved}
              fillOpacity={0.14}
              activeDot={false}
              isAnimationActive={false}
            />
            <Line
              type="linear"
              dataKey="baseline"
              stroke={BASELINE_LINE}
              {...LINE}
              dot={false}
              activeDot={activeDot(BASELINE_LINE)}
              isAnimationActive={false}
            />
            <Line
              type="linear"
              dataKey="scenario"
              stroke={SERIES.saved}
              {...LINE}
              dot={false}
              activeDot={activeDot(SERIES.saved)}
              isAnimationActive={false}
            />
          </>
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
