import { resolveBudget } from './budget'
import { addWeeksISO, listWeeks, maxISO, minISO, monthOfWeek, weekStartOf } from './dates'
import { groupByWeek, isBudgetRelevant } from './expenses'
import { ratio } from './money'
import { summarizeWeek, type WeekSummary } from './savings'
import { isActive, type Budget, type Cents, type Expense, type ISODate, type Week } from './types'

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
  avgIncomePerWeekCents: Cents
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
      avgIncomePerWeekCents: 0,
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
      avgIncomePerWeekCents: point.weeks ? Math.round(point.incomeCents / point.weeks) : 0,
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

/* ── The analysis screen: which weeks it covers and what it shows for them ── */

export type AnalyticsRange = 8 | 12 | 26 | 'all'
export type Granularity = 'week' | 'month'

/** Where the analysis can start: the tracking week, or an even earlier closed week. */
export function firstAnalyticsWeek(trackingSince: ISODate, weeks: readonly Week[]): ISODate {
  let first = weekStartOf(trackingSince)
  for (const week of weeks) {
    if (isActive(week) && week.closedAt !== null) first = minISO(first, week.id)
  }
  return first
}

/**
 * Week starts the selection covers, oldest first, always ending with the running week and never
 * reaching back before `firstWeek` (weeks before tracking began would show up as empty open
 * weeks). By month, the start moves back to the first week of its month (Thursday rule), so no
 * month is cut in half by the range.
 */
export function analyticsWeeks(input: {
  range: AnalyticsRange
  granularity: Granularity
  today: ISODate
  firstWeek: ISODate
}): ISODate[] {
  const currentWeek = weekStartOf(input.today)
  let start = input.range === 'all' ? input.firstWeek : addWeeksISO(currentWeek, 1 - input.range)
  if (input.granularity === 'month') {
    while (monthOfWeek(addWeeksISO(start, -1)) === monthOfWeek(start)) {
      start = addWeeksISO(start, -1)
    }
  }
  return listWeeks(minISO(maxISO(start, input.firstWeek), currentWeek), currentWeek)
}

/** One summary per requested week, in the given order – weeks without any row included. */
export function summarizeWeeks(
  weekStarts: readonly ISODate[],
  data: { weeks: readonly Week[]; expenses: readonly Expense[]; budgets: readonly Budget[] },
): WeekSummary[] {
  const expensesByWeek = groupByWeek(data.expenses)
  const rows = new Map(data.weeks.map((week) => [week.id, week]))
  return weekStarts.map((weekStart) =>
    summarizeWeek({
      weekStart,
      week: rows.get(weekStart),
      expenses: expensesByWeek.get(weekStart) ?? [],
      budget: resolveBudget(data.budgets, weekStart),
    }),
  )
}

/** Active expenses dated in one of the given weeks. */
export function expensesInWeeks(
  expenses: readonly Expense[],
  weekStarts: readonly ISODate[],
): Expense[] {
  const wanted = new Set(weekStarts)
  return expenses.filter((expense) => isActive(expense) && wanted.has(weekStartOf(expense.date)))
}

export interface RangeTotals {
  closedWeeks: number
  incomeCents: Cents
  spentCents: Cents
  savedCents: Cents
  /** saved / income over the closed weeks; 0 without income. */
  savingsRate: number
  /** Weeks not closed yet: their spending is known, their income is not. */
  openWeeks: number
  openSpentCents: Cents
}

/** Headline numbers of a selection. Only closed weeks count, as in the monthly series. */
export function rangeTotals(summaries: readonly WeekSummary[]): RangeTotals {
  const totals: RangeTotals = {
    closedWeeks: 0,
    incomeCents: 0,
    spentCents: 0,
    savedCents: 0,
    savingsRate: 0,
    openWeeks: 0,
    openSpentCents: 0,
  }
  for (const summary of summaries) {
    if (summary.closed) {
      totals.closedWeeks += 1
      totals.incomeCents += summary.incomeCents
      totals.spentCents += summary.spentCents
      totals.savedCents += summary.savedCents
    } else {
      totals.openWeeks += 1
      totals.openSpentCents += summary.spentCents
    }
  }
  totals.savingsRate = ratio(totals.savedCents, totals.incomeCents)
  return totals
}

/**
 * One column of "Verdient · Ausgegeben · Gespart". By week the amounts are the week's own; by
 * month they are the AVERAGE PER CLOSED WEEK, because months have four or five weeks and their
 * sums would zigzag for no reason. Spending of weeks that are not closed yet never mixes into
 * these numbers – it is carried in `openSpentCents`.
 */
export interface FlowPoint {
  /** Week start, or 'YYYY-MM' by month. */
  key: string
  /** Closed weeks behind the amounts (0 or 1 by week). */
  weeks: number
  incomeCents: Cents
  spentCents: Cents
  savedCents: Cents
  openWeeks: number
  /** By week: what the open week has spent so far. By month: the sum over its open weeks. */
  openSpentCents: Cents
  /**
   * Height of the pale "still open" bar: the open spending when the column has nothing else to
   * show (per open week by month), otherwise 0.
   */
  openBarCents: Cents
  /** Sums over the closed weeks (equal to the amounts above by week). */
  totalIncomeCents: Cents
  totalSpentCents: Cents
  totalSavedCents: Cents
}

export function flowSeries(
  summaries: readonly WeekSummary[],
  granularity: Granularity,
): FlowPoint[] {
  if (granularity === 'week') {
    return [...summaries].sort(byWeek).map((summary) => {
      const closed = summary.closed
      return {
        key: summary.weekStart,
        weeks: closed ? 1 : 0,
        incomeCents: closed ? summary.incomeCents : 0,
        spentCents: closed ? summary.spentCents : 0,
        savedCents: closed ? summary.savedCents : 0,
        openWeeks: closed ? 0 : 1,
        openSpentCents: closed ? 0 : summary.spentCents,
        openBarCents: closed ? 0 : summary.spentCents,
        totalIncomeCents: closed ? summary.incomeCents : 0,
        totalSpentCents: closed ? summary.spentCents : 0,
        totalSavedCents: closed ? summary.savedCents : 0,
      }
    })
  }
  return monthlySeries(summaries).map((month) => ({
    key: month.month,
    weeks: month.weeks,
    incomeCents: month.avgIncomePerWeekCents,
    spentCents: month.avgSpentPerWeekCents,
    savedCents: month.avgSavedPerWeekCents,
    openWeeks: month.openWeeks,
    openSpentCents: month.openSpentCents,
    openBarCents:
      month.weeks === 0 && month.openWeeks > 0
        ? Math.round(month.openSpentCents / month.openWeeks)
        : 0,
    totalIncomeCents: month.incomeCents,
    totalSpentCents: month.spentCents,
    totalSavedCents: month.savedCents,
  }))
}

export interface PeriodComparison extends WeekComparison {
  /** Week start or 'YYYY-MM' of the two periods. */
  currentKey: string
  previousKey: string
  /** The newer period's amounts (per week by month), so the UI can show value + delta. */
  incomeCents: Cents
  spentCents: Cents
  savedCents: Cents
}

/**
 * The newest finished period against the one before it: the two latest CLOSED weeks, or – by
 * month – the two latest months that have closed weeks, compared by their per-week averages.
 * The running open week is left out on purpose: half a week always looks like a saving.
 */
export function latestComparison(
  summaries: readonly WeekSummary[],
  granularity: Granularity,
): PeriodComparison | null {
  const points = flowSeries(summaries, granularity).filter((point) => point.weeks > 0)
  const current = points.at(-1)
  const previous = points.at(-2)
  if (!current || !previous) return null
  const spentDeltaCents = current.spentCents - previous.spentCents
  return {
    currentKey: current.key,
    previousKey: previous.key,
    incomeCents: current.incomeCents,
    spentCents: current.spentCents,
    savedCents: current.savedCents,
    incomeDeltaCents: current.incomeCents - previous.incomeCents,
    spentDeltaCents,
    savedDeltaCents: current.savedCents - previous.savedCents,
    spentDeltaRatio: previous.spentCents > 0 ? spentDeltaCents / previous.spentCents : null,
  }
}

export interface FoldedSlices {
  /** The largest categories, as they come from `categoryBreakdown`. */
  top: CategorySlice[]
  /** Everything else as one slice; null when nothing had to be folded. */
  rest: { amountCents: Cents; share: number; slices: CategorySlice[] } | null
}

/**
 * A donut reads at a glance only with a handful of slices: keep the `max` largest and fold the
 * tail into one. A single leftover category is not folded – it would only lose its name.
 */
export function foldSlices(slices: readonly CategorySlice[], max = 5): FoldedSlices {
  if (slices.length <= max + 1) return { top: [...slices], rest: null }
  const tail = slices.slice(max)
  return {
    top: slices.slice(0, max),
    rest: {
      amountCents: tail.reduce((sum, slice) => sum + slice.amountCents, 0),
      share: tail.reduce((sum, slice) => sum + slice.share, 0),
      slices: tail,
    },
  }
}

/**
 * Drill-down of one category: its budget-relevant spending per week (or per month, as sums)
 * across the selection – periods without spending are zero, not missing – and its largest
 * expenses, newest first among equals.
 */
export function categoryDetail(input: {
  expenses: readonly Expense[]
  categoryId: string
  weekStarts: readonly ISODate[]
  granularity: Granularity
  topCount?: number
}): {
  totalCents: Cents
  avgPerWeekCents: Cents
  trend: { key: string; amountCents: Cents }[]
  largest: Expense[]
} {
  const { weekStarts, granularity, topCount = 5 } = input
  const keyOf = (weekStart: ISODate) =>
    granularity === 'week' ? weekStart : monthOfWeek(weekStart)
  const amounts = new Map<string, Cents>()
  for (const weekStart of [...weekStarts].sort()) amounts.set(keyOf(weekStart), 0)

  const own = expensesInWeeks(input.expenses, weekStarts).filter(
    (expense) => expense.categoryId === input.categoryId && isBudgetRelevant(expense),
  )
  let totalCents = 0
  for (const expense of own) {
    const key = keyOf(weekStartOf(expense.date))
    amounts.set(key, (amounts.get(key) ?? 0) + expense.amountCents)
    totalCents += expense.amountCents
  }

  return {
    totalCents,
    avgPerWeekCents: weekStarts.length ? Math.round(totalCents / weekStarts.length) : 0,
    trend: [...amounts.entries()].map(([key, amountCents]) => ({ key, amountCents })),
    largest: [...own]
      .sort(
        (a, b) =>
          b.amountCents - a.amountCents ||
          (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt),
      )
      .slice(0, topCount),
  }
}

export interface AnalyticsView {
  /** Weeks of the selection, oldest first. */
  weekStarts: ISODate[]
  summaries: WeekSummary[]
  totals: RangeTotals
  flow: FlowPoint[]
  comparison: PeriodComparison | null
  /** Null until two weeks are closed – one week is neither best nor worst. */
  bestWorst: { best: WeekSummary; worst: WeekSummary } | null
  /** Running total of what the closed weeks of the selection put aside, starting at zero. */
  cumulative: { weekStart: ISODate; totalCents: Cents }[]
  /** Budget-relevant spending by category, largest first. */
  slices: CategorySlice[]
  /** Active expenses of the selection (drill-down input). */
  expenses: Expense[]
  /** Paid from pots in the selection – not part of any number above. */
  fundedCents: Cents
}

/** Everything the analysis screen shows for one selection, derived from raw rows. */
export function buildAnalytics(input: {
  today: ISODate
  range: AnalyticsRange
  granularity: Granularity
  trackingSince: ISODate
  weeks: readonly Week[]
  expenses: readonly Expense[]
  budgets: readonly Budget[]
}): AnalyticsView {
  const weekStarts = analyticsWeeks({
    range: input.range,
    granularity: input.granularity,
    today: input.today,
    firstWeek: firstAnalyticsWeek(input.trackingSince, input.weeks),
  })
  const summaries = summarizeWeeks(weekStarts, input)
  const expenses = expensesInWeeks(input.expenses, weekStarts)
  const totals = rangeTotals(summaries)
  return {
    weekStarts,
    summaries,
    totals,
    flow: flowSeries(summaries, input.granularity),
    comparison: latestComparison(summaries, input.granularity),
    bestWorst: totals.closedWeeks >= 2 ? bestWorstWeek(summaries) : null,
    cumulative: cumulativeSavings(summaries),
    slices: categoryBreakdown(expenses),
    expenses,
    fundedCents: summaries.reduce((sum, summary) => sum + summary.fundedCents, 0),
  }
}
