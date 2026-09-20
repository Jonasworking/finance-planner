import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { db, loadExpenseFormData, repos } from '@/db'
import { centsToAmountInput } from '@/lib/amountInput'
import { isActive } from '@/lib/types'
import { ResponsiveSheet } from '@/shared/components/ResponsiveSheet'
import { useToday } from '@/shared/hooks/useToday'
import { errorMessage } from '@/shared/lib/errorMessages'
import { useUiStore } from '@/shared/stores/uiStore'
import { ExpenseForm, type ExpenseFormResult } from './ExpenseForm'
import { deleteExpenseWithUndo } from './deleteExpenseWithUndo'

export function EditExpenseSheet() {
  const expenseId = useUiStore((state) => state.editingExpenseId)
  const open = useUiStore((state) => state.editOpen)
  const session = useUiStore((state) => state.editSession)
  const close = useUiStore((state) => state.closeExpense)
  const today = useToday()

  // The result names the id it belongs to: after switching expenses the hook may briefly still
  // hold the previous answer, and a stale "not found" must not close the freshly opened sheet.
  const result = useLiveQuery(async () => {
    if (expenseId === null) return null
    const [expense, form] = await Promise.all([db.expenses.get(expenseId), loadExpenseFormData(db)])
    if (!expense || !isActive(expense)) return { expenseId, found: null }
    // An archived category stays selectable for the expense that already uses it.
    const own = await db.categories.get(expense.categoryId)
    const categories =
      own && !form.categories.some((category) => category.id === own.id)
        ? [...form.categories, own]
        : form.categories
    // The same goes for an archived pot that paid for it.
    const ownPot = expense.fundedByPotId ? await db.pots.get(expense.fundedByPotId) : undefined
    const pots =
      ownPot && isActive(ownPot) && !form.pots.some((pot) => pot.id === ownPot.id)
        ? [...form.pots, ownPot]
        : form.pots
    return {
      expenseId,
      found: {
        expense,
        categories,
        pots,
        potBalances: form.potBalances,
        tagVocabulary: form.tagVocabulary,
      },
    }
  }, [expenseId])

  const current = result && result.expenseId === expenseId ? result : undefined
  const data = current?.found ?? null
  const gone = current !== undefined && current.found === null

  // The expense vanished (e.g. deleted while the sheet was opening): never leave an empty modal
  // behind – it would block everything underneath, including the undo toast.
  useEffect(() => {
    if (open && gone) close()
  }, [open, gone, close])

  const save = async (values: ExpenseFormResult) => {
    if (!data) return
    try {
      await repos.expenses.update(data.expense.id, values)
      close()
      toast.success('Änderung gespeichert')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(next) => !next && close()}
      title="Ausgabe bearbeiten"
    >
      {data ? (
        // Keyed per opening, so reopening the same expense starts from its stored values.
        <ExpenseForm
          key={`${data.expense.id}-${session}`}
          initial={{
            amountInput: centsToAmountInput(data.expense.amountCents),
            categoryId: data.expense.categoryId,
            date: data.expense.date,
            note: data.expense.note ?? '',
            tags: data.expense.tags,
            fundedByPotId: data.expense.fundedByPotId ?? null,
          }}
          categories={data.categories}
          tagVocabulary={data.tagVocabulary}
          pots={data.pots}
          potBalances={data.potBalances}
          existing={data.expense}
          today={today}
          submitLabel="Änderung speichern"
          onSubmit={save}
          onDelete={() => {
            close()
            void deleteExpenseWithUndo(data.expense)
          }}
        />
      ) : null}
    </ResponsiveSheet>
  )
}
