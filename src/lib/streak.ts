import { addWeeksISO, weekStartOf } from './dates'
import type { WeekSummary } from './savings'
import type { ISODate } from './types'

export interface Streak {
  /** Weeks in a row under budget, ending at the latest closed week. 0 while `stale`. */
  current: number
  best: number
  /**
   * True when the latest closed week is older than last week: there are weeks to close before
   * the streak can be shown ("Wochen abschließen, um den Streak zu sehen").
   */
  stale: boolean
}

/**
 * A streak is a run of calendar-contiguous CLOSED weeks with `spent <= limit`.
 * An unclosed week in between breaks the run; weeks without a budget are ignored entirely.
 */
export function computeStreak(summaries: readonly WeekSummary[], today: ISODate): Streak {
  const closed = summaries
    .filter((summary) => summary.closed && summary.underBudget !== null)
    .sort((a, b) => (a.weekStart < b.weekStart ? -1 : a.weekStart > b.weekStart ? 1 : 0))

  let best = 0
  let run = 0
  let previous: ISODate | null = null
  for (const summary of closed) {
    const contiguous = previous !== null && addWeeksISO(previous, 1) === summary.weekStart
    run = summary.underBudget ? (contiguous ? run + 1 : 1) : 0
    best = Math.max(best, run)
    previous = summary.weekStart
  }

  const latest = closed.at(-1)
  if (!latest) return { current: 0, best: 0, stale: false }

  const lastWeek = addWeeksISO(weekStartOf(today), -1)
  const stale = latest.weekStart < lastWeek
  return { current: stale ? 0 : run, best, stale }
}
