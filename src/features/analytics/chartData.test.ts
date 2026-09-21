import { describe, expect, it } from 'vitest'
import { flowSeries } from '@/lib/analytics'
import { AUD_DISPLAY } from '@/lib/money'
import type { WeekSummary } from '@/lib/savings'
import { toFlowRows } from './chartData'

const summary = (
  weekStart: string,
  spentCents: number,
  incomeCents: number | null,
): WeekSummary => ({
  weekStart,
  closed: incomeCents !== null,
  hasIncome: incomeCents !== null,
  incomeCents: incomeCents ?? 0,
  spentCents,
  fundedCents: 0,
  savedCents: (incomeCents ?? 0) - spentCents,
  savingsRate: 0,
  totalLimitCents: 40_000,
  underBudget: true,
})

const summaries = [
  summary('2026-09-07', 50_000, 200_000),
  summary('2026-09-14', 30_000, 0), // minus week
  summary('2026-09-21', 12_000, null), // still open
]

describe('toFlowRows', () => {
  it('draws exactly what lib computed, in axis units', () => {
    const rows = toFlowRows(flowSeries(summaries, 'week'), 'week', AUD_DISPLAY)
    expect(
      rows.map(({ key, tick, spent, saved, open, income }) => ({
        key,
        tick,
        spent,
        saved,
        open,
        income,
      })),
    ).toEqual([
      { key: '2026-09-07', tick: '7.9.', spent: 500, saved: 1500, open: 0, income: 2000 },
      { key: '2026-09-14', tick: '14.9.', spent: 300, saved: -300, open: 0, income: 0 },
      // An open week has no income marker and only its pale bar.
      { key: '2026-09-21', tick: '21.9.', spent: 0, saved: 0, open: 120, income: null },
    ])
    expect(rows[0]?.title).toBe('7.–13. Sep. 2026')
  })

  it('counts in EUR when EUR is shown and labels months', () => {
    const [row] = toFlowRows(flowSeries(summaries, 'month'), 'month', {
      currency: 'EUR',
      rate: 0.5,
    })
    // September: two closed weeks → per-week averages, converted at 0.5.
    expect(row).toMatchObject({
      key: '2026-09',
      tick: 'Sep 26',
      title: 'September 2026',
      income: 500,
      spent: 200,
      saved: 300,
      open: 0,
    })
  })
})
