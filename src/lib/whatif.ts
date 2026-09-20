import { listWeeks, weekStartOf } from './dates'
import type { WeekSummary } from './savings'
import type { Cents, ISODate } from './types'

export interface Adjustment {
  categoryId: string
  /** Positive = spend this much LESS per week in the category (so more is saved). */
  deltaCentsPerWeek: Cents
}

export interface ScenarioPoint {
  weekStart: ISODate
  baselineCents: Cents
  scenarioCents: Cents
}

export interface Scenario {
  /** Balance after each week closes; the first point is the week of `from`. */
  points: ScenarioPoint[]
  weeks: number
  extraPerWeekCents: Cents
  /** "… habe ich bis Datum Y Z A$ mehr". */
  gainCents: Cents
}

/** Projects savings week by week: baseline tempo vs. tempo with the adjustments applied. */
export function projectScenario(input: {
  startBalanceCents: Cents
  baselineWeeklySavingCents: Cents
  adjustments: readonly Adjustment[]
  from: ISODate
  until: ISODate
}): Scenario {
  const extraPerWeekCents = input.adjustments.reduce((sum, a) => sum + a.deltaCentsPerWeek, 0)
  const weekStarts = listWeeks(weekStartOf(input.from), weekStartOf(input.until))

  let baseline = input.startBalanceCents
  let scenario = input.startBalanceCents
  const points = weekStarts.map((weekStart) => {
    baseline += input.baselineWeeklySavingCents
    scenario += input.baselineWeeklySavingCents + extraPerWeekCents
    return { weekStart, baselineCents: baseline, scenarioCents: scenario }
  })

  return {
    points,
    weeks: points.length,
    extraPerWeekCents,
    gainCents: extraPerWeekCents * points.length,
  }
}

/**
 * Baseline tempo = average saved over the last `windowWeeks` closed weeks;
 * `fallbackCents` (e.g. default income − budget limit) while there is no history.
 */
export function baselineWeeklySaving(
  summaries: readonly WeekSummary[],
  fallbackCents: Cents,
  windowWeeks = 8,
): Cents {
  const closed = summaries
    .filter((summary) => summary.closed)
    .sort((a, b) => (a.weekStart < b.weekStart ? -1 : a.weekStart > b.weekStart ? 1 : 0))
    .slice(-windowWeeks)
  if (closed.length === 0) return fallbackCents
  return Math.round(closed.reduce((sum, summary) => sum + summary.savedCents, 0) / closed.length)
}
