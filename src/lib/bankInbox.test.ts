import { describe, expect, it } from 'vitest'
import { makeBankTx, makeExpense, makeWeek, NOW } from '@/test/fixtures'
import type { ParsedBankRow } from './bankImport'
import {
  bankNote,
  byNewest,
  closedWeekFor,
  isInInbox,
  matchCandidates,
  planImport,
  purchaseDay,
  type ImportPlanInput,
} from './bankInbox'

let line = 0
const row = (
  date: string,
  amountCents: number,
  overrides: Partial<ParsedBankRow> = {},
): ParsedBankRow => ({
  id: `bank:${++line}:0`,
  line,
  date,
  valueDate: null,
  amountCents,
  description: 'SHOP PERTH AU',
  balanceCents: null,
  ...overrides,
})

const plan = (rows: ParsedBankRow[], overrides: Partial<ImportPlanInput> = {}) =>
  planImport({
    rows,
    existingIds: new Set(),
    latestStoredDate: null,
    expenses: [],
    linkedExpenseIds: new Set(),
    trackingSince: '2026-09-07',
    ...overrides,
  })

describe('purchaseDay / isInInbox', () => {
  it('prefers the value date of a card purchase', () => {
    expect(purchaseDay({ date: '2026-09-18', valueDate: '2026-09-16' })).toBe('2026-09-16')
    expect(purchaseDay({ date: '2026-09-18', valueDate: null })).toBe('2026-09-18')
  })

  it('counts open debits only', () => {
    expect(isInInbox(makeBankTx('2026-09-18', -500))).toBe(true)
    expect(isInInbox(makeBankTx('2026-09-18', 500))).toBe(false)
    expect(isInInbox(makeBankTx('2026-09-18', -500, { status: 'ignored' }))).toBe(false)
    expect(isInInbox(makeBankTx('2026-09-18', -500, { deletedAt: NOW }))).toBe(false)
  })
})

describe('matchCandidates', () => {
  const tx = { date: '2026-09-18', valueDate: '2026-09-16', amountCents: -1_250 }

  it('finds hand-entered expenses with the same amount around the purchase', () => {
    const expenses = [
      makeExpense('2026-09-12', 1_250, { id: 'too-early' }),
      makeExpense('2026-09-13', 1_250, { id: 'three-before' }),
      makeExpense('2026-09-16', 1_250, { id: 'purchase-day' }),
      makeExpense('2026-09-18', 1_250, { id: 'booking-day' }),
      makeExpense('2026-09-19', 1_250, { id: 'too-late' }),
      makeExpense('2026-09-16', 1_251, { id: 'other-amount' }),
      makeExpense('2026-09-16', 1_250, { id: 'deleted', deletedAt: NOW }),
      makeExpense('2026-09-16', 1_250, { id: 'linked' }),
    ]
    const found = matchCandidates(tx, expenses, new Set(['linked']))
    // newest first
    expect(found.map((expense) => expense.id)).toEqual([
      'booking-day',
      'purchase-day',
      'three-before',
    ])
  })

  it('uses the booking date when there is no value date', () => {
    const expenses = [
      makeExpense('2026-09-14', 1_250, { id: 'too-early' }),
      makeExpense('2026-09-15', 1_250, { id: 'in' }),
    ]
    expect(
      matchCandidates({ ...tx, valueDate: null }, expenses, new Set()).map((e) => e.id),
    ).toEqual(['in'])
  })

  it('orders same-day candidates by id and never matches a credit', () => {
    const expenses = [
      makeExpense('2026-09-16', 1_250, { id: 'b' }),
      makeExpense('2026-09-16', 1_250, { id: 'a' }),
    ]
    expect(matchCandidates(tx, expenses, new Set()).map((e) => e.id)).toEqual(['a', 'b'])
    expect(matchCandidates({ ...tx, amountCents: 1_250 }, expenses, new Set())).toEqual([])
  })
})

describe('planImport', () => {
  it('sorts new lines into inbox, credits and lines before tracking began', () => {
    const debit = row('2026-09-18', -1_250)
    const credit = row('2026-09-17', 143_260)
    const early = row('2026-09-06', -900)
    const earlyCredit = row('2026-09-05', 5_000)
    // the week tracking started in counts as a whole, even its days before `trackingSince`
    const sameWeek = row('2026-09-08', -300)
    // a card purchase belongs to the day of the purchase
    const bookedLater = row('2026-09-08', -700, { valueDate: '2026-09-04' })

    const result = plan([debit, credit, early, earlyCredit, sameWeek, bookedLater], {
      trackingSince: '2026-09-09',
    })
    expect(result.inbox).toEqual([debit, sameWeek])
    expect(result.credits).toEqual([credit])
    expect(result.beforeTracking).toEqual([early, earlyCredit, bookedLater])
    expect(result).toMatchObject({ matched: [], ambiguous: [], alreadyImported: [], gap: false })
  })

  it('skips what an earlier import already brought in', () => {
    const known = row('2026-09-17', -500)
    const fresh = row('2026-09-18', -600)
    const result = plan([fresh, known], {
      existingIds: new Set([known.id]),
      latestStoredDate: '2026-09-17',
    })
    expect(result.alreadyImported).toEqual([known])
    expect(result.inbox).toEqual([fresh])
    expect(result.gap).toBe(false)
  })

  it('links a debit to the one expense that was entered by hand', () => {
    const coffee = makeExpense('2026-09-16', 1_250, { id: 'coffee' })
    const other = makeExpense('2026-09-16', 999, { id: 'other' })
    const debit = row('2026-09-18', -1_250, { valueDate: '2026-09-16' })
    const unrelated = row('2026-09-18', -4_000)

    const result = plan([debit, unrelated], { expenses: [coffee, other] })
    expect(result.matched).toEqual([{ row: debit, expense: coffee }])
    expect(result.inbox).toEqual([unrelated])
    expect(result.ambiguous).toEqual([])
  })

  it('leaves the decision to the user when the match is not unambiguous', () => {
    // one line, two possible expenses
    const twoExpenses = plan([row('2026-09-18', -1_250)], {
      expenses: [makeExpense('2026-09-17', 1_250), makeExpense('2026-09-18', 1_250)],
    })
    expect(twoExpenses.matched).toEqual([])
    expect(twoExpenses.ambiguous).toEqual(twoExpenses.inbox)
    expect(twoExpenses.inbox).toHaveLength(1)

    // two lines, one possible expense
    const first = row('2026-09-18', -1_250)
    const second = row('2026-09-18', -1_250)
    const twoLines = plan([first, second], { expenses: [makeExpense('2026-09-18', 1_250)] })
    expect(twoLines.matched).toEqual([])
    expect(twoLines.ambiguous).toEqual([first, second])
  })

  it('matches the same amount in different weeks one to one (weekly rent)', () => {
    const rentA = makeExpense('2026-09-10', 21_000, { id: 'rent-a' })
    const rentB = makeExpense('2026-09-17', 21_000, { id: 'rent-b' })
    const lineA = row('2026-09-10', -21_000)
    const lineB = row('2026-09-18', -21_000)
    const result = plan([lineB, lineA], { expenses: [rentA, rentB] })
    expect(result.matched).toEqual([
      { row: lineB, expense: rentB },
      { row: lineA, expense: rentA },
    ])
  })

  it('does not link to an expense that already has a bank line, nor when told to keep it open', () => {
    const coffee = makeExpense('2026-09-18', 1_250, { id: 'coffee' })
    const debit = row('2026-09-18', -1_250)

    expect(
      plan([debit], { expenses: [coffee], linkedExpenseIds: new Set(['coffee']) }),
    ).toMatchObject({ matched: [], inbox: [debit], ambiguous: [] })
    expect(plan([debit], { expenses: [coffee], keepOpen: new Set([debit.id]) })).toMatchObject({
      matched: [],
      inbox: [debit],
      ambiguous: [debit],
    })
  })

  it('warns when a file does not connect to what is stored', () => {
    const rows = [row('2026-09-18', -500), row('2026-09-17', -600)]
    expect(plan(rows, { latestStoredDate: '2026-09-10' }).gap).toBe(true)
    // touching days are fine: an export is cut in the middle of a day
    expect(plan(rows, { latestStoredDate: '2026-09-17' }).gap).toBe(false)
    expect(plan(rows, { latestStoredDate: '2026-09-30' }).gap).toBe(false)
    expect(plan(rows, { latestStoredDate: null }).gap).toBe(false)
    expect(plan([], { latestStoredDate: '2026-09-10' }).gap).toBe(false)
    expect(
      plan(rows, { latestStoredDate: '2026-09-10', existingIds: new Set([rows[1]!.id]) }).gap,
    ).toBe(false)
  })
})

describe('bankNote', () => {
  it('drops the card suffix and keeps everything else', () => {
    expect(bankNote('WOOLWORTHS 1234 MIDLAND WA AUS Card xx1234 Value Date: 16/09/2026')).toBe(
      'WOOLWORTHS 1234 MIDLAND WA AUS',
    )
    expect(bankNote('Seaside Tavern Fremantle AU')).toBe('Seaside Tavern Fremantle AU')
    expect(bankNote('Direct Debit 123456 FITCLUBPERTH 800000002')).toBe(
      'Direct Debit 123456 FITCLUBPERTH 800000002',
    )
  })
})

describe('closedWeekFor', () => {
  const weeks = [
    makeWeek('2026-09-07', { closedAt: NOW }),
    makeWeek('2026-09-14'),
    makeWeek('2026-08-31', { closedAt: NOW, deletedAt: NOW }),
  ]

  it('names the closed week a new expense would change', () => {
    expect(closedWeekFor({ date: '2026-09-13', valueDate: null }, weeks)).toBe('2026-09-07')
    // the purchase counts, not the booking
    expect(closedWeekFor({ date: '2026-09-15', valueDate: '2026-09-12' }, weeks)).toBe('2026-09-07')
  })

  it('is null for open, unknown and deleted weeks', () => {
    expect(closedWeekFor({ date: '2026-09-15', valueDate: null }, weeks)).toBeNull()
    expect(closedWeekFor({ date: '2026-09-22', valueDate: null }, weeks)).toBeNull()
    expect(closedWeekFor({ date: '2026-09-01', valueDate: null }, weeks)).toBeNull()
  })
})

describe('byNewest', () => {
  it('sorts by booking date, then id', () => {
    const rows = [
      makeBankTx('2026-09-17', -1, { id: 'b' }),
      makeBankTx('2026-09-18', -1, { id: 'c' }),
      makeBankTx('2026-09-17', -1, { id: 'a' }),
    ]
    expect(rows.sort(byNewest).map((tx) => tx.id)).toEqual(['c', 'a', 'b'])
  })
})
