import { categoryAverages, summarizeWeeks } from './analytics'
import { BUDGET_STEP_CENTS, resolveBudget, roundToBudgetStep, type ResolvedBudget } from './budget'
import { addMonthsClamped, addWeeksISO, listWeeks, maxISO, weekStartOf } from './dates'
import { potBalances, type WeekSummary } from './savings'
import {
  isActive,
  type Budget,
  type Category,
  type Cents,
  type Expense,
  type ISODate,
  type Pot,
  type PotTransaction,
  type Week,
} from './types'

export interface Adjustment {
  categoryId: string
  /** Positive = spend this much LESS per week in the category (so more is saved). */
  deltaCentsPerWeek: Cents
}

export interface ScenarioPoint {
  weekStart: ISODate
  baselineCents: Cents
  scenarioCents: Cents
}

export interface Scenario {
  /** Balance after each week closes; the first point is the week of `from`. */
  points: ScenarioPoint[]
  weeks: number
  extraPerWeekCents: Cents
  /** "… habe ich bis Datum Y Z A$ mehr". */
  gainCents: Cents
  /** What each adjustment alone adds by the end (category id → cents). */
  gainByCategory: Record<string, Cents>
}

/** Projects savings week by week: baseline tempo vs. tempo with the adjustments applied. */
export function projectScenario(input: {
  startBalanceCents: Cents
  baselineWeeklySavingCents: Cents
  adjustments: readonly Adjustment[]
  from: ISODate
  until: ISODate
}): Scenario {
  const extraPerWeekCents = input.adjustments.reduce((sum, a) => sum + a.deltaCentsPerWeek, 0)
  const weekStarts = listWeeks(weekStartOf(input.from), weekStartOf(input.until))

  let baseline = input.startBalanceCents
  let scenario = input.startBalanceCents
  const points = weekStarts.map((weekStart) => {
    baseline += input.baselineWeeklySavingCents
    scenario += input.baselineWeeklySavingCents + extraPerWeekCents
    return { weekStart, baselineCents: baseline, scenarioCents: scenario }
  })

  return {
    points,
    weeks: points.length,
    extraPerWeekCents,
    gainCents: extraPerWeekCents * points.length,
    gainByCategory: Object.fromEntries(
      input.adjustments.map((a) => [a.categoryId, a.deltaCentsPerWeek * points.length]),
    ),
  }
}

/**
 * Baseline tempo = average saved over the last `windowWeeks` closed weeks;
 * `fallbackCents` (e.g. default income − budget limit) while there is no history.
 */
export function baselineWeeklySaving(
  summaries: readonly WeekSummary[],
  fallbackCents: Cents,
  windowWeeks = 8,
): Cents {
  const closed = summaries
    .filter((summary) => summary.closed)
    .sort((a, b) => (a.weekStart < b.weekStart ? -1 : a.weekStart > b.weekStart ? 1 : 0))
    .slice(-windowWeeks)
  if (closed.length === 0) return fallbackCents
  return Math.round(closed.reduce((sum, summary) => sum + summary.savedCents, 0) / closed.length)
}

/* ── The what-if screen: where it starts, what can be cut, and turning it into a budget ── */

/** Closed weeks that the baseline tempo and the category averages look back on. */
export const WHATIF_WINDOW_WEEKS = 8
/** Sliders move in the budget's steps (A$5), so a scenario can become a budget as it is. */
export const WHATIF_STEP_CENTS = BUDGET_STEP_CENTS

export interface WhatIfCategory {
  categoryId: string
  /** Budget-relevant spend per week, averaged over the closed weeks of the window. */
  averageCents: Cents
  /** The category's limit in the running week's budget; null = none. */
  limitCents: Cents | null
  /** Most that can be cut per week: what is spent (or allowed), in whole slider steps. */
  maxCents: Cents
}

export interface WhatIfBase {
  /** Every pot added up – "Nur gespart" and the rest. */
  startBalanceCents: Cents
  /**
   * First week the projection adds: the running week, or – once it is closed and its saving is
   * already in the pots – the next one.
   */
  fromWeek: ISODate
  baselineWeeklySavingCents: Cents
  /** Closed weeks the baseline averages; 0 = no history, the baseline is income − budget. */
  basisWeeks: number
  /** Categories that something can be cut from, in the given order. */
  categories: WhatIfCategory[]
  /** The budget of the running week – what "als Budget übernehmen" starts from. */
  budget: ResolvedBudget | null
}

/**
 * Everything the calculator starts from. `categories` are the ones to offer (active, not
 * archived, in display order); categories without spending and without a limit are left out,
 * there is nothing to cut.
 */
export function whatIfBase(input: {
  today: ISODate
  defaultWeeklyIncomeCents: Cents
  weeks: readonly Week[]
  expenses: readonly Expense[]
  budgets: readonly Budget[]
  categories: readonly Pick<Category, 'id'>[]
  pots: readonly Pot[]
  potTransactions: readonly PotTransaction[]
}): WhatIfBase {
  // Unfiltered: limits of archived categories must survive "als Budget übernehmen".
  const budget = resolveBudget(input.budgets, weekStartOf(input.today))

  const closedWeekStarts = input.weeks
    .filter((week) => isActive(week) && week.closedAt !== null)
    .map((week) => week.id)
    .sort()
    .slice(-WHATIF_WINDOW_WEEKS)
  const summaries = summarizeWeeks(closedWeekStarts, input)
  const fallbackCents = input.defaultWeeklyIncomeCents - (budget?.totalLimitCents ?? 0)
  const averages = categoryAverages(input.expenses, closedWeekStarts)

  const livePots = new Set(input.pots.filter(isActive).map((pot) => pot.id))
  const balances = potBalances(input.potTransactions)
  const startBalanceCents = Object.entries(balances)
    .filter(([potId]) => livePots.has(potId))
    .reduce((sum, [, balance]) => sum + balance, 0)

  const categories = input.categories.flatMap(({ id }) => {
    const averageCents = averages[id] ?? 0
    const limitCents = budget?.categoryLimits[id] ?? null
    const reference = Math.max(averageCents, limitCents ?? 0)
    const maxCents = Math.ceil(reference / WHATIF_STEP_CENTS) * WHATIF_STEP_CENTS
    return maxCents > 0 ? [{ categoryId: id, averageCents, limitCents, maxCents }] : []
  })

  const currentWeek = weekStartOf(input.today)
  const currentClosed = input.weeks.some(
    (week) => week.id === currentWeek && isActive(week) && week.closedAt !== null,
  )

  return {
    startBalanceCents,
    fromWeek: currentClosed ? addWeeksISO(currentWeek, 1) : currentWeek,
    baselineWeeklySavingCents: baselineWeeklySaving(summaries, fallbackCents, WHATIF_WINDOW_WEEKS),
    basisWeeks: closedWeekStarts.length,
    categories,
    budget,
  }
}

/** Slider positions (category id → cut per week) as adjustments, each within its category's range. */
export function toAdjustments(
  categories: readonly WhatIfCategory[],
  cuts: Readonly<Record<string, Cents>>,
): Adjustment[] {
  return categories.flatMap(({ categoryId, maxCents }) => {
    const cut = Math.min(Math.max(cuts[categoryId] ?? 0, 0), maxCents)
    return cut > 0 ? [{ categoryId, deltaCentsPerWeek: cut }] : []
  })
}

export interface BudgetChange {
  /** null = the weekly total. */
  categoryId: string | null
  /** null = the category had no limit before. */
  fromCents: Cents | null
  toCents: Cents
}

export interface ScenarioBudget {
  totalLimitCents: Cents
  categoryLimits: Record<string, Cents>
  /** Total first, then the categories in the order of the adjustments. */
  changes: BudgetChange[]
}

/**
 * The scenario as a budget: the total drops by all cuts together, each cut category gets a limit
 * that is lower by its cut – from its limit, or, without one, from what it costs on average
 * (rounded to the slider step). Nothing drops below zero. Null without a budget or without cuts.
 */
export function budgetFromScenario(
  budget: ResolvedBudget | null,
  categories: readonly WhatIfCategory[],
  adjustments: readonly Adjustment[],
): ScenarioBudget | null {
  const cuts = adjustments.filter((adjustment) => adjustment.deltaCentsPerWeek > 0)
  if (!budget || cuts.length === 0) return null

  const byId = new Map(categories.map((category) => [category.categoryId, category]))
  const categoryLimits = { ...budget.categoryLimits }
  const categoryChanges: BudgetChange[] = []
  let totalCut = 0
  for (const { categoryId, deltaCentsPerWeek } of cuts) {
    totalCut += deltaCentsPerWeek
    const fromCents = budget.categoryLimits[categoryId] ?? null
    const reference = fromCents ?? roundToBudgetStep(byId.get(categoryId)?.averageCents ?? 0)
    const toCents = Math.max(0, reference - deltaCentsPerWeek)
    categoryLimits[categoryId] = toCents
    categoryChanges.push({ categoryId, fromCents, toCents })
  }
  const totalLimitCents = Math.max(0, budget.totalLimitCents - totalCut)

  return {
    totalLimitCents,
    categoryLimits,
    changes: [
      { categoryId: null, fromCents: budget.totalLimitCents, toCents: totalLimitCents },
      ...categoryChanges,
    ],
  }
}

/** The target date: a horizon in months from today, or a picked day – never before today. */
export function horizonUntil(today: ISODate, horizon: number | ISODate): ISODate {
  return typeof horizon === 'number' ? addMonthsClamped(today, horizon) : maxISO(horizon, today)
}
