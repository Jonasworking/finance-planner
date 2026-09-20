import { addDaysISO, addMonthsClamped, daysBetween, maxISO, minISO, parseISODate } from './dates'
import type { ISODate, RecurringExpense } from './types'

type Schedule = Pick<RecurringExpense, 'interval' | 'anchorDate' | 'endDate' | 'active'>

const MAX_OCCURRENCES = 5000

/**
 * Due dates in (`afterExclusive`, `untilInclusive`], never before the anchor or after the end
 * date. Always derived from the ANCHOR (never from the previous occurrence or the watermark):
 * a monthly rule anchored on the 31st yields Feb 28 and then Mar 31 again, and a fortnightly
 * rule keeps its rhythm no matter when it was last materialised.
 */
export function dueDates(
  schedule: Schedule,
  afterExclusive: ISODate | null,
  untilInclusive: ISODate,
): ISODate[] {
  if (!schedule.active) return []

  const end = schedule.endDate ? minISO(untilInclusive, schedule.endDate) : untilInclusive
  const start = afterExclusive
    ? maxISO(schedule.anchorDate, addDaysISO(afterExclusive, 1))
    : schedule.anchorDate
  if (start > end) return []

  const dates: ISODate[] = []

  if (schedule.interval === 'monthly') {
    // Rough lower bound in months, then walk forward; clamping makes exact math unreliable.
    const firstIndex = Math.max(0, Math.floor(daysBetween(schedule.anchorDate, start) / 31) - 1)
    for (let index = firstIndex; index < firstIndex + MAX_OCCURRENCES; index++) {
      const date = addMonthsClamped(schedule.anchorDate, index)
      if (date > end) break
      if (date >= start) dates.push(date)
    }
    return dates
  }

  const step = schedule.interval === 'weekly' ? 7 : 14
  const firstIndex = Math.max(0, Math.ceil(daysBetween(schedule.anchorDate, start) / step))
  for (let index = firstIndex; index < firstIndex + MAX_OCCURRENCES; index++) {
    const date = addDaysISO(schedule.anchorDate, index * step)
    if (date > end) break
    dates.push(date)
  }
  return dates
}

/** First due date on or after `today`, or null when the rule is inactive or has ended. */
export function nextDueDate(schedule: Schedule, today: ISODate): ISODate | null {
  const horizon = addDaysISO(maxISO(today, schedule.anchorDate), 62)
  return dueDates(schedule, addDaysISO(today, -1), horizon)[0] ?? null
}

export interface MaterializationPlan {
  /** Instances to create (the repo skips ids that already exist, including tombstones). */
  dates: ISODate[]
  /** New watermark, or null when nothing should change. */
  nextWatermark: ISODate | null
}

/**
 * What the materialiser should generate for a template up to `today`.
 * - A fresh template (no watermark) back-fills from its anchor.
 * - `today` before the watermark (device clock / time-zone travel) is a no-op.
 */
export function planMaterialization(
  template: Pick<
    RecurringExpense,
    'interval' | 'anchorDate' | 'endDate' | 'active' | 'lastGeneratedDate' | 'deletedAt'
  >,
  today: ISODate,
): MaterializationPlan {
  const none: MaterializationPlan = { dates: [], nextWatermark: null }
  if (!template.active || template.deletedAt !== null) return none
  if (template.lastGeneratedDate && today <= template.lastGeneratedDate) return none
  return { dates: dueDates(template, template.lastGeneratedDate, today), nextWatermark: today }
}

const WEEKDAYS_DATIVE = [
  'sonntags',
  'montags',
  'dienstags',
  'mittwochs',
  'donnerstags',
  'freitags',
  'samstags',
]

/** Human rhythm of a rule: "Wöchentlich, freitags" · "Alle 2 Wochen, freitags" · "Monatlich am 31." */
export function describeRecurrence(schedule: Pick<Schedule, 'interval' | 'anchorDate'>): string {
  const anchor = parseISODate(schedule.anchorDate)
  if (schedule.interval === 'monthly') {
    const day = anchor.getDate()
    // Days 29–31 do not exist in every month; the rule then falls on the month's last day.
    return day > 28 ? `Monatlich am ${day}. (sonst Monatsende)` : `Monatlich am ${day}.`
  }
  const weekday = WEEKDAYS_DATIVE[anchor.getDay()]!
  return schedule.interval === 'weekly' ? `Wöchentlich, ${weekday}` : `Alle 2 Wochen, ${weekday}`
}
