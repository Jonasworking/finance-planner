import type { ParsedBankRow } from '@/lib/bankImport'
import { bankNote, planImport, purchaseDay, type ImportPlan } from '@/lib/bankInbox'
import {
  isActive,
  type BankSource,
  type BankTransaction,
  type BankTxStatus,
  type Expense,
} from '@/lib/types'
import { DomainError } from '../errors'
import { loadImportState } from '../queries'
import { ledgerTables, newId, writeExpense, type RepoContext } from './context'

export interface BankImportOptions {
  source?: BankSource
  /** Row ids that must not be linked automatically ("Lösen" in the preview). */
  keepOpen?: ReadonlySet<string>
}

export function createBankRepo(ctx: RepoContext) {
  const { db, clock } = ctx
  const inLedger = <T>(work: () => Promise<T>) =>
    db.transaction('rw', [...ledgerTables(ctx), db.bankTransactions, db.settings], work)

  async function mustGet(id: string): Promise<BankTransaction> {
    const tx = await db.bankTransactions.get(id)
    if (!tx || !isActive(tx)) throw new DomainError('not-found')
    return tx
  }

  /** A line that still waits in the inbox – the only kind that can be assigned, linked or ignored. */
  async function mustGetOpenDebit(id: string): Promise<BankTransaction> {
    const tx = await mustGet(id)
    if (tx.status !== 'open' || tx.amountCents >= 0) throw new DomainError('not-open')
    return tx
  }

  const setStatus = (tx: BankTransaction, status: BankTxStatus, expenseId: string | null) =>
    db.bankTransactions.put({ ...tx, status, expenseId, updatedAt: clock.now() })

  return {
    /**
     * Stores the lines of a parsed file. Idempotent: ids that exist (tombstones included) are
     * skipped, so the same or an overlapping export never adds a line twice – also when two
     * imports race, because the plan is computed inside the transaction. Nothing becomes an
     * expense here; unambiguous hand-entered counterparts are only linked.
     */
    import: (
      rows: readonly ParsedBankRow[],
      options: BankImportOptions = {},
    ): Promise<ImportPlan> =>
      inLedger(async () => {
        const state = await loadImportState(db)
        if (state.trackingSince === null) throw new DomainError('not-found')
        const plan = planImport({
          ...state,
          trackingSince: state.trackingSince,
          rows,
          keepOpen: options.keepOpen,
        })

        const now = clock.now()
        const batchId = newId()
        const toRow = (
          row: ParsedBankRow,
          status: BankTxStatus,
          expenseId: string | null = null,
        ): BankTransaction => ({
          id: row.id,
          source: options.source ?? 'commbank',
          date: row.date,
          valueDate: row.valueDate,
          amountCents: row.amountCents,
          description: row.description,
          balanceCents: row.balanceCents,
          status,
          expenseId,
          batchId,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        })

        await db.bankTransactions.bulkAdd([
          ...plan.inbox.map((row) => toRow(row, 'open')),
          ...plan.credits.map((row) => toRow(row, 'open')),
          ...plan.beforeTracking.map((row) => toRow(row, 'ignored')),
          ...plan.matched.map(({ row, expense }) => toRow(row, 'matched', expense.id)),
        ])
        return plan
      }),

    /**
     * Turns an inbox line into an expense. It goes through the same bottleneck as every other
     * expense, so a line that falls into a closed week re-syncs that week's savings booking.
     */
    assign: (txId: string, categoryId: string): Promise<Expense> =>
      inLedger(async () => {
        const tx = await mustGetOpenDebit(txId)
        const now = clock.now()
        const expense: Expense = {
          id: newId(),
          date: purchaseDay(tx),
          amountCents: -tx.amountCents,
          categoryId,
          tags: [],
          note: bankNote(tx.description),
          fundedByPotId: null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        }
        await writeExpense(ctx, expense, undefined)
        await setStatus(tx, 'assigned', expense.id)
        return expense
      }),

    /** Undo of `assign`: the expense goes (soft delete), the line is back in the inbox. */
    undoAssign: (txId: string): Promise<void> =>
      inLedger(async () => {
        const tx = await mustGet(txId)
        if (tx.status !== 'assigned' || tx.expenseId === null) throw new DomainError('not-open')
        const expense = await db.expenses.get(tx.expenseId)
        if (expense && isActive(expense)) {
          const now = clock.now()
          await writeExpense(ctx, { ...expense, deletedAt: now, updatedAt: now }, expense)
        }
        await setStatus(tx, 'open', null)
      }),

    /** "Ist dieselbe": the line belongs to an expense that was entered by hand. */
    linkExisting: (txId: string, expenseId: string): Promise<void> =>
      inLedger(async () => {
        const tx = await mustGetOpenDebit(txId)
        const expense = await db.expenses.get(expenseId)
        if (!expense || !isActive(expense)) throw new DomainError('not-found')
        const taken = await db.bankTransactions
          .filter((other) => isActive(other) && other.expenseId === expenseId)
          .count()
        if (taken > 0) throw new DomainError('already-linked')
        await setStatus(tx, 'matched', expenseId)
      }),

    /** Undo of a link (automatic or by hand): back to the inbox, the expense stays as it is. */
    unlink: (txId: string): Promise<void> =>
      inLedger(async () => {
        const tx = await mustGet(txId)
        if (tx.status !== 'matched') throw new DomainError('not-open')
        await setStatus(tx, 'open', null)
      }),

    /** "Keine Ausgabe": own transfers and the like leave the inbox without becoming an expense. */
    ignore: (txId: string): Promise<void> =>
      inLedger(async () => {
        await setStatus(await mustGetOpenDebit(txId), 'ignored', null)
      }),

    reopen: (txId: string): Promise<void> =>
      inLedger(async () => {
        const tx = await mustGet(txId)
        if (tx.status !== 'ignored') throw new DomainError('not-open')
        await setStatus(tx, 'open', null)
      }),
  }
}
