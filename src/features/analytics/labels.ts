import type { AnalyticsRange, Granularity } from '@/lib/analytics'
import {
  formatDayRange,
  formatMonth,
  formatWeekRange,
  formatWeekTick,
  monthOfWeek,
  weekEndOf,
} from '@/lib/dates'
import type { ISODate } from '@/lib/types'
import type { SegmentedOption } from '@/shared/components/SegmentedControl'

export const GRANULARITY_OPTIONS: readonly SegmentedOption<Granularity>[] = [
  { value: 'week', label: 'Wochen' },
  { value: 'month', label: 'Monate' },
]

export const RANGE_OPTIONS: readonly SegmentedOption<AnalyticsRange>[] = [
  { value: 8, label: '8 W', ariaLabel: '8 Wochen' },
  { value: 12, label: '12 W', ariaLabel: '12 Wochen' },
  { value: 26, label: '26 W', ariaLabel: '26 Wochen' },
  { value: 'all', label: 'Alles', ariaLabel: 'Gesamter Zeitraum' },
]

/** A period spelled out: "14.–20. Sep. 2026" or "September 2026". */
export const periodLabel = (key: string, granularity: Granularity): string =>
  granularity === 'week' ? formatWeekRange(key) : formatMonth(key)

/** A period on a chart axis: "14.9." or "Sep 26". */
export const periodTick = (key: string, granularity: Granularity): string =>
  granularity === 'week' ? formatWeekTick(key) : formatMonth(key, 'short')

/** What the selection covers, for the page header. */
export function selectionLabel(weekStarts: readonly ISODate[], granularity: Granularity): string {
  const first = weekStarts[0]
  const last = weekStarts.at(-1)
  if (!first || !last) return ''
  if (granularity === 'week') return formatDayRange(first, weekEndOf(last))
  const [from, to] = [monthOfWeek(first), monthOfWeek(last)]
  return from === to ? formatMonth(to) : `${formatMonth(from)} – ${formatMonth(to)}`
}

export const weeksLabel = (count: number): string => (count === 1 ? '1 Woche' : `${count} Wochen`)
