import { isMonday, weekEndOf } from './dates'
import { autoWeeklyTxId, fundingTxId } from './ids'
import { summarizeWeek } from './savings'
import { isActive, PRIMARY_POT_ID, type AppData, type PotTransaction } from './types'

export type ViolationCode =
  | 'week-not-monday'
  | 'budget-not-monday'
  | 'amount-invalid'
  | 'missing-primary-pot'
  | 'unknown-category'
  | 'unknown-pot'
  | 'unknown-recurring'
  | 'transfer-unbalanced'
  | 'tx-sign'
  | 'auto-missing'
  | 'auto-mismatch'
  | 'auto-orphan'
  | 'funding-missing'
  | 'funding-mismatch'
  | 'funding-orphan'
  | 'bank-link-missing'
  | 'bank-link-unexpected'
  | 'bank-link-duplicate'
  | 'rule-target'

export interface Violation {
  code: ViolationCode
  /** Id of the offending row. */
  ref: string
  message: string
}

const EXPECTED_SIGN: Partial<Record<PotTransaction['type'], 1 | -1>> = {
  'manual-deposit': 1,
  'transfer-in': 1,
  withdrawal: -1,
  'transfer-out': -1,
  'expense-funding': -1,
}

/**
 * Cross-table consistency of the books. Runs in tests, before every import and behind
 * "Daten prüfen". Only active rows are checked; tombstones may point anywhere.
 * An empty result means: pot balances can be trusted.
 */
export function checkLedgerInvariants(data: AppData): Violation[] {
  const violations: Violation[] = []
  const report = (code: ViolationCode, ref: string, message: string) =>
    violations.push({ code, ref, message })

  const categories = new Map(data.categories.map((row) => [row.id, row]))
  const pots = new Map(data.pots.map((row) => [row.id, row]))
  const recurring = new Set(data.recurringExpenses.map((row) => row.id))
  const expenses = data.expenses.filter(isActive)
  const transactions = data.potTransactions.filter(isActive)
  const txById = new Map(transactions.map((tx) => [tx.id, tx]))
  const livePot = (id: string) => {
    const pot = pots.get(id)
    return pot !== undefined && isActive(pot)
  }

  const primary = pots.get(PRIMARY_POT_ID)
  if (!primary || !isActive(primary) || primary.archived) {
    report(
      'missing-primary-pot',
      PRIMARY_POT_ID,
      'The primary pot is missing, deleted or archived.',
    )
  }

  // --- Keys and amounts ---
  for (const week of data.weeks.filter(isActive)) {
    if (!isMonday(week.id)) report('week-not-monday', week.id, 'Week id is not a Monday.')
    if (
      week.incomeCents !== null &&
      (!Number.isInteger(week.incomeCents) || week.incomeCents < 0)
    ) {
      report('amount-invalid', week.id, 'Income must be a non-negative integer of cents.')
    }
  }
  for (const budget of data.budgets.filter(isActive)) {
    if (!isMonday(budget.id)) report('budget-not-monday', budget.id, 'Budget id is not a Monday.')
    for (const categoryId of Object.keys(budget.categoryLimits)) {
      if (!categories.has(categoryId)) {
        report('unknown-category', budget.id, `Budget limit for unknown category ${categoryId}.`)
      }
    }
  }

  // --- Expenses ---
  for (const expense of expenses) {
    if (!Number.isInteger(expense.amountCents) || expense.amountCents <= 0) {
      report('amount-invalid', expense.id, 'Expense amount must be a positive integer of cents.')
    }
    const category = categories.get(expense.categoryId)
    if (!category || !isActive(category)) {
      report('unknown-category', expense.id, `Unknown category ${expense.categoryId}.`)
    }
    if (expense.recurringId && !recurring.has(expense.recurringId)) {
      report('unknown-recurring', expense.id, `Unknown recurring template ${expense.recurringId}.`)
    }

    // Pot-funded expenses map 1:1 onto a funding transaction.
    if (expense.fundedByPotId) {
      const tx = txById.get(fundingTxId(expense.id))
      if (!tx) {
        report('funding-missing', expense.id, 'Pot-funded expense has no funding transaction.')
      } else if (
        tx.type !== 'expense-funding' ||
        tx.amountCents !== -expense.amountCents ||
        tx.potId !== expense.fundedByPotId ||
        tx.date !== expense.date ||
        tx.expenseId !== expense.id
      ) {
        report('funding-mismatch', expense.id, 'Funding transaction does not mirror the expense.')
      }
    }
  }

  // --- Pot transactions ---
  const expenseById = new Map(expenses.map((expense) => [expense.id, expense]))
  const weekById = new Map(data.weeks.filter(isActive).map((week) => [week.id, week]))
  const transfers = new Map<string, PotTransaction[]>()

  for (const tx of transactions) {
    if (!Number.isInteger(tx.amountCents)) {
      report('amount-invalid', tx.id, 'Transaction amount must be an integer of cents.')
    }
    if (!livePot(tx.potId)) report('unknown-pot', tx.id, `Unknown pot ${tx.potId}.`)

    const sign = EXPECTED_SIGN[tx.type]
    if (sign !== undefined && Math.sign(tx.amountCents) !== sign) {
      report('tx-sign', tx.id, `A ${tx.type} must be ${sign > 0 ? 'positive' : 'negative'}.`)
    }

    if (tx.type === 'transfer-in' || tx.type === 'transfer-out') {
      const key = tx.transferId ?? tx.id
      transfers.set(key, [...(transfers.get(key) ?? []), tx])
    }

    if (tx.type === 'expense-funding') {
      const expense = tx.expenseId ? expenseById.get(tx.expenseId) : undefined
      if (!expense || !expense.fundedByPotId || tx.id !== fundingTxId(expense.id)) {
        report('funding-orphan', tx.id, 'Funding transaction without a pot-funded expense.')
      }
    }

    if (tx.type === 'auto-weekly') {
      const week = tx.sourceWeekStart ? weekById.get(tx.sourceWeekStart) : undefined
      if (!week || week.closedAt === null || tx.id !== autoWeeklyTxId(week.id)) {
        report('auto-orphan', tx.id, 'Weekly booking without a closed week.')
      }
    }
  }

  for (const [transferId, legs] of transfers) {
    const out = legs.filter((leg) => leg.type === 'transfer-out')
    const into = legs.filter((leg) => leg.type === 'transfer-in')
    const balanced =
      legs.length === 2 &&
      out.length === 1 &&
      into.length === 1 &&
      out[0]!.amountCents + into[0]!.amountCents === 0 &&
      out[0]!.potId !== into[0]!.potId &&
      out[0]!.date === into[0]!.date
    if (!balanced) report('transfer-unbalanced', transferId, 'Transfer legs do not cancel out.')
  }

  // --- Closed weeks: exactly one booking that equals income − spending ---
  for (const week of weekById.values()) {
    if (week.closedAt === null) continue
    const tx = txById.get(autoWeeklyTxId(week.id))
    if (!tx) {
      report('auto-missing', week.id, 'Closed week has no booking in the savings pot.')
      continue
    }
    const { savedCents } = summarizeWeek({ weekStart: week.id, week, expenses, budget: null })
    if (
      tx.type !== 'auto-weekly' ||
      tx.amountCents !== savedCents ||
      tx.date !== weekEndOf(week.id)
    ) {
      report('auto-mismatch', week.id, `Booking is ${tx.amountCents}, expected ${savedCents}.`)
    }
  }

  // --- Tasks ---
  for (const task of data.tasks.filter(isActive)) {
    if (task.linkedPotId && !pots.has(task.linkedPotId)) {
      report('unknown-pot', task.id, `Task linked to unknown pot ${task.linkedPotId}.`)
    }
  }

  // --- Bank import: a dealt-with line points at its expense, an expense has at most one line ---
  // The expense may be a tombstone: deleting it must not bring the bank line back to the inbox.
  const allExpenseIds = new Set(data.expenses.map((row) => row.id))
  const linkedExpenses = new Set<string>()
  for (const tx of data.bankTransactions.filter(isActive)) {
    if (!Number.isInteger(tx.amountCents) || tx.amountCents === 0) {
      report('amount-invalid', tx.id, 'Bank transaction amount must be a non-zero integer.')
    }
    const linked = tx.status === 'assigned' || tx.status === 'matched'
    if (!linked) {
      if (tx.expenseId !== null) {
        report('bank-link-unexpected', tx.id, `A bank line that is ${tx.status} has an expense.`)
      }
      continue
    }
    if (tx.amountCents > 0) {
      report('bank-link-unexpected', tx.id, 'A credit must never become an expense.')
    }
    if (tx.expenseId === null || !allExpenseIds.has(tx.expenseId)) {
      report('bank-link-missing', tx.id, `Expense ${tx.expenseId ?? '(none)'} does not exist.`)
    } else if (linkedExpenses.has(tx.expenseId)) {
      report('bank-link-duplicate', tx.id, `Expense ${tx.expenseId} has two bank lines.`)
    } else {
      linkedExpenses.add(tx.expenseId)
    }
  }

  for (const rule of data.merchantRules.filter(isActive)) {
    const valid =
      rule.action === 'categorize'
        ? rule.categoryId !== null && categories.has(rule.categoryId)
        : rule.categoryId === null
    if (!valid) {
      report('rule-target', rule.id, `Rule "${rule.pattern}" has no valid target.`)
    }
  }

  return violations
}
