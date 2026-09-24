import type { FinanceDB } from '../schema'
import type { createBackupRepo } from './backup'
import { systemClock, type Clock, type RepoContext } from './context'
import { createExpensesRepo } from './expenses'
import {
  createBudgetsRepo,
  createCategoriesRepo,
  createSettingsRepo,
  createTasksRepo,
} from './misc'
import { createOnboardingRepo } from './onboarding'
import { createPotsRepo } from './pots'
import { createRecurringRepo } from './recurring'
import { createWeeksRepo } from './weeks'

type BackupRepo = ReturnType<typeof createBackupRepo>

/**
 * Backup pulls in zod, the backup schema and the ledger check (~90 KB gzip) but is only needed
 * on the settings screen – so it is loaded on first use. Every method was async already, which
 * makes the lazy wrapper invisible to callers.
 */
function lazyBackupRepo(ctx: RepoContext): BackupRepo {
  let loading: Promise<BackupRepo> | undefined
  const load = () => (loading ??= import('./backup').then((module) => module.createBackupRepo(ctx)))
  return {
    export: async () => (await load()).export(),
    markBackupDone: async () => (await load()).markBackupDone(),
    import: async (input) => (await load()).import(input),
    safetyCopyInfo: async () => (await load()).safetyCopyInfo(),
    restoreSafetyCopy: async () => (await load()).restoreSafetyCopy(),
    check: async () => (await load()).check(),
    wipeAll: async () => (await load()).wipeAll(),
  }
}

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
    onboarding: createOnboardingRepo(ctx),
    backup: lazyBackupRepo(ctx),
  }
}

export type Repos = ReturnType<typeof createRepos>
export type { Clock } from './context'
export type { ExpenseInput, ExpensePatch } from './expenses'
export type { OnboardingInput } from './onboarding'
export type { PotInput, PotPatch } from './pots'
export type { RecurringInput, RecurringPatch } from './recurring'
export type { CategoryInput, CategoryPatch, SettingsPatch, TaskInput, TaskPatch } from './misc'
