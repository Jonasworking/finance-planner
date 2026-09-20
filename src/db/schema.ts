import Dexie, { type EntityTable, type Table } from 'dexie'
import { toISODate } from '@/lib/dates'
import type {
  AppData,
  Budget,
  Category,
  Expense,
  Pot,
  PotTransaction,
  RecurringExpense,
  Settings,
  Task,
  Week,
} from '@/lib/types'
import { buildSeed } from './seed'

export const DB_NAME = 'finance-planner'

/** Table names in dependency-free order; also the key order of backups. */
export const TABLE_NAMES = [
  'weeks',
  'expenses',
  'recurringExpenses',
  'categories',
  'budgets',
  'pots',
  'potTransactions',
  'tasks',
  'settings',
] as const satisfies readonly (keyof AppData)[]

export class FinanceDB extends Dexie {
  weeks!: EntityTable<Week, 'id'>
  expenses!: EntityTable<Expense, 'id'>
  recurringExpenses!: EntityTable<RecurringExpense, 'id'>
  categories!: EntityTable<Category, 'id'>
  budgets!: EntityTable<Budget, 'id'>
  pots!: EntityTable<Pot, 'id'>
  potTransactions!: EntityTable<PotTransaction, 'id'>
  tasks!: EntityTable<Task, 'id'>
  settings!: EntityTable<Settings, 'id'>

  constructor(name: string = DB_NAME) {
    super(name)

    /*
     * Version 1. NEVER edit a released version: add `this.version(2).stores({...}).upgrade(...)`
     * below, bump SCHEMA_VERSION in src/lib/types.ts and add a `migrateBackup` step.
     * Indexes are deliberately sparse (~1k expenses/year are filtered in memory; booleans are not
     * valid IndexedDB keys; deterministic ids replace lookup indexes). Adding one later is a
     * cheap version bump without data migration.
     */
    this.version(1).stores({
      weeks: 'id', // id = week start (Monday)
      expenses: 'id, date', // week queries are date ranges
      recurringExpenses: 'id',
      categories: 'id',
      budgets: 'id', // id = week start "gültig ab"
      pots: 'id',
      potTransactions: 'id, [potId+date]', // pot history, sorted
      tasks: 'id',
      settings: 'id',
    })

    // Runs once per freshly created database – also after a wipe (`db.delete()` + reopen).
    this.on('populate', (tx) => {
      const seed = buildSeed(Date.now(), toISODate(new Date()))
      for (const [name, rows] of Object.entries(seed)) {
        ;(tx.table(name) as Table).bulkAdd(rows)
      }
    })
  }

  /** Every table, for operations that must span the whole database (import, export). */
  get allTables(): Table[] {
    return TABLE_NAMES.map((name) => this.table(name))
  }
}
