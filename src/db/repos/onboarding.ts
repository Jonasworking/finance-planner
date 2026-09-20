import { weekStartOf } from '@/lib/dates'
import { isActive, PRIMARY_POT_ID, SETTINGS_ID, type Cents, type ISODate } from '@/lib/types'
import { DomainError } from '../errors'
import { assertCents, assertDate, type RepoContext } from './context'

/** Fixed id: completing the onboarding twice must not deposit the opening balance twice. */
export const OPENING_BALANCE_TX_ID = 'opening-balance'

export interface OnboardingInput {
  defaultWeeklyIncomeCents: Cents
  totalLimitCents: Cents
  /** What is already saved; 0 = start from zero. */
  openingBalanceCents: Cents
  /** First day that counts. Finished weeks since then queue up for "Woche abschließen". */
  trackingSince: ISODate
}

export function createOnboardingRepo({ db, clock }: RepoContext) {
  return {
    /**
     * One transaction, idempotent: settings, the first budget and the opening balance either all
     * land or none does, and running it again simply overwrites the same rows.
     */
    complete: (input: OnboardingInput, today: ISODate): Promise<void> =>
      db.transaction('rw', [db.settings, db.budgets, db.pots, db.potTransactions], async () => {
        assertCents(input.defaultWeeklyIncomeCents, { allowZero: true })
        assertCents(input.totalLimitCents, { allowZero: true })
        assertCents(input.openingBalanceCents, { allowZero: true })
        assertDate(input.trackingSince)
        assertDate(today)
        if (input.trackingSince > today) throw new DomainError('invalid-date')

        const settings = await db.settings.get(SETTINGS_ID)
        if (!settings) throw new DomainError('not-found', 'Settings row is missing.')
        const now = clock.now()

        // The chosen limit applies from the first tracked week on. The seeded default row(s) get
        // the same limit, otherwise the seed would win for the weeks after it.
        const firstWeek = weekStartOf(input.trackingSince)
        const existing = await db.budgets.toArray()
        await db.budgets.bulkPut(
          existing.filter(isActive).map((budget) => ({
            ...budget,
            totalLimitCents: input.totalLimitCents,
            updatedAt: now,
          })),
        )
        const first = existing.find((budget) => budget.id === firstWeek)
        await db.budgets.put({
          id: firstWeek,
          totalLimitCents: input.totalLimitCents,
          categoryLimits: first?.categoryLimits ?? {},
          createdAt: first?.createdAt ?? now,
          updatedAt: now,
          deletedAt: null,
        })

        const opening = await db.potTransactions.get(OPENING_BALANCE_TX_ID)
        if (input.openingBalanceCents > 0) {
          await db.potTransactions.put({
            id: OPENING_BALANCE_TX_ID,
            potId: PRIMARY_POT_ID,
            amountCents: input.openingBalanceCents,
            date: input.trackingSince,
            type: 'manual-deposit',
            note: 'Startguthaben',
            createdAt: opening?.createdAt ?? now,
            updatedAt: now,
            deletedAt: null,
          })
        } else if (opening && isActive(opening)) {
          await db.potTransactions.put({ ...opening, deletedAt: now, updatedAt: now })
        }

        await db.settings.put({
          ...settings,
          defaultWeeklyIncomeCents: input.defaultWeeklyIncomeCents,
          trackingSince: input.trackingSince,
          onboardingDone: true,
          updatedAt: now,
        })
      }),
  }
}
