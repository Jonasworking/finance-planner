import { toast } from 'sonner'
import { repos } from '@/db'
import { formatAUD } from '@/lib/money'
import type { Expense } from '@/lib/types'
import { errorMessage } from '@/shared/lib/errorMessages'

/** Soft-deletes and offers "Rückgängig" – deleting never asks for confirmation up front. */
export async function deleteExpenseWithUndo(expense: Expense): Promise<void> {
  try {
    await repos.expenses.remove(expense.id)
    toast(`${formatAUD(expense.amountCents)} gelöscht`, {
      action: {
        label: 'Rückgängig',
        onClick: () => {
          repos.expenses.restore(expense.id).catch((error) => toast.error(errorMessage(error)))
        },
      },
    })
  } catch (error) {
    toast.error(errorMessage(error))
  }
}
