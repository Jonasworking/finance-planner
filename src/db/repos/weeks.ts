import type { Cents, ISODate, Week } from '@/lib/types'
import { DomainError } from '../errors'
import {
  assertCents,
  assertMonday,
  ledgerTables,
  syncWeekDerived,
  type RepoContext,
} from './context'

export function createWeeksRepo(ctx: RepoContext) {
  const { db, clock } = ctx
  const inLedger = <T>(work: () => Promise<T>) => db.transaction('rw', ledgerTables(ctx), work)

  async function upsert(weekStart: ISODate, patch: Partial<Week>): Promise<Week> {
    assertMonday(weekStart)
    const now = clock.now()
    const existing = await db.weeks.get(weekStart)
    const week: Week = {
      id: weekStart,
      incomeCents: null,
      closedAt: null,
      createdAt: now,
      ...existing,
      ...patch,
      updatedAt: now,
      deletedAt: null,
    }
    await db.weeks.put(week)
    await syncWeekDerived(ctx, weekStart)
    return week
  }

  return {
    /** Sets the net income of a week (0 = week without work). `null` clears it – open weeks only. */
    setIncome: (weekStart: ISODate, incomeCents: Cents | null, note?: string): Promise<Week> =>
      inLedger(async () => {
        if (incomeCents !== null) assertCents(incomeCents, { allowZero: true })
        const existing = await db.weeks.get(weekStart)
        if (incomeCents === null && existing?.closedAt != null) throw new DomainError('week-closed')
        return upsert(weekStart, note === undefined ? { incomeCents } : { incomeCents, note })
      }),

    /**
     * "Woche abschließen": books income − spending into the savings pot. Idempotent – closing a
     * closed week keeps `closedAt` and merely re-syncs the booking.
     */
    close: (weekStart: ISODate, income?: { incomeCents: Cents; note?: string }): Promise<Week> =>
      inLedger(async () => {
        if (income) assertCents(income.incomeCents, { allowZero: true })
        const existing = await db.weeks.get(weekStart)
        const incomeCents = income?.incomeCents ?? existing?.incomeCents ?? null
        if (incomeCents === null) throw new DomainError('income-missing')
        return upsert(weekStart, {
          incomeCents,
          ...(income?.note === undefined ? {} : { note: income.note }),
          closedAt: existing?.closedAt ?? clock.now(),
        })
      }),

    /** Reopening removes the booking again; the entered income stays. */
    reopen: (weekStart: ISODate): Promise<Week> =>
      inLedger(async () => {
        const existing = await db.weeks.get(weekStart)
        if (!existing) throw new DomainError('not-found')
        return upsert(weekStart, { closedAt: null })
      }),
  }
}
