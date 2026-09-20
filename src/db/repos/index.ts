import type { FinanceDB } from '../schema'
import { createBackupRepo } from './backup'
import { systemClock, type Clock } from './context'
import { createExpensesRepo } from './expenses'
import {
  createBudgetsRepo,
  createCategoriesRepo,
  createSettingsRepo,
  createTasksRepo,
} from './misc'
import { createPotsRepo } from './pots'
import { createRecurringRepo } from './recurring'
import { createWeeksRepo } from './weeks'

/** The only write API of the app. Tests pass their own database and a fake clock. */
export function createRepos(db: FinanceDB, clock: Clock = systemClock) {
  const ctx = { db, clock }
  return {
    expenses: createExpensesRepo(ctx),
    weeks: createWeeksRepo(ctx),
    pots: createPotsRepo(ctx),
    recurring: createRecurringRepo(ctx),
    categories: createCategoriesRepo(ctx),
    budgets: createBudgetsRepo(ctx),
    tasks: createTasksRepo(ctx),
    settings: createSettingsRepo(ctx),
    backup: createBackupRepo(ctx),
  }
}

export type Repos = ReturnType<typeof createRepos>
export type { Clock } from './context'
export type { ExpenseInput, ExpensePatch } from './expenses'
export type { PotInput, PotPatch } from './pots'
export type { RecurringInput, RecurringPatch } from './recurring'
export type { CategoryInput, CategoryPatch, SettingsPatch, TaskInput, TaskPatch } from './misc'
