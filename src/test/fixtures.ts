import {
  PRIMARY_POT_ID,
  SETTINGS_ID,
  type Budget,
  type Category,
  type Expense,
  type Pot,
  type PotTransaction,
  type RecurringExpense,
  type Settings,
  type Task,
  type Week,
} from '@/lib/types'

/** Fixed fake clock for fixtures (2026-09-20T01:00:00Z). */
export const NOW = 1_789_866_000_000

let counter = 0
const nextId = (prefix: string) => `${prefix}-${++counter}`
const base = (id: string) => ({ id, createdAt: NOW, updatedAt: NOW, deletedAt: null })

export const makeWeek = (id: string, overrides: Partial<Week> = {}): Week => ({
  ...base(id),
  incomeCents: 200_000,
  closedAt: null,
  ...overrides,
})

export const makeExpense = (
  date: string,
  amountCents: number,
  overrides: Partial<Expense> = {},
): Expense => ({
  ...base(overrides.id ?? nextId('exp')),
  date,
  amountCents,
  categoryId: 'cat:groceries',
  tags: [],
  ...overrides,
})

export const makeBudget = (
  id: string,
  totalLimitCents: number,
  categoryLimits: Record<string, number> = {},
  overrides: Partial<Budget> = {},
): Budget => ({ ...base(id), totalLimitCents, categoryLimits, ...overrides })

export const makeCategory = (id: string, overrides: Partial<Category> = {}): Category => ({
  ...base(id),
  name: id,
  icon: 'Circle',
  color: 'cat-1',
  group: 'Variabel',
  defaultWeeklyLimitCents: null,
  sortOrder: 0,
  archived: false,
  ...overrides,
})

export const makePot = (id: string, overrides: Partial<Pot> = {}): Pot => ({
  ...base(id),
  name: id === PRIMARY_POT_ID ? 'Nur gespart' : id,
  targetCents: null,
  deadline: null,
  color: 'cat-1',
  icon: 'PiggyBank',
  sortOrder: 0,
  archived: false,
  ...overrides,
})

export const makeTx = (
  potId: string,
  amountCents: number,
  date: string,
  overrides: Partial<PotTransaction> = {},
): PotTransaction => ({
  ...base(overrides.id ?? nextId('tx')),
  potId,
  amountCents,
  date,
  type: amountCents >= 0 ? 'manual-deposit' : 'withdrawal',
  ...overrides,
})

export const makeRecurring = (
  anchorDate: string,
  overrides: Partial<RecurringExpense> = {},
): RecurringExpense => ({
  ...base(overrides.id ?? nextId('rec')),
  title: 'Miete',
  amountCents: 25_000,
  categoryId: 'cat:rent',
  tags: [],
  interval: 'weekly',
  anchorDate,
  endDate: null,
  active: true,
  lastGeneratedDate: null,
  ...overrides,
})

export const makeTask = (overrides: Partial<Task> = {}): Task => ({
  ...base(overrides.id ?? nextId('task')),
  title: 'Steuernummer beantragen',
  dueDate: null,
  done: false,
  doneAt: null,
  category: 'Behörden',
  linkedPotId: null,
  ...overrides,
})

export const makeSettings = (overrides: Partial<Settings> = {}): Settings => ({
  id: SETTINGS_ID,
  currency: 'AUD',
  eurRate: null,
  eurRateUpdatedAt: null,
  showEur: false,
  theme: 'dark',
  defaultWeeklyIncomeCents: 200_000,
  trackingSince: '2026-06-29',
  lastBackupAt: null,
  installHintDismissedAt: null,
  onboardingDone: true,
  updatedAt: NOW,
  ...overrides,
})
