import { z } from 'zod'
import { isISODate, isMonday } from './dates'
import { SCHEMA_VERSION, SETTINGS_ID, type AppData } from './types'

export const BACKUP_APP = 'finance-planner'

const isoDate = z.string().refine(isISODate, 'must be a calendar date (YYYY-MM-DD)')
const monday = isoDate.refine(isMonday, 'must be a Monday')
const cents = z.number().int()
const timestamp = z.number()

const base = {
  id: z.string().min(1),
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: timestamp.nullable(),
}

const week = z.object({
  ...base,
  id: monday,
  incomeCents: cents.min(0).nullable(),
  note: z.string().optional(),
  closedAt: timestamp.nullable(),
})

const expense = z.object({
  ...base,
  date: isoDate,
  amountCents: cents.positive(),
  categoryId: z.string().min(1),
  tags: z.array(z.string()),
  note: z.string().optional(),
  recurringId: z.string().optional(),
  fundedByPotId: z.string().nullable().optional(),
})

const recurringExpense = z.object({
  ...base,
  title: z.string(),
  amountCents: cents.positive(),
  categoryId: z.string().min(1),
  tags: z.array(z.string()),
  interval: z.enum(['weekly', 'fortnightly', 'monthly']),
  anchorDate: isoDate,
  endDate: isoDate.nullable(),
  active: z.boolean(),
  lastGeneratedDate: isoDate.nullable(),
})

const category = z.object({
  ...base,
  name: z.string(),
  icon: z.string(),
  color: z.string(),
  group: z.enum(['Fixkosten', 'Variabel', 'Freizeit', 'Reisen', 'Sonstiges']),
  defaultWeeklyLimitCents: cents.min(0).nullable(),
  sortOrder: z.number(),
  archived: z.boolean(),
})

const budget = z.object({
  ...base,
  id: monday,
  totalLimitCents: cents.min(0),
  categoryLimits: z.record(z.string(), cents.min(0)),
})

const pot = z.object({
  ...base,
  name: z.string(),
  targetCents: cents.min(0).nullable(),
  deadline: isoDate.nullable(),
  color: z.string(),
  icon: z.string(),
  sortOrder: z.number(),
  archived: z.boolean(),
})

const potTransaction = z.object({
  ...base,
  potId: z.string().min(1),
  amountCents: cents,
  date: isoDate,
  type: z.enum([
    'auto-weekly',
    'manual-deposit',
    'withdrawal',
    'transfer-in',
    'transfer-out',
    'expense-funding',
  ]),
  sourceWeekStart: monday.optional(),
  transferId: z.string().optional(),
  expenseId: z.string().optional(),
  note: z.string().optional(),
})

const task = z.object({
  ...base,
  title: z.string(),
  dueDate: isoDate.nullable(),
  done: z.boolean(),
  doneAt: timestamp.nullable(),
  category: z.enum(['Finanzen', 'Behörden', 'Sonstiges']),
  linkedPotId: z.string().nullable(),
  note: z.string().optional(),
})

const settings = z.object({
  id: z.literal(SETTINGS_ID),
  currency: z.literal('AUD'),
  eurRate: z.number().positive().nullable(),
  eurRateUpdatedAt: timestamp.nullable(),
  showEur: z.boolean(),
  theme: z.enum(['dark', 'light', 'system']),
  defaultWeeklyIncomeCents: cents.min(0),
  trackingSince: isoDate,
  lastBackupAt: timestamp.nullable(),
  installHintDismissedAt: timestamp.nullable(),
  onboardingDone: z.boolean(),
  updatedAt: timestamp,
})

const appData = z.object({
  weeks: z.array(week),
  expenses: z.array(expense),
  recurringExpenses: z.array(recurringExpense),
  categories: z.array(category),
  budgets: z.array(budget),
  pots: z.array(pot),
  potTransactions: z.array(potTransaction),
  tasks: z.array(task),
  // Exactly one: importing a backup without settings would leave the app unusable.
  settings: z.array(settings).length(1),
})

const backupFile = z.object({
  app: z.literal(BACKUP_APP),
  schemaVersion: z.literal(SCHEMA_VERSION),
  exportedAt: timestamp,
  data: appData,
})

// Compile-time guard: the zod schema and the TypeScript model must not drift apart.
type Assert<T extends true> = T
export type SchemaMatchesModel = Assert<z.infer<typeof appData> extends AppData ? true : false>
export type ModelMatchesSchema = Assert<AppData extends z.infer<typeof appData> ? true : false>

export interface BackupFile {
  app: typeof BACKUP_APP
  schemaVersion: number
  exportedAt: number
  data: AppData
}

export function buildBackup(data: AppData, now: number): BackupFile {
  return { app: BACKUP_APP, schemaVersion: SCHEMA_VERSION, exportedAt: now, data }
}

type RawBackup = { schemaVersion: number; [key: string]: unknown }

/**
 * One entry per released schema version: `migrations[n]` lifts a backup from version n to n+1.
 * Add a step here whenever a Dexie `version(n+1)` changes the shape of stored rows.
 */
const migrations: Record<number, (backup: RawBackup) => RawBackup> = {}

/** Lifts an older backup step by step to the current schema version. */
export function migrateBackup(
  raw: RawBackup,
  steps: Record<number, (backup: RawBackup) => RawBackup> = migrations,
  targetVersion: number = SCHEMA_VERSION,
): RawBackup {
  let current = raw
  while (current.schemaVersion < targetVersion) {
    const step = steps[current.schemaVersion]
    if (!step) throw new Error(`No migration from backup version ${current.schemaVersion}.`)
    current = { ...step(current), schemaVersion: current.schemaVersion + 1 }
  }
  return current
}

export type ParseResult = { ok: true; backup: BackupFile } | { ok: false; errors: string[] }

/** Validates (and if needed migrates) an untrusted, already JSON-parsed backup. */
export function parseBackup(input: unknown): ParseResult {
  if (typeof input !== 'object' || input === null) {
    return { ok: false, errors: ['Die Datei ist kein Finanzplaner-Backup.'] }
  }
  const envelope = input as Record<string, unknown>
  if (envelope.app !== BACKUP_APP || !Number.isInteger(envelope.schemaVersion)) {
    return { ok: false, errors: ['Die Datei ist kein Finanzplaner-Backup.'] }
  }
  const version = envelope.schemaVersion as number
  if (version > SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [
        `Das Backup stammt aus einer neueren App-Version (Schema ${version}). Bitte die App aktualisieren.`,
      ],
    }
  }

  let migrated: RawBackup
  try {
    migrated = migrateBackup(envelope as RawBackup)
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : String(error)] }
  }

  const result = backupFile.safeParse(migrated)
  if (!result.success) {
    const errors = result.error.issues
      .slice(0, 10)
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    return { ok: false, errors }
  }
  return { ok: true, backup: result.data }
}
