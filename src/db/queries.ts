import Dexie from 'dexie'
import { weekEndOf, weekStartOf } from '@/lib/dates'
import { potBalance, potBalances } from '@/lib/savings'
import { collectTags } from '@/lib/tags'
import {
  isActive,
  PRIMARY_POT_ID,
  SETTINGS_ID,
  type AppData,
  type Category,
  type ISODate,
  type Pot,
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

const byPotOrder = (a: Pot, b: Pot) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt

/**
 * What the expense form needs: selectable categories (in order), the tag vocabulary and the
 * pots an expense can be paid from ("aus Topf bezahlt") with their balances.
 */
export async function loadExpenseFormData(db: FinanceDB) {
  const [categories, expenses, pots, transactions] = await Promise.all([
    db.categories.toArray(),
    db.expenses.toArray(),
    db.pots.toArray(),
    db.potTransactions.toArray(),
  ])
  return {
    categories: categories
      .filter((category) => isActive(category) && !category.archived)
      .sort(bySortOrder),
    tagVocabulary: collectTags(expenses),
    pots: pots.filter((pot) => isActive(pot) && !pot.archived).sort(byPotOrder),
    potBalances: potBalances(transactions),
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

/**
 * Everything the home screen needs, in one querier. Expenses are loaded completely: the streak
 * runs over every closed week, and ~1,000 rows a year are cheap to read.
 */
export async function loadDashboard(db: FinanceDB) {
  const [settings, weeks, budgets, expenses, templates, categories, primaryTx] = await Promise.all([
    db.settings.get(SETTINGS_ID),
    db.weeks.toArray(),
    db.budgets.toArray(),
    db.expenses.toArray(),
    db.recurringExpenses.toArray(),
    db.categories.toArray(),
    db.potTransactions
      .where('[potId+date]')
      .between([PRIMARY_POT_ID, Dexie.minKey], [PRIMARY_POT_ID, Dexie.maxKey])
      .toArray(),
  ])
  const activeExpenses = expenses.filter(isActive)
  return {
    settings: settings ?? null,
    weeks: weeks.filter(isActive),
    budgets,
    expenses: activeExpenses,
    templates: templates.filter(isActive),
    categories: categories.filter(isActive),
    primaryBalanceCents: potBalance(primaryTx, PRIMARY_POT_ID),
    hasAnyExpense: activeExpenses.length > 0,
  }
}

/** The budget screen and the budget warnings: the running week against the budget rows. */
export async function loadBudget(db: FinanceDB, today: ISODate) {
  const weekStart = weekStartOf(today)
  const [settings, budgets, categories, expenses, templates, week] = await Promise.all([
    db.settings.get(SETTINGS_ID),
    db.budgets.toArray(),
    db.categories.toArray(),
    db.expenses.where('date').between(weekStart, weekEndOf(weekStart), true, true).toArray(),
    db.recurringExpenses.toArray(),
    db.weeks.get(weekStart),
  ])
  return {
    weekStart,
    onboardingDone: settings?.onboardingDone === true,
    budgets,
    categories: categories
      .filter((category) => isActive(category) && !category.archived)
      .sort(bySortOrder),
    expenses: expenses.filter(isActive),
    templates: templates.filter(isActive),
    weekClosed: week != null && isActive(week) && week.closedAt !== null,
  }
}

/**
 * All pots with every booking – balances, forecasts and histories derive from these. Expenses
 * that were paid from a pot come along (with the categories), so a history can name them.
 */
export async function loadPots(db: FinanceDB) {
  const [pots, transactions, fundedExpenses, categories] = await Promise.all([
    db.pots.toArray(),
    db.potTransactions.toArray(),
    db.expenses.filter((expense) => isActive(expense) && expense.fundedByPotId != null).toArray(),
    db.categories.toArray(),
  ])
  return {
    pots: pots.filter(isActive),
    transactions: transactions.filter(isActive),
    fundedExpenses,
    categories: categories.filter(isActive),
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
