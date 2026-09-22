import { toast } from 'sonner'
import { repos } from '@/db'
import type { Task } from '@/lib/types'
import { errorMessage } from '@/shared/lib/errorMessages'

const undo = (work: () => Promise<void>) => ({
  label: 'Rückgängig',
  onClick: () => {
    work().catch((error) => toast.error(errorMessage(error)))
  },
})

/** Ticks a task off and offers "Rückgängig" – no confirmation, as everywhere in the app. */
export async function completeTaskWithUndo(task: Task): Promise<void> {
  try {
    await repos.tasks.setDone(task.id, true)
    toast(`„${task.title}" erledigt`, { action: undo(() => repos.tasks.setDone(task.id, false)) })
  } catch (error) {
    toast.error(errorMessage(error))
  }
}

/** Soft-deletes and offers "Rückgängig". */
export async function deleteTaskWithUndo(task: Task): Promise<void> {
  try {
    await repos.tasks.remove(task.id)
    toast(`„${task.title}" gelöscht`, { action: undo(() => repos.tasks.restore(task.id)) })
  } catch (error) {
    toast.error(errorMessage(error))
  }
}
