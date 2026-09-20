import type { Expense } from '@/lib/types'
import { DomainError } from '../errors'
import { ledgerTables, newId, writeExpense, type RepoContext } from './context'

export type ExpenseInput = Pick<Expense, 'date' | 'amountCents' | 'categoryId'> &
  Partial<Pick<Expense, 'id' | 'tags' | 'note' | 'recurringId' | 'fundedByPotId'>>

export type ExpensePatch = Partial<
  Pick<Expense, 'date' | 'amountCents' | 'categoryId' | 'tags' | 'note' | 'fundedByPotId'>
>

export function createExpensesRepo(ctx: RepoContext) {
  const { db, clock } = ctx
  const inLedger = <T>(work: () => Promise<T>) => db.transaction('rw', ledgerTables(ctx), work)

  async function mustGet(id: string): Promise<Expense> {
    const expense = await db.expenses.get(id)
    if (!expense) throw new DomainError('not-found')
    return expense
  }

  return {
    add: (input: ExpenseInput): Promise<Expense> =>
      inLedger(async () => {
        const now = clock.now()
        const expense: Expense = {
          id: input.id ?? newId(),
          date: input.date,
          amountCents: input.amountCents,
          categoryId: input.categoryId,
          tags: input.tags ?? [],
          note: input.note,
          recurringId: input.recurringId,
          fundedByPotId: input.fundedByPotId ?? null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        }
        await writeExpense(ctx, expense, undefined)
        return expense
      }),

    update: (id: string, patch: ExpensePatch): Promise<Expense> =>
      inLedger(async () => {
        const previous = await mustGet(id)
        const next: Expense = { ...previous, ...patch, updatedAt: clock.now() }
        await writeExpense(ctx, next, previous)
        return next
      }),

    /** Soft delete – `restore` is the undo of swipe-to-delete. */
    remove: (id: string): Promise<void> =>
      inLedger(async () => {
        const previous = await mustGet(id)
        if (previous.deletedAt !== null) return
        const now = clock.now()
        await writeExpense(ctx, { ...previous, deletedAt: now, updatedAt: now }, previous)
      }),

    restore: (id: string): Promise<void> =>
      inLedger(async () => {
        const previous = await mustGet(id)
        if (previous.deletedAt === null) return
        await writeExpense(ctx, { ...previous, deletedAt: null, updatedAt: clock.now() }, previous)
      }),
  }
}
