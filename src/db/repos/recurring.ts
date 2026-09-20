import { addDaysISO } from '@/lib/dates'
import { recurringInstanceId } from '@/lib/ids'
import { planMaterialization } from '@/lib/recurrence'
import { isActive, type ISODate, type RecurringExpense } from '@/lib/types'
import { DomainError } from '../errors'
import {
  assertCents,
  assertDate,
  ledgerTables,
  newId,
  writeExpense,
  type RepoContext,
} from './context'

export type RecurringInput = Pick<
  RecurringExpense,
  'title' | 'amountCents' | 'categoryId' | 'interval' | 'anchorDate'
> &
  Partial<Pick<RecurringExpense, 'tags' | 'endDate'>>

export type RecurringPatch = Partial<
  Pick<
    RecurringExpense,
    | 'title'
    | 'amountCents'
    | 'categoryId'
    | 'tags'
    | 'interval'
    | 'anchorDate'
    | 'endDate'
    | 'active'
  >
>

export function createRecurringRepo(ctx: RepoContext) {
  const { db, clock } = ctx
  const inLedger = <T>(work: () => Promise<T>) => db.transaction('rw', ledgerTables(ctx), work)

  async function assertCategory(categoryId: string): Promise<void> {
    const category = await db.categories.get(categoryId)
    if (!category || !isActive(category)) throw new DomainError('unknown-category')
  }

  return {
    /** A new template back-fills from its anchor on the next materialisation. */
    create: (input: RecurringInput): Promise<RecurringExpense> =>
      inLedger(async () => {
        assertCents(input.amountCents)
        assertDate(input.anchorDate)
        if (input.endDate) assertDate(input.endDate)
        await assertCategory(input.categoryId)
        const now = clock.now()
        const template: RecurringExpense = {
          id: newId(),
          title: input.title,
          amountCents: input.amountCents,
          categoryId: input.categoryId,
          tags: input.tags ?? [],
          interval: input.interval,
          anchorDate: input.anchorDate,
          endDate: input.endDate ?? null,
          active: true,
          lastGeneratedDate: null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        }
        await db.recurringExpenses.add(template)
        return template
      }),

    /**
     * Editing the rhythm (anchor/interval) or re-activating a paused template moves the watermark
     * to yesterday, so the gap is NOT back-filled with a pile of old expenses.
     */
    update: (id: string, patch: RecurringPatch, today: ISODate): Promise<RecurringExpense> =>
      inLedger(async () => {
        const previous = await db.recurringExpenses.get(id)
        if (!previous || !isActive(previous)) throw new DomainError('not-found')
        if (patch.amountCents !== undefined) assertCents(patch.amountCents)
        if (patch.anchorDate !== undefined) assertDate(patch.anchorDate)
        if (patch.endDate) assertDate(patch.endDate)
        if (patch.categoryId !== undefined) await assertCategory(patch.categoryId)

        const rhythmChanged =
          (patch.anchorDate !== undefined && patch.anchorDate !== previous.anchorDate) ||
          (patch.interval !== undefined && patch.interval !== previous.interval)
        const reactivated = patch.active === true && !previous.active
        const next: RecurringExpense = {
          ...previous,
          ...patch,
          lastGeneratedDate:
            rhythmChanged || reactivated ? addDaysISO(today, -1) : previous.lastGeneratedDate,
          updatedAt: clock.now(),
        }
        await db.recurringExpenses.put(next)
        return next
      }),

    /** Soft delete; already generated expenses stay. */
    remove: (id: string): Promise<void> =>
      inLedger(async () => {
        const previous = await db.recurringExpenses.get(id)
        if (!previous || !isActive(previous)) return
        const now = clock.now()
        await db.recurringExpenses.put({ ...previous, deletedAt: now, updatedAt: now })
      }),

    /** Undo of `remove`. The watermark is kept, so nothing is back-filled for the meantime. */
    restore: (id: string): Promise<void> =>
      inLedger(async () => {
        const previous = await db.recurringExpenses.get(id)
        if (!previous) throw new DomainError('not-found')
        if (isActive(previous)) return
        await db.recurringExpenses.put({ ...previous, deletedAt: null, updatedAt: clock.now() })
      }),

    /**
     * Generates all due instances up to `today`. Safe to call from app start AND
     * visibilitychange AND a second tab at once: the watermark is read INSIDE the transaction,
     * concurrent calls queue behind it, and existing ids (including tombstones of instances the
     * user deleted) are skipped – never overwritten. Instances go through `writeExpense`, so one
     * that lands in an already closed week re-syncs that week's booking.
     */
    materialize: (today: ISODate): Promise<number> =>
      inLedger(async () => {
        assertDate(today)
        let created = 0
        for (const template of await db.recurringExpenses.toArray()) {
          const plan = planMaterialization(template, today)
          if (plan.nextWatermark === null) continue

          const ids = plan.dates.map((date) => recurringInstanceId(template.id, date))
          const existing = await db.expenses.bulkGet(ids)
          for (const [index, date] of plan.dates.entries()) {
            if (existing[index]) continue
            const now = clock.now()
            await writeExpense(
              ctx,
              {
                id: ids[index]!,
                date,
                amountCents: template.amountCents,
                categoryId: template.categoryId,
                tags: template.tags,
                note: template.title,
                recurringId: template.id,
                fundedByPotId: null,
                createdAt: now,
                updatedAt: now,
                deletedAt: null,
              },
              undefined,
            )
            created++
          }
          await db.recurringExpenses.update(template.id, {
            lastGeneratedDate: plan.nextWatermark,
            updatedAt: clock.now(),
          })
        }
        return created
      }),
  }
}
