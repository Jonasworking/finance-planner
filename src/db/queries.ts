import type { AppData } from '@/lib/types'
import type { FinanceDB } from './schema'

/** Snapshot of every table (tombstones included) – input for backups and the ledger check. */
export async function loadAppData(db: FinanceDB): Promise<AppData> {
  return db.transaction('r', db.allTables, async () => {
    const [
      weeks,
      expenses,
      recurringExpenses,
      categories,
      budgets,
      pots,
      potTransactions,
      tasks,
      settings,
    ] = await Promise.all([
      db.weeks.toArray(),
      db.expenses.toArray(),
      db.recurringExpenses.toArray(),
      db.categories.toArray(),
      db.budgets.toArray(),
      db.pots.toArray(),
      db.potTransactions.toArray(),
      db.tasks.toArray(),
      db.settings.toArray(),
    ])
    return {
      weeks,
      expenses,
      recurringExpenses,
      categories,
      budgets,
      pots,
      potTransactions,
      tasks,
      settings,
    }
  })
}
