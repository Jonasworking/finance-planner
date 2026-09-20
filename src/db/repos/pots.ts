import { transferTxIds } from '@/lib/ids'
import {
  validateDeposit,
  validateTransfer,
  validateWithdrawal,
  type MoveError,
} from '@/lib/savings'
import {
  isActive,
  PRIMARY_POT_ID,
  type Cents,
  type ISODate,
  type Pot,
  type PotTransaction,
} from '@/lib/types'
import { DomainError } from '../errors'
import { assertDate, balanceOf, ledgerTables, newId, type RepoContext } from './context'

export type PotInput = Pick<Pot, 'name'> &
  Partial<Pick<Pot, 'targetCents' | 'deadline' | 'color' | 'icon'>>

export type PotPatch = Partial<
  Pick<Pot, 'name' | 'targetCents' | 'deadline' | 'color' | 'icon' | 'sortOrder'>
>

const fail = (problem: MoveError | null): void => {
  if (problem) throw new DomainError(problem)
}

export function createPotsRepo(ctx: RepoContext) {
  const { db, clock } = ctx
  const inLedger = <T>(work: () => Promise<T>) => db.transaction('rw', ledgerTables(ctx), work)

  async function mustGet(id: string): Promise<Pot> {
    const pot = await db.pots.get(id)
    if (!pot || !isActive(pot)) throw new DomainError('unknown-pot')
    return pot
  }

  const manualTx = (
    potId: string,
    amountCents: Cents,
    date: ISODate,
    type: PotTransaction['type'],
    extra: Partial<PotTransaction> = {},
  ): PotTransaction => {
    const now = clock.now()
    return {
      id: newId(),
      potId,
      amountCents,
      date,
      type,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      ...extra,
    }
  }

  return {
    create: (input: PotInput): Promise<Pot> =>
      inLedger(async () => {
        const now = clock.now()
        const pots = await db.pots.toArray()
        const pot: Pot = {
          id: newId(),
          name: input.name,
          targetCents: input.targetCents ?? null,
          deadline: input.deadline ?? null,
          color: input.color ?? 'cat-1',
          icon: input.icon ?? 'PiggyBank',
          sortOrder: Math.max(-1, ...pots.map((row) => row.sortOrder)) + 1,
          archived: false,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        }
        if (pot.deadline) assertDate(pot.deadline)
        await db.pots.add(pot)
        return pot
      }),

    update: (id: string, patch: PotPatch): Promise<Pot> =>
      inLedger(async () => {
        const pot = await mustGet(id)
        if (patch.deadline) assertDate(patch.deadline)
        const next = { ...pot, ...patch, updatedAt: clock.now() }
        await db.pots.put(next)
        return next
      }),

    /** Pots are archived, never deleted – and only when empty. "Nur gespart" always stays. */
    archive: (id: string): Promise<void> =>
      inLedger(async () => {
        if (id === PRIMARY_POT_ID) throw new DomainError('primary-pot-protected')
        const pot = await mustGet(id)
        if ((await balanceOf(ctx, id)) !== 0) throw new DomainError('pot-not-empty')
        await db.pots.put({ ...pot, archived: true, updatedAt: clock.now() })
      }),

    unarchive: (id: string): Promise<void> =>
      inLedger(async () => {
        const pot = await mustGet(id)
        await db.pots.put({ ...pot, archived: false, updatedAt: clock.now() })
      }),

    deposit: (
      potId: string,
      amountCents: Cents,
      date: ISODate,
      note?: string,
    ): Promise<PotTransaction> =>
      inLedger(async () => {
        assertDate(date)
        fail(validateDeposit({ pot: await db.pots.get(potId), amountCents }))
        const tx = manualTx(potId, amountCents, date, 'manual-deposit', { note })
        await db.potTransactions.add(tx)
        return tx
      }),

    withdraw: (
      potId: string,
      amountCents: Cents,
      date: ISODate,
      note?: string,
    ): Promise<PotTransaction> =>
      inLedger(async () => {
        assertDate(date)
        fail(
          validateWithdrawal({
            pot: await db.pots.get(potId),
            amountCents,
            balanceCents: await balanceOf(ctx, potId),
          }),
        )
        const tx = manualTx(potId, -amountCents, date, 'withdrawal', { note })
        await db.potTransactions.add(tx)
        return tx
      }),

    /** Two legs with a shared transferId, written atomically. Never overdraws the source. */
    transfer: (input: {
      fromPotId: string
      toPotId: string
      amountCents: Cents
      date: ISODate
      note?: string
    }): Promise<string> =>
      inLedger(async () => {
        assertDate(input.date)
        fail(
          validateTransfer({
            from: await db.pots.get(input.fromPotId),
            to: await db.pots.get(input.toPotId),
            amountCents: input.amountCents,
            fromBalanceCents: await balanceOf(ctx, input.fromPotId),
          }),
        )
        const transferId = newId()
        const ids = transferTxIds(transferId)
        const shared = { transferId, note: input.note }
        await db.potTransactions.bulkAdd([
          manualTx(input.fromPotId, -input.amountCents, input.date, 'transfer-out', {
            ...shared,
            id: ids.out,
          }),
          manualTx(input.toPotId, input.amountCents, input.date, 'transfer-in', {
            ...shared,
            id: ids.in,
          }),
        ])
        return transferId
      }),

    /**
     * Removes a manual booking (both legs of a transfer). Derived bookings (weekly savings, pot
     * funding) follow their week/expense and cannot be deleted directly. A pot never ends up
     * negative because money that was already moved on gets "un-deposited".
     */
    removeTransaction: (id: string): Promise<void> =>
      inLedger(async () => {
        const tx = await db.potTransactions.get(id)
        if (!tx || !isActive(tx)) throw new DomainError('not-found')
        if (tx.type === 'auto-weekly' || tx.type === 'expense-funding') {
          throw new DomainError('derived-transaction')
        }

        const legs = tx.transferId
          ? (await db.potTransactions.bulkGet(Object.values(transferTxIds(tx.transferId)))).filter(
              (leg): leg is PotTransaction => leg !== undefined && isActive(leg),
            )
          : [tx]

        for (const leg of legs) {
          if (leg.amountCents > 0 && (await balanceOf(ctx, leg.potId)) < leg.amountCents) {
            throw new DomainError('insufficient')
          }
        }
        const now = clock.now()
        await db.potTransactions.bulkPut(
          legs.map((leg) => ({ ...leg, deletedAt: now, updatedAt: now })),
        )
      }),
  }
}
