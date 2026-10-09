import { cumulativeSavings } from './analytics'
import { addWeeksISO, daysBetween, weekEndOf, weekStartOf } from './dates'
import { potBalances, type WeekSummary } from './savings'
import {
  isActive,
  PRIMARY_POT_ID,
  type Cents,
  type ISODate,
  type Pot,
  type PotTransaction,
} from './types'

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
  /**
   * Where the income comes from: entered for the week, the wage credits the bank import saw
   * in it, or the default income.
   */
  source: 'entered' | 'bank' | 'default'
  /** True while the week's income has not been entered – bank or default income is assumed. */
  isEstimate: boolean
  /** Booking days of the wage credits (oldest first, distinct) – only with `source: 'bank'`. */
  wageDays: ISODate[]
  /** income − spent − still reserved standing orders. */
  projectedSavedCents: Cents
}

/**
 * "Voraussichtlich gespart": meaningful from day one, even though nothing is closed yet.
 * Same order as the close-week prefill: entered income, then the wage the bank saw, then the
 * default. Display only – the week's income is written when the week is closed.
 */
export function projectWeek(input: {
  incomeCents: Cents | null
  /** Wage credits of the week from the bank import (`incomeSuggestion`), if any. */
  bankIncome?: { totalCents: Cents; credits: readonly { date: ISODate }[] } | null
  defaultIncomeCents: Cents
  spentCents: Cents
  reservedCents: Cents
}): WeekProjection {
  const bank = input.incomeCents === null ? (input.bankIncome ?? null) : null
  const incomeCents = input.incomeCents ?? bank?.totalCents ?? input.defaultIncomeCents
  return {
    incomeCents,
    source: input.incomeCents !== null ? 'entered' : bank ? 'bank' : 'default',
    isEstimate: input.incomeCents === null,
    wageDays: bank ? [...new Set(bank.credits.map((credit) => credit.date))].sort() : [],
    projectedSavedCents: incomeCents - input.spentCents - input.reservedCents,
  }
}

/** How many closed weeks the home screen's savings curve looks back. */
export const SAVINGS_TREND_WEEKS = 12

export interface SavingsOverview {
  /** Everything in the pots that are in use (not archived). */
  totalCents: Cents
  /** "Nur gespart" on its own … */
  primaryCents: Cents
  /** … and the other pots in use: how many there are and what they hold. */
  otherPots: number
  otherCents: Cents
  /**
   * What happened to the total since the last closed week ended: that week's saving plus every
   * booking after its Sunday. Null until a week is closed.
   */
  change: { deltaCents: Cents; since: ISODate } | null
  /**
   * The total after each of the last closed weeks, oldest first, led by where it stood before
   * them – so one closed week already makes a line. It ends at `totalCents`: the weeks' savings
   * are counted back from today's total. Empty until a week is closed.
   */
  trend: { weekStart: ISODate; totalCents: Cents }[]
}

/** The savings card of the home screen: total, split, latest change and the curve. */
export function savingsOverview(input: {
  pots: readonly Pot[]
  potTransactions: readonly PotTransaction[]
  /** Summaries of the closed weeks, in any order (open ones are ignored). */
  closedWeeks: readonly WeekSummary[]
}): SavingsOverview {
  const inUse = new Set(
    input.pots.filter((pot) => isActive(pot) && !pot.archived).map((pot) => pot.id),
  )
  const bookings = input.potTransactions.filter((tx) => isActive(tx) && inUse.has(tx.potId))
  const balances = potBalances(bookings)
  const totalCents = bookings.reduce((sum, tx) => sum + tx.amountCents, 0)
  const primaryCents = inUse.has(PRIMARY_POT_ID) ? (balances[PRIMARY_POT_ID] ?? 0) : 0

  const closed = input.closedWeeks
    .filter((week) => week.closed)
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
  const recent = closed.slice(-SAVINGS_TREND_WEEKS)
  const first = recent[0]
  const last = recent[recent.length - 1]

  let change: SavingsOverview['change'] = null
  let trend: SavingsOverview['trend'] = []
  if (first && last) {
    const since = weekEndOf(last.weekStart)
    change = {
      since,
      deltaCents: bookings
        .filter((tx) => tx.date > since || (tx.type === 'auto-weekly' && tx.date === since))
        .reduce((sum, tx) => sum + tx.amountCents, 0),
    }
    const before = totalCents - recent.reduce((sum, week) => sum + week.savedCents, 0)
    trend = [
      { weekStart: addWeeksISO(first.weekStart, -1), totalCents: before },
      ...cumulativeSavings(recent, before),
    ]
  }

  return {
    totalCents,
    primaryCents,
    otherPots: inUse.size - (inUse.has(PRIMARY_POT_ID) ? 1 : 0),
    otherCents: totalCents - primaryCents,
    change,
    trend,
  }
}
