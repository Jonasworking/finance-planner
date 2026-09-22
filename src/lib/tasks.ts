import { daysBetween, dayOfTimestamp, formatDayLabel } from './dates'
import { isActive, type ISODate, type Task, type TaskCategory } from './types'

export const TASK_CATEGORIES: readonly TaskCategory[] = ['Finanzen', 'Behörden', 'Sonstiges']

/** How urgent a due date is, seen from today. 'soon' = within the next six days. */
export type DueState = 'overdue' | 'today' | 'soon' | 'later' | 'none'

export function dueState(dueDate: ISODate | null, today: ISODate): DueState {
  if (dueDate === null) return 'none'
  const days = daysBetween(today, dueDate)
  if (days < 0) return 'overdue'
  if (days === 0) return 'today'
  return days < 7 ? 'soon' : 'later'
}

/** Only an OPEN task can be overdue – a task finished late is simply done. */
export const isOverdue = (task: Pick<Task, 'dueDate' | 'done'>, today: ISODate): boolean =>
  !task.done && dueState(task.dueDate, today) === 'overdue'

/**
 * Open tasks: the ones with a due date first (soonest first – so overdue ones lead), then the
 * undated ones, newest first. Done tasks: most recently finished first.
 */
export function sortTasks(tasks: readonly Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    if (a.done) return (b.doneAt ?? b.updatedAt) - (a.doneAt ?? a.updatedAt)
    if (a.dueDate !== null && b.dueDate !== null && a.dueDate !== b.dueDate) {
      return a.dueDate < b.dueDate ? -1 : 1
    }
    if ((a.dueDate === null) !== (b.dueDate === null)) return a.dueDate === null ? 1 : -1
    // Rows created in the same millisecond still need a fixed order (the id is random).
    return b.createdAt - a.createdAt || a.id.localeCompare(b.id)
  })
}

export interface TaskOverview {
  open: Task[]
  done: Task[]
  overdueCount: number
}

/** The tasks screen: live rows only, split and sorted. */
export function splitTasks(tasks: readonly Task[], today: ISODate): TaskOverview {
  const sorted = sortTasks(tasks.filter(isActive))
  const open = sorted.filter((task) => !task.done)
  return {
    open,
    done: sorted.filter((task) => task.done),
    overdueCount: open.filter((task) => isOverdue(task, today)).length,
  }
}

export interface DashboardTasks {
  /** At most `limit` open tasks in the order of `sortTasks` – overdue ones lead. */
  tasks: Task[]
  openCount: number
  overdueCount: number
}

/** The home-screen widget. With no open task there is nothing to show (the card is omitted). */
export function tasksForDashboard(
  tasks: readonly Task[],
  today: ISODate,
  limit = 3,
): DashboardTasks {
  const { open, overdueCount } = splitTasks(tasks, today)
  return { tasks: open.slice(0, limit), openCount: open.length, overdueCount }
}

/**
 * "Heute fällig", "Morgen fällig", "In 3 Tagen fällig", "Fällig am Mo., 5. Okt.", or for an
 * overdue task "Gestern fällig" / "Seit 3 Tagen überfällig". Null without a due date.
 */
export function describeDue(dueDate: ISODate | null, today: ISODate): string | null {
  if (dueDate === null) return null
  const days = daysBetween(today, dueDate)
  if (days === 0) return 'Heute fällig'
  if (days === 1) return 'Morgen fällig'
  if (days === -1) return 'Gestern fällig'
  if (days < 0) return `Seit ${-days} Tagen überfällig`
  if (days < 7) return `In ${days} Tagen fällig`
  return `Fällig am ${formatDayLabel(dueDate, today)}`
}

/** "Heute erledigt", "Gestern erledigt" or "Erledigt am Mo., 21. Sep.". */
export function describeDone(doneAt: number, today: ISODate): string {
  const day = dayOfTimestamp(doneAt)
  const label = formatDayLabel(day, today)
  return day === today || label === 'Gestern' ? `${label} erledigt` : `Erledigt am ${label}`
}
