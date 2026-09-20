import type { Cents } from './money'

export type { Cents }

/** Local calendar day as 'YYYY-MM-DD'. Never a timestamp – see src/lib/dates.ts. */
export type ISODate = string

/** Bump together with a Dexie `version(n+1)` and a `migrateBackup` step. */
export const SCHEMA_VERSION = 1

/** The "Nur gespart" pot has a fixed id, so there can never be zero or two primary pots. */
export const PRIMARY_POT_ID = 'pot:primary'
export const SETTINGS_ID = 'app'

/** Every synced row. `deletedAt` is a tombstone (soft delete); reads filter it out. */
export interface Base {
  id: string
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

/** One row per calendar week; `id` is the week's Monday. Replaces the proposed WeekIncome. */
export interface Week extends Base {
  /** Net amount paid out for this week. `0` is valid (week without work), `null` = not entered. */
  incomeCents: Cents | null
  note?: string
  /** `null` while the week is open. */
  closedAt: number | null
}

export interface Expense extends Base {
  date: ISODate
  /** Always > 0. */
  amountCents: Cents
  categoryId: string
  tags: string[]
  note?: string
  /** Set when generated from a recurring template. */
  recurringId?: string
  /** "Aus Topf bezahlt": excluded from budget, streak and the week's savings. */
  fundedByPotId?: string | null
}

export type RecurrenceInterval = 'weekly' | 'fortnightly' | 'monthly'

export interface RecurringExpense extends Base {
  title: string
  amountCents: Cents
  categoryId: string
  tags: string[]
  interval: RecurrenceInterval
  /** First due date; weekday / day of month derive from it. */
  anchorDate: ISODate
  endDate: ISODate | null
  active: boolean
  /** Watermark: instances up to this day have been generated (or deliberately skipped). */
  lastGeneratedDate: ISODate | null
}

export type CategoryGroup = 'Fixkosten' | 'Variabel' | 'Freizeit' | 'Reisen' | 'Sonstiges'

export interface Category extends Base {
  name: string
  /** lucide icon name */
  icon: string
  /** token key, e.g. 'cat-3' */
  color: string
  group: CategoryGroup
  defaultWeeklyLimitCents: Cents | null
  sortOrder: number
  /** Categories are archived, never deleted – old expenses keep pointing at them. */
  archived: boolean
}

/** Effective-dated: `id` is the week start from which this budget applies. */
export interface Budget extends Base {
  /** Authoritative weekly limit. */
  totalLimitCents: Cents
  /** Optional per-category limits; may sum to less (unallocated) or more (overbooked). */
  categoryLimits: Record<string, Cents>
}

export interface Pot extends Base {
  name: string
  targetCents: Cents | null
  deadline: ISODate | null
  color: string
  icon: string
  sortOrder: number
  archived: boolean
}

export type PotTransactionType =
  | 'auto-weekly'
  | 'manual-deposit'
  | 'withdrawal'
  | 'transfer-in'
  | 'transfer-out'
  | 'expense-funding'

export interface PotTransaction extends Base {
  potId: string
  /** Signed: a pot's balance is the plain sum of its transactions. */
  amountCents: Cents
  /** For auto-weekly: the week's Sunday, independent of when the week was closed. */
  date: ISODate
  type: PotTransactionType
  sourceWeekStart?: ISODate
  transferId?: string
  expenseId?: string
  note?: string
}

export type TaskCategory = 'Finanzen' | 'Behörden' | 'Sonstiges'

export interface Task extends Base {
  title: string
  dueDate: ISODate | null
  done: boolean
  doneAt: number | null
  category: TaskCategory
  linkedPotId: string | null
  note?: string
}

export type ThemePreference = 'dark' | 'light' | 'system'

/** Singleton row with id 'app'. */
export interface Settings {
  id: typeof SETTINGS_ID
  currency: 'AUD'
  /** 1 AUD = `eurRate` EUR, maintained by hand. Display only. */
  eurRate: number | null
  eurRateUpdatedAt: number | null
  showEur: boolean
  theme: ThemePreference
  defaultWeeklyIncomeCents: Cents
  /** First day that counts for "pending weeks". */
  trackingSince: ISODate
  lastBackupAt: number | null
  installHintDismissedAt: number | null
  onboardingDone: boolean
  updatedAt: number
}

/** All persisted tables – the shape of backups and of the ledger check input. */
export interface AppData {
  weeks: Week[]
  expenses: Expense[]
  recurringExpenses: RecurringExpense[]
  categories: Category[]
  budgets: Budget[]
  pots: Pot[]
  potTransactions: PotTransaction[]
  tasks: Task[]
  settings: Settings[]
}

export const isActive = <T extends { deletedAt: number | null }>(row: T): boolean =>
  row.deletedAt === null
