import { describe, expect, it } from 'vitest'
import { makeExpense, NOW } from '@/test/fixtures'
import {
  expensesInWeek,
  groupByDay,
  groupByWeek,
  isBudgetRelevant,
  isPotFunded,
  sumAmounts,
} from './expenses'
import { autoWeeklyTxId, categoryId, fundingTxId, recurringInstanceId, transferTxIds } from './ids'

describe('expense helpers', () => {
  const monday = makeExpense('2026-09-21', 1_000)
  const sunday = makeExpense('2026-09-27', 2_000)
  const funded = makeExpense('2026-09-23', 50_000, { fundedByPotId: 'pot:trip' })
  const deleted = makeExpense('2026-09-24', 9_000, { deletedAt: NOW })
  const nextWeek = makeExpense('2026-09-28', 4_000)
  const all = [monday, sunday, funded, deleted, nextWeek]

  it('selects the active expenses of a Monday–Sunday week', () => {
    expect(expensesInWeek(all, '2026-09-21')).toEqual([monday, sunday, funded])
  })

  it('knows what counts against the budget', () => {
    expect(all.filter(isBudgetRelevant)).toEqual([monday, sunday, nextWeek])
    expect(isPotFunded(funded)).toBe(true)
    expect(isPotFunded(makeExpense('2026-09-21', 1, { fundedByPotId: null }))).toBe(false)
    expect(sumAmounts([monday, sunday])).toBe(3_000)
    expect(sumAmounts([])).toBe(0)
  })

  it('groups active expenses by week start', () => {
    const groups = groupByWeek(all)
    expect([...groups.keys()]).toEqual(['2026-09-21', '2026-09-28'])
    expect(groups.get('2026-09-21')).toEqual([monday, sunday, funded])
  })
})

describe('deterministic ids', () => {
  it('are stable strings', () => {
    expect(autoWeeklyTxId('2026-09-21')).toBe('auto:2026-09-21')
    expect(fundingTxId('e1')).toBe('fund:e1')
    expect(transferTxIds('t1')).toEqual({ out: 'tr:t1:out', in: 'tr:t1:in' })
    expect(recurringInstanceId('rent', '2026-09-25')).toBe('rec:rent:2026-09-25')
    expect(categoryId('groceries')).toBe('cat:groceries')
  })
})

describe('groupByDay', () => {
  it('lists newest day and newest entry first, totals without pot-funded spending', () => {
    const early = makeExpense('2026-09-22', 1_000, { createdAt: 10 })
    const late = makeExpense('2026-09-22', 2_000, { createdAt: 20 })
    const funded = makeExpense('2026-09-22', 50_000, { createdAt: 15, fundedByPotId: 'pot:trip' })
    const monday = makeExpense('2026-09-21', 700)
    const deleted = makeExpense('2026-09-23', 9_000, { deletedAt: NOW })

    expect(groupByDay([monday, early, deleted, late, funded])).toEqual([
      { date: '2026-09-22', expenses: [late, funded, early], totalCents: 3_000 },
      { date: '2026-09-21', expenses: [monday], totalCents: 700 },
    ])
    expect(groupByDay([])).toEqual([])
  })
})
