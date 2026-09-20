import Dexie from 'dexie'
import { addWeeksISO, weekEndOf, weekStartOf } from '@/lib/dates'
import { potBalance } from '@/lib/savings'
import { collectTags } from '@/lib/tags'
import {
  isActive,
  PRIMARY_POT_ID,
  SETTINGS_ID,
  type AppData,
  type Category,
  type ISODate,
} from '@/lib/types'
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

/** How many weeks of history the home screen looks back (recent weeks list). */
export const DASHBOARD_WEEKS = 8

/** Everything the home screen needs, in one querier. */
export async function loadDashboard(db: FinanceDB, today: ISODate) {
  const currentWeek = weekStartOf(today)
  const from = addWeeksISO(currentWeek, -DASHBOARD_WEEKS)
  const [settings, weeks, budgets, expenses, templates, categories, primaryTx, anyExpense] =
    await Promise.all([
      db.settings.get(SETTINGS_ID),
      db.weeks.toArray(),
      db.budgets.toArray(),
      db.expenses.where('date').between(from, weekEndOf(currentWeek), true, true).toArray(),
      db.recurringExpenses.toArray(),
      db.categories.toArray(),
      db.potTransactions
        .where('[potId+date]')
        .between([PRIMARY_POT_ID, Dexie.minKey], [PRIMARY_POT_ID, Dexie.maxKey])
        .toArray(),
      db.expenses.filter(isActive).limit(1).count(),
    ])
  return {
    settings: settings ?? null,
    weeks: weeks.filter(isActive),
    budgets,
    expenses: expenses.filter(isActive),
    templates: templates.filter(isActive),
    categories: categories.filter(isActive),
    primaryBalanceCents: potBalance(primaryTx, PRIMARY_POT_ID),
    hasAnyExpense: anyExpense > 0,
  }
}

/** Data for "Woche abschließen" / "Woche bearbeiten" of one week. */
export async function loadCloseWeek(db: FinanceDB, weekStart: ISODate) {
  const [settings, week, weeks, budgets, expenses] = await Promise.all([
    db.settings.get(SETTINGS_ID),
    db.weeks.get(weekStart),
    db.weeks.toArray(),
    db.budgets.toArray(),
    db.expenses.where('date').between(weekStart, weekEndOf(weekStart), true, true).toArray(),
  ])
  return {
    settings: settings ?? null,
    week: week && isActive(week) ? week : null,
    weeks: weeks.filter(isActive),
    budgets,
    expenses: expenses.filter(isActive),
  }
}

/** Standing orders with what the list needs to show them. */
export async function loadRecurring(db: FinanceDB) {
  const [templates, categories, settings] = await Promise.all([
    db.recurringExpenses.toArray(),
    db.categories.toArray(),
    db.settings.get(SETTINGS_ID),
  ])
  return {
    templates: templates
      .filter(isActive)
      .sort((a, b) => Number(b.active) - Number(a.active) || a.title.localeCompare(b.title, 'de')),
    categories: categories.filter(isActive).sort(bySortOrder),
    trackingSince: settings?.trackingSince ?? null,
  }
}
