import { weekStartOf } from '@/lib/dates'
import { isValidRate } from '@/lib/money'
import {
  isActive,
  SETTINGS_ID,
  type Budget,
  type Category,
  type Cents,
  type ISODate,
  type Settings,
  type Task,
} from '@/lib/types'
import { DomainError } from '../errors'
import { assertCents, assertDate, newId, type RepoContext } from './context'

export type CategoryInput = Pick<Category, 'name' | 'icon' | 'color' | 'group'> &
  Partial<Pick<Category, 'defaultWeeklyLimitCents'>>
export type CategoryPatch = Partial<
  Pick<Category, 'name' | 'icon' | 'color' | 'group' | 'defaultWeeklyLimitCents' | 'archived'>
>

export function createCategoriesRepo({ db, clock }: RepoContext) {
  return {
    create: (input: CategoryInput): Promise<Category> =>
      db.transaction('rw', db.categories, async () => {
        const now = clock.now()
        const rows = await db.categories.toArray()
        const category: Category = {
          id: newId(),
          ...input,
          defaultWeeklyLimitCents: input.defaultWeeklyLimitCents ?? null,
          sortOrder: Math.max(-1, ...rows.map((row) => row.sortOrder)) + 1,
          archived: false,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        }
        await db.categories.add(category)
        return category
      }),

    /** Archiving (not deleting) keeps old expenses readable; budget limits are dropped on resolve. */
    update: (id: string, patch: CategoryPatch): Promise<Category> =>
      db.transaction('rw', db.categories, async () => {
        const previous = await db.categories.get(id)
        if (!previous || !isActive(previous)) throw new DomainError('unknown-category')
        const next = { ...previous, ...patch, updatedAt: clock.now() }
        await db.categories.put(next)
        return next
      }),

    reorder: (orderedIds: readonly string[]): Promise<void> =>
      db.transaction('rw', db.categories, async () => {
        const now = clock.now()
        for (const [sortOrder, id] of orderedIds.entries()) {
          await db.categories.update(id, { sortOrder, updatedAt: now })
        }
      }),
  }
}

export function createBudgetsRepo({ db, clock }: RepoContext) {
  return {
    /**
     * Budgets are effective-dated and ONLY ever written for the current week ("gilt ab dieser
     * Woche"), so past weeks – and the streak – can never change retroactively.
     */
    set: (
      today: ISODate,
      input: { totalLimitCents: Cents; categoryLimits?: Record<string, Cents> },
    ): Promise<Budget> =>
      db.transaction('rw', db.budgets, async () => {
        assertDate(today)
        assertCents(input.totalLimitCents, { allowZero: true })
        for (const limit of Object.values(input.categoryLimits ?? {})) {
          assertCents(limit, { allowZero: true })
        }
        const id = weekStartOf(today)
        const now = clock.now()
        const existing = await db.budgets.get(id)
        const budget: Budget = {
          id,
          totalLimitCents: input.totalLimitCents,
          categoryLimits: input.categoryLimits ?? existing?.categoryLimits ?? {},
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          deletedAt: null,
        }
        await db.budgets.put(budget)
        return budget
      }),
  }
}

export type TaskInput = Pick<Task, 'title'> &
  Partial<Pick<Task, 'dueDate' | 'category' | 'linkedPotId' | 'note'>>
export type TaskPatch = Partial<
  Pick<Task, 'title' | 'dueDate' | 'category' | 'linkedPotId' | 'note'>
>

export function createTasksRepo({ db, clock }: RepoContext) {
  async function mustGet(id: string): Promise<Task> {
    const task = await db.tasks.get(id)
    if (!task) throw new DomainError('not-found')
    return task
  }

  return {
    add: async (input: TaskInput): Promise<Task> => {
      if (input.dueDate) assertDate(input.dueDate)
      const now = clock.now()
      const task: Task = {
        id: newId(),
        title: input.title,
        dueDate: input.dueDate ?? null,
        done: false,
        doneAt: null,
        category: input.category ?? 'Finanzen',
        linkedPotId: input.linkedPotId ?? null,
        note: input.note,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }
      await db.tasks.add(task)
      return task
    },

    update: async (id: string, patch: TaskPatch): Promise<void> => {
      if (patch.dueDate) assertDate(patch.dueDate)
      await db.tasks.put({ ...(await mustGet(id)), ...patch, updatedAt: clock.now() })
    },

    setDone: async (id: string, done: boolean): Promise<void> => {
      const now = clock.now()
      await db.tasks.put({
        ...(await mustGet(id)),
        done,
        doneAt: done ? now : null,
        updatedAt: now,
      })
    },

    remove: async (id: string): Promise<void> => {
      const now = clock.now()
      await db.tasks.put({ ...(await mustGet(id)), deletedAt: now, updatedAt: now })
    },

    restore: async (id: string): Promise<void> => {
      await db.tasks.put({ ...(await mustGet(id)), deletedAt: null, updatedAt: clock.now() })
    },
  }
}

export type SettingsPatch = Partial<Omit<Settings, 'id' | 'currency' | 'updatedAt'>>

export function createSettingsRepo({ db, clock }: RepoContext) {
  return {
    get: async (): Promise<Settings> => {
      const settings = await db.settings.get(SETTINGS_ID)
      if (!settings) throw new DomainError('not-found', 'Settings row is missing.')
      return settings
    },

    update: (patch: SettingsPatch): Promise<Settings> =>
      db.transaction('rw', db.settings, async () => {
        const previous = await db.settings.get(SETTINGS_ID)
        if (!previous) throw new DomainError('not-found', 'Settings row is missing.')
        if (patch.trackingSince) assertDate(patch.trackingSince)
        if (patch.defaultWeeklyIncomeCents !== undefined) {
          assertCents(patch.defaultWeeklyIncomeCents, { allowZero: true })
        }
        if (patch.eurRate != null && !isValidRate(patch.eurRate)) {
          throw new DomainError('invalid-rate', `Not a usable exchange rate: ${patch.eurRate}`)
        }
        const eurRateChanged = patch.eurRate !== undefined && patch.eurRate !== previous.eurRate
        const now = clock.now()
        const next: Settings = {
          ...previous,
          ...patch,
          eurRateUpdatedAt: eurRateChanged
            ? now
            : (patch.eurRateUpdatedAt ?? previous.eurRateUpdatedAt),
          updatedAt: now,
        }
        await db.settings.put(next)
        return next
      }),
  }
}
