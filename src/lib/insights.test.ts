import { describe, expect, it } from 'vitest'
import { makeExpense, makePot, makeSettings, makeTx, NOW } from '@/test/fixtures'
import { budgetUsage } from './budget'
import { addWeeksISO } from './dates'
import {
  backupStaleRule,
  budgetRule,
  categoryOverAverageRule,
  eurRateStaleRule,
  pendingWeeksRule,
  potDeadlineRule,
  runInsights,
  dashboardRules,
  defaultRules,
  savingsRateRule,
  streakMilestoneRule,
  type InsightContext,
} from './insights'
import type { WeekSummary } from './savings'

const WEEK = '2026-09-21'
const TODAY = '2026-09-23'
const DAY = 86_400_000
const budget = { effectiveFrom: '2026-06-29', totalLimitCents: 40_000, categoryLimits: {} }

const summary = (weekStart: string, overrides: Partial<WeekSummary> = {}): WeekSummary => ({
  weekStart,
  closed: true,
  hasIncome: true,
  incomeCents: 200_000,
  spentCents: 40_000,
  fundedCents: 0,
  savedCents: 160_000,
  savingsRate: 0.8,
  totalLimitCents: 40_000,
  underBudget: true,
  ...overrides,
})

const context = (overrides: Partial<InsightContext> = {}): InsightContext => ({
  today: TODAY,
  now: NOW,
  currentWeek: summary(WEEK, { closed: false }),
  history: [],
  currentUsage: null,
  expenses: [],
  pots: [],
  potTransactions: [],
  streak: { current: 0, best: 0, stale: false },
  pendingWeeks: [],
  settings: makeSettings({ lastBackupAt: NOW }),
  ...overrides,
})

describe('budgetRule', () => {
  const usageFor = (cents: number) => budgetUsage([makeExpense(WEEK, cents)], budget)

  it('stays quiet below 80 %', () => {
    expect(budgetRule(context({ currentUsage: usageFor(31_999) }))).toEqual([])
    expect(budgetRule(context())).toEqual([])
  })

  it('warns from 80 % and escalates from 100 %', () => {
    expect(budgetRule(context({ currentUsage: usageFor(32_000) }))).toEqual([
      expect.objectContaining({
        kind: 'budget-warn',
        remainingCents: 8_000,
        severity: 'warning',
        id: `budget-warn:${WEEK}`,
      }),
    ])
    expect(budgetRule(context({ currentUsage: usageFor(45_500) }))).toEqual([
      expect.objectContaining({ kind: 'budget-over', overCents: 5_500, priority: 100 }),
    ])
  })
})

describe('pendingWeeksRule', () => {
  it('fires only when weeks are waiting to be closed', () => {
    expect(pendingWeeksRule(context())).toEqual([])
    expect(pendingWeeksRule(context({ pendingWeeks: ['2026-09-07', '2026-09-14'] }))).toEqual([
      expect.objectContaining({ kind: 'pending-weeks', count: 2, oldest: '2026-09-07' }),
    ])
  })
})

describe('categoryOverAverageRule', () => {
  /** A$60 of groceries in each of the 8 weeks before the current one. */
  const history = Array.from({ length: 8 }, (_, index) =>
    makeExpense(addWeeksISO('2026-07-27', index), 6_000),
  )

  it('fires when a category is at least 20 % over its 8-week average', () => {
    const expenses = [...history, makeExpense(WEEK, 7_800)]
    expect(categoryOverAverageRule(context({ expenses }))).toEqual([
      expect.objectContaining({
        kind: 'category-over-average',
        categoryId: 'cat:groceries',
        currentCents: 7_800,
        averageCents: 6_000,
      }),
    ])
    expect(categoryOverAverageRule(context({ expenses }))[0]).toHaveProperty(
      'overRatio',
      expect.closeTo(0.3),
    )
  })

  it('stays quiet under 20 %, for tiny averages and without enough history', () => {
    expect(
      categoryOverAverageRule(context({ expenses: [...history, makeExpense(WEEK, 7_100)] })),
    ).toEqual([])

    const tiny = history.map((expense) => ({ ...expense, amountCents: 500 }))
    expect(
      categoryOverAverageRule(context({ expenses: [...tiny, makeExpense(WEEK, 5_000)] })),
    ).toEqual([])

    const newUser = [makeExpense('2026-09-16', 1_000), makeExpense(WEEK, 9_000)]
    expect(categoryOverAverageRule(context({ expenses: newUser }))).toEqual([])
  })

  it('averages a newer user over the weeks on record only', () => {
    // Three recorded weeks at A$60: average 60, not 60 × 3 / 8.
    const expenses = [...history.slice(5), makeExpense(WEEK, 9_000)]
    expect(categoryOverAverageRule(context({ expenses }))[0]).toMatchObject({ averageCents: 6_000 })
  })

  it('reports the category with the largest excess and ignores pot-funded spending', () => {
    const fun = history.map((expense) => ({
      ...expense,
      id: `${expense.id}-fun`,
      categoryId: 'cat:fun',
      amountCents: 2_000,
    }))
    const expenses = [
      ...history,
      ...fun,
      makeExpense(WEEK, 7_800), // +18
      makeExpense(WEEK, 5_000, { categoryId: 'cat:fun' }), // +30
      makeExpense(WEEK, 90_000, { fundedByPotId: 'pot:trip' }),
    ]
    expect(categoryOverAverageRule(context({ expenses }))).toEqual([
      expect.objectContaining({ categoryId: 'cat:fun' }),
    ])
  })
})

describe('potDeadlineRule', () => {
  const trip = makePot('pot:trip', { targetCents: 300_000, deadline: '2026-12-20' })
  const deposits = (cents: number) =>
    Array.from({ length: 8 }, (_, index) =>
      makeTx('pot:trip', cents, addWeeksISO('2026-08-02', index)),
    )

  it('celebrates being ahead of the deadline', () => {
    // 8 × 250 = 2.000 saved, 1.000 to go at 250/week → 4 weeks → ETA 2026-10-18, deadline 9 weeks later.
    expect(potDeadlineRule(context({ pots: [trip], potTransactions: deposits(25_000) }))).toEqual([
      expect.objectContaining({
        kind: 'pot-ahead',
        potId: 'pot:trip',
        weeks: 9,
        severity: 'positive',
      }),
    ])
  })

  it('warns when behind and says what is needed per week', () => {
    // 8 × 50 = 400 saved, 2.600 to go at 50/week → far beyond the deadline.
    const [insight] = potDeadlineRule(context({ pots: [trip], potTransactions: deposits(5_000) }))
    expect(insight).toMatchObject({
      kind: 'pot-behind',
      potId: 'pot:trip',
      requiredWeeklyCents: 20_000,
    })
    expect(insight && 'weeks' in insight && insight.weeks).toBeGreaterThan(30)
  })

  it('warns without an ETA when nothing is being saved', () => {
    expect(potDeadlineRule(context({ pots: [trip] }))).toEqual([
      expect.objectContaining({ kind: 'pot-behind', weeks: null }),
    ])
  })

  it('ignores reached, archived, deleted and open-ended pots', () => {
    const pots = [
      makePot('pot:a', { targetCents: 100, deadline: '2026-12-20', archived: true }),
      makePot('pot:b', { targetCents: 100, deadline: '2026-12-20', deletedAt: NOW }),
      makePot('pot:c', { targetCents: 100, deadline: null }),
      makePot('pot:d', { targetCents: null, deadline: '2026-12-20' }),
      makePot('pot:e', { targetCents: 100, deadline: '2026-12-20' }),
    ]
    const potTransactions = [makeTx('pot:e', 100, '2026-09-01')]
    expect(potDeadlineRule(context({ pots, potTransactions }))).toEqual([])
  })
})

describe('streakMilestoneRule', () => {
  it('fires on milestones only and never for a stale streak', () => {
    expect(streakMilestoneRule(context({ streak: { current: 5, best: 5, stale: false } }))).toEqual(
      [expect.objectContaining({ kind: 'streak-milestone', weeks: 5, id: 'streak:5' })],
    )
    expect(streakMilestoneRule(context({ streak: { current: 4, best: 5, stale: false } }))).toEqual(
      [],
    )
    expect(streakMilestoneRule(context({ streak: { current: 0, best: 5, stale: true } }))).toEqual(
      [],
    )
  })
})

describe('savingsRateRule', () => {
  const baseline = ['2026-08-24', '2026-08-31', '2026-09-07'].map((week) =>
    summary(week, { savingsRate: 0.7 }),
  )

  it('compares the latest closed week with the weeks before it', () => {
    const up = savingsRateRule(
      context({ history: [...baseline, summary('2026-09-14', { savingsRate: 0.85 })] }),
    )
    expect(up).toEqual([
      expect.objectContaining({ kind: 'savings-rate', direction: 'up', severity: 'positive' }),
    ])

    const down = savingsRateRule(
      context({ history: [...baseline, summary('2026-09-14', { savingsRate: 0.5 })] }),
    )
    expect(down).toEqual([
      expect.objectContaining({
        direction: 'down',
        severity: 'warning',
        id: 'savings-rate:2026-09-14',
      }),
    ])
  })

  it('needs a real change and at least three weeks of baseline', () => {
    expect(
      savingsRateRule(
        context({ history: [...baseline, summary('2026-09-14', { savingsRate: 0.75 })] }),
      ),
    ).toEqual([])
    expect(
      savingsRateRule(
        context({ history: [...baseline.slice(1), summary('2026-09-14', { savingsRate: 0.2 })] }),
      ),
    ).toEqual([])
  })

  it('skips open weeks and weeks without income', () => {
    const history = [...baseline, summary('2026-09-14', { savingsRate: 0, incomeCents: 0 })]
    expect(savingsRateRule(context({ history }))).toEqual([])
  })
})

describe('backupStaleRule', () => {
  const expenses = [makeExpense(WEEK, 1_000, { createdAt: NOW - 30 * DAY })]

  it('nags when the last backup is two weeks old', () => {
    const settings = makeSettings({ lastBackupAt: NOW - 15 * DAY })
    expect(backupStaleRule(context({ expenses, settings }))).toEqual([
      expect.objectContaining({ kind: 'backup-stale', days: 15, id: `backup:${WEEK}` }),
    ])
  })

  it('counts from the first entry when there never was a backup', () => {
    const never = makeSettings({ lastBackupAt: null })
    expect(backupStaleRule(context({ expenses, settings: never }))).toEqual([
      expect.objectContaining({ kind: 'backup-stale', days: null }),
    ])
    const fresh = [makeExpense(WEEK, 1_000, { createdAt: NOW - 3 * DAY })]
    expect(backupStaleRule(context({ expenses: fresh, settings: never }))).toEqual([])
  })

  it('stays quiet with a recent backup or without data', () => {
    expect(
      backupStaleRule(
        context({ expenses, settings: makeSettings({ lastBackupAt: NOW - 13 * DAY }) }),
      ),
    ).toEqual([])
    expect(backupStaleRule(context({ settings: makeSettings({ lastBackupAt: null }) }))).toEqual([])
  })
})

describe('eurRateStaleRule', () => {
  it('fires only when EUR is shown and the rate is a month old', () => {
    const stale = makeSettings({ showEur: true, eurRate: 0.6, eurRateUpdatedAt: NOW - 31 * DAY })
    expect(eurRateStaleRule(context({ settings: stale }))).toEqual([
      expect.objectContaining({ kind: 'eur-rate-stale', days: 31, id: 'eur-rate:2026-09' }),
    ])
    expect(eurRateStaleRule(context({ settings: { ...stale, showEur: false } }))).toEqual([])
    expect(
      eurRateStaleRule(context({ settings: { ...stale, eurRateUpdatedAt: NOW - 5 * DAY } })),
    ).toEqual([])
    expect(eurRateStaleRule(context())).toEqual([])
  })
})

describe('runInsights', () => {
  const busy = context({
    currentUsage: budgetUsage([makeExpense(WEEK, 45_000)], budget),
    pendingWeeks: ['2026-09-14'],
    streak: { current: 3, best: 3, stale: false },
    expenses: [makeExpense(WEEK, 45_000, { createdAt: NOW - 40 * DAY })],
    settings: makeSettings({ lastBackupAt: null }),
  })

  it('returns the three most important insights, highest priority first', () => {
    expect(runInsights(busy).map((insight) => insight.kind)).toEqual([
      'budget-over',
      'pending-weeks',
      'backup-stale',
    ])
  })

  it('honours dismissals, a custom limit and custom rules', () => {
    const dismissed = new Set([`budget-over:${WEEK}`])
    expect(runInsights(busy, { dismissed, max: 2 }).map((insight) => insight.kind)).toEqual([
      'pending-weeks',
      'backup-stale',
    ])
    expect(
      runInsights(busy, { rules: [streakMilestoneRule] }).map((insight) => insight.kind),
    ).toEqual(['streak-milestone'])
    expect(runInsights(context())).toEqual([])
  })

  it('leaves pending weeks and the backup reminder out of the home-screen cards', () => {
    expect(runInsights(busy, { rules: dashboardRules }).map((insight) => insight.kind)).toEqual([
      'budget-over',
      'streak-milestone',
    ])
    expect(dashboardRules).toHaveLength(defaultRules.length - 2)
  })
})
