import type { FlowPoint, FoldedSlices, Granularity } from '@/lib/analytics'
import { displayUnits, type Cents, type MoneyDisplay } from '@/lib/money'
import type { Category, ISODate } from '@/lib/types'
import { CHART_OTHER, chartColor } from '@/shared/lib/categoryStyle'
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

/** Id of the slice that stands for the folded tail of small categories. */
export const REST_SLICE_ID = '__rest'

export interface DonutRow {
  /** Category id, or `REST_SLICE_ID`. */
  id: string
  name: string
  icon: string
  /** Token key of the category color (chips), and the chart step of the same hue. */
  color: string
  fill: string
  swatch: string
  amountCents: Cents
  share: number
  /** Slice size; shares do not depend on the currency, cents keep it exact. */
  value: number
}

/** A category that no longer exists still has spending – it keeps a neutral name and color. */
const FALLBACK = { name: 'Gelöschte Kategorie', icon: 'Ellipsis', color: 'cat-10' }

export function toDonutRows(folded: FoldedSlices, categories: readonly Category[]): DonutRow[] {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const rows: DonutRow[] = folded.top.map((slice) => {
    const category = byId.get(slice.categoryId) ?? FALLBACK
    return {
      id: slice.categoryId,
      name: category.name,
      icon: category.icon,
      color: category.color,
      ...chartColor(category.color),
      amountCents: slice.amountCents,
      share: slice.share,
      value: slice.amountCents,
    }
  })
  if (folded.rest) {
    rows.push({
      id: REST_SLICE_ID,
      name: `Übrige (${folded.rest.slices.length})`,
      icon: 'Ellipsis',
      color: 'cat-10',
      ...CHART_OTHER,
      amountCents: folded.rest.amountCents,
      share: folded.rest.share,
      value: folded.rest.amountCents,
    })
  }
  return rows
}

export interface TrendRow {
  key: string
  tick: string
  title: string
  amount: number
  amountCents: Cents
}

export function toTrendRows(
  trend: readonly { key: ISODate | string; amountCents: Cents }[],
  granularity: Granularity,
  display: MoneyDisplay,
): TrendRow[] {
  return trend.map((point) => ({
    key: point.key,
    tick: periodTick(point.key, granularity),
    title: periodLabel(point.key, granularity),
    amount: displayUnits(point.amountCents, display),
    amountCents: point.amountCents,
  }))
}
