import { describe, expect, it } from 'vitest'
import { makeExpense, NOW } from '@/test/fixtures'
import {
  bestWorstWeek,
  categoryAverages,
  categoryBreakdown,
  compareToPreviousWeek,
  cumulativeSavings,
  monthlySeries,
  weeklySeries,
} from './analytics'
import type { WeekSummary } from './savings'

const summary = (
  weekStart: string,
  spentCents: number,
  closed = true,
  incomeCents = 200_000,
): WeekSummary => ({
  weekStart,
  closed,
  hasIncome: closed,
  incomeCents: closed ? incomeCents : 0,
  spentCents,
  fundedCents: 0,
  savedCents: (closed ? incomeCents : 0) - spentCents,
  savingsRate: 0,
  totalLimitCents: 40_000,
  underBudget: spentCents <= 40_000,
})

const summaries = [
  summary('2026-09-21', 12_000, false), // running week
  summary('2026-08-31', 30_000),
  summary('2026-09-07', 50_000),
  summary('2026-09-14', 20_000),
  summary('2026-08-24', 40_000),
]

describe('weeklySeries', () => {
  it('is chronological', () => {
    expect(weeklySeries(summaries).map((point) => point.weekStart)).toEqual([
      '2026-08-24',
      '2026-08-31',
      '2026-09-07',
      '2026-09-14',
      '2026-09-21',
    ])
  })
})

describe('monthlySeries', () => {
  it('sums whole closed weeks by the Thursday rule and keeps open weeks apart', () => {
    const [august, september] = monthlySeries(summaries)
    // 08-24 (Thu 27th) is August; 08-31 (Thu Sept 3rd) already counts as September.
    expect(august).toMatchObject({
      month: '2026-08',
      weeks: 1,
      spentCents: 40_000,
      savedCents: 160_000,
    })
    expect(september).toEqual({
      month: '2026-09',
      weeks: 3,
      incomeCents: 600_000,
      spentCents: 100_000,
      savedCents: 500_000,
      avgSpentPerWeekCents: 33_333,
      avgSavedPerWeekCents: 166_667,
      openWeeks: 1,
      openSpentCents: 12_000,
    })
  })

  it('shows no bogus minus for a month that only has an open week', () => {
    expect(monthlySeries([summary('2026-10-05', 9_000, false)])).toEqual([
      expect.objectContaining({
        month: '2026-10',
        weeks: 0,
        savedCents: 0,
        avgSavedPerWeekCents: 0,
        openSpentCents: 9_000,
      }),
    ])
  })
})

describe('categoryBreakdown', () => {
  const expenses = [
    makeExpense('2026-09-21', 6_000, { categoryId: 'cat:groceries' }),
    makeExpense('2026-09-22', 25_000, { categoryId: 'cat:rent' }),
    makeExpense('2026-09-23', 4_000, { categoryId: 'cat:groceries' }),
    makeExpense('2026-09-23', 65_000, { categoryId: 'cat:travel', fundedByPotId: 'pot:trip' }),
    makeExpense('2026-09-23', 1_000, { deletedAt: NOW }),
  ]

  it('orders by amount with shares, excluding pot-funded by default', () => {
    expect(categoryBreakdown(expenses)).toEqual([
      { categoryId: 'cat:rent', amountCents: 25_000, share: 25 / 35 },
      { categoryId: 'cat:groceries', amountCents: 10_000, share: 10 / 35 },
    ])
  })

  it('can include pot-funded spending and copes with no data', () => {
    expect(categoryBreakdown(expenses, { includeFunded: true })[0]).toMatchObject({
      categoryId: 'cat:travel',
      share: 0.65,
    })
    expect(categoryBreakdown([])).toEqual([])
  })
})

describe('cumulativeSavings', () => {
  it('accumulates closed weeks only, optionally from a starting balance', () => {
    expect(cumulativeSavings(summaries)).toEqual([
      { weekStart: '2026-08-24', totalCents: 160_000 },
      { weekStart: '2026-08-31', totalCents: 330_000 },
      { weekStart: '2026-09-07', totalCents: 480_000 },
      { weekStart: '2026-09-14', totalCents: 660_000 },
    ])
    expect(cumulativeSavings(summaries, 1_000_000).at(-1)?.totalCents).toBe(1_660_000)
  })
})

describe('compareToPreviousWeek', () => {
  it('reports deltas, with a null ratio when last week had no spending', () => {
    expect(
      compareToPreviousWeek(summary('2026-09-14', 20_000), summary('2026-09-07', 50_000)),
    ).toEqual({
      incomeDeltaCents: 0,
      spentDeltaCents: -30_000,
      savedDeltaCents: 30_000,
      spentDeltaRatio: -0.6,
    })
    expect(
      compareToPreviousWeek(summary('2026-09-14', 20_000), summary('2026-09-07', 0))
        ?.spentDeltaRatio,
    ).toBeNull()
    expect(compareToPreviousWeek(summary('2026-09-14', 20_000), null)).toBeNull()
  })
})

describe('bestWorstWeek', () => {
  it('picks by amount saved among closed weeks', () => {
    const result = bestWorstWeek(summaries)
    expect(result?.best.weekStart).toBe('2026-09-14')
    expect(result?.worst.weekStart).toBe('2026-09-07')
    expect(bestWorstWeek([summary('2026-09-21', 1, false)])).toBeNull()
  })
})

describe('categoryAverages', () => {
  it('averages per calendar week, counting empty weeks as zero', () => {
    const expenses = [
      makeExpense('2026-09-01', 9_000),
      makeExpense('2026-09-09', 6_000),
      makeExpense('2026-09-10', 3_000, { categoryId: 'cat:fun' }),
      makeExpense('2026-09-22', 99_000), // outside the requested weeks
      makeExpense('2026-09-02', 99_000, { fundedByPotId: 'pot:trip' }),
    ]
    expect(categoryAverages(expenses, ['2026-08-31', '2026-09-07', '2026-09-14'])).toEqual({
      'cat:groceries': 5_000,
      'cat:fun': 1_000,
    })
    expect(categoryAverages(expenses, [])).toEqual({})
  })
})
