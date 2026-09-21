import { useReducedMotion } from 'motion/react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDisplayUnits, formatMoney, type MoneyDisplay } from '@/lib/money'
import type { TrendRow } from '../chartData'
import { ChartTooltip } from './ChartTooltip'
import {
  ANIMATION_MS,
  AXIS_TICK,
  BASELINE_STROKE,
  CURSOR_FILL,
  GRID_STROKE,
  MAX_BAR_SIZE,
} from './theme'

interface TrendTooltipProps {
  active?: boolean
  payload?: readonly { payload?: TrendRow }[]
  fill: string
  display: MoneyDisplay
}

function TrendTooltip({ active, payload, fill, display }: TrendTooltipProps) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return (
    <ChartTooltip
      title={row.title}
      rows={[{ label: 'ausgegeben', value: formatMoney(row.amountCents, display), color: fill }]}
    />
  )
}

export interface CategoryTrendChartProps {
  rows: readonly TrendRow[]
  /** Chart step of the category's color (a CSS variable). */
  fill: string
  display: MoneyDisplay
}

/** One category over the selection: a single series, so one color and no legend. */
export function CategoryTrendChart({ rows, fill, display }: CategoryTrendChartProps) {
  const animate = !useReducedMotion()
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows as TrendRow[]} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <XAxis
          dataKey="tick"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: BASELINE_STROKE }}
          interval="preserveStartEnd"
          minTickGap={10}
        />
        <YAxis
          width="auto"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          tickCount={4}
          tickFormatter={(units: number) => formatDisplayUnits(units, display)}
        />
        <Tooltip
          cursor={CURSOR_FILL}
          isAnimationActive={false}
          content={<TrendTooltip fill={fill} display={display} />}
        />
        <Bar
          dataKey="amount"
          fill={fill}
          radius={[4, 4, 0, 0]}
          maxBarSize={MAX_BAR_SIZE}
          isAnimationActive={animate}
          animationDuration={ANIMATION_MS}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
