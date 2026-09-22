import { describe, expect, it } from 'vitest'
import type { InsightData } from '@/lib/insights'
import { makeCategory, makePot } from '@/test/fixtures'
import { describeInsight } from './insightCopy'

const refs = {
  categories: [makeCategory('cat:food', { name: 'Essen gehen', icon: 'Utensils', color: 'cat-3' })],
  pots: [makePot('pot:bali', { name: 'Bali', icon: 'Plane', color: 'cat-5' })],
  today: '2026-09-23',
}
const base = { id: 'x', severity: 'info', priority: 1 } as const
// Intl puts a no-break space before "%" – never as a literal in source (see CLAUDE.md).
const pct = (digits: string) => `${digits}${String.fromCharCode(0xa0)}%`

const describe_ = (data: InsightData) => describeInsight({ ...base, ...data }, refs)

describe('describeInsight', () => {
  it('turns budget insights into copy that leads to the budget screen', () => {
    const over = describe_({ kind: 'budget-over', overCents: 5_000 })
    expect(over.title).toBe('A$50,00 über dem Budget')
    expect(over.action).toEqual({ label: 'Budget', to: '/budget' })

    const warn = describe_({ kind: 'budget-warn', remainingCents: 6_000, ratio: 0.85 })
    expect(warn.title).toBe(`Budget zu ${pct('85')} verbraucht`)
    expect(warn.text).toBe('Noch A$60,00 bis zum Wochenlimit.')
  })

  it('names the category with its own tile and falls back without one', () => {
    const copy = describe_({
      kind: 'category-over-average',
      categoryId: 'cat:food',
      currentCents: 13_000,
      averageCents: 10_000,
      overRatio: 0.3,
    })
    expect(copy.title).toBe('Essen gehen über deinem Schnitt')
    expect(copy.text).toBe(`A$130 diese Woche statt sonst Ø A$100 – +${pct('30')} mehr als üblich.`)
    expect(copy.chip).toEqual({ icon: 'Utensils', color: 'cat-3' })
    expect(copy.action).toEqual({ label: 'Analyse', to: '/analytics' })

    const unknown = describeInsight(
      {
        ...base,
        kind: 'category-over-average',
        categoryId: 'cat:gone',
        currentCents: 1,
        averageCents: 1,
        overRatio: 1,
      },
      refs,
    )
    expect(unknown.title).toBe('Eine Kategorie über deinem Schnitt')
    expect(unknown.chip).toBeUndefined()
  })

  it('speaks about pots by name and links to them', () => {
    const ahead = describe_({ kind: 'pot-ahead', potId: 'pot:bali', weeks: 2 })
    expect(ahead.title).toBe('„Bali" liegt 2 Wochen vor dem Plan')
    expect(ahead.chip).toEqual({ icon: 'Plane', color: 'cat-5' })
    expect(ahead.action).toEqual({ label: 'Zum Topf', to: '/pots/pot%3Abali' })

    const behind = describe_({
      kind: 'pot-behind',
      potId: 'pot:bali',
      weeks: 1,
      requiredWeeklyCents: 23_100,
    })
    expect(behind.title).toBe('„Bali" hinkt 1 Woche hinterher')
    expect(behind.text).toBe('Bis zur Deadline bräuchtest du A$231 pro Woche.')

    const hopeless = describe_({
      kind: 'pot-behind',
      potId: 'pot:bali',
      weeks: null,
      requiredWeeklyCents: null,
    })
    expect(hopeless.title).toBe('„Bali" kommt so nicht ans Ziel')
    expect(hopeless.text).toBe('Bei deinem Tempo reicht es nicht bis zur Deadline.')
  })

  it('covers the remaining kinds', () => {
    const streak = describe_({ kind: 'streak-milestone', weeks: 5 })
    expect(streak.title).toBe('5 Wochen im Budget – stark!')
    expect(streak.action).toBeUndefined()
    expect(
      describe_({ kind: 'savings-rate', direction: 'down', rate: 0.6, averageRate: 0.75 }),
    ).toMatchObject({
      title: `Sparquote gesunken: ${pct('60')}`,
      text: `Letzte Woche ${pct('60')} statt sonst Ø ${pct('75')}.`,
    })
    expect(
      describe_({ kind: 'savings-rate', direction: 'up', rate: 0.9, averageRate: 0.75 }).title,
    ).toBe(`Sparquote gestiegen: ${pct('90')}`)
    expect(describe_({ kind: 'eur-rate-stale', days: 45 })).toMatchObject({
      title: 'EUR-Kurs ist 45 Tage alt',
      action: { label: 'Kurs prüfen', run: 'eur-rate' },
    })
    expect(describe_({ kind: 'backup-stale', days: null }).title).toBe('Noch kein Backup')
    expect(describe_({ kind: 'backup-stale', days: 21 }).title).toBe('Letztes Backup vor 21 Tagen')
    expect(describe_({ kind: 'pending-weeks', count: 2, oldest: '2026-09-07' })).toMatchObject({
      title: '2 Wochen warten auf ihren Abschluss',
      text: 'Die älteste beginnt am Mo., 7. Sep.',
    })
  })
})
