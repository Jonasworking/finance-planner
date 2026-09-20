import type { ISODate } from './types'

/*
 * Deterministic ids for seeded and derived rows. They make writes idempotent across reloads,
 * imports and a future sync: the same week closed on two devices yields the same row.
 */

export const autoWeeklyTxId = (weekStart: ISODate) => `auto:${weekStart}`

export const fundingTxId = (expenseId: string) => `fund:${expenseId}`

export const transferTxIds = (transferId: string) => ({
  out: `tr:${transferId}:out`,
  in: `tr:${transferId}:in`,
})

export const recurringInstanceId = (recurringId: string, date: ISODate) =>
  `rec:${recurringId}:${date}`

export const categoryId = (slug: string) => `cat:${slug}`
