import { addDaysISO, maxISO, weekEndOf } from './dates'
import { isBudgetRelevant } from './expenses'
import { ratio } from './money'
import { dueDates } from './recurrence'
import {
  isActive,
  type Budget,
  type Cents,
  type Expense,
  type ISODate,
  type RecurringExpense,
} from './types'

export const WARN_THRESHOLD = 0.8
export const OVER_THRESHOLD = 1

export interface ResolvedBudget {
  /** Week start of the budget row that applies. */
  effectiveFrom: ISODate
  totalLimitCents: Cents
  categoryLimits: Record<string, Cents>
}

/**
 * Budgets are effective-dated: the row with the latest `id <= weekStart` applies; weeks before
 * the first row fall back to that first row. Past weeks therefore never change when the budget
 * is edited today. Limits of categories missing from `activeCategoryIds` (archived) are dropped
 * at resolve time – stored rows are never rewritten.
 */
export function resolveBudget(
  budgets: readonly Budget[],
  weekStart: ISODate,
  activeCategoryIds?: ReadonlySet<string>,
): ResolvedBudget | null {
  const sorted = budgets.filter(isActive).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const row = sorted.findLast((budget) => budget.id <= weekStart) ?? sorted[0]
  if (!row) return null

  const categoryLimits = Object.fromEntries(
    Object.entries(row.categoryLimits).filter(
      ([categoryId]) => !activeCategoryIds || activeCategoryIds.has(categoryId),
    ),
  )
  return { effectiveFrom: row.id, totalLimitCents: row.totalLimitCents, categoryLimits }
}

export type BudgetLevel = 'ok' | 'warn' | 'over'

export const levelFor = (usedRatio: number): BudgetLevel =>
  usedRatio >= OVER_THRESHOLD ? 'over' : usedRatio >= WARN_THRESHOLD ? 'warn' : 'ok'

export interface Usage {
  spentCents: Cents
  /** null = no limit set for this category. */
  limitCents: Cents | null
  /** Negative when over the limit; null without a limit. */
  remainingCents: Cents | null
  ratio: number
  level: BudgetLevel
}

function usage(spentCents: Cents, limitCents: Cents | null): Usage {
  if (limitCents === null) {
    return { spentCents, limitCents, remainingCents: null, ratio: 0, level: 'ok' }
  }
  // A zero limit with any spending is "over", not a division by zero.
  const usedRatio = limitCents > 0 ? ratio(spentCents, limitCents) : spentCents > 0 ? Infinity : 0
  return {
    spentCents,
    limitCents,
    remainingCents: limitCents - spentCents,
    ratio: usedRatio,
    level: levelFor(usedRatio),
  }
}

export interface BudgetUsage {
  total: Usage
  /** Every category that has spending or a limit. */
  byCategory: Record<string, Usage>
}

/** Usage of one week's expenses against its budget. Pot-funded and deleted expenses don't count. */
export function budgetUsage(weekExpenses: readonly Expense[], budget: ResolvedBudget): BudgetUsage {
  const spentByCategory = new Map<string, Cents>()
  let totalSpent = 0
  for (const expense of weekExpenses) {
    if (!isBudgetRelevant(expense)) continue
    totalSpent += expense.amountCents
    spentByCategory.set(
      expense.categoryId,
      (spentByCategory.get(expense.categoryId) ?? 0) + expense.amountCents,
    )
  }

  const byCategory: Record<string, Usage> = {}
  const categoryIds = new Set([...spentByCategory.keys(), ...Object.keys(budget.categoryLimits)])
  for (const categoryId of categoryIds) {
    byCategory[categoryId] = usage(
      spentByCategory.get(categoryId) ?? 0,
      budget.categoryLimits[categoryId] ?? null,
    )
  }
  return { total: usage(totalSpent, budget.totalLimitCents), byCategory }
}

/**
 * Which warning to show when usage moves from `previousRatio` to `nextRatio`. Returns the
 * highest threshold that was newly crossed, so each toast fires exactly once per crossing.
 */
export function thresholdCrossed(previousRatio: number, nextRatio: number): 'warn' | 'over' | null {
  if (previousRatio < OVER_THRESHOLD && nextRatio >= OVER_THRESHOLD) return 'over'
  if (previousRatio < WARN_THRESHOLD && nextRatio >= WARN_THRESHOLD) return 'warn'
  return null
}

/** Total limit minus the category limits. Negative = categories are overbooked. */
export function unallocatedCents(
  budget: Pick<ResolvedBudget, 'totalLimitCents' | 'categoryLimits'>,
): Cents {
  const allocated = Object.values(budget.categoryLimits).reduce((sum, limit) => sum + limit, 0)
  return budget.totalLimitCents - allocated
}

export interface ReservedItem {
  recurringId: string
  title: string
  categoryId: string
  date: ISODate
  amountCents: Cents
}

/**
 * Recurring expenses due in this week that are not booked yet, i.e. after the template's
 * watermark (so an instance due today still counts if the materialiser has not run, and a
 * deliberately deleted instance does not come back). Shown as "reserved" so the remaining
 * budget is honest before Friday's rent hits. Computed virtually – nothing is written.
 */
export function reservedThisWeek(
  templates: readonly RecurringExpense[],
  weekStart: ISODate,
  today: ISODate,
): { totalCents: Cents; items: ReservedItem[] } {
  const weekEnd = weekEndOf(weekStart)
  const items: ReservedItem[] = []
  // Past weeks have nothing "reserved": whatever was due is either booked or was skipped.
  if (today <= weekEnd) {
    const dayBeforeWeek = addDaysISO(weekStart, -1)
    for (const template of templates) {
      if (!isActive(template)) continue
      const after = template.lastGeneratedDate
        ? maxISO(template.lastGeneratedDate, dayBeforeWeek)
        : dayBeforeWeek
      for (const date of dueDates(template, after, weekEnd)) {
        items.push({
          recurringId: template.id,
          title: template.title,
          categoryId: template.categoryId,
          date,
          amountCents: template.amountCents,
        })
      }
    }
  }
  items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return { totalCents: items.reduce((sum, item) => sum + item.amountCents, 0), items }
}
