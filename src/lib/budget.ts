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
  /** Standing orders of the week that are not booked yet – they count as used already. */
  reservedCents: Cents
  /** null = no limit set for this category. */
  limitCents: Cents | null
  /** limit − spent − reserved. Negative when over the limit; null without a limit. */
  remainingCents: Cents | null
  /** (spent + reserved) / limit – what ring, colors and warnings go by. */
  ratio: number
  level: BudgetLevel
}

function usage(spentCents: Cents, reservedCents: Cents, limitCents: Cents | null): Usage {
  if (limitCents === null) {
    return { spentCents, reservedCents, limitCents, remainingCents: null, ratio: 0, level: 'ok' }
  }
  const committedCents = spentCents + reservedCents
  // A zero limit with any spending is "over", not a division by zero.
  const usedRatio =
    limitCents > 0 ? ratio(committedCents, limitCents) : committedCents > 0 ? Infinity : 0
  return {
    spentCents,
    reservedCents,
    limitCents,
    remainingCents: limitCents - committedCents,
    ratio: usedRatio,
    level: levelFor(usedRatio),
  }
}

export interface BudgetUsage {
  total: Usage
  /** Every category that has spending, something reserved or a limit. */
  byCategory: Record<string, Usage>
}

/**
 * Usage of one week's expenses against its budget. Pot-funded and deleted expenses don't count.
 * `reserved` (see `reservedThisWeek`) makes the remaining budget honest before Friday's rent is
 * booked; leave it out for past weeks.
 */
export function budgetUsage(
  weekExpenses: readonly Expense[],
  budget: ResolvedBudget,
  reserved: readonly ReservedItem[] = [],
): BudgetUsage {
  const spentByCategory = new Map<string, Cents>()
  const reservedByCategory = new Map<string, Cents>()
  let totalSpent = 0
  let totalReserved = 0
  for (const expense of weekExpenses) {
    if (!isBudgetRelevant(expense)) continue
    totalSpent += expense.amountCents
    spentByCategory.set(
      expense.categoryId,
      (spentByCategory.get(expense.categoryId) ?? 0) + expense.amountCents,
    )
  }
  for (const item of reserved) {
    totalReserved += item.amountCents
    reservedByCategory.set(
      item.categoryId,
      (reservedByCategory.get(item.categoryId) ?? 0) + item.amountCents,
    )
  }

  const byCategory: Record<string, Usage> = {}
  const categoryIds = new Set([
    ...spentByCategory.keys(),
    ...reservedByCategory.keys(),
    ...Object.keys(budget.categoryLimits),
  ])
  for (const categoryId of categoryIds) {
    byCategory[categoryId] = usage(
      spentByCategory.get(categoryId) ?? 0,
      reservedByCategory.get(categoryId) ?? 0,
      budget.categoryLimits[categoryId] ?? null,
    )
  }
  return { total: usage(totalSpent, totalReserved, budget.totalLimitCents), byCategory }
}

export type WarningLevel = Exclude<BudgetLevel, 'ok'>

/** Scope key of the overall weekly limit in `AnnouncedWarnings`; categories use their id. */
export const TOTAL_SCOPE = 'total'

/** Highest level that was already announced this week, per scope. */
export type AnnouncedWarnings = Record<string, WarningLevel>

export interface BudgetWarning {
  /** `TOTAL_SCOPE` or a category id. */
  scope: string
  level: WarningLevel
  usage: Usage
}

const LEVEL_RANK: Record<BudgetLevel, number> = { ok: 0, warn: 1, over: 2 }

/**
 * Warnings that are due now: every scope whose level is higher than what was announced for it
 * this week. Remembering the announcements (instead of comparing before/after) is what makes a
 * warning fire exactly once per threshold and week – deleting an expense and adding it again
 * does not warn twice, and jumping straight past 100 % only announces "over".
 * The overall limit comes first, then categories by how far they are gone.
 */
export function dueBudgetWarnings(
  current: BudgetUsage,
  announced: AnnouncedWarnings,
): BudgetWarning[] {
  const isDue = (scope: string, level: BudgetLevel): level is WarningLevel =>
    LEVEL_RANK[level] > LEVEL_RANK[announced[scope] ?? 'ok']

  const due: BudgetWarning[] = []
  if (isDue(TOTAL_SCOPE, current.total.level)) {
    due.push({ scope: TOTAL_SCOPE, level: current.total.level, usage: current.total })
  }
  const categories = Object.entries(current.byCategory)
    .filter(([, categoryUsage]) => categoryUsage.limitCents !== null)
    .sort(([, a], [, b]) => b.ratio - a.ratio)
  for (const [categoryId, categoryUsage] of categories) {
    if (isDue(categoryId, categoryUsage.level)) {
      due.push({ scope: categoryId, level: categoryUsage.level, usage: categoryUsage })
    }
  }
  return due
}

/** The announcement log after `warnings` have been shown. */
export function withAnnounced(
  announced: AnnouncedWarnings,
  warnings: readonly BudgetWarning[],
): AnnouncedWarnings {
  const next = { ...announced }
  for (const warning of warnings) next[warning.scope] = warning.level
  return next
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

/** Budget sliders move in steps of A$5. */
export const BUDGET_STEP_CENTS = 500

export const roundToBudgetStep = (cents: Cents): Cents =>
  Math.max(0, Math.round(cents / BUDGET_STEP_CENTS) * BUDGET_STEP_CENTS)

/**
 * Upper end of a budget slider: at least `floorCents`, and always half as much again as the
 * current value (in whole A$100), so a typed-in higher amount never pins the thumb to the end.
 */
export function sliderMaxCents(valueCents: Cents, floorCents: Cents): Cents {
  const headroom = Math.ceil((valueCents * 1.5) / 10_000) * 10_000
  return Math.max(floorCents, headroom)
}

/** What gets stored: a category without a limit has no entry (0 and null both mean "no limit"). */
export function cleanCategoryLimits(
  limits: Readonly<Record<string, Cents | null | undefined>>,
): Record<string, Cents> {
  const cleaned: Record<string, Cents> = {}
  for (const [categoryId, limit] of Object.entries(limits)) {
    if (limit != null && limit > 0) cleaned[categoryId] = limit
  }
  return cleaned
}

type BudgetValues = Pick<ResolvedBudget, 'totalLimitCents' | 'categoryLimits'>

/** True when two budgets would behave the same – the editor only offers "save" for a change. */
export function sameBudget(a: BudgetValues, b: BudgetValues): boolean {
  const left = cleanCategoryLimits(a.categoryLimits)
  const right = cleanCategoryLimits(b.categoryLimits)
  const ids = new Set([...Object.keys(left), ...Object.keys(right)])
  return a.totalLimitCents === b.totalLimitCents && [...ids].every((id) => left[id] === right[id])
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
