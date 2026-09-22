import { categoryAverages } from './analytics'
import type { BudgetUsage } from './budget'
import { addWeeksISO, listWeeks, monthOfWeek } from './dates'
import { expensesInWeek, isBudgetRelevant } from './expenses'
import { deadlineDelta, forecastPot, requiredWeeklyForDeadline, weeklyPace } from './forecast'
import { potBalances, type WeekSummary } from './savings'
import type { Streak } from './streak'
import {
  isActive,
  type Cents,
  type Expense,
  type ISODate,
  type Pot,
  type PotTransaction,
  type Settings,
} from './types'

const DAY_MS = 86_400_000

export type InsightSeverity = 'positive' | 'info' | 'warning'

/** Structured on purpose: the UI (phase 5) turns `kind` + data into German copy. */
export type InsightData =
  | { kind: 'budget-over'; overCents: Cents }
  | { kind: 'budget-warn'; remainingCents: Cents; ratio: number }
  | { kind: 'pending-weeks'; count: number; oldest: ISODate }
  | {
      kind: 'category-over-average'
      categoryId: string
      currentCents: Cents
      averageCents: Cents
      overRatio: number
    }
  | { kind: 'pot-ahead'; potId: string; weeks: number }
  | { kind: 'pot-behind'; potId: string; weeks: number | null; requiredWeeklyCents: Cents | null }
  | { kind: 'streak-milestone'; weeks: number }
  | { kind: 'savings-rate'; direction: 'up' | 'down'; rate: number; averageRate: number }
  | { kind: 'backup-stale'; days: number | null }
  | { kind: 'eur-rate-stale'; days: number }

export type Insight = InsightData & {
  /** Stable per occurrence, so a dismissed insight stays dismissed but can return next week. */
  id: string
  severity: InsightSeverity
  priority: number
}

export interface InsightContext {
  today: ISODate
  now: number
  currentWeek: WeekSummary
  /** Summaries of other weeks (open or closed), any order. */
  history: readonly WeekSummary[]
  currentUsage: BudgetUsage | null
  expenses: readonly Expense[]
  pots: readonly Pot[]
  potTransactions: readonly PotTransaction[]
  streak: Streak
  pendingWeeks: readonly ISODate[]
  settings: Settings
}

export type InsightRule = (context: InsightContext) => Insight[]

const CATEGORY_WINDOW_WEEKS = 8
const CATEGORY_MIN_AVERAGE_CENTS = 1_000
const CATEGORY_OVER_RATIO = 0.2
const STREAK_MILESTONES = [3, 5, 10, 15, 20, 26, 39, 52]
const SAVINGS_RATE_DELTA = 0.1
const BACKUP_STALE_DAYS = 14
const EUR_RATE_STALE_DAYS = 30

export const budgetRule: InsightRule = ({ currentUsage, currentWeek }) => {
  const total = currentUsage?.total
  if (!total || total.limitCents === null || total.remainingCents === null) return []
  if (total.level === 'over') {
    return [
      {
        kind: 'budget-over',
        id: `budget-over:${currentWeek.weekStart}`,
        severity: 'warning',
        priority: 100,
        overCents: -total.remainingCents,
      },
    ]
  }
  if (total.level === 'warn') {
    return [
      {
        kind: 'budget-warn',
        id: `budget-warn:${currentWeek.weekStart}`,
        severity: 'warning',
        priority: 80,
        remainingCents: total.remainingCents,
        ratio: total.ratio,
      },
    ]
  }
  return []
}

export const pendingWeeksRule: InsightRule = ({ pendingWeeks }) => {
  const oldest = pendingWeeks[0]
  if (!oldest) return []
  return [
    {
      kind: 'pending-weeks',
      id: `pending-weeks:${oldest}:${pendingWeeks.length}`,
      severity: 'info',
      priority: 90,
      count: pendingWeeks.length,
      oldest,
    },
  ]
}

/** "Essen liegt 30 % über deinem Schnitt" – the category with the largest excess this week. */
export const categoryOverAverageRule: InsightRule = ({ currentWeek, expenses }) => {
  const { weekStart } = currentWeek
  const window = listWeeks(
    addWeeksISO(weekStart, -CATEGORY_WINDOW_WEEKS),
    addWeeksISO(weekStart, -1),
  )
  const earliest = expenses.reduce<ISODate | null>(
    (min, expense) =>
      isActive(expense) && (min === null || expense.date < min) ? expense.date : min,
    null,
  )
  // Only average over weeks that are actually on record.
  const recorded = window.filter((week) => earliest !== null && addWeeksISO(week, 1) > earliest)
  if (recorded.length < 2) return []

  const averages = categoryAverages(expenses, recorded)
  const current = new Map<string, Cents>()
  for (const expense of expensesInWeek(expenses, weekStart)) {
    if (!isBudgetRelevant(expense)) continue
    current.set(expense.categoryId, (current.get(expense.categoryId) ?? 0) + expense.amountCents)
  }

  let worst: Insight | null = null
  let worstExcess = 0
  for (const [categoryId, currentCents] of current) {
    const averageCents = averages[categoryId] ?? 0
    if (averageCents < CATEGORY_MIN_AVERAGE_CENTS) continue
    const overRatio = currentCents / averageCents - 1
    const excess = currentCents - averageCents
    if (overRatio < CATEGORY_OVER_RATIO || excess <= worstExcess) continue
    worstExcess = excess
    worst = {
      kind: 'category-over-average',
      id: `category:${categoryId}:${weekStart}`,
      severity: 'warning',
      priority: 70,
      categoryId,
      currentCents,
      averageCents,
      overRatio,
    }
  }
  return worst ? [worst] : []
}

/** "Du bist 2 Wochen vor deinem Ziel" / behind it, for pots with target and deadline. */
export const potDeadlineRule: InsightRule = ({ pots, potTransactions, today, currentWeek }) => {
  const balances = potBalances(potTransactions)
  const insights: Insight[] = []
  for (const pot of pots) {
    if (!isActive(pot) || pot.archived || pot.targetCents === null || pot.deadline === null)
      continue
    const balanceCents = balances[pot.id] ?? 0
    if (balanceCents >= pot.targetCents) continue

    const paceCentsPerWeek = weeklyPace(potTransactions, pot.id, today)
    const { eta } = forecastPot({
      balanceCents,
      targetCents: pot.targetCents,
      paceCentsPerWeek,
      today,
    })
    const weeks = deadlineDelta(eta, pot.deadline)
    const id = `pot:${pot.id}:${currentWeek.weekStart}`

    if (weeks !== null && weeks >= 1) {
      insights.push({
        kind: 'pot-ahead',
        id,
        severity: 'positive',
        priority: 50,
        potId: pot.id,
        weeks,
      })
    } else if (weeks === null || weeks <= -1) {
      insights.push({
        kind: 'pot-behind',
        id,
        severity: 'warning',
        priority: 60,
        potId: pot.id,
        weeks: weeks === null ? null : -weeks,
        requiredWeeklyCents: requiredWeeklyForDeadline({
          balanceCents,
          targetCents: pot.targetCents,
          deadline: pot.deadline,
          today,
        }),
      })
    }
  }
  return insights
}

export const streakMilestoneRule: InsightRule = ({ streak }) =>
  !streak.stale && STREAK_MILESTONES.includes(streak.current)
    ? [
        {
          kind: 'streak-milestone',
          id: `streak:${streak.current}`,
          severity: 'positive',
          priority: 40,
          weeks: streak.current,
        },
      ]
    : []

/** Latest closed week vs. the average of up to 8 closed weeks before it (needs 3 for a baseline). */
export const savingsRateRule: InsightRule = ({ currentWeek, history }) => {
  const closed = [currentWeek, ...history]
    .filter((summary) => summary.closed && summary.incomeCents > 0)
    .sort((a, b) => (a.weekStart < b.weekStart ? 1 : a.weekStart > b.weekStart ? -1 : 0))
  const [latest, ...earlier] = closed
  const baseline = earlier.slice(0, 8)
  if (!latest || baseline.length < 3) return []

  const averageRate =
    baseline.reduce((sum, summary) => sum + summary.savingsRate, 0) / baseline.length
  const delta = latest.savingsRate - averageRate
  if (Math.abs(delta) < SAVINGS_RATE_DELTA) return []
  return [
    {
      kind: 'savings-rate',
      id: `savings-rate:${latest.weekStart}`,
      severity: delta > 0 ? 'positive' : 'warning',
      priority: 30,
      direction: delta > 0 ? 'up' : 'down',
      rate: latest.savingsRate,
      averageRate,
    },
  ]
}

/** Data lives only on this device – nag (once per week) when the last backup is old. */
export const backupStaleRule: InsightRule = ({ settings, expenses, now, currentWeek }) => {
  const firstEntry = expenses.reduce<number | null>(
    (min, expense) => (min === null || expense.createdAt < min ? expense.createdAt : min),
    null,
  )
  if (firstEntry === null) return []
  const since = settings.lastBackupAt ?? firstEntry
  const days = Math.floor((now - since) / DAY_MS)
  if (days < BACKUP_STALE_DAYS) return []
  return [
    {
      kind: 'backup-stale',
      id: `backup:${currentWeek.weekStart}`,
      severity: 'warning',
      priority: 65,
      days: settings.lastBackupAt === null ? null : days,
    },
  ]
}

export const eurRateStaleRule: InsightRule = ({ settings, now, currentWeek }) => {
  if (!settings.showEur || settings.eurRate === null || settings.eurRateUpdatedAt === null)
    return []
  const days = Math.floor((now - settings.eurRateUpdatedAt) / DAY_MS)
  if (days < EUR_RATE_STALE_DAYS) return []
  return [
    {
      kind: 'eur-rate-stale',
      id: `eur-rate:${monthOfWeek(currentWeek.weekStart)}`,
      severity: 'info',
      priority: 20,
      days,
    },
  ]
}

export const defaultRules: InsightRule[] = [
  budgetRule,
  pendingWeeksRule,
  categoryOverAverageRule,
  backupStaleRule,
  potDeadlineRule,
  streakMilestoneRule,
  savingsRateRule,
  eurRateStaleRule,
]

/**
 * What the home screen shows as insight cards. Pending weeks are already THE next step there
 * (a second card would nag twice), and the backup reminder gets its card together with the
 * export in phase 6 – until then a reminder without a way to act on it would only annoy.
 */
export const dashboardRules: InsightRule[] = defaultRules.filter(
  (rule) => rule !== pendingWeeksRule && rule !== backupStaleRule,
)

/** Runs all rules and keeps the `max` most important insights that were not dismissed. */
export function runInsights(
  context: InsightContext,
  options: { rules?: readonly InsightRule[]; max?: number; dismissed?: ReadonlySet<string> } = {},
): Insight[] {
  const { rules = defaultRules, max = 3, dismissed } = options
  return rules
    .flatMap((rule) => rule(context))
    .filter((insight) => !dismissed?.has(insight.id))
    .sort((a, b) => b.priority - a.priority || (a.id < b.id ? -1 : 1))
    .slice(0, max)
}
