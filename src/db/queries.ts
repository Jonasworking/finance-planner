import { weekEndOf } from '@/lib/dates'
import { collectTags } from '@/lib/tags'
import { isActive, type AppData, type Category, type ISODate } from '@/lib/types'
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

const bySortOrder = (a: Category, b: Category) => a.sortOrder - b.sortOrder

/** Everything the expenses screen shows for one week – a single querier, so no tearing. */
export async function loadExpensesOfWeek(db: FinanceDB, weekStart: ISODate) {
  const [expenses, categories] = await Promise.all([
    db.expenses.where('date').between(weekStart, weekEndOf(weekStart), true, true).toArray(),
    db.categories.toArray(),
  ])
  return { expenses: expenses.filter(isActive), categories: categories.filter(isActive) }
}

/** What the expense form needs: selectable categories (in order) and the tag vocabulary. */
export async function loadExpenseFormData(db: FinanceDB) {
  const [categories, expenses] = await Promise.all([db.categories.toArray(), db.expenses.toArray()])
  return {
    categories: categories
      .filter((category) => isActive(category) && !category.archived)
      .sort(bySortOrder),
    tagVocabulary: collectTags(expenses),
  }
}

/** All categories for the management screen, split into active and archived. */
export async function loadCategories(db: FinanceDB) {
  const categories = (await db.categories.toArray()).filter(isActive).sort(bySortOrder)
  return {
    active: categories.filter((category) => !category.archived),
    archived: categories.filter((category) => category.archived),
  }
}
