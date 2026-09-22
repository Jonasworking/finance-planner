import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'motion/react'
import { ListChecks, Plus } from 'lucide-react'
import { useState } from 'react'
import { db, loadTasks, repos } from '@/db'
import { summarizePots } from '@/lib/pots'
import { splitTasks } from '@/lib/tasks'
import type { Task } from '@/lib/types'
import { GlassCard } from '@/shared/components/GlassCard'
import { Page } from '@/shared/components/Page'
import { useToday } from '@/shared/hooks/useToday'
import { errorMessage } from '@/shared/lib/errorMessages'
import { spring } from '@/shared/motion'
import { useUiStore } from '@/shared/stores/uiStore'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'
import { toast } from 'sonner'
import { TaskRow } from './components/TaskRow'
import { completeTaskWithUndo, deleteTaskWithUndo } from './taskActions'
import { openCountLabel } from './taskCopy'

const DONE_PREVIEW = 5

export function TasksPage() {
  const today = useToday()
  const data = useLiveQuery(() => loadTasks(db), [])
  const openTask = useUiStore((state) => state.openTask)
  const [allDone, setAllDone] = useState(false)

  const overview = data ? splitTasks(data.tasks, today) : undefined
  // Archived pots included: a task may still point at one, and its progress is history.
  const pots = data ? summarizePots(data.pots, data.transactions, today) : undefined
  const potById = new Map(
    [...(pots?.active ?? []), ...(pots?.archived ?? [])].map((summary) => [
      summary.pot.id,
      summary,
    ]),
  )

  const toggle = (task: Task, done: boolean) => {
    if (done) return void completeTaskWithUndo(task)
    repos.tasks.setDone(task.id, false).catch((error) => toast.error(errorMessage(error)))
  }
  const rowProps = {
    today,
    onToggle: toggle,
    onOpen: (task: Task) => openTask(task.id),
    onDelete: (task: Task) => void deleteTaskWithUndo(task),
  }

  const list = (tasks: readonly Task[]) => (
    <GlassCard padded={false} className="divide-y divide-border overflow-hidden">
      <AnimatePresence initial={false}>
        {tasks.map((task) => (
          <motion.div
            key={task.id}
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={spring.soft}
          >
            <TaskRow
              task={task}
              pot={task.linkedPotId ? (potById.get(task.linkedPotId) ?? null) : null}
              {...rowProps}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </GlassCard>
  )

  return (
    <Page
      title="Tasks"
      subtitle={overview ? openCountLabel(overview.open.length, overview.overdueCount) : undefined}
      actions={
        <Button size="touch" onClick={() => openTask(null)}>
          <Plus aria-hidden />
          Neu
        </Button>
      }
    >
      {overview === undefined ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : overview.open.length === 0 && overview.done.length === 0 ? (
        <GlassCard className="flex flex-col items-start gap-3">
          <span className="grid size-12 place-items-center rounded-md bg-surface-3 text-fg-muted">
            <ListChecks className="size-6" aria-hidden />
          </span>
          <div>
            <p className="text-h2">Was steht an?</p>
            <p className="text-label text-fg-muted">
              Finanz-To-dos mit Fälligkeit: Steuernummer beantragen, Super prüfen, Miete überweisen.
              Überfällige Tasks stehen oben und auf dem Home-Screen. Ein Task kann auf einen
              Spartopf zeigen und dessen Stand anzeigen.
            </p>
          </div>
          <Button size="touch" variant="secondary" onClick={() => openTask(null)}>
            <Plus aria-hidden />
            Task anlegen
          </Button>
        </GlassCard>
      ) : (
        <div className="flex flex-col gap-6">
          {overview.open.length > 0 ? (
            list(overview.open)
          ) : (
            <GlassCard className="flex items-center gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-md bg-saved-soft text-saved">
                <ListChecks className="size-6" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-h2">Alles erledigt</p>
                <p className="text-label text-fg-muted">
                  Nichts Offenes – neue Tasks landen hier und auf dem Home-Screen.
                </p>
              </div>
            </GlassCard>
          )}

          {overview.done.length > 0 ? (
            <section className="flex flex-col gap-2" aria-label="Erledigt">
              <div className="flex items-baseline justify-between px-1">
                <h2 className="text-caption text-fg-subtle uppercase">Erledigt</h2>
                {overview.done.length > DONE_PREVIEW ? (
                  <button
                    type="button"
                    onClick={() => setAllDone((value) => !value)}
                    className="rounded-sm text-label text-fg-muted outline-none hover:text-fg focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {allDone ? 'Weniger anzeigen' : `Alle anzeigen (${overview.done.length})`}
                  </button>
                ) : null}
              </div>
              <div className="opacity-80">
                {list(allDone ? overview.done : overview.done.slice(0, DONE_PREVIEW))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </Page>
  )
}
