import { addDays, addMonths, differenceInCalendarDays, format, getDay, startOfWeek } from 'date-fns'
import { de } from 'date-fns/locale/de'
import type { ISODate } from './types'

/*
 * Calendar days are local 'YYYY-MM-DD' strings. This module is the only place that turns them
 * into Date objects. Dates are anchored at local NOON, so they stay on the right day even in
 * time zones whose DST switch happens at midnight, and all arithmetic is calendar-based
 * (never milliseconds), so weeks stay 7 days long across DST changes.
 */

/** Weeks start on Monday – fixed, because week starts are primary keys. */
export const WEEK_STARTS_ON = 1

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

function toDate(iso: ISODate): Date | null {
  const match = ISO_DATE.exec(iso)
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(year, month - 1, day, 12, 0, 0, 0)
  // Rejects overflow such as 2026-02-30 (which would silently become March 2nd).
  const valid =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  return valid ? date : null
}

export function isISODate(value: unknown): value is ISODate {
  return typeof value === 'string' && toDate(value) !== null
}

/** Parses a calendar day to a Date at local noon. Throws on anything that is not a real day. */
export function parseISODate(iso: ISODate): Date {
  const date = toDate(iso)
  if (!date) throw new RangeError(`Invalid calendar date: ${JSON.stringify(iso)}`)
  return date
}

/** The local calendar day of a Date (NOT the UTC day – never use toISOString for this). */
export function toISODate(date: Date): ISODate {
  return format(date, 'yyyy-MM-dd')
}

/** The local calendar day on which a stored timestamp (`createdAt`, `eurRateUpdatedAt` …) fell. */
export function dayOfTimestamp(timestamp: number): ISODate {
  return toISODate(new Date(timestamp))
}

export function addDaysISO(iso: ISODate, days: number): ISODate {
  return toISODate(addDays(parseISODate(iso), days))
}

export function addWeeksISO(iso: ISODate, weeks: number): ISODate {
  return addDaysISO(iso, weeks * 7)
}

/** `anchor` + `months`, clamped to the end of shorter months (Jan 31 + 1 → Feb 28/29). */
export function addMonthsClamped(anchor: ISODate, months: number): ISODate {
  return toISODate(addMonths(parseISODate(anchor), months))
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). DST-safe. */
export function daysBetween(from: ISODate, to: ISODate): number {
  return differenceInCalendarDays(parseISODate(to), parseISODate(from))
}

/** Monday of the week that contains `iso`. */
export function weekStartOf(iso: ISODate): ISODate {
  return toISODate(startOfWeek(parseISODate(iso), { weekStartsOn: WEEK_STARTS_ON }))
}

/** Sunday of the week that starts on `weekStart`. */
export function weekEndOf(weekStart: ISODate): ISODate {
  return addDaysISO(weekStart, 6)
}

export function isMonday(iso: ISODate): boolean {
  return isISODate(iso) && getDay(parseISODate(iso)) === 1
}

export function weekRange(weekStart: ISODate): { start: ISODate; end: ISODate } {
  return { start: weekStart, end: weekEndOf(weekStart) }
}

/** Week starts from `fromWeekStart` to `toWeekStart`, both inclusive. Empty when reversed. */
export function listWeeks(fromWeekStart: ISODate, toWeekStart: ISODate): ISODate[] {
  const count = Math.floor(daysBetween(fromWeekStart, toWeekStart) / 7)
  const weeks: ISODate[] = []
  for (let index = 0; index <= count; index++) weeks.push(addWeeksISO(fromWeekStart, index))
  return weeks
}

/**
 * Thursday rule (as in ISO week numbering): a week belongs to the month its Thursday falls in.
 * Monthly KPIs are sums of whole weeks, which keeps earned/spent/saved consistent with the
 * weekly view. Returns 'YYYY-MM'.
 */
export function monthOfWeek(weekStart: ISODate): string {
  return addDaysISO(weekStart, 3).slice(0, 7)
}

/** ISO strings sort chronologically, so plain comparison is enough. */
export const minISO = (a: ISODate, b: ISODate): ISODate => (a <= b ? a : b)
export const maxISO = (a: ISODate, b: ISODate): ISODate => (a >= b ? a : b)

/** "Heute", "Gestern", otherwise "Mo., 21. Sep." (with the year when it is not today's year). */
export function formatDayLabel(iso: ISODate, today: ISODate): string {
  if (iso === today) return 'Heute'
  if (iso === addDaysISO(today, -1)) return 'Gestern'
  const pattern = iso.slice(0, 4) === today.slice(0, 4) ? 'EEE, d. MMM' : 'EEE, d. MMM yyyy'
  return format(parseISODate(iso), pattern, { locale: de })
}

/** "21.–27. Sep. 2026", "28. Sep. – 4. Okt. 2026" or "28. Dez. 2026 – 3. Jan. 2027". */
export function formatWeekRange(weekStart: ISODate): string {
  const start = parseISODate(weekStart)
  const end = parseISODate(weekEndOf(weekStart))
  const last = format(end, 'd. MMM yyyy', { locale: de })
  if (start.getFullYear() !== end.getFullYear()) {
    return `${format(start, 'd. MMM yyyy', { locale: de })} – ${last}`
  }
  if (start.getMonth() !== end.getMonth())
    return `${format(start, 'd. MMM', { locale: de })} – ${last}`
  return `${format(start, 'd.', { locale: de })}–${last}`
}

/** Axis label of a week: its Monday as "21.9." */
export function formatWeekTick(weekStart: ISODate): string {
  return format(parseISODate(weekStart), 'd.M.')
}

/** 'YYYY-MM' → "Sep 26" (axis) or "September 2026". */
export function formatMonth(month: string, style: 'short' | 'long' = 'long'): string {
  const pattern = style === 'short' ? 'LLL yy' : 'LLLL yyyy'
  return format(parseISODate(`${month}-01`), pattern, { locale: de })
}
