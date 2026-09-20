import { describe, expect, it } from 'vitest'
import type { WeekSummary } from './savings'
import { baselineWeeklySaving, projectScenario } from './whatif'

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
    expect(past).toEqual({ points: [], weeks: 0, extraPerWeekCents: 0, gainCents: 0 })
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
