import { daysBetween } from './dates'
import {
  deadlineDelta,
  forecastPot,
  requiredWeeklyForDeadline,
  weeklyPace,
  type PotForecast,
} from './forecast'
import { ratio } from './money'
import { potBalances } from './savings'
import {
  isActive,
  type Cents,
  type Expense,
  type ISODate,
  type Pot,
  type PotTransaction,
} from './types'

/** Everything a pot's card and detail screen show – derived from its bookings, never stored. */
export interface PotSummary {
  pot: Pot
  balanceCents: Cents
  /** 0…1 of the way to the target; null without a target. */
  progress: number | null
  /** What is still missing; 0 once the target is reached, null without a target. */
  missingCents: Cents | null
  /** Average net contribution per finished week (see `weeklyPace`). */
  paceCentsPerWeek: Cents
  forecast: PotForecast
  /** "Nötig pro Woche" to make the deadline; null without target + deadline or once it passed. */
  requiredWeeklyCents: Cents | null
  /** Weeks ahead (+) or behind (−) the deadline at the current pace. */
  deadlineDeltaWeeks: number | null
  /** The deadline is over and the target was not reached. */
  overdue: boolean
}

export function summarizePot(
  pot: Pot,
  transactions: readonly PotTransaction[],
  today: ISODate,
): PotSummary {
  const balanceCents = potBalances(transactions)[pot.id] ?? 0
  const { targetCents, deadline } = pot
  const paceCentsPerWeek = weeklyPace(transactions, pot.id, today)
  const forecast = forecastPot({ balanceCents, targetCents, paceCentsPerWeek, today })
  const reached = targetCents !== null && balanceCents >= targetCents

  return {
    pot,
    balanceCents,
    progress:
      targetCents === null ? null : Math.min(1, Math.max(0, ratio(balanceCents, targetCents))),
    missingCents: targetCents === null ? null : Math.max(0, targetCents - balanceCents),
    paceCentsPerWeek,
    forecast,
    requiredWeeklyCents: requiredWeeklyForDeadline({ balanceCents, targetCents, deadline, today }),
    deadlineDeltaWeeks: reached ? null : deadlineDelta(forecast.eta, deadline),
    overdue: deadline !== null && !reached && daysBetween(today, deadline) < 0,
  }
}

const bySortOrder = (a: Pot, b: Pot) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt

/** The pots screen: active pots in order, archived ones apart, and what is saved overall. */
export function summarizePots(
  pots: readonly Pot[],
  transactions: readonly PotTransaction[],
  today: ISODate,
): { active: PotSummary[]; archived: PotSummary[]; totalCents: Cents } {
  const summaries = pots
    .filter(isActive)
    .sort(bySortOrder)
    .map((pot) => summarizePot(pot, transactions, today))
  return {
    active: summaries.filter((summary) => !summary.pot.archived),
    archived: summaries.filter((summary) => summary.pot.archived),
    totalCents: summaries.reduce((sum, summary) => sum + summary.balanceCents, 0),
  }
}

/** Weekly savings and pot funding follow their week/expense – they are not edited directly. */
export const isDerivedTx = (tx: Pick<PotTransaction, 'type'>): boolean =>
  tx.type === 'auto-weekly' || tx.type === 'expense-funding'

export interface PotHistoryEntry {
  tx: PotTransaction
  /** The pot's balance right after this booking. */
  balanceAfterCents: Cents
}

/** A pot's bookings, newest first, each with the running balance. */
export function potHistory(
  transactions: readonly PotTransaction[],
  potId: string,
): PotHistoryEntry[] {
  const own = transactions
    .filter((tx) => isActive(tx) && tx.potId === potId)
    .sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1))

  let running = 0
  const entries = own.map((tx) => {
    running += tx.amountCents
    return { tx, balanceAfterCents: running }
  })
  return entries.reverse()
}

/**
 * What an expense may take out of a pot ("aus Topf bezahlt"): the balance, plus whatever the
 * expense itself already holds in that pot – so editing a funded expense is not blocked by its
 * own booking.
 */
export function availableForExpense(
  balances: Readonly<Record<string, Cents>>,
  potId: string,
  existing?: Pick<Expense, 'fundedByPotId' | 'amountCents' | 'deletedAt'> | null,
): Cents {
  const held =
    existing && isActive(existing) && existing.fundedByPotId === potId ? existing.amountCents : 0
  return (balances[potId] ?? 0) + held
}
