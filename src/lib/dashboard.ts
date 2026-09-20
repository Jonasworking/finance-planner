import { addWeeksISO, daysBetween, weekEndOf, weekStartOf } from './dates'
import type { Cents, ISODate } from './types'

/** Where we are in the current Monday–Sunday week. */
export function weekProgress(today: ISODate): { dayIndex: number; daysLeft: number } {
  const dayIndex = daysBetween(weekStartOf(today), today)
  return { dayIndex, daysLeft: 6 - dayIndex }
}

export type NextStep =
  | { kind: 'close-pending'; count: number; oldest: ISODate }
  | { kind: 'first-expense' }
  | { kind: 'close-current'; weekStart: ISODate }
  | { kind: 'add-recurring' }
  | { kind: 'all-set'; nextCloseOn: ISODate }

/**
 * The ONE thing the home screen asks for – so it is useful from the first minute, long before
 * any week has been closed. Priority: catch up on finished weeks → start tracking → close the
 * week that is ending (Sat/Sun) → set up rent as a standing order (only in the early days, so it
 * never nags) → nothing to do.
 */
export function nextStep(input: {
  today: ISODate
  pendingWeeks: readonly ISODate[]
  hasAnyExpense: boolean
  hasRecurring: boolean
  currentWeekClosed: boolean
  closedWeeks: number
}): NextStep {
  const oldest = input.pendingWeeks[0]
  if (oldest) return { kind: 'close-pending', count: input.pendingWeeks.length, oldest }
  if (!input.hasAnyExpense) return { kind: 'first-expense' }

  const weekStart = weekStartOf(input.today)
  if (!input.currentWeekClosed && weekProgress(input.today).daysLeft <= 1) {
    return { kind: 'close-current', weekStart }
  }
  if (!input.hasRecurring && input.closedWeeks < 2) return { kind: 'add-recurring' }

  // Already closed this week → the next close is due at the end of next week.
  const closingWeek = input.currentWeekClosed ? addWeeksISO(weekStart, 1) : weekStart
  return { kind: 'all-set', nextCloseOn: weekEndOf(closingWeek) }
}

export interface WeekProjection {
  incomeCents: Cents
  /** True while the week's income has not been entered – the default income is assumed. */
  isEstimate: boolean
  /** income − spent − still reserved standing orders. */
  projectedSavedCents: Cents
}

/** "Voraussichtlich gespart": meaningful from day one, even though nothing is closed yet. */
export function projectWeek(input: {
  incomeCents: Cents | null
  defaultIncomeCents: Cents
  spentCents: Cents
  reservedCents: Cents
}): WeekProjection {
  const isEstimate = input.incomeCents === null
  const incomeCents = input.incomeCents ?? input.defaultIncomeCents
  return {
    incomeCents,
    isEstimate,
    projectedSavedCents: incomeCents - input.spentCents - input.reservedCents,
  }
}
