import type { FlowPoint, Granularity } from '@/lib/analytics'
import { displayUnits, type MoneyDisplay } from '@/lib/money'
import { periodLabel, periodTick } from './labels'

/*
 * Rows the charts draw. Kept apart from the chart components (which import Recharts and live
 * in the lazy chunk) so that the numbers can be tested without rendering SVG.
 */

export interface FlowRow {
  key: string
  tick: string
  title: string
  /** Axis values in the shown currency's major unit. */
  spent: number
  saved: number
  open: number
  /** Null where there is no income to mark (open weeks). */
  income: number | null
  point: FlowPoint
}

export function toFlowRows(
  points: readonly FlowPoint[],
  granularity: Granularity,
  display: MoneyDisplay,
): FlowRow[] {
  return points.map((point) => ({
    key: point.key,
    tick: periodTick(point.key, granularity),
    title: periodLabel(point.key, granularity),
    spent: displayUnits(point.spentCents, display),
    saved: displayUnits(point.savedCents, display),
    open: displayUnits(point.openBarCents, display),
    income: point.weeks > 0 ? displayUnits(point.incomeCents, display) : null,
    point,
  }))
}
