import { describe, expect, it } from 'vitest'
import { makeBudget, makeExpense, makeRecurring } from '@/test/fixtures'
import {
  budgetUsage,
  levelFor,
  reservedThisWeek,
  resolveBudget,
  thresholdCrossed,
  unallocatedCents,
} from './budget'

describe('resolveBudget (effective-dated)', () => {
  const budgets = [
    makeBudget('2026-08-31', 45_000, { 'cat:groceries': 15_000 }),
    makeBudget('2026-08-03', 40_000, { 'cat:groceries': 12_000, 'cat:old': 5_000 }),
  ]

  it('uses the latest row at or before the week', () => {
    expect(resolveBudget(budgets, '2026-08-17')?.totalLimitCents).toBe(40_000)
    expect(resolveBudget(budgets, '2026-08-31')?.totalLimitCents).toBe(45_000)
    expect(resolveBudget(budgets, '2026-09-21')).toMatchObject({
      effectiveFrom: '2026-08-31',
      totalLimitCents: 45_000,
    })
  })

  it('falls back to the first row for weeks before it, and to null without rows', () => {
    expect(resolveBudget(budgets, '2026-07-06')?.effectiveFrom).toBe('2026-08-03')
    expect(resolveBudget([], '2026-09-21')).toBeNull()
  })

  it('does not change past weeks when a new budget is written today', () => {
    const before = resolveBudget(budgets, '2026-08-17')
    const after = resolveBudget([...budgets, makeBudget('2026-09-21', 99_000)], '2026-08-17')
    expect(after).toEqual(before)
  })

  it('ignores deleted rows and limits of archived categories', () => {
    const withDeleted = [...budgets, makeBudget('2026-09-14', 1, {}, { deletedAt: 5 })]
    expect(resolveBudget(withDeleted, '2026-09-21')?.totalLimitCents).toBe(45_000)
    const active = new Set(['cat:groceries'])
    expect(resolveBudget(budgets, '2026-08-17', active)?.categoryLimits).toEqual({
      'cat:groceries': 12_000,
    })
  })
})

describe('budgetUsage', () => {
  const budget = {
    effectiveFrom: '2026-08-03',
    totalLimitCents: 40_000,
    categoryLimits: { 'cat:groceries': 10_000, 'cat:fun': 5_000, 'cat:zero': 0 },
  }

  it('counts only active, non-funded expenses', () => {
    const usage = budgetUsage(
      [
        makeExpense('2026-09-21', 8_000),
        makeExpense('2026-09-22', 24_000, { categoryId: 'cat:rent' }),
        makeExpense('2026-09-22', 80_000, { categoryId: 'cat:travel', fundedByPotId: 'pot:trip' }),
        makeExpense('2026-09-23', 9_999, { deletedAt: 7 }),
      ],
      budget,
    )
    expect(usage.total).toMatchObject({ spentCents: 32_000, remainingCents: 8_000, level: 'warn' })
    expect(usage.total.ratio).toBeCloseTo(0.8)
    expect(usage.byCategory['cat:groceries']).toMatchObject({ spentCents: 8_000, level: 'warn' })
    expect(usage.byCategory['cat:rent']).toMatchObject({
      limitCents: null,
      remainingCents: null,
      level: 'ok',
    })
    expect(usage.byCategory['cat:fun']).toMatchObject({ spentCents: 0, level: 'ok' })
    expect(usage.byCategory['cat:travel']).toBeUndefined()
  })

  it('flags over-limit and zero limits', () => {
    const usage = budgetUsage(
      [makeExpense('2026-09-21', 10_000), makeExpense('2026-09-21', 1, { categoryId: 'cat:zero' })],
      budget,
    )
    expect(usage.byCategory['cat:groceries']).toMatchObject({ level: 'over', remainingCents: 0 })
    expect(usage.byCategory['cat:zero']?.level).toBe('over')
  })

  it('maps ratios to levels at exactly 80 % and 100 %', () => {
    expect([0, 0.7999, 0.8, 0.9999, 1, 3].map(levelFor)).toEqual([
      'ok',
      'ok',
      'warn',
      'warn',
      'over',
      'over',
    ])
  })
})

describe('thresholdCrossed', () => {
  it('fires once per crossing and reports the highest threshold', () => {
    expect(thresholdCrossed(0.5, 0.85)).toBe('warn')
    expect(thresholdCrossed(0.85, 0.9)).toBeNull()
    expect(thresholdCrossed(0.79, 1.2)).toBe('over')
    expect(thresholdCrossed(0.95, 1)).toBe('over')
    expect(thresholdCrossed(1, 1.4)).toBeNull()
    expect(thresholdCrossed(1.1, 0.5)).toBeNull()
  })
})

describe('unallocatedCents', () => {
  it('is positive when unallocated and negative when overbooked', () => {
    expect(
      unallocatedCents({ totalLimitCents: 40_000, categoryLimits: { a: 10_000, b: 5_000 } }),
    ).toBe(25_000)
    expect(
      unallocatedCents({ totalLimitCents: 10_000, categoryLimits: { a: 8_000, b: 5_000 } }),
    ).toBe(-3_000)
  })
})

describe('reservedThisWeek', () => {
  const week = '2026-09-21'

  it('reserves instances that are due this week but not generated yet', () => {
    const rent = makeRecurring('2026-09-04', { id: 'rent', lastGeneratedDate: '2026-09-21' })
    expect(reservedThisWeek([rent], week, '2026-09-21')).toEqual({
      totalCents: 25_000,
      items: [
        {
          recurringId: 'rent',
          title: 'Miete',
          categoryId: 'cat:rent',
          date: '2026-09-25',
          amountCents: 25_000,
        },
      ],
    })
  })

  it('still reserves an instance due today when the materialiser has not run yet', () => {
    const rent = makeRecurring('2026-09-04', { lastGeneratedDate: '2026-09-24' })
    expect(reservedThisWeek([rent], week, '2026-09-25').totalCents).toBe(25_000)
  })

  it('reserves nothing once generated, for past weeks, or for paused/deleted templates', () => {
    expect(
      reservedThisWeek(
        [makeRecurring('2026-09-04', { lastGeneratedDate: '2026-09-25' })],
        week,
        '2026-09-26',
      ).items,
    ).toEqual([])
    expect(reservedThisWeek([makeRecurring('2026-09-04')], week, '2026-09-28').items).toEqual([])
    expect(
      reservedThisWeek([makeRecurring('2026-09-04', { active: false })], week, '2026-09-21').items,
    ).toEqual([])
    expect(
      reservedThisWeek([makeRecurring('2026-09-04', { deletedAt: 3 })], week, '2026-09-21').items,
    ).toEqual([])
  })

  it('covers a future week from Monday on and sorts by date', () => {
    const rent = makeRecurring('2026-09-04', { id: 'rent', lastGeneratedDate: '2026-09-20' })
    const gym = makeRecurring('2026-09-01', {
      id: 'gym',
      title: 'Gym',
      amountCents: 2_000,
      lastGeneratedDate: '2026-09-20',
    })
    const result = reservedThisWeek([rent, gym], '2026-09-28', '2026-09-21')
    expect(result.items.map((item) => [item.recurringId, item.date])).toEqual([
      ['gym', '2026-09-29'],
      ['rent', '2026-10-02'],
    ])
    expect(result.totalCents).toBe(27_000)
  })
})
