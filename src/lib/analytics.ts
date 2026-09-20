import { monthOfWeek, weekStartOf } from './dates'
import { isBudgetRelevant } from './expenses'
import { ratio } from './money'
import type { WeekSummary } from './savings'
import { isActive, type Cents, type Expense, type ISODate } from './types'

const byWeek = (a: WeekSummary, b: WeekSummary) =>
  a.weekStart < b.weekStart ? -1 : a.weekStart > b.weekStart ? 1 : 0

export interface WeekPoint {
  weekStart: ISODate
  closed: boolean
  incomeCents: Cents
  spentCents: Cents
  savedCents: Cents
}

/** Chronological series for "Verdient vs. Ausgegeben vs. Gespart". */
export function weeklySeries(summaries: readonly WeekSummary[]): WeekPoint[] {
  return [...summaries].sort(byWeek).map((summary) => ({
    weekStart: summary.weekStart,
    closed: summary.closed,
    incomeCents: summary.incomeCents,
    spentCents: summary.spentCents,
    savedCents: summary.savedCents,
  }))
}

export interface MonthPoint {
  /** 'YYYY-MM' */
  month: string
  /** Closed weeks in this month (4 or 5 when complete) – the basis of all KPIs below. */
  weeks: number
  incomeCents: Cents
  spentCents: Cents
  savedCents: Cents
  avgSpentPerWeekCents: Cents
  avgSavedPerWeekCents: Cents
  /** Still-open weeks are reported separately so the running month shows no bogus minus. */
  openWeeks: number
  openSpentCents: Cents
}

/**
 * Months are sums of WHOLE weeks (Thursday rule) and only of closed ones: an open week has
 * spending but no income yet. Compare months by the per-week averages – they have 4 or 5 weeks.
 */
export function monthlySeries(summaries: readonly WeekSummary[]): MonthPoint[] {
  const months = new Map<string, MonthPoint>()
  for (const summary of summaries) {
    const month = monthOfWeek(summary.weekStart)
    const point = months.get(month) ?? {
      month,
      weeks: 0,
      incomeCents: 0,
      spentCents: 0,
      savedCents: 0,
      avgSpentPerWeekCents: 0,
      avgSavedPerWeekCents: 0,
      openWeeks: 0,
      openSpentCents: 0,
    }
    if (summary.closed) {
      point.weeks += 1
      point.incomeCents += summary.incomeCents
      point.spentCents += summary.spentCents
      point.savedCents += summary.savedCents
    } else {
      point.openWeeks += 1
      point.openSpentCents += summary.spentCents
    }
    months.set(month, point)
  }

  return [...months.values()]
    .map((point) => ({
      ...point,
      avgSpentPerWeekCents: point.weeks ? Math.round(point.spentCents / point.weeks) : 0,
      avgSavedPerWeekCents: point.weeks ? Math.round(point.savedCents / point.weeks) : 0,
    }))
    .sort((a, b) => (a.month < b.month ? -1 : 1))
}

export interface CategorySlice {
  categoryId: string
  amountCents: Cents
  /** 0..1 of the total. */
  share: number
}

/** Donut data, largest first. Pot-funded expenses are left out unless `includeFunded` is set. */
export function categoryBreakdown(
  expenses: readonly Expense[],
  options: { includeFunded?: boolean } = {},
): CategorySlice[] {
  const totals = new Map<string, Cents>()
  let total = 0
  for (const expense of expenses) {
    if (options.includeFunded ? !isActive(expense) : !isBudgetRelevant(expense)) continue
    totals.set(expense.categoryId, (totals.get(expense.categoryId) ?? 0) + expense.amountCents)
    total += expense.amountCents
  }
  return [...totals.entries()]
    .map(([categoryId, amountCents]) => ({
      categoryId,
      amountCents,
      share: ratio(amountCents, total),
    }))
    .sort((a, b) => b.amountCents - a.amountCents || (a.categoryId < b.categoryId ? -1 : 1))
}

/** Running total of what closed weeks put aside ("Sparverlauf kumuliert"). */
export function cumulativeSavings(
  summaries: readonly WeekSummary[],
  startCents: Cents = 0,
): { weekStart: ISODate; totalCents: Cents }[] {
  let total = startCents
  return [...summaries]
    .filter((summary) => summary.closed)
    .sort(byWeek)
    .map((summary) => ({ weekStart: summary.weekStart, totalCents: (total += summary.savedCents) }))
}

export interface WeekComparison {
  incomeDeltaCents: Cents
  spentDeltaCents: Cents
  savedDeltaCents: Cents
  /** Relative change of spending; null when last week had none. */
  spentDeltaRatio: number | null
}

export function compareToPreviousWeek(
  current: WeekSummary,
  previous: WeekSummary | null | undefined,
): WeekComparison | null {
  if (!previous) return null
  const spentDeltaCents = current.spentCents - previous.spentCents
  return {
    incomeDeltaCents: current.incomeCents - previous.incomeCents,
    spentDeltaCents,
    savedDeltaCents: current.savedCents - previous.savedCents,
    spentDeltaRatio: previous.spentCents > 0 ? spentDeltaCents / previous.spentCents : null,
  }
}

/** Best and worst closed week by amount saved (earliest wins ties). */
export function bestWorstWeek(
  summaries: readonly WeekSummary[],
): { best: WeekSummary; worst: WeekSummary } | null {
  const closed = [...summaries].filter((summary) => summary.closed).sort(byWeek)
  const first = closed[0]
  if (!first) return null
  let best = first
  let worst = first
  for (const summary of closed) {
    if (summary.savedCents > best.savedCents) best = summary
    if (summary.savedCents < worst.savedCents) worst = summary
  }
  return { best, worst }
}

/**
 * Average budget-relevant spend per category and week over the given weeks
 * (weeks without spending count as zero, so the average is per calendar week).
 */
export function categoryAverages(
  expenses: readonly Expense[],
  weekStarts: readonly ISODate[],
): Record<string, Cents> {
  if (weekStarts.length === 0) return {}
  const wanted = new Set(weekStarts)

  const totals: Record<string, Cents> = {}
  for (const expense of expenses) {
    if (!isBudgetRelevant(expense) || !wanted.has(weekStartOf(expense.date))) continue
    totals[expense.categoryId] = (totals[expense.categoryId] ?? 0) + expense.amountCents
  }
  return Object.fromEntries(
    Object.entries(totals).map(([categoryId, sum]) => [categoryId, Math.round(sum / wanted.size)]),
  )
}
