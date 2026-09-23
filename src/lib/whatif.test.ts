import { describe, expect, it } from 'vitest'
import {
  makeBudget,
  makeCategory,
  makeExpense,
  makePot,
  makeTx,
  makeWeek,
  NOW,
} from '@/test/fixtures'
import type { WeekSummary } from './savings'
import { PRIMARY_POT_ID } from './types'
import {
  baselineWeeklySaving,
  budgetFromScenario,
  horizonUntil,
  projectScenario,
  toAdjustments,
  whatIfBase,
} from './whatif'

const summary = (weekStart: string, savedCents: number, closed = true): WeekSummary => ({
  weekStart,
  closed,
  hasIncome: true,
  incomeCents: 200_000,
  spentCents: 200_000 - savedCents,
  fundedCents: 0,
  savedCents,
  savingsRate: savedCents / 200_000,
  totalLimitCents: 40_000,
  underBudget: true,
})

describe('projectScenario', () => {
  it('projects baseline and scenario week by week', () => {
    const scenario = projectScenario({
      startBalanceCents: 1_000_000,
      baselineWeeklySavingCents: 160_000,
      adjustments: [
        { categoryId: 'cat:eating-out', deltaCentsPerWeek: 5_000 },
        { categoryId: 'cat:fun', deltaCentsPerWeek: 2_000 },
      ],
      from: '2026-09-23',
      until: '2026-10-18',
    })
    expect(scenario.weeks).toBe(4)
    expect(scenario.extraPerWeekCents).toBe(7_000)
    expect(scenario.gainCents).toBe(28_000)
    expect(scenario.gainByCategory).toEqual({ 'cat:eating-out': 20_000, 'cat:fun': 8_000 })
    expect(scenario.points[0]).toEqual({
      weekStart: '2026-09-21',
      baselineCents: 1_160_000,
      scenarioCents: 1_167_000,
    })
    expect(scenario.points.at(-1)).toEqual({
      weekStart: '2026-10-12',
      baselineCents: 1_640_000,
      scenarioCents: 1_668_000,
    })
  })

  it('shows the cost of spending more and is empty for a past target date', () => {
    const base = { startBalanceCents: 0, baselineWeeklySavingCents: 100, from: '2026-09-23' }
    const more = projectScenario({
      ...base,
      adjustments: [{ categoryId: 'c', deltaCentsPerWeek: -50 }],
      until: '2026-09-30',
    })
    expect(more.gainCents).toBe(-100)
    const past = projectScenario({ ...base, adjustments: [], until: '2026-09-01' })
    expect(past).toEqual({
      points: [],
      weeks: 0,
      extraPerWeekCents: 0,
      gainCents: 0,
      gainByCategory: {},
    })
  })
})

describe('baselineWeeklySaving', () => {
  it('averages the latest closed weeks and falls back without history', () => {
    const summaries = [
      summary('2026-09-07', 150_000),
      summary('2026-09-14', 170_000),
      summary('2026-09-21', 10, false),
    ]
    expect(baselineWeeklySaving(summaries, 1)).toBe(160_000)
    expect(baselineWeeklySaving(summaries, 1, 1)).toBe(170_000)
    expect(baselineWeeklySaving([], 160_000)).toBe(160_000)
  })
})

describe('whatIfBase', () => {
  const today = '2026-09-23' // Wednesday, running week 2026-09-21
  const closed = (id: string, incomeCents = 200_000) => makeWeek(id, { incomeCents, closedAt: NOW })
  const base = (overrides: Partial<Parameters<typeof whatIfBase>[0]> = {}) =>
    whatIfBase({
      today,
      defaultWeeklyIncomeCents: 200_000,
      weeks: [],
      expenses: [],
      budgets: [makeBudget('2026-01-05', 40_000)],
      categories: [makeCategory('cat:eating-out'), makeCategory('cat:groceries')],
      pots: [],
      potTransactions: [],
      ...overrides,
    })

  it('starts from every pot together and falls back to income − budget without history', () => {
    const result = base({
      pots: [makePot(PRIMARY_POT_ID), makePot('pot:trip'), makePot('pot:gone', { deletedAt: NOW })],
      potTransactions: [
        makeTx(PRIMARY_POT_ID, 150_000, '2026-09-13'),
        makeTx('pot:trip', 30_000, '2026-09-14'),
        makeTx('pot:trip', -5_000, '2026-09-15'),
        makeTx('pot:gone', 99_000, '2026-09-15'),
        makeTx('pot:trip', 70_000, '2026-09-15', { deletedAt: NOW }),
      ],
    })
    expect(result.startBalanceCents).toBe(175_000)
    expect(result.baselineWeeklySavingCents).toBe(160_000)
    expect(result.basisWeeks).toBe(0)
    // no spending and no limits yet: nothing to cut
    expect(result.categories).toEqual([])
  })

  it('averages the latest closed weeks – tempo and category spend alike', () => {
    const weeks = [
      closed('2026-07-06'), // outside the window of eight
      ...['07-13', '07-20', '07-27', '08-03', '08-10', '08-17', '08-24'].map((d) =>
        closed(`2026-${d}`),
      ),
      closed('2026-08-31', 100_000),
      makeWeek('2026-09-07'), // open: not part of the basis
      makeWeek('2026-09-14', { closedAt: NOW, deletedAt: NOW }),
    ]
    const result = base({
      weeks,
      expenses: [
        makeExpense('2026-07-07', 80_000, { categoryId: 'cat:eating-out' }), // outside the window
        makeExpense('2026-08-12', 16_000, { categoryId: 'cat:eating-out' }),
        makeExpense('2026-09-01', 24_020, { categoryId: 'cat:eating-out' }),
        makeExpense('2026-09-01', 50_000, { categoryId: 'cat:eating-out', fundedByPotId: 'p' }),
        makeExpense('2026-09-08', 70_000, { categoryId: 'cat:eating-out' }), // open week
      ],
    })
    expect(result.basisWeeks).toBe(8)
    // 7 × 200 000 + 100 000 income, 40 020 spent → (1 500 000 − 40 020) / 8
    expect(result.baselineWeeklySavingCents).toBe(182_498)
    expect(result.categories).toEqual([
      { categoryId: 'cat:eating-out', averageCents: 5_003, limitCents: null, maxCents: 5_500 },
    ])
  })

  it('offers a category by its limit too, and takes the larger of limit and average', () => {
    const result = base({
      weeks: [closed('2026-09-14')],
      expenses: [makeExpense('2026-09-15', 12_300, { categoryId: 'cat:groceries' })],
      budgets: [
        makeBudget('2026-09-21', 40_000, {
          'cat:eating-out': 6_000,
          'cat:groceries': 10_000,
          'cat:old': 5_000,
        }),
      ],
    })
    expect(result.budget?.totalLimitCents).toBe(40_000)
    // an archived category's limit is not offered, but kept for "als Budget übernehmen"
    expect(result.budget?.categoryLimits['cat:old']).toBe(5_000)
    expect(result.categories).toEqual([
      { categoryId: 'cat:eating-out', averageCents: 0, limitCents: 6_000, maxCents: 6_000 },
      { categoryId: 'cat:groceries', averageCents: 12_300, limitCents: 10_000, maxCents: 12_500 },
    ])
  })
})

describe('toAdjustments', () => {
  const categories = [
    { categoryId: 'a', averageCents: 5_000, limitCents: null, maxCents: 5_000 },
    { categoryId: 'b', averageCents: 2_000, limitCents: null, maxCents: 2_000 },
    { categoryId: 'c', averageCents: 2_000, limitCents: null, maxCents: 2_000 },
  ]

  it('keeps cuts inside their range and drops untouched or unknown categories', () => {
    expect(toAdjustments(categories, { a: 1_500, b: 9_000, c: 0, gone: 500 })).toEqual([
      { categoryId: 'a', deltaCentsPerWeek: 1_500 },
      { categoryId: 'b', deltaCentsPerWeek: 2_000 },
    ])
    expect(toAdjustments(categories, { a: -500 })).toEqual([])
  })
})

describe('budgetFromScenario', () => {
  const budget = {
    effectiveFrom: '2026-09-21',
    totalLimitCents: 40_000,
    categoryLimits: { 'cat:groceries': 15_000, 'cat:fun': 3_000 },
  }
  const categories = [
    { categoryId: 'cat:eating-out', averageCents: 6_130, limitCents: null, maxCents: 6_500 },
    { categoryId: 'cat:groceries', averageCents: 14_000, limitCents: 15_000, maxCents: 15_000 },
    { categoryId: 'cat:fun', averageCents: 4_000, limitCents: 3_000, maxCents: 4_000 },
  ]

  it('lowers the total and each cut category, from its limit or its rounded average', () => {
    const result = budgetFromScenario(budget, categories, [
      { categoryId: 'cat:eating-out', deltaCentsPerWeek: 2_000 },
      { categoryId: 'cat:groceries', deltaCentsPerWeek: 1_500 },
      { categoryId: 'cat:fun', deltaCentsPerWeek: 4_000 },
    ])
    expect(result).toEqual({
      totalLimitCents: 32_500,
      categoryLimits: { 'cat:groceries': 13_500, 'cat:fun': 0, 'cat:eating-out': 4_000 },
      changes: [
        { categoryId: null, fromCents: 40_000, toCents: 32_500 },
        { categoryId: 'cat:eating-out', fromCents: null, toCents: 4_000 },
        { categoryId: 'cat:groceries', fromCents: 15_000, toCents: 13_500 },
        { categoryId: 'cat:fun', fromCents: 3_000, toCents: 0 },
      ],
    })
    // the source budget is left alone
    expect(budget.categoryLimits).toEqual({ 'cat:groceries': 15_000, 'cat:fun': 3_000 })
  })

  it('never goes below zero and is null without a budget or without a cut', () => {
    const small = { ...budget, totalLimitCents: 1_000 }
    expect(
      budgetFromScenario(small, categories, [
        { categoryId: 'cat:groceries', deltaCentsPerWeek: 5_000 },
      ])?.totalLimitCents,
    ).toBe(0)
    expect(
      budgetFromScenario(null, categories, [{ categoryId: 'cat:fun', deltaCentsPerWeek: 500 }]),
    ).toBeNull()
    expect(budgetFromScenario(budget, categories, [])).toBeNull()
  })
})

describe('horizonUntil', () => {
  it('counts months from today, clamps month ends and never goes back in time', () => {
    expect(horizonUntil('2026-09-23', 12)).toBe('2027-09-23')
    expect(horizonUntil('2026-08-31', 6)).toBe('2027-02-28')
    expect(horizonUntil('2026-09-23', '2026-12-24')).toBe('2026-12-24')
    expect(horizonUntil('2026-09-23', '2026-01-01')).toBe('2026-09-23')
  })
})
