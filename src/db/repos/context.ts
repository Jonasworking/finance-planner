import Dexie from 'dexie'
import { isISODate, isMonday, weekEndOf, weekStartOf } from '@/lib/dates'
import { isPotFunded } from '@/lib/expenses'
import { autoWeeklyTxId, fundingTxId } from '@/lib/ids'
import { buildAutoWeeklyTx, potBalance, summarizeWeek, validateWithdrawal } from '@/lib/savings'
import { isActive, type Cents, type Expense, type ISODate } from '@/lib/types'
import { DomainError } from '../errors'
import type { FinanceDB } from '../schema'

export interface Clock {
  now: () => number
}

export const systemClock: Clock = { now: () => Date.now() }

export const newId = (): string => crypto.randomUUID()

export interface RepoContext {
  db: FinanceDB
  clock: Clock
}

/** Tables every ledger-affecting write may touch – one list so nested transactions always fit. */
export const ledgerTables = ({ db }: RepoContext) => [
  db.expenses,
  db.potTransactions,
  db.weeks,
  db.pots,
  db.categories,
  db.recurringExpenses,
]

export function assertCents(value: Cents, options: { allowZero?: boolean } = {}): void {
  const min = options.allowZero ? 0 : 1
  if (!Number.isInteger(value) || value < min) throw new DomainError('invalid-amount')
}

export function assertDate(value: ISODate): void {
  if (!isISODate(value)) throw new DomainError('invalid-date')
}

export function assertMonday(value: ISODate): void {
  if (!isMonday(value)) throw new DomainError('not-a-monday')
}

export async function balanceOf(ctx: RepoContext, potId: string): Promise<Cents> {
  const transactions = await ctx.db.potTransactions
    .where('[potId+date]')
    .between([potId, Dexie.minKey], [potId, Dexie.maxKey])
    .toArray()
  return potBalance(transactions, potId)
}

/**
 * Keeps the one materialised consequence of a closed week in sync: the `auto:<weekStart>`
 * booking. Closed → upsert (income − spending, possibly negative); open or missing → tombstone.
 * Writes only when something changed, so live queries stay quiet. Call inside a rw transaction.
 */
export async function syncWeekDerived(ctx: RepoContext, weekStart: ISODate): Promise<void> {
  const { db, clock } = ctx
  const week = await db.weeks.get(weekStart)
  const existing = await db.potTransactions.get(autoWeeklyTxId(weekStart))

  if (week && isActive(week) && week.closedAt !== null) {
    const expenses = await db.expenses
      .where('date')
      .between(weekStart, weekEndOf(weekStart), true, true)
      .toArray()
    const summary = summarizeWeek({ weekStart, week, expenses, budget: null })
    const next = buildAutoWeeklyTx(summary, clock.now(), existing)
    const unchanged =
      existing &&
      isActive(existing) &&
      existing.amountCents === next.amountCents &&
      existing.date === next.date
    if (!unchanged) await db.potTransactions.put(next)
    return
  }

  if (existing && isActive(existing)) {
    const now = clock.now()
    await db.potTransactions.put({ ...existing, deletedAt: now, updatedAt: now })
  }
}

/** Mirrors a pot-funded expense as `fund:<expenseId>` (or tombstones the mirror). */
async function syncFunding(ctx: RepoContext, expense: Expense): Promise<void> {
  const { db, clock } = ctx
  const id = fundingTxId(expense.id)
  const existing = await db.potTransactions.get(id)
  const now = clock.now()

  if (isActive(expense) && isPotFunded(expense)) {
    const potId = expense.fundedByPotId!
    const pot = await db.pots.get(potId)
    // What this expense already holds in the same pot is available to it again.
    const held =
      existing && isActive(existing) && existing.potId === potId ? -existing.amountCents : 0
    const problem = validateWithdrawal({
      pot,
      amountCents: expense.amountCents,
      balanceCents: (await balanceOf(ctx, potId)) + held,
    })
    if (problem) throw new DomainError(problem === 'unknown-pot' ? 'unknown-pot' : problem)

    await db.potTransactions.put({
      id,
      potId,
      amountCents: -expense.amountCents,
      date: expense.date,
      type: 'expense-funding',
      expenseId: expense.id,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      deletedAt: null,
    })
  } else if (existing && isActive(existing)) {
    await db.potTransactions.put({ ...existing, deletedAt: now, updatedAt: now })
  }
}

/**
 * THE write path for expenses. Every create/update/delete/restore – by the UI, the recurring
 * materialiser or anything else – ends here, inside a rw transaction over `ledgerTables`:
 * 1. store the row, 2. mirror pot funding, 3. re-sync every closed week it touches
 * (the old AND the new one when the date moved across a week boundary).
 */
export async function writeExpense(
  ctx: RepoContext,
  next: Expense,
  previous: Expense | undefined,
): Promise<void> {
  assertCents(next.amountCents)
  assertDate(next.date)
  if (isActive(next)) {
    const category = await ctx.db.categories.get(next.categoryId)
    if (!category || !isActive(category)) throw new DomainError('unknown-category')
  }

  await ctx.db.expenses.put(next)
  await syncFunding(ctx, next)

  const weeks = new Set([weekStartOf(next.date)])
  if (previous) weeks.add(weekStartOf(previous.date))
  for (const weekStart of weeks) await syncWeekDerived(ctx, weekStart)
}
