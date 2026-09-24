import { ChevronRight } from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { repos } from '@/db'
import { summarizePot } from '@/lib/pots'
import type { DashboardTasks } from '@/lib/tasks'
import type { ISODate, Pot, PotTransaction, Task } from '@/lib/types'
import { GlassCard } from '@/shared/components/GlassCard'
import { errorMessage } from '@/shared/lib/errorMessages'
import { spring } from '@/shared/motion'
import { useUiStore } from '@/shared/stores/uiStore'
import { completeTaskWithUndo } from '../taskActions'
import { TaskRow } from './TaskRow'

export interface TasksCardProps {
  widget: DashboardTasks
  pots: readonly Pot[]
  potTransactions: readonly PotTransaction[]
  today: ISODate
}

/**
 * Home-screen widget: the next open tasks, overdue ones first. Rendered only with open tasks –
 * an empty list would say nothing (the "Mehr" page leads to the tasks screen anyway).
 */
export function TasksCard({ widget, pots, potTransactions, today }: TasksCardProps) {
  const openTask = useUiStore((state) => state.openTask)
  const potById = new Map(pots.map((pot) => [pot.id, pot]))
  const remaining = widget.openCount - widget.tasks.length

  const toggle = (task: Task, done: boolean) => {
    if (done) return void completeTaskWithUndo(task)
    repos.tasks.setDone(task.id, false).catch((error) => toast.error(errorMessage(error)))
  }

  return (
    <section className="flex flex-col gap-2" aria-label="Tasks">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h2 className="flex items-baseline gap-2 text-caption text-fg-subtle uppercase">
          Tasks
          {widget.overdueCount > 0 ? (
            <span className="rounded-full bg-spent-soft px-2 py-0.5 text-caption font-medium text-spent normal-case">
              {widget.overdueCount === 1 ? '1 überfällig' : `${widget.overdueCount} überfällig`}
            </span>
          ) : null}
        </h2>
        <Link
          to="/tasks"
          className="flex items-center gap-0.5 rounded-sm text-label text-fg-muted outline-none hover:text-fg focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Alle
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
      <GlassCard padded={false} className="divide-y divide-border overflow-hidden">
        <AnimatePresence initial={false}>
          {widget.tasks.map((task) => {
            const pot = task.linkedPotId ? potById.get(task.linkedPotId) : undefined
            return (
              <m.div
                key={task.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={spring.soft}
              >
                <TaskRow
                  task={task}
                  today={today}
                  pot={pot ? summarizePot(pot, potTransactions, today) : null}
                  onToggle={toggle}
                  onOpen={(row) => openTask(row.id)}
                  compact
                />
              </m.div>
            )
          })}
        </AnimatePresence>
        {remaining > 0 ? (
          <Link
            to="/tasks"
            className="block px-4 py-2.5 text-label text-fg-muted outline-none hover:text-fg focus-visible:bg-surface-3/60"
          >
            {remaining === 1 ? '1 weiterer Task' : `${remaining} weitere Tasks`}
          </Link>
        ) : null}
      </GlassCard>
    </section>
  )
}
