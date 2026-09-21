import { describe, expect, it } from 'vitest'
import { cumulativeSavings, flowSeries, foldSlices } from '@/lib/analytics'
import { AUD_DISPLAY } from '@/lib/money'
import type { WeekSummary } from '@/lib/savings'
import { makeCategory } from '@/test/fixtures'
import { REST_SLICE_ID, toCumulativeRows, toDonutRows, toFlowRows, toTrendRows } from './chartData'

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

describe('toDonutRows', () => {
  const categories = [
    makeCategory('cat:rent', { name: 'Miete', icon: 'House', color: 'cat-1' }),
    makeCategory('cat:food', { name: 'Essen', icon: 'Utensils', color: 'cat-6' }),
  ]
  const slice = (categoryId: string, amountCents: number, share: number) => ({
    categoryId,
    amountCents,
    share,
  })

  it('gives every slice the name, icon and chart color of ITS category', () => {
    const rows = toDonutRows(
      foldSlices([slice('cat:rent', 60_000, 0.6), slice('cat:food', 40_000, 0.4)]),
      categories,
    )
    expect(rows).toEqual([
      expect.objectContaining({
        id: 'cat:rent',
        name: 'Miete',
        icon: 'House',
        color: 'cat-1',
        fill: 'var(--chart-cat-1)',
        swatch: 'bg-chart-cat-1',
        amountCents: 60_000,
        share: 0.6,
        value: 60_000,
      }),
      expect.objectContaining({ id: 'cat:food', fill: 'var(--chart-cat-6)', value: 40_000 }),
    ])
  })

  it('folds the tail into a neutral slice and keeps a deleted category visible', () => {
    const slices = [50, 20, 10, 8, 6, 4, 2].map((amount, index) =>
      slice(index === 0 ? 'cat:rent' : `cat:gone-${index}`, amount * 100, amount / 100),
    )
    const rows = toDonutRows(foldSlices(slices), categories)
    expect(rows).toHaveLength(6)
    expect(rows[1]).toMatchObject({ name: 'Gelöschte Kategorie', fill: 'var(--chart-cat-10)' })
    expect(rows.at(-1)).toMatchObject({
      id: REST_SLICE_ID,
      name: 'Übrige (2)',
      fill: 'var(--chart-other)',
      amountCents: 600,
    })
  })
})

describe('toTrendRows', () => {
  it('labels each period and converts to axis units', () => {
    expect(
      toTrendRows(
        [
          { key: '2026-09-07', amountCents: 11_000 },
          { key: '2026-09-14', amountCents: 0 },
        ],
        'week',
        { currency: 'EUR', rate: 0.5 },
      ),
    ).toEqual([
      {
        key: '2026-09-07',
        tick: '7.9.',
        title: '7.–13. Sep. 2026',
        amount: 55,
        amountCents: 11_000,
      },
      { key: '2026-09-14', tick: '14.9.', title: '14.–20. Sep. 2026', amount: 0, amountCents: 0 },
    ])
  })
})

describe('toCumulativeRows', () => {
  it('draws the running total of the closed weeks, week by week', () => {
    const rows = toCumulativeRows(cumulativeSavings(summaries), AUD_DISPLAY)
    // 07.09.: +1.500 · 14.09.: minus week −300 · the open week is not part of it.
    expect(rows.map(({ key, tick, total }) => ({ key, tick, total }))).toEqual([
      { key: '2026-09-07', tick: '7.9.', total: 1500 },
      { key: '2026-09-14', tick: '14.9.', total: 1200 },
    ])
    expect(rows[1]).toMatchObject({ title: '14.–20. Sep. 2026', totalCents: 120_000 })
  })
})
