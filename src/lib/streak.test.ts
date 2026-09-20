import { describe, expect, it } from 'vitest'
import type { WeekSummary } from './savings'
import { computeStreak } from './streak'

const week = (weekStart: string, underBudget: boolean | null, closed = true): WeekSummary => ({
  weekStart,
  closed,
  hasIncome: true,
  incomeCents: 200_000,
  spentCents: underBudget ? 30_000 : 50_000,
  fundedCents: 0,
  savedCents: underBudget ? 170_000 : 150_000,
  savingsRate: 0.8,
  totalLimitCents: underBudget === null ? null : 40_000,
  underBudget,
})

describe('computeStreak', () => {
  it('counts contiguous closed weeks under budget (input order does not matter)', () => {
    const summaries = [week('2026-09-07', true), week('2026-08-24', true), week('2026-08-31', true)]
    expect(computeStreak(summaries, '2026-09-16')).toEqual({ current: 3, best: 3, stale: false })
  })

  it('resets on an over-budget week but remembers the best run', () => {
    const summaries = [
      week('2026-08-10', true),
      week('2026-08-17', true),
      week('2026-08-24', true),
      week('2026-08-31', false),
      week('2026-09-07', true),
    ]
    expect(computeStreak(summaries, '2026-09-16')).toEqual({ current: 1, best: 3, stale: false })
  })

  it('breaks on a calendar gap (a week that was never closed)', () => {
    const summaries = [
      week('2026-08-24', true),
      week('2026-08-31', true, false),
      week('2026-09-07', true),
    ]
    expect(computeStreak(summaries, '2026-09-16')).toEqual({ current: 1, best: 1, stale: false })
  })

  it('is stale when the latest close is older than last week', () => {
    const summaries = [week('2026-08-17', true), week('2026-08-24', true)]
    expect(computeStreak(summaries, '2026-09-16')).toEqual({ current: 0, best: 2, stale: true })
    // Closing last week (or already the current one) makes it valid again.
    expect(computeStreak([week('2026-09-07', true)], '2026-09-20').stale).toBe(false)
    expect(computeStreak([week('2026-09-14', true)], '2026-09-20')).toEqual({
      current: 1,
      best: 1,
      stale: false,
    })
  })

  it('ends at zero when the latest closed week was over budget', () => {
    expect(
      computeStreak([week('2026-08-31', true), week('2026-09-07', false)], '2026-09-16'),
    ).toEqual({
      current: 0,
      best: 1,
      stale: false,
    })
  })

  it('ignores weeks without a budget and handles no data', () => {
    expect(computeStreak([week('2026-09-07', null)], '2026-09-16')).toEqual({
      current: 0,
      best: 0,
      stale: false,
    })
    expect(computeStreak([], '2026-09-16')).toEqual({ current: 0, best: 0, stale: false })
  })
})
