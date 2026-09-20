import { describe, expect, it } from 'vitest'
import { makeTx, NOW } from '@/test/fixtures'
import { addWeeksISO } from './dates'
import {
  deadlineDelta,
  forecastPot,
  requiredWeeklyForDeadline,
  weeklyPace,
  weeksUntil,
} from './forecast'
import { PRIMARY_POT_ID } from './types'

const TODAY = '2026-09-23' // Wednesday; last finished week ends on Sunday 2026-09-20

/** One weekly booking per Sunday for the 8 weeks of the pace window. */
const eightSundays = Array.from({ length: 8 }, (_, index) =>
  makeTx(PRIMARY_POT_ID, 160_000, addWeeksISO('2026-08-02', index), { type: 'auto-weekly' }),
)

describe('weeklyPace', () => {
  it('averages net contributions over the last 8 finished weeks', () => {
    expect(weeklyPace(eightSundays, PRIMARY_POT_ID, TODAY)).toBe(160_000)
  })

  it('counts transfers but not withdrawals or pot-funded expenses', () => {
    const txs = [
      ...eightSundays,
      makeTx(PRIMARY_POT_ID, -40_000, '2026-09-10', { type: 'transfer-out' }),
      makeTx(PRIMARY_POT_ID, -50_000, '2026-09-11', { type: 'withdrawal' }),
      makeTx(PRIMARY_POT_ID, -80_000, '2026-09-12', { type: 'expense-funding' }),
    ]
    expect(weeklyPace(txs, PRIMARY_POT_ID, TODAY)).toBe(155_000)
  })

  it('ignores the running week, other pots and deleted rows', () => {
    const txs = [
      ...eightSundays,
      makeTx(PRIMARY_POT_ID, 999_999, '2026-09-22'),
      makeTx('pot:trip', 999_999, '2026-09-10'),
      makeTx(PRIMARY_POT_ID, 999_999, '2026-09-10', { deletedAt: NOW }),
    ]
    expect(weeklyPace(txs, PRIMARY_POT_ID, TODAY)).toBe(160_000)
  })

  it('averages a young pot over its own age, not the whole window', () => {
    const txs = ['2026-09-06', '2026-09-13', '2026-09-20'].map((date) =>
      makeTx('pot:trip', 30_000, date),
    )
    expect(weeklyPace(txs, 'pot:trip', TODAY)).toBe(30_000)
  })

  it('can be negative and is zero without history', () => {
    const minus = eightSundays.map((tx) => ({ ...tx, amountCents: -10_000 }))
    expect(weeklyPace(minus, PRIMARY_POT_ID, TODAY)).toBe(-10_000)
    expect(weeklyPace([], PRIMARY_POT_ID, TODAY)).toBe(0)
  })

  it('drops old contributions that fell out of the window', () => {
    const old = [makeTx('pot:trip', 800_000, '2026-05-03')]
    expect(weeklyPace(old, 'pot:trip', TODAY)).toBe(0)
  })
})

describe('forecastPot', () => {
  it('predicts the Sunday on which the target is reached', () => {
    expect(
      forecastPot({
        balanceCents: 100_000,
        targetCents: 500_000,
        paceCentsPerWeek: 160_000,
        today: TODAY,
      }),
    ).toEqual({ reached: false, weeksLeft: 3, eta: '2026-10-11' })
  })

  it('handles reached targets, missing targets and a non-positive pace', () => {
    expect(
      forecastPot({
        balanceCents: 500_000,
        targetCents: 500_000,
        paceCentsPerWeek: 0,
        today: TODAY,
      }),
    ).toEqual({
      reached: true,
      weeksLeft: 0,
      eta: TODAY,
    })
    expect(
      forecastPot({ balanceCents: 1, targetCents: null, paceCentsPerWeek: 5, today: TODAY }).eta,
    ).toBeNull()
    expect(
      forecastPot({ balanceCents: 1, targetCents: 10, paceCentsPerWeek: 0, today: TODAY }),
    ).toEqual({
      reached: false,
      weeksLeft: null,
      eta: null,
    })
    expect(
      forecastPot({ balanceCents: 1, targetCents: 10, paceCentsPerWeek: -5, today: TODAY })
        .weeksLeft,
    ).toBeNull()
  })
})

describe('deadlines', () => {
  it('counts week closes until the deadline', () => {
    expect(weeksUntil(TODAY, TODAY)).toBe(1)
    expect(weeksUntil('2026-10-01', TODAY)).toBe(2)
    expect(weeksUntil('2026-12-20', TODAY)).toBe(13)
    expect(weeksUntil('2026-09-22', TODAY)).toBeNull()
  })

  it('computes what is needed per week', () => {
    const base = { balanceCents: 100_000, targetCents: 500_000, today: TODAY }
    expect(requiredWeeklyForDeadline({ ...base, deadline: '2026-12-20' })).toBe(30_770)
    expect(
      requiredWeeklyForDeadline({ ...base, balanceCents: 600_000, deadline: '2026-12-20' }),
    ).toBe(0)
    expect(requiredWeeklyForDeadline({ ...base, deadline: null })).toBeNull()
    expect(
      requiredWeeklyForDeadline({ ...base, targetCents: null, deadline: '2026-12-20' }),
    ).toBeNull()
    expect(requiredWeeklyForDeadline({ ...base, deadline: '2026-09-01' })).toBeNull()
  })

  it('reports whole weeks ahead (+) or behind (−)', () => {
    expect(deadlineDelta('2026-10-11', '2026-10-25')).toBe(2)
    expect(deadlineDelta('2026-10-11', '2026-10-01')).toBe(-1)
    expect(deadlineDelta('2026-10-11', '2026-10-13')).toBe(0)
    expect(deadlineDelta(null, '2026-10-13')).toBeNull()
    expect(deadlineDelta('2026-10-11', null)).toBeNull()
  })
})
