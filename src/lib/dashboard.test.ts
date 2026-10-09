import { describe, expect, it } from 'vitest'
import { makePot, makeTx } from '@/test/fixtures'
import { addWeeksISO } from './dates'
import { nextStep, projectWeek, savingsOverview, weekProgress } from './dashboard'
import type { WeekSummary } from './savings'
import { PRIMARY_POT_ID } from './types'

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
    ).toEqual({
      incomeCents: 200_000,
      source: 'default',
      isEstimate: true,
      wageDays: [],
      projectedSavedCents: 168_750,
    })
  })

  it('uses the entered income (also zero) and can go negative', () => {
    expect(
      projectWeek({
        incomeCents: 0,
        defaultIncomeCents: 200_000,
        spentCents: 5_000,
        reservedCents: 0,
      }),
    ).toEqual({
      incomeCents: 0,
      source: 'entered',
      isEstimate: false,
      wageDays: [],
      projectedSavedCents: -5_000,
    })
  })

  const wage = (date: string, amountCents: number) => ({ date, amountCents })

  it('counts on the wage the bank import saw instead of the default income', () => {
    expect(
      projectWeek({
        incomeCents: null,
        bankIncome: { totalCents: 184_350, credits: [wage('2026-09-24', 184_350)] },
        defaultIncomeCents: 200_000,
        spentCents: 13_250,
        reservedCents: 18_000,
      }),
    ).toEqual({
      incomeCents: 184_350,
      source: 'bank',
      isEstimate: true,
      wageDays: ['2026-09-24'],
      projectedSavedCents: 153_100,
    })
  })

  it('lists each wage day once, oldest first', () => {
    const projection = projectWeek({
      incomeCents: null,
      bankIncome: {
        totalCents: 230_000,
        credits: [
          wage('2026-09-25', 30_000),
          wage('2026-09-24', 100_000),
          wage('2026-09-24', 100_000),
        ],
      },
      defaultIncomeCents: 200_000,
      spentCents: 0,
      reservedCents: 0,
    })
    expect(projection.wageDays).toEqual(['2026-09-24', '2026-09-25'])
    expect(projection.incomeCents).toBe(230_000)
  })

  it('lets the entered income win over the bank', () => {
    expect(
      projectWeek({
        incomeCents: 150_000,
        bankIncome: { totalCents: 184_350, credits: [wage('2026-09-24', 184_350)] },
        defaultIncomeCents: 200_000,
        spentCents: 0,
        reservedCents: 0,
      }),
    ).toMatchObject({ incomeCents: 150_000, source: 'entered', isEstimate: false, wageDays: [] })
  })
})

describe('savingsOverview', () => {
  const closedWeek = (weekStart: string, savedCents: number): WeekSummary => ({
    weekStart,
    closed: true,
    hasIncome: true,
    incomeCents: 200_000,
    spentCents: 200_000 - savedCents,
    fundedCents: 0,
    savedCents,
    savingsRate: savedCents / 200_000,
    totalLimitCents: null,
    underBudget: null,
  })
  const auto = (weekStart: string, sunday: string, amountCents: number) =>
    makeTx(PRIMARY_POT_ID, amountCents, sunday, {
      id: `auto:${weekStart}`,
      type: 'auto-weekly',
      sourceWeekStart: weekStart,
    })
  const pots = [makePot(PRIMARY_POT_ID), makePot('pot:trip', { sortOrder: 1 })]

  it('shows the balance and nothing else before the first week is closed', () => {
    expect(
      savingsOverview({
        pots,
        potTransactions: [makeTx(PRIMARY_POT_ID, 850_000, '2026-09-21', { id: 'opening-balance' })],
        closedWeeks: [],
      }),
    ).toEqual({
      totalCents: 850_000,
      primaryCents: 850_000,
      otherPots: 1,
      otherCents: 0,
      change: null,
      trend: [],
    })
  })

  it('adds up the pots in use and leaves archived pots and deleted bookings out', () => {
    const overview = savingsOverview({
      pots: [
        ...pots,
        makePot('pot:old', { archived: true }),
        makePot('pot:gone', { deletedAt: 1 }),
      ],
      potTransactions: [
        makeTx(PRIMARY_POT_ID, 100_000, '2026-09-01'),
        makeTx('pot:trip', 30_000, '2026-09-02'),
        makeTx('pot:trip', 5_000, '2026-09-03', { deletedAt: 1 }),
        makeTx('pot:old', 70_000, '2026-09-02'),
        makeTx('pot:gone', 9_000, '2026-09-02'),
      ],
      closedWeeks: [],
    })
    expect(overview).toMatchObject({
      totalCents: 130_000,
      primaryCents: 100_000,
      otherPots: 1,
      otherCents: 30_000,
    })
  })

  it('draws one closed week as a line from before to after, ending at the total', () => {
    const overview = savingsOverview({
      pots,
      potTransactions: [
        makeTx(PRIMARY_POT_ID, 850_000, '2026-09-07', { id: 'opening-balance' }),
        auto('2026-09-14', '2026-09-20', 142_000),
      ],
      closedWeeks: [closedWeek('2026-09-14', 142_000)],
    })
    expect(overview.trend).toEqual([
      { weekStart: '2026-09-07', totalCents: 850_000 },
      { weekStart: '2026-09-14', totalCents: 992_000 },
    ])
    expect(overview.change).toEqual({ deltaCents: 142_000, since: '2026-09-20' })
  })

  it('counts everything after the last closed Sunday into the change – not what was booked on it by hand', () => {
    const overview = savingsOverview({
      pots,
      potTransactions: [
        makeTx(PRIMARY_POT_ID, 500_000, '2026-09-07'),
        auto('2026-09-07', '2026-09-13', 100_000),
        auto('2026-09-14', '2026-09-20', 142_000),
        makeTx(PRIMARY_POT_ID, 20_000, '2026-09-20'), // by hand, on the Sunday itself
        makeTx(PRIMARY_POT_ID, -30_000, '2026-09-22', { type: 'transfer-out' }),
        makeTx('pot:trip', 30_000, '2026-09-22', { type: 'transfer-in' }),
        makeTx('pot:trip', -12_000, '2026-09-23', { type: 'expense-funding' }),
      ],
      // open weeks are ignored, the order does not matter
      closedWeeks: [
        closedWeek('2026-09-14', 142_000),
        { ...closedWeek('2026-09-21', 0), closed: false },
        closedWeek('2026-09-07', 100_000),
      ],
    })
    expect(overview.totalCents).toBe(750_000)
    expect(overview.change).toEqual({ deltaCents: 130_000, since: '2026-09-20' })
    // counted back from the total: movements by hand shift the whole line, the end stays true
    expect(overview.trend).toEqual([
      { weekStart: '2026-08-31', totalCents: 508_000 },
      { weekStart: '2026-09-07', totalCents: 608_000 },
      { weekStart: '2026-09-14', totalCents: 750_000 },
    ])
  })

  it('looks back twelve closed weeks at most', () => {
    const mondays = Array.from({ length: 15 }, (_, index) => addWeeksISO('2026-06-01', index))
    const overview = savingsOverview({
      pots,
      potTransactions: [makeTx(PRIMARY_POT_ID, 1_500_000, '2026-01-01')],
      closedWeeks: mondays.map((monday) => closedWeek(monday, 100_000)),
    })
    expect(overview.trend).toHaveLength(13)
    expect(overview.trend[0]?.totalCents).toBe(300_000)
    expect(overview.trend[12]).toEqual({ weekStart: mondays[14], totalCents: 1_500_000 })
  })
})
