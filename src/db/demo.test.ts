import { afterEach, describe, expect, it } from 'vitest'
import { resolveBudget } from '@/lib/budget'
import { addWeeksISO, listWeeks } from '@/lib/dates'
import { checkLedgerInvariants } from '@/lib/ledger'
import { pendingWeeks, potBalances, summarizeWeek } from '@/lib/savings'
import { computeStreak } from '@/lib/streak'
import { isActive, PRIMARY_POT_ID } from '@/lib/types'
import { seedDemoData } from './demo'
import { loadAppData } from './queries'
import { createRepos } from './repos'
import { FinanceDB } from './schema'

const TODAY = '2026-09-23'
const databases: FinanceDB[] = []

async function demo(name: string) {
  const db = new FinanceDB(name)
  databases.push(db)
  let tick = 3_000_000
  await db.open()
  await seedDemoData(createRepos(db, { now: () => ++tick }), TODAY)
  return loadAppData(db)
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((db) => db.delete()))
})

describe('demo data', () => {
  it('produces consistent books with everything the UI needs to show', async () => {
    const data = await demo('demo-test-a')
    expect(checkLedgerInvariants(data)).toEqual([])

    const closedWeeks = listWeeks(addWeeksISO('2026-09-21', -12), '2026-09-14')
    const summaries = closedWeeks.map((weekStart) =>
      summarizeWeek({
        weekStart,
        week: data.weeks.find((week) => week.id === weekStart),
        expenses: data.expenses,
        budget: resolveBudget(data.budgets, weekStart),
      }),
    )
    expect(summaries.every((summary) => summary.closed)).toBe(true)
    expect(pendingWeeks(data.weeks, data.settings[0]!.trackingSince, TODAY)).toEqual([])

    // The interesting cases are really in there.
    expect(summaries.filter((summary) => summary.savedCents < 0)).toHaveLength(1) // week without work
    expect(summaries.some((summary) => summary.underBudget === false)).toBe(true)
    expect(summaries.some((summary) => summary.underBudget === true)).toBe(true)
    expect(new Set(summaries.map((summary) => summary.totalLimitCents))).toEqual(
      new Set([40_000, 45_000]),
    )
    expect(summaries.some((summary) => summary.fundedCents === 65_000)).toBe(true)
    expect(
      data.expenses.filter((expense) => expense.recurringId && isActive(expense)).length,
    ).toBeGreaterThanOrEqual(12)
    expect(data.expenses.some((expense) => expense.date >= '2026-09-21')).toBe(true) // running week
    expect(computeStreak(summaries, TODAY).stale).toBe(false)

    // Pot balances follow from the summaries: start + savings − 6 transfers; trip: 6 × 300 − flight.
    const saved = summaries.reduce((sum, summary) => sum + summary.savedCents, 0)
    const trip = data.pots.find((pot) => pot.name === 'Reisen')!
    expect(potBalances(data.potTransactions)).toEqual({
      [PRIMARY_POT_ID]: 850_000 + saved - 180_000,
      [trip.id]: 115_000,
    })
  })

  it('is deterministic apart from random ids', async () => {
    const [a, b] = await Promise.all([demo('demo-test-b'), demo('demo-test-c')])
    // Tables come back ordered by their (random) id, so compare order-independently.
    const shape = (data: typeof a) =>
      data.expenses
        .map((expense) =>
          [expense.date, expense.amountCents, expense.categoryId, expense.note ?? ''].join('|'),
        )
        .sort()
    expect(shape(a)).toEqual(shape(b))
    expect(shape(a).length).toBeGreaterThan(80)
  })
})
