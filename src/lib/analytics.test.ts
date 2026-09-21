import { describe, expect, it } from 'vitest'
import { makeBudget, makeExpense, makeWeek, NOW } from '@/test/fixtures'
import {
  analyticsWeeks,
  bestWorstWeek,
  categoryAverages,
  categoryBreakdown,
  categoryDetail,
  compareToPreviousWeek,
  cumulativeSavings,
  expensesInWeeks,
  firstAnalyticsWeek,
  flowSeries,
  foldSlices,
  latestComparison,
  monthlySeries,
  rangeTotals,
  summarizeWeeks,
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
      avgIncomePerWeekCents: 200_000,
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

describe('firstAnalyticsWeek', () => {
  it('is the tracking week, or an earlier closed week', () => {
    expect(firstAnalyticsWeek('2026-09-09', [])).toBe('2026-09-07')
    expect(
      firstAnalyticsWeek('2026-09-09', [
        makeWeek('2026-08-31', { closedAt: NOW }),
        makeWeek('2026-08-17'), // open rows do not pull the start back
        makeWeek('2026-08-10', { closedAt: NOW, deletedAt: NOW }),
      ]),
    ).toBe('2026-08-31')
  })
})

describe('analyticsWeeks', () => {
  const base = { today: '2026-09-23', firstWeek: '2026-01-05', granularity: 'week' } as const

  it('ends with the running week and spans the requested number of weeks', () => {
    const weeks = analyticsWeeks({ ...base, range: 8 })
    expect(weeks).toHaveLength(8)
    expect(weeks[0]).toBe('2026-08-03')
    expect(weeks.at(-1)).toBe('2026-09-21')
  })

  it('never reaches back before tracking began', () => {
    expect(analyticsWeeks({ ...base, range: 26, firstWeek: '2026-09-07' })).toEqual([
      '2026-09-07',
      '2026-09-14',
      '2026-09-21',
    ])
    expect(analyticsWeeks({ ...base, range: 'all', firstWeek: '2026-09-14' })).toEqual([
      '2026-09-14',
      '2026-09-21',
    ])
    // A tracking start in the future still shows the running week.
    expect(analyticsWeeks({ ...base, range: 8, firstWeek: '2026-10-05' })).toEqual(['2026-09-21'])
  })

  it('by month, starts with the first week of a month (Thursday rule)', () => {
    // 12 weeks back is 07-06; July's first week is 06-29 (its Thursday is July 2nd).
    const weeks = analyticsWeeks({ ...base, range: 12, granularity: 'month' })
    expect(weeks[0]).toBe('2026-06-29')
    expect(weeks).toHaveLength(13)
    // … but still not before tracking began.
    expect(
      analyticsWeeks({ ...base, range: 12, granularity: 'month', firstWeek: '2026-07-06' })[0],
    ).toBe('2026-07-06')
  })

  it('crosses a year boundary', () => {
    const weeks = analyticsWeeks({
      ...base,
      today: '2027-01-06',
      range: 8,
      firstWeek: '2026-01-05',
    })
    expect(weeks[0]).toBe('2026-11-16')
    expect(weeks.at(-1)).toBe('2027-01-04')
  })
})

describe('summarizeWeeks', () => {
  it('summarizes every requested week from raw rows, also weeks without a row', () => {
    const result = summarizeWeeks(['2026-09-07', '2026-09-14'], {
      weeks: [makeWeek('2026-09-07', { closedAt: NOW, incomeCents: 180_000 })],
      expenses: [
        makeExpense('2026-09-08', 30_000),
        makeExpense('2026-09-15', 5_000),
        makeExpense('2026-09-16', 70_000, { fundedByPotId: 'pot:trip' }),
        makeExpense('2026-09-01', 99_000), // not requested
      ],
      budgets: [makeBudget('2026-09-07', 40_000)],
    })
    expect(result).toEqual([
      expect.objectContaining({
        weekStart: '2026-09-07',
        closed: true,
        incomeCents: 180_000,
        spentCents: 30_000,
        savedCents: 150_000,
        totalLimitCents: 40_000,
      }),
      expect.objectContaining({
        weekStart: '2026-09-14',
        closed: false,
        spentCents: 5_000,
        fundedCents: 70_000,
      }),
    ])
  })
})

describe('expensesInWeeks', () => {
  it('keeps active expenses of the given weeks', () => {
    const kept = makeExpense('2026-09-20', 1_000) // Sunday still belongs to 09-14
    const result = expensesInWeeks(
      [
        kept,
        makeExpense('2026-09-21', 2_000),
        makeExpense('2026-09-15', 3_000, { deletedAt: NOW }),
      ],
      ['2026-09-14'],
    )
    expect(result).toEqual([kept])
  })
})

describe('rangeTotals', () => {
  it('adds up closed weeks and keeps open spending apart', () => {
    expect(rangeTotals(summaries)).toEqual({
      closedWeeks: 4,
      incomeCents: 800_000,
      spentCents: 140_000,
      savedCents: 660_000,
      savingsRate: 0.825,
      openWeeks: 1,
      openSpentCents: 12_000,
    })
    expect(rangeTotals([])).toMatchObject({ closedWeeks: 0, savingsRate: 0 })
  })
})

describe('flowSeries', () => {
  it('by week: closed weeks carry their numbers, an open week only what it has spent', () => {
    const series = flowSeries(summaries, 'week')
    expect(series.map((point) => point.key)).toEqual([
      '2026-08-24',
      '2026-08-31',
      '2026-09-07',
      '2026-09-14',
      '2026-09-21',
    ])
    expect(series[3]).toEqual({
      key: '2026-09-14',
      weeks: 1,
      incomeCents: 200_000,
      spentCents: 20_000,
      savedCents: 180_000,
      openWeeks: 0,
      openSpentCents: 0,
      openBarCents: 0,
      totalIncomeCents: 200_000,
      totalSpentCents: 20_000,
      totalSavedCents: 180_000,
    })
    expect(series[4]).toMatchObject({
      key: '2026-09-21',
      weeks: 0,
      incomeCents: 0,
      spentCents: 0,
      savedCents: 0,
      openWeeks: 1,
      openSpentCents: 12_000,
      openBarCents: 12_000,
    })
  })

  it('by month: per-week averages of the closed weeks, sums alongside', () => {
    const [august, september] = flowSeries(summaries, 'month')
    expect(august).toMatchObject({ key: '2026-08', weeks: 1, spentCents: 40_000, openBarCents: 0 })
    expect(september).toEqual({
      key: '2026-09',
      weeks: 3,
      incomeCents: 200_000,
      spentCents: 33_333,
      savedCents: 166_667,
      openWeeks: 1,
      openSpentCents: 12_000,
      openBarCents: 0, // the month has closed weeks to show
      totalIncomeCents: 600_000,
      totalSpentCents: 100_000,
      totalSavedCents: 500_000,
    })
  })

  it('by month: a month of open weeks only shows their average spending as the pale bar', () => {
    expect(
      flowSeries(
        [summary('2026-10-05', 9_000, false), summary('2026-10-12', 4_000, false)],
        'month',
      ),
    ).toEqual([
      expect.objectContaining({
        key: '2026-10',
        weeks: 0,
        savedCents: 0,
        openWeeks: 2,
        openSpentCents: 13_000,
        openBarCents: 6_500,
      }),
    ])
  })

  it('keeps a minus week negative', () => {
    const [point] = flowSeries([summary('2026-09-14', 30_000, true, 0)], 'week')
    expect(point).toMatchObject({ incomeCents: 0, spentCents: 30_000, savedCents: -30_000 })
  })
})

describe('latestComparison', () => {
  it('compares the two latest closed weeks and ignores the running one', () => {
    expect(latestComparison(summaries, 'week')).toEqual({
      currentKey: '2026-09-14',
      previousKey: '2026-09-07',
      incomeCents: 200_000,
      spentCents: 20_000,
      savedCents: 180_000,
      incomeDeltaCents: 0,
      spentDeltaCents: -30_000,
      savedDeltaCents: 30_000,
      spentDeltaRatio: -0.6,
    })
  })

  it('compares months by their per-week averages', () => {
    expect(latestComparison(summaries, 'month')).toMatchObject({
      currentKey: '2026-09',
      previousKey: '2026-08',
      spentCents: 33_333,
      spentDeltaCents: -6_667,
      savedDeltaCents: 6_667,
    })
  })

  it('needs two finished periods', () => {
    expect(
      latestComparison([summary('2026-09-14', 1), summary('2026-09-21', 1, false)], 'week'),
    ).toBeNull()
    expect(latestComparison(summaries.slice(1, 4), 'month')).toBeNull() // all in September
    expect(latestComparison([], 'week')).toBeNull()
  })

  it('has no ratio when the earlier period had no spending', () => {
    expect(
      latestComparison([summary('2026-09-07', 0), summary('2026-09-14', 5_000)], 'week')
        ?.spentDeltaRatio,
    ).toBeNull()
  })
})

describe('foldSlices', () => {
  const slices = [50, 20, 10, 8, 6, 4, 2].map((amount, index) => ({
    categoryId: `cat:${index}`,
    amountCents: amount * 100,
    share: amount / 100,
  }))

  it('keeps the largest and folds the tail into one slice', () => {
    const folded = foldSlices(slices, 5)
    expect(folded.top.map((slice) => slice.categoryId)).toEqual([
      'cat:0',
      'cat:1',
      'cat:2',
      'cat:3',
      'cat:4',
    ])
    expect(folded.rest?.amountCents).toBe(600)
    expect(folded.rest?.share).toBeCloseTo(0.06)
    expect(folded.rest?.slices.map((slice) => slice.categoryId)).toEqual(['cat:5', 'cat:6'])
  })

  it('does not fold a single leftover category', () => {
    expect(foldSlices(slices.slice(0, 6), 5)).toEqual({ top: slices.slice(0, 6), rest: null })
    expect(foldSlices([], 5)).toEqual({ top: [], rest: null })
  })
})

describe('categoryDetail', () => {
  const weekStarts = ['2026-08-24', '2026-08-31', '2026-09-07']
  const biggest = makeExpense('2026-09-08', 9_000, { id: 'big' })
  const expenses = [
    makeExpense('2026-08-25', 2_000, { id: 'a' }),
    biggest,
    makeExpense('2026-09-09', 2_000, { id: 'b' }),
    makeExpense('2026-09-09', 50_000, { categoryId: 'cat:rent' }),
    makeExpense('2026-09-10', 70_000, { fundedByPotId: 'pot:trip' }),
    makeExpense('2026-09-10', 1_000, { deletedAt: NOW }),
    makeExpense('2026-09-15', 8_000), // outside the selection
  ]

  it('gives the trend per week with empty weeks as zero', () => {
    const detail = categoryDetail({
      expenses,
      categoryId: 'cat:groceries',
      weekStarts,
      granularity: 'week',
    })
    expect(detail.totalCents).toBe(13_000)
    expect(detail.avgPerWeekCents).toBe(4_333)
    expect(detail.trend).toEqual([
      { key: '2026-08-24', amountCents: 2_000 },
      { key: '2026-08-31', amountCents: 0 },
      { key: '2026-09-07', amountCents: 11_000 },
    ])
  })

  it('gives the trend per month by the Thursday rule', () => {
    expect(
      categoryDetail({ expenses, categoryId: 'cat:groceries', weekStarts, granularity: 'month' })
        .trend,
    ).toEqual([
      { key: '2026-08', amountCents: 2_000 },
      { key: '2026-09', amountCents: 11_000 }, // 08-31 already counts as September
    ])
  })

  it('lists the largest expenses, newest first among equals', () => {
    const detail = categoryDetail({
      expenses,
      categoryId: 'cat:groceries',
      weekStarts,
      granularity: 'week',
      topCount: 2,
    })
    expect(detail.largest.map((expense) => expense.id)).toEqual(['big', 'b'])
  })

  it('copes with nothing to show', () => {
    expect(
      categoryDetail({ expenses, categoryId: 'cat:none', weekStarts: [], granularity: 'week' }),
    ).toEqual({ totalCents: 0, avgPerWeekCents: 0, trend: [], largest: [] })
  })
})
