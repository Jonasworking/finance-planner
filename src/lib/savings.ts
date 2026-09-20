import type { ResolvedBudget } from './budget'
import { addWeeksISO, listWeeks, weekEndOf, weekStartOf } from './dates'
import { expensesInWeek, isPotFunded, sumAmounts } from './expenses'
import { autoWeeklyTxId } from './ids'
import { ratio } from './money'
import {
  isActive,
  PRIMARY_POT_ID,
  type Cents,
  type Expense,
  type ISODate,
  type Pot,
  type PotTransaction,
  type Week,
} from './types'

export interface WeekSummary {
  weekStart: ISODate
  closed: boolean
  /** False while no income has been entered; `incomeCents` is 0 then. */
  hasIncome: boolean
  incomeCents: Cents
  /** Spending that counts: active, not pot-funded. */
  spentCents: Cents
  /** Paid from pots – informational, not part of `savedCents`. */
  fundedCents: Cents
  /** income − spent. Negative in a minus week (booked as-is, the pot stays honest). */
  savedCents: Cents
  /** saved / income; 0 without positive income. */
  savingsRate: number
  totalLimitCents: Cents | null
  /** spent <= limit; null when no budget exists. */
  underBudget: boolean | null
}

/**
 * The single source of truth for a week's numbers – always computed from raw rows, never stored.
 * `expenses` may be the full table; only this week's active rows are used.
 */
export function summarizeWeek(input: {
  weekStart: ISODate
  week: Week | null | undefined
  expenses: readonly Expense[]
  budget: ResolvedBudget | null
}): WeekSummary {
  const { weekStart, budget } = input
  const week = input.week && isActive(input.week) ? input.week : null
  const weekExpenses = expensesInWeek(input.expenses, weekStart)
  const fundedCents = sumAmounts(weekExpenses.filter(isPotFunded))
  const spentCents = sumAmounts(weekExpenses) - fundedCents
  const incomeCents = week?.incomeCents ?? 0
  const savedCents = incomeCents - spentCents
  const totalLimitCents = budget?.totalLimitCents ?? null

  return {
    weekStart,
    closed: week?.closedAt != null,
    hasIncome: week?.incomeCents != null,
    incomeCents,
    spentCents,
    fundedCents,
    savedCents,
    savingsRate: ratio(savedCents, incomeCents),
    totalLimitCents,
    underBudget: totalLimitCents === null ? null : spentCents <= totalLimitCents,
  }
}

/**
 * The materialised result of closing a week: one signed booking into "Nur gespart", dated on the
 * week's Sunday (not on `closedAt`, so late closes don't skew charts). Re-running it for an
 * edited week keeps the original pot and creation time.
 */
export function buildAutoWeeklyTx(
  summary: Pick<WeekSummary, 'weekStart' | 'savedCents'>,
  now: number,
  existing?: PotTransaction | null,
): PotTransaction {
  return {
    id: autoWeeklyTxId(summary.weekStart),
    potId: existing?.potId ?? PRIMARY_POT_ID,
    amountCents: summary.savedCents,
    date: weekEndOf(summary.weekStart),
    type: 'auto-weekly',
    sourceWeekStart: summary.weekStart,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    deletedAt: null,
  }
}

/** Balance per pot id = sum of its active, signed transactions. */
export function potBalances(transactions: readonly PotTransaction[]): Record<string, Cents> {
  const balances: Record<string, Cents> = {}
  for (const tx of transactions) {
    if (!isActive(tx)) continue
    balances[tx.potId] = (balances[tx.potId] ?? 0) + tx.amountCents
  }
  return balances
}

export const potBalance = (transactions: readonly PotTransaction[], potId: string): Cents =>
  potBalances(transactions)[potId] ?? 0

export type MoveError = 'non-positive' | 'same-pot' | 'unknown-pot' | 'archived' | 'insufficient'

const usable = (pot: Pot | null | undefined): MoveError | null =>
  !pot || !isActive(pot) ? 'unknown-pot' : pot.archived ? 'archived' : null

/** Taking money out of a pot (withdrawal, expense funding): never overdraw. */
export function validateWithdrawal(input: {
  pot: Pot | null | undefined
  amountCents: Cents
  balanceCents: Cents
}): MoveError | null {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return 'non-positive'
  return usable(input.pot) ?? (input.balanceCents < input.amountCents ? 'insufficient' : null)
}

export function validateDeposit(input: {
  pot: Pot | null | undefined
  amountCents: Cents
}): MoveError | null {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return 'non-positive'
  return usable(input.pot)
}

export function validateTransfer(input: {
  from: Pot | null | undefined
  to: Pot | null | undefined
  amountCents: Cents
  fromBalanceCents: Cents
}): MoveError | null {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return 'non-positive'
  const problem = usable(input.from) ?? usable(input.to)
  if (problem) return problem
  if (input.from!.id === input.to!.id) return 'same-pot'
  return input.fromBalanceCents < input.amountCents ? 'insufficient' : null
}

/**
 * Finished weeks (their Sunday is before `today`) since tracking began that are not closed yet,
 * oldest first – the queue for "Woche abschließen".
 */
export function pendingWeeks(
  weeks: readonly Week[],
  trackingSince: ISODate,
  today: ISODate,
): ISODate[] {
  const closed = new Set(
    weeks.filter((week) => isActive(week) && week.closedAt !== null).map((week) => week.id),
  )
  const lastFinished = addWeeksISO(weekStartOf(today), -1)
  return listWeeks(weekStartOf(trackingSince), lastFinished).filter((week) => !closed.has(week))
}
