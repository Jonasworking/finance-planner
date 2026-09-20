import { describe, expect, it } from 'vitest'
import { nextStep, projectWeek, weekProgress } from './dashboard'

describe('weekProgress', () => {
  it('counts days within the Monday–Sunday week', () => {
    expect(weekProgress('2026-09-21')).toEqual({ dayIndex: 0, daysLeft: 6 })
    expect(weekProgress('2026-09-24')).toEqual({ dayIndex: 3, daysLeft: 3 })
    expect(weekProgress('2026-09-27')).toEqual({ dayIndex: 6, daysLeft: 0 })
  })
})

describe('nextStep', () => {
  const base = {
    today: '2026-09-23', // Wednesday
    pendingWeeks: [] as string[],
    hasAnyExpense: true,
    hasRecurring: true,
    currentWeekClosed: false,
    closedWeeks: 5,
  }

  it('asks to catch up on finished weeks first', () => {
    const step = nextStep({
      ...base,
      hasAnyExpense: false,
      pendingWeeks: ['2026-09-07', '2026-09-14'],
    })
    expect(step).toEqual({ kind: 'close-pending', count: 2, oldest: '2026-09-07' })
  })

  it('starts a brand-new user with the first expense', () => {
    expect(
      nextStep({ ...base, hasAnyExpense: false, hasRecurring: false, closedWeeks: 0 }),
    ).toEqual({
      kind: 'first-expense',
    })
  })

  it('offers to close the running week on Saturday and Sunday only', () => {
    expect(nextStep({ ...base, today: '2026-09-25' }).kind).toBe('all-set')
    expect(nextStep({ ...base, today: '2026-09-26' })).toEqual({
      kind: 'close-current',
      weekStart: '2026-09-21',
    })
    expect(nextStep({ ...base, today: '2026-09-27' })).toEqual({
      kind: 'close-current',
      weekStart: '2026-09-21',
    })
    expect(nextStep({ ...base, today: '2026-09-27', currentWeekClosed: true }).kind).toBe('all-set')
  })

  it('suggests a standing order only in the early days, so it never nags', () => {
    expect(nextStep({ ...base, hasRecurring: false, closedWeeks: 1 })).toEqual({
      kind: 'add-recurring',
    })
    expect(nextStep({ ...base, hasRecurring: false, closedWeeks: 2 }).kind).toBe('all-set')
  })

  it('names the next closing day when there is nothing to do', () => {
    expect(nextStep(base)).toEqual({ kind: 'all-set', nextCloseOn: '2026-09-27' })
    expect(nextStep({ ...base, currentWeekClosed: true })).toEqual({
      kind: 'all-set',
      nextCloseOn: '2026-10-04',
    })
  })
})

describe('projectWeek', () => {
  it('assumes the default income until the real one is entered', () => {
    expect(
      projectWeek({
        incomeCents: null,
        defaultIncomeCents: 200_000,
        spentCents: 13_250,
        reservedCents: 18_000,
      }),
    ).toEqual({ incomeCents: 200_000, isEstimate: true, projectedSavedCents: 168_750 })
  })

  it('uses the entered income (also zero) and can go negative', () => {
    expect(
      projectWeek({
        incomeCents: 0,
        defaultIncomeCents: 200_000,
        spentCents: 5_000,
        reservedCents: 0,
      }),
    ).toEqual({ incomeCents: 0, isEstimate: false, projectedSavedCents: -5_000 })
  })
})
