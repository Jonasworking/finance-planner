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
