import { describe, expect, it } from 'vitest'
import { makeRecurring } from '@/test/fixtures'
import { dueDates, nextDueDate, planMaterialization } from './recurrence'

describe('dueDates', () => {
  it('lists weekly occurrences from the anchor', () => {
    const rent = makeRecurring('2026-09-04')
    expect(dueDates(rent, null, '2026-09-25')).toEqual([
      '2026-09-04',
      '2026-09-11',
      '2026-09-18',
      '2026-09-25',
    ])
  })

  it('treats the lower bound as exclusive and the upper bound as inclusive', () => {
    const rent = makeRecurring('2026-09-04')
    expect(dueDates(rent, '2026-09-11', '2026-09-25')).toEqual(['2026-09-18', '2026-09-25'])
    expect(dueDates(rent, '2026-09-25', '2026-09-25')).toEqual([])
    expect(dueDates(rent, null, '2026-09-03')).toEqual([])
  })

  it('keeps the fortnightly rhythm of the anchor, whatever the watermark is', () => {
    const phone = makeRecurring('2026-09-04', { interval: 'fortnightly' })
    expect(dueDates(phone, '2026-09-10', '2026-10-05')).toEqual(['2026-09-18', '2026-10-02'])
    expect(dueDates(phone, '2026-09-17', '2026-10-05')).toEqual(['2026-09-18', '2026-10-02'])
  })

  it('clamps a monthly rule on the 31st without drifting to the 28th forever', () => {
    const insurance = makeRecurring('2026-01-31', { interval: 'monthly' })
    expect(dueDates(insurance, null, '2026-05-31')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ])
  })

  it('stays correct for old anchors (no iteration from the beginning of time)', () => {
    const weekly = makeRecurring('2020-01-03')
    expect(dueDates(weekly, '2026-09-01', '2026-09-30')).toEqual([
      '2026-09-04',
      '2026-09-11',
      '2026-09-18',
      '2026-09-25',
    ])
    const monthly = makeRecurring('2016-01-31', { interval: 'monthly' })
    expect(dueDates(monthly, '2026-08-31', '2026-10-31')).toEqual(['2026-09-30', '2026-10-31'])
  })

  it('stays weekly across the DST switches', () => {
    expect(dueDates(makeRecurring('2026-09-25'), null, '2026-10-16')).toEqual([
      '2026-09-25',
      '2026-10-02',
      '2026-10-09',
      '2026-10-16',
    ])
    expect(dueDates(makeRecurring('2026-03-20'), null, '2026-04-10')).toEqual([
      '2026-03-20',
      '2026-03-27',
      '2026-04-03',
      '2026-04-10',
    ])
  })

  it('respects the end date and the active flag', () => {
    expect(
      dueDates(makeRecurring('2026-09-04', { endDate: '2026-09-12' }), null, '2026-12-31'),
    ).toEqual(['2026-09-04', '2026-09-11'])
    expect(dueDates(makeRecurring('2026-09-04', { active: false }), null, '2026-12-31')).toEqual([])
  })
})

describe('nextDueDate', () => {
  it('returns the first occurrence on or after today', () => {
    const rent = makeRecurring('2026-09-04')
    expect(nextDueDate(rent, '2026-09-20')).toBe('2026-09-25')
    expect(nextDueDate(rent, '2026-09-25')).toBe('2026-09-25')
    expect(nextDueDate(rent, '2026-08-01')).toBe('2026-09-04')
    expect(nextDueDate(makeRecurring('2026-01-31', { interval: 'monthly' }), '2026-02-01')).toBe(
      '2026-02-28',
    )
  })

  it('is null for ended or paused rules', () => {
    expect(
      nextDueDate(makeRecurring('2026-09-04', { endDate: '2026-09-12' }), '2026-09-20'),
    ).toBeNull()
    expect(nextDueDate(makeRecurring('2026-09-04', { active: false }), '2026-09-20')).toBeNull()
  })
})

describe('planMaterialization', () => {
  it('back-fills a fresh template from its anchor and moves the watermark to today', () => {
    expect(planMaterialization(makeRecurring('2026-09-04'), '2026-09-20')).toEqual({
      dates: ['2026-09-04', '2026-09-11', '2026-09-18'],
      nextWatermark: '2026-09-20',
    })
  })

  it('only generates what lies after the watermark', () => {
    const rent = makeRecurring('2026-09-04', { lastGeneratedDate: '2026-09-18' })
    expect(planMaterialization(rent, '2026-09-26')).toEqual({
      dates: ['2026-09-25'],
      nextWatermark: '2026-09-26',
    })
  })

  it('does nothing when today is not past the watermark (clock or time-zone travel)', () => {
    const rent = makeRecurring('2026-09-04', { lastGeneratedDate: '2026-09-20' })
    expect(planMaterialization(rent, '2026-09-20')).toEqual({ dates: [], nextWatermark: null })
    expect(planMaterialization(rent, '2026-09-19')).toEqual({ dates: [], nextWatermark: null })
  })

  it('ignores paused and deleted templates', () => {
    expect(
      planMaterialization(makeRecurring('2026-09-04', { active: false }), '2026-09-20').dates,
    ).toEqual([])
    expect(
      planMaterialization(makeRecurring('2026-09-04', { deletedAt: 1 }), '2026-09-20').dates,
    ).toEqual([])
  })
})
