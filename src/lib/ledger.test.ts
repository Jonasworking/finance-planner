import { describe, expect, it } from 'vitest'
import {
  makeBudget,
  makeCategory,
  makeExpense,
  makePot,
  makeRecurring,
  makeSettings,
  makeTask,
  makeTx,
  makeWeek,
  NOW,
} from '@/test/fixtures'
import { checkLedgerInvariants } from './ledger'
import { PRIMARY_POT_ID, type AppData } from './types'

/** A small but complete, consistent set of books. */
function consistentBooks(): AppData {
  const flight = makeExpense('2026-09-16', 80_000, {
    id: 'flight',
    categoryId: 'cat:travel',
    fundedByPotId: 'pot:trip',
  })
  return {
    settings: [makeSettings()],
    categories: [
      makeCategory('cat:groceries'),
      makeCategory('cat:rent'),
      makeCategory('cat:travel'),
    ],
    pots: [makePot(PRIMARY_POT_ID), makePot('pot:trip')],
    recurringExpenses: [makeRecurring('2026-09-04', { id: 'rent' })],
    budgets: [makeBudget('2026-09-07', 40_000, { 'cat:groceries': 10_000 })],
    tasks: [makeTask({ linkedPotId: 'pot:trip' })],
    weeks: [makeWeek('2026-09-14', { closedAt: NOW }), makeWeek('2026-09-21')],
    expenses: [
      makeExpense('2026-09-15', 6_000),
      makeExpense('2026-09-18', 25_000, {
        id: 'rec:rent:2026-09-18',
        categoryId: 'cat:rent',
        recurringId: 'rent',
      }),
      flight,
      makeExpense('2026-09-22', 4_000),
    ],
    potTransactions: [
      makeTx(PRIMARY_POT_ID, 300_000, '2026-09-10'),
      makeTx(PRIMARY_POT_ID, -100_000, '2026-09-12', {
        id: 'tr:t1:out',
        type: 'transfer-out',
        transferId: 't1',
      }),
      makeTx('pot:trip', 100_000, '2026-09-12', {
        id: 'tr:t1:in',
        type: 'transfer-in',
        transferId: 't1',
      }),
      makeTx('pot:trip', -80_000, '2026-09-16', {
        id: 'fund:flight',
        type: 'expense-funding',
        expenseId: 'flight',
      }),
      makeTx(PRIMARY_POT_ID, 169_000, '2026-09-20', {
        id: 'auto:2026-09-14',
        type: 'auto-weekly',
        sourceWeekStart: '2026-09-14',
      }),
    ],
  }
}

const codes = (data: AppData) => checkLedgerInvariants(data).map((violation) => violation.code)

describe('checkLedgerInvariants', () => {
  it('accepts consistent books', () => {
    expect(checkLedgerInvariants(consistentBooks())).toEqual([])
  })

  it('ignores tombstones', () => {
    const data = consistentBooks()
    data.expenses.push(makeExpense('2026-09-15', -5, { categoryId: 'cat:gone', deletedAt: NOW }))
    data.potTransactions.push(makeTx('pot:gone', 1.5, '2026-09-15', { deletedAt: NOW }))
    expect(checkLedgerInvariants(data)).toEqual([])
  })

  it('detects a closed week whose booking is missing, wrong or orphaned', () => {
    const missing = consistentBooks()
    missing.potTransactions = missing.potTransactions.filter((tx) => tx.type !== 'auto-weekly')
    expect(codes(missing)).toEqual(['auto-missing'])

    const stale = consistentBooks()
    stale.expenses.push(makeExpense('2026-09-19', 1_000)) // edited after closing, booking not re-synced
    expect(codes(stale)).toEqual(['auto-mismatch'])

    const reopened = consistentBooks()
    reopened.weeks[0]!.closedAt = null
    expect(codes(reopened)).toEqual(['auto-orphan'])
  })

  it('detects funding that does not mirror its expense', () => {
    const missing = consistentBooks()
    missing.potTransactions = missing.potTransactions.filter((tx) => tx.id !== 'fund:flight')
    expect(codes(missing)).toEqual(['funding-missing'])

    const wrongAmount = consistentBooks()
    wrongAmount.potTransactions.find((tx) => tx.id === 'fund:flight')!.amountCents = -70_000
    expect(codes(wrongAmount)).toEqual(['funding-mismatch'])

    const orphan = consistentBooks()
    orphan.expenses.find((expense) => expense.id === 'flight')!.fundedByPotId = null
    // The expense now counts as regular spending of the closed week as well.
    expect(codes(orphan).sort()).toEqual(['auto-mismatch', 'funding-orphan'])
  })

  it('detects unbalanced transfers and wrong signs', () => {
    const lopsided = consistentBooks()
    lopsided.potTransactions.find((tx) => tx.id === 'tr:t1:in')!.amountCents = 90_000
    expect(codes(lopsided)).toEqual(['transfer-unbalanced'])

    const oneLeg = consistentBooks()
    oneLeg.potTransactions = oneLeg.potTransactions.filter((tx) => tx.id !== 'tr:t1:in')
    expect(codes(oneLeg)).toEqual(['transfer-unbalanced'])

    const samePot = consistentBooks()
    samePot.potTransactions.find((tx) => tx.id === 'tr:t1:in')!.potId = PRIMARY_POT_ID
    expect(codes(samePot)).toEqual(['transfer-unbalanced'])

    const sign = consistentBooks()
    sign.potTransactions.push(makeTx(PRIMARY_POT_ID, 500, '2026-09-11', { type: 'withdrawal' }))
    expect(codes(sign)).toEqual(['tx-sign'])
  })

  it('detects broken references', () => {
    const data = consistentBooks()
    data.expenses.push(makeExpense('2026-09-23', 100, { categoryId: 'cat:nope' }))
    data.expenses.push(makeExpense('2026-09-23', 100, { recurringId: 'nope' }))
    data.potTransactions.push(makeTx('pot:nope', 100, '2026-09-23'))
    data.tasks.push(makeTask({ linkedPotId: 'pot:nope' }))
    data.budgets.push(makeBudget('2026-09-21', 40_000, { 'cat:nope': 1 }))
    expect(codes(data).sort()).toEqual([
      'unknown-category',
      'unknown-category',
      'unknown-pot',
      'unknown-pot',
      'unknown-recurring',
    ])
  })

  it('detects invalid keys and amounts', () => {
    const data = consistentBooks()
    data.weeks.push(makeWeek('2026-09-23'))
    data.weeks.push(makeWeek('2026-09-28', { incomeCents: -1 }))
    data.budgets.push(makeBudget('2026-09-01', 1))
    data.expenses.push(makeExpense('2026-09-23', 0))
    data.expenses.push(makeExpense('2026-09-23', 10.5))
    data.potTransactions.push(makeTx(PRIMARY_POT_ID, 0.5, '2026-09-23'))
    expect(codes(data).sort()).toEqual([
      'amount-invalid',
      'amount-invalid',
      'amount-invalid',
      'amount-invalid',
      'budget-not-monday',
      'week-not-monday',
    ])
  })

  it('requires a usable primary pot', () => {
    const archived = consistentBooks()
    archived.pots[0]!.archived = true
    expect(codes(archived)).toContain('missing-primary-pot')

    const deleted = consistentBooks()
    deleted.pots[0]!.deletedAt = NOW
    expect(codes(deleted)).toEqual(expect.arrayContaining(['missing-primary-pot', 'unknown-pot']))
  })
})
