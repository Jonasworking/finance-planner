import { toast } from 'sonner'
import { repos } from '@/db'
import { displayMerchant } from '@/lib/merchantRules'
import type { BankTransaction, Category, Expense } from '@/lib/types'
import { errorMessage } from '@/shared/lib/errorMessages'

const undo = (work: () => Promise<void>) => ({
  label: 'Rückgängig',
  onClick: () => {
    work().catch((error) => toast.error(errorMessage(error)))
  },
})

const run = async (work: () => Promise<void>) => {
  try {
    await work()
  } catch (error) {
    toast.error(errorMessage(error))
  }
}

/** Inbox line → new expense. Nothing asks beforehand; the toast takes it back. */
export const assignWithUndo = (tx: BankTransaction, category: Category) =>
  run(async () => {
    const { rule } = await repos.bank.assign(tx.id, category.id)
    toast(`${displayMerchant(tx.description)} → ${category.name}`, {
      action: undo(() => repos.bank.undoAssign(tx.id, rule)),
    })
  })

/** "Ist dieselbe": the line belongs to an expense that was entered by hand. */
export const linkWithUndo = (tx: BankTransaction, expense: Expense) =>
  run(async () => {
    const rule = await repos.bank.linkExisting(tx.id, expense.id)
    toast('Mit deiner Ausgabe verknüpft', { action: undo(() => repos.bank.unlink(tx.id, rule)) })
  })

/** "Keine Ausgabe": own transfers and the like. */
export const ignoreWithUndo = (tx: BankTransaction) =>
  run(async () => {
    const rule = await repos.bank.ignore(tx.id)
    toast('Als „keine Ausgabe" markiert', { action: undo(() => repos.bank.reopen(tx.id, rule)) })
  })
