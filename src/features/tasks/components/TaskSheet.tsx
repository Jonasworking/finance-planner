import { useLiveQuery } from 'dexie-react-hooks'
import { Trash2, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { db, loadTasks, repos } from '@/db'
import { addDaysISO } from '@/lib/dates'
import { TASK_CATEGORIES } from '@/lib/tasks'
import type { ISODate, Pot, Task, TaskCategory } from '@/lib/types'
import { CategoryIcon } from '@/shared/components/CategoryIcon'
import { ResponsiveSheet } from '@/shared/components/ResponsiveSheet'
import { SegmentedControl } from '@/shared/components/SegmentedControl'
import { useToday } from '@/shared/hooks/useToday'
import { errorMessage } from '@/shared/lib/errorMessages'
import { cn } from '@/shared/lib/utils'
import { useUiStore } from '@/shared/stores/uiStore'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { deleteTaskWithUndo } from '../taskActions'

const DUE_PRESETS = [
  { label: 'Heute', days: 0 },
  { label: 'Morgen', days: 1 },
  { label: 'In 7 Tagen', days: 7 },
] as const

interface TaskFormProps {
  /** null = a new task. */
  task: Task | null
  pots: readonly Pot[]
  today: ISODate
  onDone: () => void
}

function TaskForm({ task, pots, today, onDone }: TaskFormProps) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [dueDate, setDueDate] = useState<ISODate | null>(task?.dueDate ?? null)
  const [category, setCategory] = useState<TaskCategory>(task?.category ?? 'Finanzen')
  const [linkedPotId, setLinkedPotId] = useState<string | null>(task?.linkedPotId ?? null)
  const [note, setNote] = useState(task?.note ?? '')
  const [busy, setBusy] = useState(false)

  const valid = title.trim() !== ''
  // An archived pot stays selectable for the task that already points at it.
  const selectablePots = pots.filter((pot) => !pot.archived || pot.id === linkedPotId)

  const save = async () => {
    if (!valid || busy) return
    setBusy(true)
    const values = { title, dueDate, category, linkedPotId, note }
    try {
      if (task) {
        await repos.tasks.update(task.id, values)
        toast.success('Task gespeichert')
      } else {
        await repos.tasks.add(values)
        toast.success(`„${title.trim()}" angelegt`)
      }
      onDone()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void save()
        }}
        placeholder="Was steht an? (z. B. TFN beantragen)"
        aria-label="Titel"
        maxLength={80}
        enterKeyHint="done"
        autoFocus={task === null}
        className="h-11 rounded-md"
      />

      <div className="flex flex-col gap-2">
        <label htmlFor="task-due" className="text-caption text-fg-subtle uppercase">
          Fällig (optional)
        </label>
        <div className="grid grid-cols-3 gap-2">
          {DUE_PRESETS.map((preset) => {
            const value = addDaysISO(today, preset.days)
            const active = dueDate === value
            return (
              <Button
                key={preset.label}
                type="button"
                variant={active ? 'default' : 'secondary'}
                size="touch"
                aria-pressed={active}
                onClick={() => setDueDate(active ? null : value)}
                className="min-w-0 px-2"
              >
                {preset.label}
              </Button>
            )
          })}
        </div>
        <div className="flex gap-2">
          <Input
            id="task-due"
            type="date"
            value={dueDate ?? ''}
            aria-label="Fällig am"
            onChange={(event) => setDueDate(event.target.value === '' ? null : event.target.value)}
            className="h-11 min-w-0 flex-1 rounded-md"
          />
          {dueDate ? (
            <Button
              type="button"
              variant="secondary"
              size="icon-touch"
              onClick={() => setDueDate(null)}
              aria-label="Fälligkeit entfernen"
            >
              <X aria-hidden />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-caption text-fg-subtle uppercase">Kategorie</span>
        <SegmentedControl
          label="Kategorie"
          options={TASK_CATEGORIES.map((value) => ({ value, label: value }))}
          value={category}
          onChange={setCategory}
        />
      </div>

      {/* Only pots beyond "Nur gespart" are worth pointing at – with none, the row is left out. */}
      {selectablePots.length > 1 ? (
        <div className="flex flex-col gap-2">
          <span className="text-caption text-fg-subtle uppercase">Topf (optional)</span>
          <div role="radiogroup" aria-label="Topf" className="flex flex-wrap gap-2">
            <PotChip
              label="Kein Topf"
              selected={linkedPotId === null}
              onSelect={() => setLinkedPotId(null)}
            />
            {selectablePots.map((pot) => (
              <PotChip
                key={pot.id}
                label={pot.name}
                icon={<CategoryIcon icon={pot.icon} color={pot.color} size="sm" />}
                selected={linkedPotId === pot.id}
                onSelect={() => setLinkedPotId(pot.id)}
              />
            ))}
          </div>
          <span className="text-label text-fg-muted">
            Der Task zeigt den Stand des Topfs – gebucht wird dadurch nichts.
          </span>
        </div>
      ) : null}

      <Input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Notiz (optional)"
        aria-label="Notiz"
        maxLength={200}
        className="h-11 rounded-md"
      />

      <div className="flex gap-2">
        {task ? (
          <Button
            type="button"
            variant="destructive"
            size="icon-touch"
            aria-label="Task löschen"
            onClick={() => {
              onDone()
              void deleteTaskWithUndo(task)
            }}
          >
            <Trash2 aria-hidden />
          </Button>
        ) : null}
        <Button
          type="button"
          size="touch"
          className="flex-1"
          disabled={!valid || busy}
          onClick={() => void save()}
        >
          {task ? 'Speichern' : 'Task anlegen'}
        </Button>
      </div>
    </div>
  )
}

interface PotChipProps {
  label: string
  icon?: ReactNode
  selected: boolean
  onSelect: () => void
}

function PotChip({ label, icon, selected, onSelect }: PotChipProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex h-11 max-w-full items-center gap-2 rounded-md border px-3 text-label transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        selected
          ? 'border-saved bg-saved-soft text-fg'
          : 'border-border bg-surface-3 text-fg-muted hover:text-fg',
        icon ? 'pl-1.5' : undefined,
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  )
}

/**
 * Create/edit sheet for tasks, mounted once in the shell and opened via `uiStore.openTask`.
 * A vanished task closes the sheet – an empty modal would block the undo toast underneath.
 */
export function TaskSheet() {
  const taskId = useUiStore((state) => state.taskId)
  const open = useUiStore((state) => state.taskOpen)
  const session = useUiStore((state) => state.taskSession)
  const close = useUiStore((state) => state.closeTask)
  const today = useToday()

  // The result names the id it belongs to (see EditExpenseSheet): a stale "not found" from the
  // previous task must not close a sheet that was just opened for the next one.
  const result = useLiveQuery(async () => {
    const data = await loadTasks(db)
    const task = taskId === null ? null : (data.tasks.find((row) => row.id === taskId) ?? null)
    return { taskId, pots: data.pots, task, found: taskId === null || task !== null }
  }, [taskId])
  const current = result && result.taskId === taskId ? result : undefined

  useEffect(() => {
    if (open && current && !current.found) close()
  }, [open, current, close])

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(next) => !next && close()}
      title={taskId === null ? 'Neuer Task' : 'Task bearbeiten'}
      description={
        taskId === null
          ? 'Ein Finanz-To-do mit Fälligkeit – optional an einen Topf geknüpft.'
          : undefined
      }
    >
      {current?.found ? (
        <TaskForm
          key={`${taskId ?? 'new'}-${session}`}
          task={current.task}
          pots={current.pots}
          today={today}
          onDone={close}
        />
      ) : null}
    </ResponsiveSheet>
  )
}
