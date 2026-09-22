import { CircleAlert, PiggyBank } from 'lucide-react'
import { Link } from 'react-router'
import { formatAUD } from '@/lib/money'
import type { PotSummary } from '@/lib/pots'
import { describeDone, describeDue, dueState, isOverdue } from '@/lib/tasks'
import type { ISODate, Task } from '@/lib/types'
import { ProgressBar } from '@/shared/components/ProgressBar'
import { SwipeRow } from '@/shared/components/SwipeRow'
import { potPath } from '@/shared/lib/routes'
import { cn } from '@/shared/lib/utils'
import { dueTone } from '../taskCopy'
import { TaskCheck } from './TaskCheck'

export interface TaskRowProps {
  task: Task
  today: ISODate
  /** The linked pot with its progress – null when the task has none (or it no longer exists). */
  pot: PotSummary | null
  onToggle: (task: Task, done: boolean) => void
  onOpen: (task: Task) => void
  /** Swipe-to-delete; the dashboard widget leaves it out. */
  onDelete?: (task: Task) => void
  /** Dashboard: one meta line, no pot progress bar. */
  compact?: boolean
}

/** One task: tick, title with due/category line, optional pot reference with progress. */
export function TaskRow({ task, today, pot, onToggle, onOpen, onDelete, compact }: TaskRowProps) {
  const overdue = isOverdue(task, today)
  const state = task.done ? 'none' : dueState(task.dueDate, today)
  const due = task.done
    ? task.doneAt !== null
      ? describeDone(task.doneAt, today)
      : null
    : describeDue(task.dueDate, today)

  const content = (
    <div
      className={cn(
        'flex items-stretch gap-1 border-l-[3px] pr-4 pl-1',
        overdue ? 'border-spent' : 'border-transparent',
      )}
    >
      <TaskCheck
        checked={task.done}
        label={task.done ? `„${task.title}" wieder öffnen` : `„${task.title}" erledigen`}
        onChange={(done) => onToggle(task, done)}
        className="self-center"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <button
          type="button"
          onClick={() => onOpen(task)}
          className="flex min-h-14 w-full flex-col justify-center py-2 text-left outline-none focus-visible:bg-surface-3/60"
        >
          <span
            className={cn(
              'block truncate transition-colors',
              task.done && 'text-fg-muted line-through decoration-fg-subtle',
            )}
          >
            {task.title}
          </span>
          <span className="flex min-w-0 items-center gap-1.5 text-label">
            {due ? (
              <span className={cn('flex min-w-0 items-center gap-1', dueTone[state])}>
                {overdue ? <CircleAlert className="size-3.5 shrink-0" aria-hidden /> : null}
                <span className="truncate">{due}</span>
              </span>
            ) : null}
            {due ? <span className="text-fg-subtle">·</span> : null}
            <span className="truncate text-fg-muted">{task.category}</span>
            {compact && pot ? (
              <>
                <span className="text-fg-subtle">·</span>
                <span className="flex min-w-0 items-center gap-1 text-fg-muted">
                  <PiggyBank className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{pot.pot.name}</span>
                </span>
              </>
            ) : null}
          </span>
        </button>

        {/* The pot is a reference: it shows where the pot stands, nothing is booked from a task. */}
        {!compact && pot ? (
          <Link
            to={potPath(pot.pot.id)}
            aria-label={`Topf ${pot.pot.name}`}
            className="mb-3 flex flex-col gap-1.5 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="flex items-center gap-1.5 text-label text-fg-muted">
              <PiggyBank className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{pot.pot.name}</span>
              <span className="ml-auto shrink-0 tabular-nums">
                {pot.pot.targetCents === null
                  ? formatAUD(pot.balanceCents, { decimals: false })
                  : `${formatAUD(pot.balanceCents, { decimals: false })} von ${formatAUD(pot.pot.targetCents, { decimals: false })}`}
              </span>
            </span>
            {pot.progress !== null ? (
              <ProgressBar value={pot.progress} label={`${pot.pot.name}: Ziel erreicht zu`} />
            ) : null}
          </Link>
        ) : null}
      </div>
    </div>
  )

  if (!onDelete) return content
  return (
    <SwipeRow onDelete={() => onDelete(task)} deleteLabel={`${task.title} löschen`}>
      {content}
    </SwipeRow>
  )
}
