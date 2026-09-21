import { useReducedMotion } from 'motion/react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
} from 'recharts'
import type { Granularity } from '@/lib/analytics'
import { formatDisplayUnits, formatMoney, type MoneyDisplay } from '@/lib/money'
import type { FlowRow } from '../chartData'
import { weeksLabel } from '../labels'
import { ChartTooltip, type TooltipRow } from './ChartTooltip'
import {
  ANIMATION_MS,
  AXIS_TICK,
  BASELINE_STROKE,
  CURSOR_FILL,
  GRID_STROKE,
  MAX_BAR_SIZE,
  SERIES,
} from './theme'

const RADIUS = 4
/** Surface-colored gap between the two segments of a column. */
const GAP = 2

/** `payload` is untyped in Recharts; it is the row we passed in. */
const rowOf = (props: BarShapeProps): FlowRow | undefined => props.payload as FlowRow | undefined

/** A rectangle whose DATA end is rounded; the end on the baseline (or on a neighbor) is square. */
function segmentPath(
  x: number,
  top: number,
  width: number,
  height: number,
  round: 'top' | 'bottom' | 'none',
) {
  const r = Math.min(RADIUS, width / 2, height)
  if (round === 'top') {
    return `M${x},${top + height}V${top + r}Q${x},${top} ${x + r},${top}H${x + width - r}Q${x + width},${top} ${x + width},${top + r}V${top + height}Z`
  }
  if (round === 'bottom') {
    const bottom = top + height
    return `M${x},${top}H${x + width}V${bottom - r}Q${x + width},${bottom} ${x + width - r},${bottom}H${x + r}Q${x},${bottom} ${x},${bottom - r}Z`
  }
  return `M${x},${top}H${x + width}V${top + height}H${x}Z`
}

function segment(kind: 'spent' | 'saved' | 'open') {
  return function Segment(props: BarShapeProps) {
    const row = rowOf(props)
    // Negative values arrive with a negative height – normalize to a top edge and a size.
    let top = Math.min(props.y, props.y + props.height)
    let size = Math.abs(props.height)
    if (size === 0 || !row) return null

    let round: 'top' | 'bottom' | 'none' = 'top'
    if (kind === 'spent' && row.saved > 0) {
      // "Gespart" sits on top: square end, and a gap in the surface color between the two.
      round = 'none'
      if (size > GAP + 1) {
        top += GAP
        size -= GAP
      }
    } else if (kind === 'saved' && row.saved < 0) {
      round = 'bottom' // a minus week hangs below the baseline
    }
    return (
      <path
        d={segmentPath(props.x, top, props.width, size, round)}
        fill={props.fill}
        fillOpacity={props.fillOpacity}
      />
    )
  }
}

const SpentSegment = segment('spent')
const SavedSegment = segment('saved')
const OpenSegment = segment('open')

/** "Verdient" as a marker across the column: where spent + saved add up to (or fall short of). */
function IncomeCap(props: BarShapeProps) {
  const row = rowOf(props)
  if (!row || row.income === null) return null
  return (
    <rect
      x={props.x - 3}
      y={props.y - 1}
      width={props.width + 6}
      height={2}
      rx={1}
      fill={SERIES.income}
      stroke="var(--surface-1)"
      strokeWidth={1}
      paintOrder="stroke"
    />
  )
}

interface FlowTooltipProps {
  active?: boolean
  payload?: readonly { payload?: FlowRow }[]
  granularity: Granularity
  display: MoneyDisplay
}

function FlowTooltip({ active, payload, granularity, display }: FlowTooltipProps) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  const { point } = row
  const money = (cents: number) => formatMoney(cents, display)
  const byMonth = granularity === 'month'

  const rows: TooltipRow[] =
    point.weeks > 0
      ? [
          { label: 'Verdient', value: money(point.incomeCents), color: SERIES.income },
          { label: 'Ausgegeben', value: money(point.spentCents), color: SERIES.spent },
          { label: 'Gespart', value: money(point.savedCents), color: SERIES.saved },
        ]
      : []
  if (point.openWeeks > 0) {
    rows.push({
      label: byMonth ? `offen (${weeksLabel(point.openWeeks)})` : 'bisher ausgegeben',
      value: money(point.openSpentCents),
      color: SERIES.spent,
      pale: true,
    })
  }

  const note =
    point.weeks === 0
      ? 'Noch nicht abgeschlossen – das Einkommen fehlt noch.'
      : byMonth
        ? `Ø pro Woche aus ${weeksLabel(point.weeks)} · gespart gesamt ${money(point.totalSavedCents)}`
        : undefined

  return <ChartTooltip title={row.title} rows={rows} note={note} />
}

export interface FlowChartProps {
  rows: readonly FlowRow[]
  granularity: Granularity
  display: MoneyDisplay
}

/**
 * One column per week (or month): "Ausgegeben" + "Gespart" stack up to what was earned, which a
 * marker repeats across the column – in a minus week the marker sits INSIDE the spending and
 * the shortfall hangs below the baseline. Weeks that are not closed yet only have their spending
 * so far, drawn pale.
 */
export function FlowChart({ rows, granularity, display }: FlowChartProps) {
  const animate = !useReducedMotion()
  const hasNegative = rows.some((row) => row.saved < 0)

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={rows as FlowRow[]}
        stackOffset="sign"
        margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
        barCategoryGap="20%"
      >
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <XAxis
          dataKey="tick"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={hasNegative ? false : { stroke: BASELINE_STROKE }}
          interval="preserveStartEnd"
          minTickGap={10}
        />
        {/* A second, hidden band scale lets the income marker overlay its column. */}
        <XAxis xAxisId="cap" dataKey="tick" hide />
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
          cursor={CURSOR_FILL}
          isAnimationActive={false}
          content={<FlowTooltip granularity={granularity} display={display} />}
        />
        <Bar
          dataKey="spent"
          stackId="flow"
          fill={SERIES.spent}
          maxBarSize={MAX_BAR_SIZE}
          shape={SpentSegment}
          isAnimationActive={animate}
          animationDuration={ANIMATION_MS}
        />
        <Bar
          dataKey="saved"
          stackId="flow"
          fill={SERIES.saved}
          maxBarSize={MAX_BAR_SIZE}
          shape={SavedSegment}
          isAnimationActive={animate}
          animationDuration={ANIMATION_MS}
        />
        <Bar
          dataKey="open"
          stackId="flow"
          fill={SERIES.spent}
          fillOpacity={0.4}
          maxBarSize={MAX_BAR_SIZE}
          shape={OpenSegment}
          isAnimationActive={animate}
          animationDuration={ANIMATION_MS}
        />
        <Bar
          xAxisId="cap"
          dataKey="income"
          fill={SERIES.income}
          maxBarSize={MAX_BAR_SIZE}
          shape={IncomeCap}
          isAnimationActive={false}
          legendType="none"
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
