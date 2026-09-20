import type { AnnouncedWarnings } from '@/lib/budget'
import type { ISODate } from '@/lib/types'

const KEY = 'fp.budgetWarnings'

/*
 * Which budget warnings were already shown this week. This is per-device UI state ("did I
 * already tell you?"), not financial data, so it lives in localStorage and not in the database –
 * it neither belongs in a backup nor should a second device stay quiet because of it.
 * Only the running week is kept; a new week starts with a clean slate.
 */

const isLevel = (value: unknown): value is AnnouncedWarnings[string] =>
  value === 'warn' || value === 'over'

export function readWarningLog(weekStart: ISODate): AnnouncedWarnings {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (typeof stored !== 'object' || stored === null) return {}
    const { week, announced } = stored as { week?: unknown; announced?: unknown }
    if (week !== weekStart || typeof announced !== 'object' || announced === null) return {}
    return Object.fromEntries(Object.entries(announced).filter(([, level]) => isLevel(level)))
  } catch {
    return {} // private mode or a broken entry: warn again rather than never
  }
}

export function writeWarningLog(weekStart: ISODate, announced: AnnouncedWarnings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ week: weekStart, announced }))
  } catch {
    // Storage unavailable – the warning may repeat, which beats losing it.
  }
}
