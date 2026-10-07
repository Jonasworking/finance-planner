import type { ParsedBankRow } from '@/lib/bankImport'
import {
  byNewest,
  closedWeekFor,
  inboxOfWeek,
  isDone,
  isInInbox,
  matchCandidates,
  planImport,
} from '@/lib/bankInbox'
import { weekEndOf, weekStartOf } from '@/lib/dates'
import {
  autoAssignable,
  categoryUsage,
  incomeSuggestion,
  isIncomeCredit,
  suggestCategories,
} from '@/lib/merchantRules'
import { potBalance, potBalances } from '@/lib/savings'
import { collectTags } from '@/lib/tags'
import {
  isActive,
  PRIMARY_POT_ID,
  SETTINGS_ID,
  type AppData,
  type BankTransaction,
  type Category,
  type Expense,
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
      bankTransactions,
      merchantRules,
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
      db.bankTransactions.toArray(),
      db.merchantRules.toArray(),
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
      bankTransactions,
      merchantRules,
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
  const [
    settings,
    weeks,
    budgets,
    expenses,
    templates,
    categories,
    transactions,
    tasks,
    pots,
    inboxCount,
  ] = await Promise.all([
    db.settings.get(SETTINGS_ID),
    db.weeks.toArray(),
    db.budgets.toArray(),
    db.expenses.toArray(),
    db.recurringExpenses.toArray(),
    db.categories.toArray(),
    db.potTransactions.toArray(),
    db.tasks.toArray(),
    db.pots.toArray(),
    countInbox(db),
  ])
  const activeExpenses = expenses.filter(isActive)
  const activeTransactions = transactions.filter(isActive)
  return {
    settings: settings ?? null,
    weeks: weeks.filter(isActive),
    budgets,
    expenses: activeExpenses,
    templates: templates.filter(isActive),
    categories: categories.filter(isActive),
    primaryBalanceCents: potBalance(activeTransactions, PRIMARY_POT_ID),
    hasAnyExpense: activeExpenses.length > 0,
    tasks: tasks.filter(isActive),
    /** Pots and their bookings, so a task's pot reference can show where the pot stands. */
    pots: pots.filter(isActive),
    potTransactions: activeTransactions,
    /** Bank lines waiting to be categorised. */
    inboxCount,
  }
}

/**
 * The tasks screen and the task form: every live task, plus the pots (with their bookings) a
 * task can point at – the row shows the pot's progress, the form lets you pick one.
 */
export async function loadTasks(db: FinanceDB) {
  const [tasks, pots, transactions] = await Promise.all([
    db.tasks.toArray(),
    db.pots.toArray(),
    db.potTransactions.toArray(),
  ])
  return {
    tasks: tasks.filter(isActive),
    pots: pots.filter(isActive).sort(byPotOrder),
    transactions: transactions.filter(isActive),
  }
}

/**
 * The analysis screen: every week, expense and budget row – its ranges, series and comparisons
 * are all derived from raw rows in `lib/analytics`. Archived categories stay in: past spending
 * still carries their name and color.
 */
export async function loadAnalytics(db: FinanceDB) {
  const [settings, weeks, budgets, expenses, categories] = await Promise.all([
    db.settings.get(SETTINGS_ID),
    db.weeks.toArray(),
    db.budgets.toArray(),
    db.expenses.toArray(),
    db.categories.toArray(),
  ])
  return {
    settings: settings ?? null,
    weeks: weeks.filter(isActive),
    budgets,
    expenses: expenses.filter(isActive),
    categories: categories.filter(isActive).sort(bySortOrder),
  }
}

/**
 * The what-if calculator: history for the baseline tempo and the category averages, the budget
 * it can turn into, and every pot with its bookings for the starting balance.
 */
export async function loadWhatIf(db: FinanceDB) {
  const [settings, weeks, budgets, expenses, categories, pots, transactions] = await Promise.all([
    db.settings.get(SETTINGS_ID),
    db.weeks.toArray(),
    db.budgets.toArray(),
    db.expenses.toArray(),
    db.categories.toArray(),
    db.pots.toArray(),
    db.potTransactions.toArray(),
  ])
  return {
    settings: settings ?? null,
    weeks: weeks.filter(isActive),
    budgets,
    expenses: expenses.filter(isActive),
    categories: categories
      .filter((category) => isActive(category) && !category.archived)
      .sort(bySortOrder),
    pots: pots.filter(isActive),
    potTransactions: transactions.filter(isActive),
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
  const [settings, week, weeks, budgets, expenses, bankTransactions, rules] = await Promise.all([
    db.settings.get(SETTINGS_ID),
    db.weeks.get(weekStart),
    db.weeks.toArray(),
    db.budgets.toArray(),
    db.expenses.where('date').between(weekStart, weekEndOf(weekStart), true, true).toArray(),
    db.bankTransactions.toArray(),
    db.merchantRules.toArray(),
  ])
  return {
    settings: settings ?? null,
    week: week && isActive(week) ? week : null,
    weeks: weeks.filter(isActive),
    budgets,
    expenses: expenses.filter(isActive),
    /** What the bank says was earned this week (credits of marked employers), if anything. */
    bankIncome: incomeSuggestion(bankTransactions, rules, weekStart),
    /** Bank lines of this week that still wait in the inbox – missing from the spending. */
    inboxCount: inboxOfWeek(bankTransactions, weekStart).length,
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

/** How many bank lines wait in the inbox (home card, navigation badge). */
export async function countInbox(db: FinanceDB): Promise<number> {
  const open = await db.bankTransactions.where('status').equals('open').toArray()
  return open.filter(isInInbox).length
}

/**
 * What `planImport` needs to know about the stored state. Shared by the preview and by the
 * import itself (inside its transaction), so both always see the same plan.
 */
export async function loadImportState(db: FinanceDB) {
  const [stored, expenses, settings] = await Promise.all([
    db.bankTransactions.toArray(),
    db.expenses.toArray(),
    db.settings.get(SETTINGS_ID),
  ])
  return {
    existingIds: new Set(stored.map((tx) => tx.id)),
    latestStoredDate: stored.reduce<ISODate | null>(
      (max, tx) => (max === null || tx.date > max ? tx.date : max),
      null,
    ),
    expenses,
    linkedExpenseIds: linkedExpenseIds(stored),
    trackingSince: settings?.trackingSince ?? null,
  }
}

const linkedExpenseIds = (stored: readonly BankTransaction[]) =>
  new Set(stored.flatMap((tx) => (isActive(tx) && tx.expenseId !== null ? [tx.expenseId] : [])))

/** The import preview: what importing these lines would do right now. Writes nothing. */
export async function previewBankImport(
  db: FinanceDB,
  rows: readonly ParsedBankRow[],
  keepOpen?: ReadonlySet<string>,
) {
  const state = await loadImportState(db)
  if (state.trackingSince === null) return null
  return planImport({ ...state, trackingSince: state.trackingSince, rows, keepOpen })
}

/** Everything the inbox screen shows, in one querier. */
export async function loadInbox(db: FinanceDB) {
  const [stored, expenses, categories, weeks, rules] = await Promise.all([
    db.bankTransactions.toArray(),
    db.expenses.toArray(),
    db.categories.toArray(),
    db.weeks.toArray(),
    db.merchantRules.toArray(),
  ])
  const selectable = categories
    .filter((category) => isActive(category) && !category.archived)
    .sort(bySortOrder)
  const usage = categoryUsage(expenses)
  const active = stored.filter(isActive)
  const inbox = active.filter(isInInbox).sort(byNewest)
  const linked = linkedExpenseIds(stored)
  const candidates: Record<string, Expense[]> = {}
  const closedWeeks: Record<string, ISODate> = {}
  const suggestions: Record<string, Category[]> = {}
  for (const tx of inbox) {
    suggestions[tx.id] = suggestCategories({
      description: tx.description,
      rules,
      usage,
      categories: selectable,
    })
    const found = matchCandidates(tx, expenses, linked)
    if (found.length > 0) candidates[tx.id] = found
    const closed = closedWeekFor(tx, weeks)
    if (closed) closedWeeks[tx.id] = closed
  }
  const debits = active.filter((tx) => tx.amountCents < 0)
  return {
    inbox,
    /** Hand-entered expenses that could be the same booking, per inbox line. */
    candidates,
    /** Inbox lines whose expense would land in an already closed week. */
    closedWeeks,
    /** Selectable categories per inbox line, most likely first (the first two are the swipe targets). */
    suggestions,
    /** Lines of well-known merchants – what "bekannte Händler zuordnen" would do. */
    auto: autoAssignable(inbox, rules, selectable),
    categories: selectable,
    allCategories: categories,
    /** Debits that were dealt with, newest first – "Erledigt" with "Zurück in die Inbox". */
    doneLines: active.filter(isDone).sort(byNewest),
    /** Credits, newest first, with whether their sender is marked as the employer. */
    credits: active
      .filter((tx) => tx.amountCents > 0)
      .sort(byNewest)
      .map((tx) => ({ tx, isIncome: isIncomeCredit(tx, rules) })),
    expenseCategoryIds: Object.fromEntries(
      expenses.map((expense) => [expense.id, expense.categoryId]),
    ),
    done: {
      assigned: debits.filter((tx) => tx.status === 'assigned').length,
      matched: debits.filter((tx) => tx.status === 'matched').length,
      ignored: debits.filter((tx) => tx.status === 'ignored').length,
      credits: active.filter((tx) => tx.amountCents > 0).length,
    },
    hasImported: active.length > 0,
  }
}

/** The learned merchant rules for the settings, most recently used first. */
export async function loadMerchantRules(db: FinanceDB) {
  const [rules, categories] = await Promise.all([
    db.merchantRules.toArray(),
    db.categories.toArray(),
  ])
  return {
    rules: rules
      .filter(isActive)
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt || a.id.localeCompare(b.id)),
    categories,
  }
}
