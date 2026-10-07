import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import sample from '@/lib/__fixtures__/commbank-sample.csv?raw'
import { parseBankFile, type ParsedBankRow } from '@/lib/bankImport'
import { checkLedgerInvariants } from '@/lib/ledger'
import { potBalance } from '@/lib/savings'
import { PRIMARY_POT_ID } from '@/lib/types'
import { DomainError } from './errors'
import { loadAppData } from './queries'
import { createRepos, type Repos } from './repos'
import { FinanceDB } from './schema'

const GROCERIES = 'cat:groceries'
const WEEK = '2026-09-14' // Mon … Sun 2026-09-20

let db: FinanceDB
let repos: Repos
let tick = 0
let counter = 0

const fileRows = (text: string = sample): ParsedBankRow[] => {
  const result = parseBankFile(text)
  if (!result.ok) throw new Error(result.reason)
  return result.rows
}
/** Whole lines of the sample whose day (DD) passes the test – a second, overlapping export. */
const exportOf = (keep: (day: string) => boolean) =>
  fileRows(
    sample
      .trim()
      .split('\r\n')
      .filter((line) => keep(line.slice(0, 2)))
      .join('\r\n'),
  )

beforeEach(async () => {
  db = new FinanceDB(`bank-test-${++counter}`)
  tick = 1_000_000
  repos = createRepos(db, { now: () => ++tick })
  await db.open()
  await repos.settings.update({ trackingSince: '2026-09-07' })
})

afterEach(async () => {
  expect(checkLedgerInvariants(await loadAppData(db))).toEqual([])
  await db.delete()
})

const expectCode = (promise: Promise<unknown>, code: string) =>
  expect(promise).rejects.toSatisfy((error) => error instanceof DomainError && error.code === code)
const stored = () => db.bankTransactions.toArray()
const byText = async (start: string) =>
  (await stored()).filter((tx) => tx.description.startsWith(start))
const primaryBalance = async () => potBalance(await db.potTransactions.toArray(), PRIMARY_POT_ID)

describe('bank.import', () => {
  it('stores every line once and creates no expense', async () => {
    const plan = await repos.bank.import(fileRows())
    expect(plan.inbox).toHaveLength(16)
    expect(plan.credits).toHaveLength(2)
    // booked on the 8th, but bought on the 4th – before tracking began
    expect(plan.beforeTracking.map((row) => row.valueDate)).toEqual(['2026-09-04'])
    expect(plan).toMatchObject({ matched: [], alreadyImported: [], gap: false })

    const rows = await stored()
    expect(rows).toHaveLength(19)
    expect(new Set(rows.map((tx) => tx.batchId)).size).toBe(1)
    expect(rows.filter((tx) => tx.status === 'open')).toHaveLength(18)
    expect(rows.filter((tx) => tx.status === 'ignored')).toHaveLength(1)
    expect(rows.every((tx) => tx.expenseId === null)).toBe(true)
    expect(rows.find((tx) => tx.description.startsWith('WOOLWORTHS 5678'))).toMatchObject({
      source: 'commbank',
      date: '2026-09-15',
      valueDate: '2026-09-12',
      amountCents: -1_105,
      createdAt: expect.any(Number),
      deletedAt: null,
    })
    expect(await db.expenses.count()).toBe(0)
  })

  it('adds nothing when the same export is imported again', async () => {
    await repos.bank.import(fileRows())
    const before = await stored()

    const again = await repos.bank.import(fileRows())
    expect(again.alreadyImported).toHaveLength(19)
    expect(again).toMatchObject({ inbox: [], credits: [], matched: [], gap: false })
    expect(await stored()).toEqual(before)
  })

  it('adds only the new lines of an overlapping export', async () => {
    await repos.bank.import(exportOf((day) => day <= '15')) // 08.–15. Sep.
    expect(await stored()).toHaveLength(13)

    const plan = await repos.bank.import(exportOf((day) => day >= '15')) // 15.–20. Sep.
    expect(plan.alreadyImported).toHaveLength(3)
    expect(plan.inbox.length + plan.credits.length).toBe(6)
    expect(plan.gap).toBe(false)

    const rows = await stored()
    expect(rows).toHaveLength(19)
    // the two identical vending lines of 15 Sep. are still exactly two
    expect(await byText('QUICK VENDING')).toHaveLength(2)
    expect(new Set(rows.map((tx) => tx.id))).toEqual(new Set(fileRows().map((row) => row.id)))
  })

  it('stays idempotent when two imports of the same file race', async () => {
    const plans = await Promise.all([repos.bank.import(fileRows()), repos.bank.import(fileRows())])
    expect(plans.map((plan) => plan.alreadyImported.length).sort()).toEqual([0, 19])
    expect(await stored()).toHaveLength(19)
  })

  it('does not bring back a line the user already dealt with', async () => {
    await repos.bank.import(fileRows())
    const [tavern] = await byText('Seaside Tavern')
    await repos.bank.ignore(tavern!.id)
    const [fuel] = await byText('4321-EXPRESS')
    await repos.bank.assign(fuel!.id, GROCERIES)

    await repos.bank.import(fileRows())
    expect((await byText('Seaside Tavern'))[0]!.status).toBe('ignored')
    expect((await byText('4321-EXPRESS'))[0]!.status).toBe('assigned')
    expect(await db.expenses.count()).toBe(1)
  })

  it('links a hand-entered expense instead of doubling it', async () => {
    // entered by hand on the day of the purchase; the bank books it two days later
    const manual = await repos.expenses.add({
      date: '2026-09-16',
      amountCents: 3_764,
      categoryId: GROCERIES,
    })
    const plan = await repos.bank.import(fileRows())
    expect(plan.matched.map(({ expense }) => expense.id)).toEqual([manual.id])
    expect(plan.inbox).toHaveLength(15)

    const [line] = await byText('WOOLWORTHS 1234 MIDLAND WA AUS Card xx1234 Value Date: 16')
    expect(line).toMatchObject({ status: 'matched', expenseId: manual.id })
    expect(await db.expenses.count()).toBe(1)

    // the next export does not claim the same expense for another line
    const second = await repos.bank.import(fileRows())
    expect(second.matched).toEqual([])
  })

  it('leaves it to the user when two identical lines compete for one expense', async () => {
    await repos.expenses.add({ date: '2026-09-10', amountCents: 320, categoryId: GROCERIES })
    const plan = await repos.bank.import(fileRows())
    expect(plan.matched).toEqual([])
    expect(plan.ambiguous.map((row) => row.description.slice(0, 13))).toEqual([
      'QUICK VENDING',
      'QUICK VENDING',
    ])
    expect((await byText('QUICK VENDING')).every((tx) => tx.status === 'open')).toBe(true)
  })

  it('keeps a match open when the preview said so', async () => {
    await repos.expenses.add({ date: '2026-09-16', amountCents: 3_764, categoryId: GROCERIES })
    const target = fileRows().find((row) => row.amountCents === -3_764)!

    const plan = await repos.bank.import(fileRows(), { keepOpen: new Set([target.id]) })
    expect(plan.matched).toEqual([])
    expect((await db.bankTransactions.get(target.id))!.status).toBe('open')
  })

  it('stores lines from before tracking began as ignored', async () => {
    await repos.settings.update({ trackingSince: '2026-09-16' }) // week starts Mon 14 Sep.
    const plan = await repos.bank.import(fileRows())
    // nine lines booked before the 14th, plus three booked on the 15th but bought on the 10th/12th
    expect(plan.beforeTracking).toHaveLength(12)
    const rows = await stored()
    expect(rows.filter((tx) => tx.status === 'ignored')).toHaveLength(12)
    expect(rows.filter((tx) => tx.status === 'open' && tx.amountCents < 0)).toHaveLength(6)
  })

  it('reports a gap between two exports', async () => {
    await repos.bank.import(exportOf((day) => day <= '10'))
    const plan = await repos.bank.import(exportOf((day) => day >= '18'))
    expect(plan.gap).toBe(true)
  })
})

describe('bank.assign', () => {
  beforeEach(async () => {
    await repos.bank.import(fileRows())
  })

  it('creates the expense on the day of the purchase and takes the line out of the inbox', async () => {
    const [line] = await byText('WOOLWORTHS 5678')
    const expense = await repos.bank.assign(line!.id, GROCERIES)

    expect(expense).toMatchObject({
      date: '2026-09-12',
      amountCents: 1_105,
      categoryId: GROCERIES,
      note: 'WOOLWORTHS 5678 PERTH WA AUS',
      tags: [],
      fundedByPotId: null,
    })
    expect(await db.expenses.get(expense.id)).toEqual(expense)
    expect(await db.bankTransactions.get(line!.id)).toMatchObject({
      status: 'assigned',
      expenseId: expense.id,
    })
  })

  it('re-syncs a closed week and undo restores it exactly', async () => {
    await repos.weeks.close(WEEK, { incomeCents: 200_000 })
    expect(await primaryBalance()).toBe(200_000)

    const [tavern] = await byText('Seaside Tavern') // 19 Sep., A$16.80
    await repos.bank.assign(tavern!.id, GROCERIES)
    expect(await primaryBalance()).toBe(198_320)
    expect((await db.potTransactions.get(`auto:${WEEK}`))!.amountCents).toBe(198_320)

    await repos.bank.undoAssign(tavern!.id)
    expect(await primaryBalance()).toBe(200_000)
    expect(await db.bankTransactions.get(tavern!.id)).toMatchObject({
      status: 'open',
      expenseId: null,
    })
    expect((await db.expenses.toArray()).every((expense) => expense.deletedAt !== null)).toBe(true)

    // and it can be assigned again
    await repos.bank.assign(tavern!.id, GROCERIES)
    expect(await primaryBalance()).toBe(198_320)
  })

  it('refuses credits, lines that are done, unknown lines and unknown categories', async () => {
    const [wage] = await byText('Fast Transfer From ACME')
    await expectCode(repos.bank.assign(wage!.id, GROCERIES), 'not-open')
    await expectCode(repos.bank.ignore(wage!.id), 'not-open')

    const [tavern] = await byText('Seaside Tavern')
    await expectCode(repos.bank.assign(tavern!.id, 'cat:nope'), 'unknown-category')
    expect((await db.bankTransactions.get(tavern!.id))!.status).toBe('open') // rolled back
    expect(await db.expenses.count()).toBe(0)

    await repos.bank.assign(tavern!.id, GROCERIES)
    await expectCode(repos.bank.assign(tavern!.id, GROCERIES), 'not-open')
    await expectCode(repos.bank.assign('bank:nope:0', GROCERIES), 'not-found')
    await expectCode(repos.bank.undoAssign('bank:nope:0'), 'not-found')
    expect(await db.expenses.count()).toBe(1)
  })

  it('undo only applies to assigned lines and survives an expense deleted in between', async () => {
    const [tavern] = await byText('Seaside Tavern')
    await expectCode(repos.bank.undoAssign(tavern!.id), 'not-open')

    const expense = await repos.bank.assign(tavern!.id, GROCERIES)
    await repos.expenses.remove(expense.id)
    // the deleted expense keeps its line – it does not come back by itself
    expect((await db.bankTransactions.get(tavern!.id))!.status).toBe('assigned')

    await repos.bank.undoAssign(tavern!.id)
    expect((await db.bankTransactions.get(tavern!.id))!.status).toBe('open')
  })
})

describe('bank.linkExisting / unlink / ignore / reopen', () => {
  beforeEach(async () => {
    await repos.bank.import(fileRows())
  })

  it('links a line to an expense by hand and takes the link back', async () => {
    const manual = await repos.expenses.add({
      date: '2026-09-19',
      amountCents: 1_700, // rounded by hand, so the import did not match it
      categoryId: GROCERIES,
    })
    const [tavern] = await byText('Seaside Tavern')
    await repos.bank.linkExisting(tavern!.id, manual.id)
    expect(await db.bankTransactions.get(tavern!.id)).toMatchObject({
      status: 'matched',
      expenseId: manual.id,
    })
    expect(await db.expenses.count()).toBe(1)

    await repos.bank.unlink(tavern!.id)
    expect(await db.bankTransactions.get(tavern!.id)).toMatchObject({
      status: 'open',
      expenseId: null,
    })
    expect((await db.expenses.get(manual.id))!.deletedAt).toBeNull()
  })

  it('never ties two lines to one expense, nor a line to a missing expense', async () => {
    const manual = await repos.expenses.add({
      date: '2026-09-10',
      amountCents: 320,
      categoryId: GROCERIES,
    })
    const [first, second] = await byText('QUICK VENDING')
    await repos.bank.linkExisting(first!.id, manual.id)
    await expectCode(repos.bank.linkExisting(second!.id, manual.id), 'already-linked')
    await expectCode(repos.bank.linkExisting(first!.id, manual.id), 'not-open')
    await expectCode(repos.bank.linkExisting(second!.id, 'nope'), 'not-found')

    await repos.expenses.remove(manual.id)
    await repos.bank.unlink(first!.id)
    await expectCode(repos.bank.linkExisting(first!.id, manual.id), 'not-found')
    await expectCode(repos.bank.unlink(first!.id), 'not-open')
  })

  it('ignores a line and brings it back', async () => {
    const [tavern] = await byText('Seaside Tavern')
    await expectCode(repos.bank.reopen(tavern!.id), 'not-open')

    await repos.bank.ignore(tavern!.id)
    expect((await db.bankTransactions.get(tavern!.id))!.status).toBe('ignored')
    await expectCode(repos.bank.ignore(tavern!.id), 'not-open')

    await repos.bank.reopen(tavern!.id)
    expect((await db.bankTransactions.get(tavern!.id))!.status).toBe('open')
  })
})
