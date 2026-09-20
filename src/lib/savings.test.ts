import { describe, expect, it } from 'vitest'
import { makeExpense, makePot, makeTx, makeWeek, NOW } from '@/test/fixtures'
import {
  buildAutoWeeklyTx,
  pendingWeeks,
  potBalance,
  potBalances,
  summarizeWeek,
  validateDeposit,
  validateTransfer,
  validateWithdrawal,
} from './savings'
import { PRIMARY_POT_ID } from './types'

const WEEK = '2026-09-21'
const budget = { effectiveFrom: '2026-08-03', totalLimitCents: 40_000, categoryLimits: {} }

describe('summarizeWeek', () => {
  it('derives saved = income − spent, keeping pot-funded and deleted expenses out', () => {
    const summary = summarizeWeek({
      weekStart: WEEK,
      week: makeWeek(WEEK, { closedAt: NOW }),
      budget,
      expenses: [
        makeExpense('2026-09-21', 25_000),
        makeExpense('2026-09-27', 6_250), // Sunday still belongs to the week
        makeExpense('2026-09-23', 80_000, { fundedByPotId: 'pot:trip' }),
        makeExpense('2026-09-24', 999, { deletedAt: NOW }),
        makeExpense('2026-09-20', 5_000), // previous week
        makeExpense('2026-09-28', 5_000), // next week
      ],
    })
    expect(summary).toEqual({
      weekStart: WEEK,
      closed: true,
      hasIncome: true,
      incomeCents: 200_000,
      spentCents: 31_250,
      fundedCents: 80_000,
      savedCents: 168_750,
      savingsRate: 0.84375,
      totalLimitCents: 40_000,
      underBudget: true,
    })
  })

  it('books a minus week as negative savings with a zero rate', () => {
    const summary = summarizeWeek({
      weekStart: WEEK,
      week: makeWeek(WEEK, { incomeCents: 0, closedAt: NOW }),
      budget,
      expenses: [makeExpense('2026-09-22', 45_000)],
    })
    expect(summary).toMatchObject({
      savedCents: -45_000,
      savingsRate: 0,
      underBudget: false,
      hasIncome: true,
    })
  })

  it('handles weeks without a row, without income, without a budget, or with a deleted row', () => {
    const none = summarizeWeek({ weekStart: WEEK, week: null, budget: null, expenses: [] })
    expect(none).toMatchObject({
      closed: false,
      hasIncome: false,
      incomeCents: 0,
      savedCents: 0,
      underBudget: null,
    })

    const open = summarizeWeek({
      weekStart: WEEK,
      week: makeWeek(WEEK, { incomeCents: null }),
      budget,
      expenses: [],
    })
    expect(open).toMatchObject({ closed: false, hasIncome: false })

    const deleted = summarizeWeek({
      weekStart: WEEK,
      week: makeWeek(WEEK, { closedAt: NOW, deletedAt: NOW }),
      budget,
      expenses: [],
    })
    expect(deleted).toMatchObject({ closed: false, hasIncome: false, incomeCents: 0 })
  })

  it('counts spending exactly at the limit as under budget', () => {
    const summary = summarizeWeek({
      weekStart: WEEK,
      week: makeWeek(WEEK),
      budget,
      expenses: [makeExpense(WEEK, 40_000)],
    })
    expect(summary.underBudget).toBe(true)
  })
})

describe('buildAutoWeeklyTx', () => {
  it('books into the primary pot on the week’s Sunday with a deterministic id', () => {
    expect(buildAutoWeeklyTx({ weekStart: WEEK, savedCents: 168_750 }, NOW)).toEqual({
      id: 'auto:2026-09-21',
      potId: PRIMARY_POT_ID,
      amountCents: 168_750,
      date: '2026-09-27',
      type: 'auto-weekly',
      sourceWeekStart: WEEK,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    })
  })

  it('keeps pot and creation time when a closed week is recomputed, and revives tombstones', () => {
    const existing = makeTx('pot:other', 1, '2026-09-27', {
      id: 'auto:2026-09-21',
      createdAt: 5,
      deletedAt: 9,
    })
    const next = buildAutoWeeklyTx({ weekStart: WEEK, savedCents: -4_500 }, NOW, existing)
    expect(next).toMatchObject({
      potId: 'pot:other',
      createdAt: 5,
      updatedAt: NOW,
      amountCents: -4_500,
      deletedAt: null,
    })
  })
})

describe('pot balances', () => {
  it('sums signed, active transactions per pot', () => {
    const txs = [
      makeTx(PRIMARY_POT_ID, 160_000, '2026-09-13'),
      makeTx(PRIMARY_POT_ID, -50_000, '2026-09-14'),
      makeTx('pot:trip', 50_000, '2026-09-14'),
      makeTx('pot:trip', 99_999, '2026-09-15', { deletedAt: NOW }),
    ]
    expect(potBalances(txs)).toEqual({ [PRIMARY_POT_ID]: 110_000, 'pot:trip': 50_000 })
    expect(potBalance(txs, 'pot:empty')).toBe(0)
  })
})

describe('move validation', () => {
  const primary = makePot(PRIMARY_POT_ID)
  const trip = makePot('pot:trip')

  it('accepts a covered transfer and rejects everything else', () => {
    const ok = { from: primary, to: trip, amountCents: 5_000, fromBalanceCents: 5_000 }
    expect(validateTransfer(ok)).toBeNull()
    expect(validateTransfer({ ...ok, amountCents: 5_001 })).toBe('insufficient')
    expect(validateTransfer({ ...ok, to: primary })).toBe('same-pot')
    expect(validateTransfer({ ...ok, amountCents: 0 })).toBe('non-positive')
    expect(validateTransfer({ ...ok, amountCents: 10.5 })).toBe('non-positive')
    expect(validateTransfer({ ...ok, to: makePot('pot:x', { archived: true }) })).toBe('archived')
    expect(validateTransfer({ ...ok, to: null })).toBe('unknown-pot')
    expect(validateTransfer({ ...ok, from: makePot('pot:y', { deletedAt: NOW }) })).toBe(
      'unknown-pot',
    )
  })

  it('never overdraws on withdrawals and validates deposits', () => {
    expect(validateWithdrawal({ pot: trip, amountCents: 100, balanceCents: 100 })).toBeNull()
    expect(validateWithdrawal({ pot: trip, amountCents: 101, balanceCents: 100 })).toBe(
      'insufficient',
    )
    expect(validateWithdrawal({ pot: trip, amountCents: -1, balanceCents: 100 })).toBe(
      'non-positive',
    )
    expect(validateDeposit({ pot: trip, amountCents: 100 })).toBeNull()
    expect(validateDeposit({ pot: undefined, amountCents: 100 })).toBe('unknown-pot')
    expect(validateDeposit({ pot: trip, amountCents: 0 })).toBe('non-positive')
  })
})

describe('pendingWeeks', () => {
  const weeks = [makeWeek('2026-08-31', { closedAt: NOW }), makeWeek('2026-09-07')]

  it('lists finished, unclosed weeks since tracking began, oldest first', () => {
    // Sunday: the current week (09-14) is not finished yet.
    expect(pendingWeeks(weeks, '2026-08-26', '2026-09-20')).toEqual(['2026-08-24', '2026-09-07'])
    // Monday: last week is now finished.
    expect(pendingWeeks(weeks, '2026-08-26', '2026-09-21')).toEqual([
      '2026-08-24',
      '2026-09-07',
      '2026-09-14',
    ])
  })

  it('is empty when tracking started this week and ignores deleted week rows', () => {
    expect(pendingWeeks([], '2026-09-16', '2026-09-20')).toEqual([])
    const deletedClose = [makeWeek('2026-09-07', { closedAt: NOW, deletedAt: NOW })]
    expect(pendingWeeks(deletedClose, '2026-09-07', '2026-09-20')).toEqual(['2026-09-07'])
  })
})
