import type { ParsedBankRow } from '@/lib/bankImport'
import { bankNote, planImport, purchaseDay, type ImportPlan } from '@/lib/bankInbox'
import {
  displayMerchant,
  learnRule,
  merchantRuleId,
  normalizeMerchant,
  type RuleTarget,
} from '@/lib/merchantRules'
import {
  isActive,
  type BankSource,
  type BankTransaction,
  type BankTxStatus,
  type Expense,
  type MerchantRule,
} from '@/lib/types'
import { DomainError } from '../errors'
import { loadImportState } from '../queries'
import { ledgerTables, newId, writeExpense, type RepoContext } from './context'

export interface BankImportOptions {
  source?: BankSource
  /** Row ids that must not be linked automatically ("Lösen" in the preview). */
  keepOpen?: ReadonlySet<string>
}

/**
 * What a step did to the merchant's rule, handed back so its undo can restore the rule exactly:
 * the rule as it was before (`null` = there was none), or `undefined` when no rule was touched.
 */
export type RuleUndo = MerchantRule | null | undefined

export function createBankRepo(ctx: RepoContext) {
  const { db, clock } = ctx
  const inLedger = <T>(work: () => Promise<T>) =>
    db.transaction(
      'rw',
      [...ledgerTables(ctx), db.bankTransactions, db.merchantRules, db.settings],
      work,
    )

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

  /** Teaches the merchant of this text its target; returns the rule as it was before. */
  async function learn(description: string, target: RuleTarget): Promise<RuleUndo> {
    const pattern = normalizeMerchant(description)
    if (pattern === '') return undefined
    const previous = await db.merchantRules.get(merchantRuleId(pattern))
    await db.merchantRules.put(learnRule(previous, pattern, target, clock.now()))
    return previous ?? null
  }

  /** Puts a rule back to what `learn` found. */
  async function unlearn(description: string, before: RuleUndo): Promise<void> {
    if (before === undefined) return
    if (before !== null) {
      await db.merchantRules.put(before)
      return
    }
    const rule = await db.merchantRules.get(merchantRuleId(normalizeMerchant(description)))
    if (rule) {
      const now = clock.now()
      await db.merchantRules.put({ ...rule, deletedAt: now, updatedAt: now })
    }
  }

  async function createExpense(tx: BankTransaction, categoryId: string): Promise<Expense> {
    const now = clock.now()
    const expense: Expense = {
      id: newId(),
      date: purchaseDay(tx),
      amountCents: -tx.amountCents,
      categoryId,
      tags: [],
      note: displayMerchant(tx.description) || bankNote(tx.description),
      fundedByPotId: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }
    await writeExpense(ctx, expense, undefined)
    await setStatus(tx, 'assigned', expense.id)
    return expense
  }

  async function removeExpenseOf(tx: BankTransaction): Promise<void> {
    if (tx.status !== 'assigned' || tx.expenseId === null) throw new DomainError('not-open')
    const expense = await db.expenses.get(tx.expenseId)
    if (expense && isActive(expense)) {
      const now = clock.now()
      await writeExpense(ctx, { ...expense, deletedAt: now, updatedAt: now }, expense)
    }
    await setStatus(tx, 'open', null)
  }

  async function mustGetRule(id: string): Promise<MerchantRule> {
    const rule = await db.merchantRules.get(id)
    if (!rule) throw new DomainError('not-found')
    return rule
  }

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
        // What was entered by hand already says where this merchant belongs.
        for (const { row, expense } of plan.matched) {
          await learn(row.description, { action: 'categorize', categoryId: expense.categoryId })
        }
        return plan
      }),

    /**
     * Turns an inbox line into an expense and teaches the merchant its category. The expense
     * goes through the same bottleneck as every other one, so a line that falls into a closed
     * week re-syncs that week's savings booking.
     */
    assign: (txId: string, categoryId: string): Promise<{ expense: Expense; rule: RuleUndo }> =>
      inLedger(async () => {
        const tx = await mustGetOpenDebit(txId)
        const expense = await createExpense(tx, categoryId)
        const rule = await learn(tx.description, { action: 'categorize', categoryId })
        return { expense, rule }
      }),

    /**
     * Undo of `assign`: the expense goes (soft delete), the line is back in the inbox and –
     * given what `assign` returned – the merchant's rule is what it was before.
     */
    undoAssign: (txId: string, rule?: RuleUndo): Promise<void> =>
      inLedger(async () => {
        const tx = await mustGet(txId)
        await removeExpenseOf(tx)
        await unlearn(tx.description, rule)
      }),

    /**
     * "Bekannte Händler zuordnen": applies what the preview showed, in one transaction. Rules
     * are not changed by it – a rule acting on its own is no confirmation by the user.
     */
    applyRules: (
      items: readonly { txId: string; target: RuleTarget }[],
    ): Promise<{ txId: string; action: RuleTarget['action'] }[]> =>
      inLedger(async () => {
        const done: { txId: string; action: RuleTarget['action'] }[] = []
        for (const { txId, target } of items) {
          const tx = await mustGetOpenDebit(txId)
          if (target.action === 'categorize' && target.categoryId) {
            await createExpense(tx, target.categoryId)
          } else if (target.action === 'ignore') {
            await setStatus(tx, 'ignored', null)
          } else {
            continue
          }
          done.push({ txId, action: target.action })
        }
        return done
      }),

    /** Undo of `applyRules` with what it returned. */
    undoApplyRules: (
      done: readonly { txId: string; action: RuleTarget['action'] }[],
    ): Promise<void> =>
      inLedger(async () => {
        for (const { txId, action } of done) {
          const tx = await mustGet(txId)
          if (action === 'categorize') await removeExpenseOf(tx)
          else if (tx.status === 'ignored') await setStatus(tx, 'open', null)
        }
      }),

    /** "Ist dieselbe": the line belongs to an expense that was entered by hand. */
    linkExisting: (txId: string, expenseId: string): Promise<RuleUndo> =>
      inLedger(async () => {
        const tx = await mustGetOpenDebit(txId)
        const expense = await db.expenses.get(expenseId)
        if (!expense || !isActive(expense)) throw new DomainError('not-found')
        const taken = await db.bankTransactions
          .filter((other) => isActive(other) && other.expenseId === expenseId)
          .count()
        if (taken > 0) throw new DomainError('already-linked')
        await setStatus(tx, 'matched', expenseId)
        return learn(tx.description, { action: 'categorize', categoryId: expense.categoryId })
      }),

    /** Undo of a link (automatic or by hand): back to the inbox, the expense stays as it is. */
    unlink: (txId: string, rule?: RuleUndo): Promise<void> =>
      inLedger(async () => {
        const tx = await mustGet(txId)
        if (tx.status !== 'matched') throw new DomainError('not-open')
        await setStatus(tx, 'open', null)
        await unlearn(tx.description, rule)
      }),

    /** "Keine Ausgabe": own transfers and the like leave the inbox without becoming an expense. */
    ignore: (txId: string): Promise<RuleUndo> =>
      inLedger(async () => {
        const tx = await mustGetOpenDebit(txId)
        await setStatus(tx, 'ignored', null)
        return learn(tx.description, { action: 'ignore', categoryId: null })
      }),

    reopen: (txId: string, rule?: RuleUndo): Promise<void> =>
      inLedger(async () => {
        const tx = await mustGet(txId)
        if (tx.status !== 'ignored') throw new DomainError('not-open')
        await setStatus(tx, 'open', null)
        await unlearn(tx.description, rule)
      }),

    /**
     * "Das ist mein Lohn": credits of this sender are suggested as the week's income from now
     * on. Returns the rule as it was, for `unmarkIncomeSource`.
     */
    markIncomeSource: (txId: string): Promise<RuleUndo> =>
      inLedger(async () => {
        const tx = await mustGet(txId)
        if (tx.amountCents <= 0) throw new DomainError('not-open')
        return learn(tx.description, { action: 'income', categoryId: null })
      }),

    unmarkIncomeSource: (txId: string, rule: RuleUndo = null): Promise<void> =>
      inLedger(async () => {
        const tx = await mustGet(txId)
        await unlearn(tx.description, rule)
      }),

    /**
     * "Zurück in die Inbox" for a line that was dealt with, whatever was done with it: an
     * assigned line loses its expense, a linked one only its link, an ignored one is open again.
     * Rules stay as they are – taking one booking back is no statement about the merchant.
     */
    backToInbox: (txId: string): Promise<void> =>
      inLedger(async () => {
        const tx = await mustGet(txId)
        if (tx.amountCents >= 0 || tx.status === 'open') throw new DomainError('not-open')
        if (tx.status === 'assigned') await removeExpenseOf(tx)
        else await setStatus(tx, 'open', null)
      }),

    /**
     * Undo of `backToInbox`: the line is what it was – for an assigned one its own expense
     * comes back, so nothing is created twice and no rule is touched.
     */
    restoreDone: (
      txId: string,
      was: { status: Exclude<BankTxStatus, 'open'>; expenseId: string | null },
    ): Promise<void> =>
      inLedger(async () => {
        const tx = await mustGetOpenDebit(txId)
        if (was.status === 'ignored') {
          await setStatus(tx, 'ignored', null)
          return
        }
        const expense = was.expenseId === null ? undefined : await db.expenses.get(was.expenseId)
        if (!expense) throw new DomainError('not-found')
        const taken = await db.bankTransactions
          .filter((other) => isActive(other) && other.expenseId === expense.id)
          .count()
        if (taken > 0) throw new DomainError('already-linked')
        if (was.status === 'assigned' && !isActive(expense)) {
          await writeExpense(ctx, { ...expense, deletedAt: null, updatedAt: clock.now() }, expense)
        }
        await setStatus(tx, was.status, expense.id)
      }),

    /** Rules are visible and deletable in the settings; deleting only stops the suggestions. */
    removeRule: (id: string): Promise<void> =>
      inLedger(async () => {
        const rule = await mustGetRule(id)
        if (rule.deletedAt !== null) return
        const now = clock.now()
        await db.merchantRules.put({ ...rule, deletedAt: now, updatedAt: now })
      }),

    restoreRule: (id: string): Promise<void> =>
      inLedger(async () => {
        const rule = await mustGetRule(id)
        if (rule.deletedAt === null) return
        await db.merchantRules.put({ ...rule, deletedAt: null, updatedAt: clock.now() })
      }),
  }
}
