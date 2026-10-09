import { describe, expect, it } from 'vitest'
import { trendGeometry } from './trendGeometry'

const point = (weekStart: string, totalCents: number) => ({ weekStart, totalCents })

describe('trendGeometry', () => {
  it('has nothing to draw with fewer than two points', () => {
    expect(trendGeometry([])).toBeNull()
    expect(trendGeometry([point('2026-09-14', 100)])).toBeNull()
  })

  it('spreads the points over the width and scales between lowest and highest', () => {
    const geometry = trendGeometry([
      point('2026-09-07', 100_000),
      point('2026-09-14', 200_000),
      point('2026-09-21', 150_000),
    ])
    expect(geometry?.line).toBe('M0,90 L50,10 L100,50')
    expect(geometry?.area).toBe('M0,90 L50,10 L100,50 L100,100 L0,100 Z')
    expect(geometry?.end).toEqual({ x: 100, y: 50 })
  })

  it('draws a flat line through the middle when nothing changed', () => {
    expect(trendGeometry([point('2026-09-07', 5), point('2026-09-14', 5)])?.line).toBe(
      'M0,50 L100,50',
    )
  })

  it('names each month where it begins (Thursday rule) and aligns the outer labels inwards', () => {
    const mondays = [
      '2026-08-17',
      '2026-08-24',
      '2026-08-31',
      '2026-09-07',
      '2026-09-14',
      '2026-09-21',
      '2026-09-28',
    ]
    const geometry = trendGeometry(mondays.map((monday, index) => point(monday, index)))
    // 31 Aug – 6 Sep belongs to September, 28 Sep – 4 Oct to October
    expect(geometry?.months).toEqual([
      { label: 'Aug', x: 0, align: 'start' },
      { label: 'Sep', x: 33.33, align: 'center' },
      { label: 'Okt', x: 100, align: 'end' },
    ])
  })

  it('drops a month label that would run into the next one', () => {
    const geometry = trendGeometry(
      [
        '2026-08-24',
        '2026-08-31',
        '2026-09-07',
        '2026-09-14',
        '2026-09-21',
        '2026-09-28',
        '2026-10-05',
        '2026-10-12',
        '2026-10-19',
      ].map((monday, index) => point(monday, index)),
    )
    // "Aug" at 0 and "Sep" at 12.5 collide → the later one stays
    expect(geometry?.months.map((month) => month.label)).toEqual(['Sep', 'Okt'])
  })
})
