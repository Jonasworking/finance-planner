import { describe, expect, it } from 'vitest'
import { makeExpense, makePot, makeTx, NOW } from '@/test/fixtures'
import { addWeeksISO } from './dates'
import { availableForExpense, isDerivedTx, potHistory, summarizePot, summarizePots } from './pots'
import { PRIMARY_POT_ID } from './types'

const TODAY = '2026-09-23' // Wednesday; last finished week ends on Sunday 2026-09-20
const TRIP = 'pot:trip'

/** A$200 moved into the trip pot on each of the last 8 Sundays. */
const tripTransfers = Array.from({ length: 8 }, (_, index) =>
  makeTx(TRIP, 20_000, addWeeksISO('2026-08-02', index), { type: 'transfer-in' }),
)

describe('summarizePot', () => {
  it('derives balance, progress, forecast and "needed per week" from the bookings', () => {
    const pot = makePot(TRIP, { targetCents: 300_000, deadline: '2026-12-20' })
    const summary = summarizePot(pot, tripTransfers, TODAY)

    expect(summary).toMatchObject({
      balanceCents: 160_000,
      missingCents: 140_000,
      paceCentsPerWeek: 20_000,
      // 7 more week closes at A$200: the running week's Sunday is the first of them
      forecast: { reached: false, weeksLeft: 7, eta: '2026-11-08' },
      // 88 days = 13 week closes until the deadline
      requiredWeeklyCents: 10_770,
      deadlineDeltaWeeks: 6,
      overdue: false,
    })
    expect(summary.progress).toBeCloseTo(0.5333, 3)
  })

  it('is done once the target is reached', () => {
    const pot = makePot(TRIP, { targetCents: 150_000, deadline: '2026-12-20' })
    expect(summarizePot(pot, tripTransfers, TODAY)).toMatchObject({
      progress: 1,
      missingCents: 0,
      forecast: { reached: true, weeksLeft: 0 },
      requiredWeeklyCents: 0,
      deadlineDeltaWeeks: null,
      overdue: false,
    })
  })

  it('has no progress or forecast without a target', () => {
    expect(summarizePot(makePot(TRIP), tripTransfers, TODAY)).toMatchObject({
      balanceCents: 160_000,
      progress: null,
      missingCents: null,
      forecast: { reached: false, weeksLeft: null, eta: null },
      requiredWeeklyCents: null,
      deadlineDeltaWeeks: null,
    })
  })

  it('flags a missed deadline instead of asking for an impossible weekly amount', () => {
    const pot = makePot(TRIP, { targetCents: 300_000, deadline: '2026-09-01' })
    expect(summarizePot(pot, tripTransfers, TODAY)).toMatchObject({
      overdue: true,
      requiredWeeklyCents: null,
    })
  })

  it('never shows negative progress for a pot in the red, and an empty pot is at zero', () => {
    const primary = makePot(PRIMARY_POT_ID, { targetCents: 100_000 })
    const minusWeek = [makeTx(PRIMARY_POT_ID, -5_000, '2026-09-20', { type: 'auto-weekly' })]
    expect(summarizePot(primary, minusWeek, TODAY)).toMatchObject({
      balanceCents: -5_000,
      progress: 0,
      missingCents: 105_000,
    })
    expect(summarizePot(primary, [], TODAY)).toMatchObject({ balanceCents: 0, progress: 0 })
  })
})

describe('summarizePots', () => {
  it('orders active pots, keeps archived ones apart and adds everything up', () => {
    const pots = [
      makePot('pot:car', { sortOrder: 2 }),
      makePot(PRIMARY_POT_ID, { sortOrder: 0 }),
      makePot('pot:old', { sortOrder: 1, archived: true }),
      makePot('pot:gone', { sortOrder: 3, deletedAt: NOW }),
    ]
    const txs = [
      makeTx(PRIMARY_POT_ID, 50_000, '2026-09-06'),
      makeTx('pot:car', 7_500, '2026-09-13'),
      makeTx('pot:gone', 99_999, '2026-09-13'),
    ]
    const result = summarizePots(pots, txs, TODAY)

    expect(result.active.map((summary) => summary.pot.id)).toEqual([PRIMARY_POT_ID, 'pot:car'])
    expect(result.archived.map((summary) => summary.pot.id)).toEqual(['pot:old'])
    expect(result.totalCents).toBe(57_500)
  })
})

describe('potHistory', () => {
  it('lists a pot’s bookings newest first with the running balance', () => {
    const txs = [
      makeTx(TRIP, 30_000, '2026-09-01', { id: 'a' }),
      makeTx(TRIP, -12_000, '2026-09-15', { id: 'c', createdAt: NOW + 2 }),
      makeTx(TRIP, 5_000, '2026-09-15', { id: 'b', createdAt: NOW + 1 }),
      makeTx(TRIP, 99_999, '2026-09-16', { id: 'deleted', deletedAt: NOW }),
      makeTx(PRIMARY_POT_ID, 77_000, '2026-09-16', { id: 'other-pot' }),
    ]
    expect(potHistory(txs, TRIP).map((entry) => [entry.tx.id, entry.balanceAfterCents])).toEqual([
      ['c', 23_000],
      ['b', 35_000],
      ['a', 30_000],
    ])
    expect(potHistory(txs, 'pot:unknown')).toEqual([])
  })

  it('knows which bookings follow a week or an expense', () => {
    expect(
      (
        [
          'auto-weekly',
          'expense-funding',
          'manual-deposit',
          'withdrawal',
          'transfer-in',
          'transfer-out',
        ] as const
      ).map((type) => isDerivedTx({ type })),
    ).toEqual([true, true, false, false, false, false])
  })
})

describe('availableForExpense ("aus Topf bezahlt")', () => {
  const balances = { [TRIP]: 40_000 }

  it('is the pot’s balance for a new expense', () => {
    expect(availableForExpense(balances, TRIP)).toBe(40_000)
    expect(availableForExpense(balances, TRIP, null)).toBe(40_000)
    expect(availableForExpense(balances, 'pot:unknown')).toBe(0)
  })

  it('gives an expense back what it already holds in the same pot', () => {
    const funded = makeExpense('2026-09-21', 25_000, { fundedByPotId: TRIP })
    expect(availableForExpense(balances, TRIP, funded)).toBe(65_000)
    expect(availableForExpense(balances, PRIMARY_POT_ID, funded)).toBe(0)
    expect(availableForExpense(balances, TRIP, { ...funded, deletedAt: NOW })).toBe(40_000)
    expect(availableForExpense(balances, TRIP, makeExpense('2026-09-21', 25_000))).toBe(40_000)
  })
})
