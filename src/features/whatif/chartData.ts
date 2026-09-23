import { formatMonth, formatWeekRange, monthOfWeek } from '@/lib/dates'
import type { Cents, ISODate } from '@/lib/types'
import type { ScenarioPoint } from '@/lib/whatif'

/*
 * Rows the scenario chart draws – kept apart from the chart (Recharts, lazy chunk) so the
 * numbers can be tested without rendering SVG. Values are whole A$ on the axis, cents for text.
 */

export interface ScenarioRow {
  key: ISODate
  /** Month of the week ("Okt 26"), used by the axis on the first week of each month. */
  tick: string
  title: string
  baseline: number
  scenario: number
  /** The band between both lines – what the scenario adds. */
  gain: [number, number]
  /** Scenario minus baseline: the lead the cuts have built up by this week. */
  diff: number
  baselineCents: Cents
  scenarioCents: Cents
}

export function toScenarioRows(points: readonly ScenarioPoint[]): ScenarioRow[] {
  return points.map((point) => ({
    key: point.weekStart,
    tick: formatMonth(monthOfWeek(point.weekStart), 'short'),
    title: `bis ${formatWeekRange(point.weekStart)}`,
    baseline: point.baselineCents / 100,
    scenario: point.scenarioCents / 100,
    gain: [point.baselineCents / 100, point.scenarioCents / 100],
    diff: (point.scenarioCents - point.baselineCents) / 100,
    baselineCents: point.baselineCents,
    scenarioCents: point.scenarioCents,
  }))
}

/** Axis ticks: the first week of every month (a month's weeks follow the Thursday rule). */
export function monthTicks(rows: readonly ScenarioRow[]): ISODate[] {
  return rows
    .filter((row, index) => index === 0 || rows[index - 1]?.tick !== row.tick)
    .map((row) => row.key)
}

/** The table twin: the last week of every month and the final week – a row per week is too long. */
export function scenarioTableRows(rows: readonly ScenarioRow[]): ScenarioRow[] {
  return rows.filter(
    (row, index) => index === rows.length - 1 || rows[index + 1]?.tick !== row.tick,
  )
}
