import { describe, expect, it } from 'vitest'
import {
  addDaysISO,
  addMonthsClamped,
  addWeeksISO,
  daysBetween,
  formatDayLabel,
  formatWeekRange,
  isISODate,
  isMonday,
  listWeeks,
  maxISO,
  minISO,
  monthOfWeek,
  parseISODate,
  toISODate,
  weekEndOf,
  weekRange,
  weekStartOf,
} from './dates'

describe('time zone harness', () => {
  it('really runs in the configured zone', () => {
    // App code has no Node typings on purpose; the test runner still provides `process`.
    const runner = globalThis as { process?: { env: Record<string, string | undefined> } }
    const zone = runner.process?.env.TZ
    expect(['Australia/Sydney', 'Europe/Berlin']).toContain(zone)
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(zone)
  })
})

describe('parseISODate / toISODate', () => {
  it('round-trips calendar days', () => {
    for (const iso of ['2026-01-01', '2026-09-21', '2028-02-29', '2026-12-31']) {
      expect(toISODate(parseISODate(iso))).toBe(iso)
    }
  })

  it('uses the LOCAL day – Monday 08:00 stays Monday (toISOString would say Sunday in Sydney)', () => {
    expect(toISODate(new Date(2026, 8, 21, 8, 0))).toBe('2026-09-21')
    expect(toISODate(new Date(2026, 8, 21, 0, 5))).toBe('2026-09-21')
    expect(toISODate(new Date(2026, 8, 21, 23, 55))).toBe('2026-09-21')
  })

  it('rejects anything that is not a real day', () => {
    for (const bad of ['2026-02-30', '2026-13-01', '2026-1-5', '2026-09-21T10:00:00Z', 'abc', '']) {
      expect(isISODate(bad)).toBe(false)
      expect(() => parseISODate(bad)).toThrow(RangeError)
    }
    expect(isISODate(20260921)).toBe(false)
    expect(isISODate('2026-09-21')).toBe(true)
  })
})

describe('weeks start on Monday', () => {
  it('maps every day of a week to its Monday', () => {
    const days = [
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
    ]
    for (const day of days) expect(weekStartOf(day)).toBe('2026-09-21')
    expect(weekStartOf('2026-09-27')).toBe('2026-09-21') // Sunday closes the week
    expect(weekStartOf('2026-09-28')).toBe('2026-09-28')
    expect(weekEndOf('2026-09-21')).toBe('2026-09-27')
    expect(weekRange('2026-09-21')).toEqual({ start: '2026-09-21', end: '2026-09-27' })
  })

  it('handles the turn of the year', () => {
    expect(weekStartOf('2027-01-01')).toBe('2026-12-28')
    expect(weekStartOf('2026-01-01')).toBe('2025-12-29')
    expect(addWeeksISO('2026-12-28', 1)).toBe('2027-01-04')
  })

  it('knows Mondays', () => {
    expect(isMonday('2026-09-21')).toBe(true)
    expect(isMonday('2026-09-22')).toBe(false)
    expect(isMonday('nope')).toBe(false)
  })
})

describe('DST safety (AU: 2026-04-05 / 2026-10-04, EU: 2026-03-29 / 2026-10-25)', () => {
  const switchDays = ['2026-03-29', '2026-04-05', '2026-10-04', '2026-10-25']

  it('adds whole calendar days across every switch', () => {
    for (const day of switchDays) {
      expect(addDaysISO(addDaysISO(day, -1), 1)).toBe(day)
      expect(addDaysISO(addDaysISO(day, 1), -1)).toBe(day)
      expect(daysBetween(addDaysISO(day, -1), addDaysISO(day, 1))).toBe(2)
    }
  })

  it('keeps weeks exactly 7 days apart for a whole year', () => {
    const weeks = listWeeks('2025-12-29', '2026-12-28')
    expect(weeks).toHaveLength(53)
    weeks.forEach((week, index) => {
      expect(isMonday(week)).toBe(true)
      if (index > 0) expect(daysBetween(weeks[index - 1]!, week)).toBe(7)
    })
  })

  it('assigns the switch days to the right week', () => {
    expect(weekStartOf('2026-10-04')).toBe('2026-09-28')
    expect(weekStartOf('2026-10-05')).toBe('2026-10-05')
    expect(weekStartOf('2026-03-29')).toBe('2026-03-23')
  })
})

describe('listWeeks', () => {
  it('is inclusive and empty when reversed', () => {
    expect(listWeeks('2026-09-07', '2026-09-21')).toEqual([
      '2026-09-07',
      '2026-09-14',
      '2026-09-21',
    ])
    expect(listWeeks('2026-09-21', '2026-09-21')).toEqual(['2026-09-21'])
    expect(listWeeks('2026-09-21', '2026-09-07')).toEqual([])
  })
})

describe('monthOfWeek (Thursday rule)', () => {
  it('assigns a week to the month of its Thursday', () => {
    expect(monthOfWeek('2026-09-21')).toBe('2026-09')
    expect(monthOfWeek('2026-06-29')).toBe('2026-07') // Thu = July 2nd
    expect(monthOfWeek('2026-12-28')).toBe('2026-12') // Thu = Dec 31st
    expect(monthOfWeek('2025-12-29')).toBe('2026-01') // Thu = Jan 1st
  })
})

describe('addMonthsClamped', () => {
  it('clamps to short months without drifting afterwards', () => {
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsClamped('2026-01-31', 2)).toBe('2026-03-31')
    expect(addMonthsClamped('2026-01-31', 3)).toBe('2026-04-30')
    expect(addMonthsClamped('2028-01-31', 1)).toBe('2028-02-29')
    expect(addMonthsClamped('2026-11-30', 3)).toBe('2027-02-28')
  })
})

describe('minISO / maxISO', () => {
  it('compares chronologically', () => {
    expect(minISO('2026-09-21', '2026-10-01')).toBe('2026-09-21')
    expect(maxISO('2026-09-21', '2026-10-01')).toBe('2026-10-01')
  })
})

describe('German labels', () => {
  it('labels days relative to today', () => {
    expect(formatDayLabel('2026-09-23', '2026-09-23')).toBe('Heute')
    expect(formatDayLabel('2026-09-22', '2026-09-23')).toBe('Gestern')
    expect(formatDayLabel('2026-09-21', '2026-09-23')).toBe('Mo., 21. Sep.')
    expect(formatDayLabel('2025-12-31', '2026-01-02')).toBe('Mi., 31. Dez. 2025')
    expect(formatDayLabel('2026-01-01', '2026-01-02')).toBe('Gestern')
  })

  it('formats week ranges within a month, across months and across years', () => {
    expect(formatWeekRange('2026-09-21')).toBe('21.–27. Sep. 2026')
    expect(formatWeekRange('2026-09-28')).toBe('28. Sep. – 4. Okt. 2026')
    expect(formatWeekRange('2026-12-28')).toBe('28. Dez. 2026 – 3. Jan. 2027')
  })
})
