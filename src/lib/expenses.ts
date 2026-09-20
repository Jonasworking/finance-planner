import { weekEndOf, weekStartOf } from './dates'
import { isActive, type Cents, type Expense, type ISODate } from './types'

/** "Aus Topf bezahlt": paid from savings, so it is not part of the week's spending. */
export const isPotFunded = (expense: Expense): boolean => expense.fundedByPotId != null

/** Not deleted and not pot-funded – what counts against budget, streak and weekly savings. */
export const isBudgetRelevant = (expense: Expense): boolean =>
  isActive(expense) && !isPotFunded(expense)

export const sumAmounts = (expenses: readonly Expense[]): Cents =>
  expenses.reduce((sum, expense) => sum + expense.amountCents, 0)

/** Active expenses dated within the week that starts on `weekStart`. */
export function expensesInWeek(expenses: readonly Expense[], weekStart: ISODate): Expense[] {
  const end = weekEndOf(weekStart)
  return expenses.filter(
    (expense) => isActive(expense) && expense.date >= weekStart && expense.date <= end,
  )
}

/** Active expenses bucketed by the Monday of their week. */
export function groupByWeek(expenses: readonly Expense[]): Map<ISODate, Expense[]> {
  const groups = new Map<ISODate, Expense[]>()
  for (const expense of expenses) {
    if (!isActive(expense)) continue
    const weekStart = weekStartOf(expense.date)
    const bucket = groups.get(weekStart)
    if (bucket) bucket.push(expense)
    else groups.set(weekStart, [expense])
  }
  return groups
}

export interface DayGroup {
  date: ISODate
  expenses: Expense[]
  /** Sum of what counts as spending (pot-funded expenses are listed but not added). */
  totalCents: Cents
}

/** Active expenses grouped by calendar day – newest day first, newest entry first within a day. */
export function groupByDay(expenses: readonly Expense[]): DayGroup[] {
  const groups = new Map<ISODate, Expense[]>()
  for (const expense of expenses) {
    if (!isActive(expense)) continue
    const bucket = groups.get(expense.date)
    if (bucket) bucket.push(expense)
    else groups.set(expense.date, [expense])
  }
  return [...groups.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, items]) => ({
      date,
      expenses: items.sort((a, b) => b.createdAt - a.createdAt),
      totalCents: sumAmounts(items.filter(isBudgetRelevant)),
    }))
}
