import { useLiveQuery } from 'dexie-react-hooks'
import { toast } from 'sonner'
import { db, loadExpenseFormData, repos } from '@/db'
import { formatAUD } from '@/lib/money'
import { ResponsiveSheet } from '@/shared/components/ResponsiveSheet'
import { useToday } from '@/shared/hooks/useToday'
import { errorMessage } from '@/shared/lib/errorMessages'
import { useUiStore } from '@/shared/stores/uiStore'
import { Skeleton } from '@/shared/ui/skeleton'
import { ExpenseForm, type ExpenseFormResult } from './ExpenseForm'

/** Quick capture: FAB (or "N") → amount → category → save. Undo lives in the toast. */
export function QuickAddSheet() {
  const open = useUiStore((state) => state.quickAddOpen)
  const session = useUiStore((state) => state.quickAddSession)
  const setOpen = useUiStore((state) => state.setQuickAddOpen)
  const today = useToday()
  const data = useLiveQuery(() => loadExpenseFormData(db), [])

  const save = async (result: ExpenseFormResult) => {
    try {
      const expense = await repos.expenses.add(result)
      setOpen(false)
      const category = data?.categories.find((row) => row.id === result.categoryId)
      toast.success(
        `${formatAUD(expense.amountCents)} · ${category?.name ?? 'Ausgabe'} gespeichert`,
        {
          action: { label: 'Rückgängig', onClick: () => void repos.expenses.remove(expense.id) },
        },
      )
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <ResponsiveSheet open={open} onOpenChange={setOpen} title="Neue Ausgabe">
      {data ? (
        // Remounting per opening resets the form (on open, not on close – no flicker while closing).
        <ExpenseForm
          key={session}
          initial={{ amountInput: '', categoryId: null, date: today, note: '', tags: [] }}
          categories={data.categories}
          tagVocabulary={data.tagVocabulary}
          today={today}
          submitLabel="Speichern"
          onSubmit={save}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <Skeleton className="mx-auto h-12 w-40" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-60 w-full" />
        </div>
      )}
    </ResponsiveSheet>
  )
}
