import { addWeeksISO, daysBetween, weekEndOf, weekStartOf } from './dates'
import {
  isActive,
  type Cents,
  type ISODate,
  type PotTransaction,
  type PotTransactionType,
} from './types'

/** Spending out of a pot is consumption, not a change of saving tempo. */
const NOT_PACE: ReadonlySet<PotTransactionType> = new Set(['withdrawal', 'expense-funding'])

/**
 * Average net contribution per week over the last `windowWeeks` FINISHED weeks.
 * Counts weekly savings (also negative ones), deposits and transfers in both directions;
 * ignores withdrawals and pot-funded expenses. A pot younger than the window is averaged over
 * its own age, so a new pot is not underestimated.
 */
export function weeklyPace(
  transactions: readonly PotTransaction[],
  potId: string,
  today: ISODate,
  windowWeeks = 8,
): Cents {
  const windowEnd = weekEndOf(addWeeksISO(weekStartOf(today), -1))
  const windowStart = addWeeksISO(weekStartOf(today), -windowWeeks)

  let firstDate: ISODate | null = null
  let sum = 0
  for (const tx of transactions) {
    if (!isActive(tx) || tx.potId !== potId || tx.date > windowEnd) continue
    if (firstDate === null || tx.date < firstDate) firstDate = tx.date
    if (tx.date >= windowStart && !NOT_PACE.has(tx.type)) sum += tx.amountCents
  }
  if (firstDate === null) return 0

  const ageWeeks = Math.floor(daysBetween(weekStartOf(firstDate), windowEnd) / 7) + 1
  const weeks = Math.max(1, Math.min(windowWeeks, ageWeeks))
  return Math.round(sum / weeks)
}

export interface PotForecast {
  reached: boolean
  /** Number of week closes still needed; null when the pot has no target or no positive pace. */
  weeksLeft: number | null
  /** "Bei aktuellem Tempo erreicht am …" – the Sunday of the week that gets there. */
  eta: ISODate | null
}

export function forecastPot(input: {
  balanceCents: Cents
  targetCents: Cents | null
  paceCentsPerWeek: Cents
  today: ISODate
}): PotForecast {
  const { balanceCents, targetCents, paceCentsPerWeek, today } = input
  if (targetCents === null) return { reached: false, weeksLeft: null, eta: null }
  if (balanceCents >= targetCents) return { reached: true, weeksLeft: 0, eta: today }
  if (paceCentsPerWeek <= 0) return { reached: false, weeksLeft: null, eta: null }

  const weeksLeft = Math.ceil((targetCents - balanceCents) / paceCentsPerWeek)
  // Contributions land when a week closes: the current week's Sunday is contribution #1.
  const eta = weekEndOf(addWeeksISO(weekStartOf(today), weeksLeft - 1))
  return { reached: false, weeksLeft, eta }
}

/** Week closes left until the deadline (at least one while the deadline is not in the past). */
export function weeksUntil(deadline: ISODate, today: ISODate): number | null {
  const days = daysBetween(today, deadline)
  return days < 0 ? null : Math.max(1, Math.ceil(days / 7))
}

/** "Nötig pro Woche": what must go in weekly to hit the target by the deadline. */
export function requiredWeeklyForDeadline(input: {
  balanceCents: Cents
  targetCents: Cents | null
  deadline: ISODate | null
  today: ISODate
}): Cents | null {
  const { balanceCents, targetCents, deadline, today } = input
  if (targetCents === null || deadline === null) return null
  if (balanceCents >= targetCents) return 0
  const weeks = weeksUntil(deadline, today)
  return weeks === null ? null : Math.ceil((targetCents - balanceCents) / weeks)
}

/** Weeks ahead (+) or behind (−) of the deadline at the forecast ETA; null without both dates. */
export function deadlineDelta(eta: ISODate | null, deadline: ISODate | null): number | null {
  if (eta === null || deadline === null) return null
  return Math.trunc(daysBetween(eta, deadline) / 7)
}
