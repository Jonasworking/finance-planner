import { useReducedMotion } from 'motion/react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatDisplayUnits, formatMoney, type MoneyDisplay } from '@/lib/money'
import type { CumulativeRow } from '../chartData'
import { ChartTooltip } from './ChartTooltip'
import { ANIMATION_MS, AXIS_TICK, BASELINE_STROKE, GRID_STROKE, SERIES } from './theme'

interface CumulativeTooltipProps {
  active?: boolean
  payload?: readonly { payload?: CumulativeRow }[]
  display: MoneyDisplay
}

function CumulativeTooltip({ active, payload, display }: CumulativeTooltipProps) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return (
    <ChartTooltip
      title={`bis ${row.title}`}
      rows={[
        { label: 'gespart', value: formatMoney(row.totalCents, display), color: SERIES.saved },
      ]}
    />
  )
}

export interface CumulativeChartProps {
  rows: readonly CumulativeRow[]
  display: MoneyDisplay
}

/**
 * Running total of the weekly closes: one series, so a 2px line over a light wash down to the
 * zero line, the newest point marked. The crosshair finds the week – nobody has to hit the line.
 */
export function CumulativeChart({ rows, display }: CumulativeChartProps) {
  const animate = !useReducedMotion()
  const last = rows.length - 1
  const hasNegative = rows.some((row) => row.total < 0)

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={rows as CumulativeRow[]} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <XAxis
          dataKey="tick"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={hasNegative ? false : { stroke: BASELINE_STROKE }}
          interval="preserveStartEnd"
          minTickGap={10}
          // A point scale puts the first and last label ON the plot edges – keep them inside.
          padding={{ left: 12, right: 16 }}
        />
        <YAxis
          width="auto"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          tickCount={5}
          tickFormatter={(units: number) => formatDisplayUnits(units, display)}
        />
        {hasNegative ? <ReferenceLine y={0} stroke={BASELINE_STROKE} /> : null}
        <Tooltip
          cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }}
          isAnimationActive={false}
          content={<CumulativeTooltip display={display} />}
        />
        <Area
          type="linear"
          dataKey="total"
          stroke={SERIES.saved}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill={SERIES.saved}
          fillOpacity={0.1}
          baseValue={0}
          isAnimationActive={animate}
          animationDuration={ANIMATION_MS}
          dot={({ cx, cy, index }: { cx?: number; cy?: number; index?: number }) =>
            index === last && cx != null && cy != null ? (
              <circle
                key="end"
                cx={cx}
                cy={cy}
                r={4}
                fill={SERIES.saved}
                stroke="var(--surface-1)"
                strokeWidth={2}
              />
            ) : (
              <g key={index} />
            )
          }
          activeDot={{ r: 4, fill: SERIES.saved, stroke: 'var(--surface-1)', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
