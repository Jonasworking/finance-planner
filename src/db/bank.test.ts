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
    const { expense } = await repos.bank.assign(line!.id, GROCERIES)

    expect(expense).toMatchObject({
      date: '2026-09-12',
      amountCents: 1_105,
      categoryId: GROCERIES,
      note: 'Woolworths',
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

    const { expense } = await repos.bank.assign(tavern!.id, GROCERIES)
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

describe('merchant rules', () => {
  const rules = () => db.merchantRules.toArray()
  const rule = (pattern: string) => db.merchantRules.get(`rule:${pattern}`)

  beforeEach(async () => {
    await repos.bank.import(fileRows())
  })

  it('learns a rule with every assignment and confirms it with the next branch', async () => {
    const [first] = await byText('WOOLWORTHS 5678')
    const [second] = await byText('WOOLWORTHS 1234 MIDLAND WA AUS Card xx1234 Value Date: 16')
    expect(await rules()).toEqual([])

    await repos.bank.assign(first!.id, GROCERIES)
    expect(await rules()).toMatchObject([
      {
        id: 'rule:woolworths',
        pattern: 'woolworths',
        action: 'categorize',
        categoryId: GROCERIES,
        confirmations: 1,
      },
    ])

    await repos.bank.assign(second!.id, GROCERIES)
    expect(await rules()).toHaveLength(1)
    expect(await rule('woolworths')).toMatchObject({ confirmations: 2, lastUsedAt: tick })
  })

  it('starts over when the merchant gets another category', async () => {
    const [first] = await byText('WOOLWORTHS 5678')
    const [second] = await byText('WOOLWORTHS 1234 MIDLAND WA AUS Card xx1234 Value Date: 16')
    await repos.bank.assign(first!.id, GROCERIES)
    await repos.bank.assign(second!.id, 'cat:eating-out')
    expect(await rule('woolworths')).toMatchObject({
      categoryId: 'cat:eating-out',
      confirmations: 1,
    })
  })

  it('undo restores expense, line and rule – a new rule goes, a changed one comes back', async () => {
    const [first] = await byText('WOOLWORTHS 5678')
    const [second] = await byText('WOOLWORTHS 1234 MIDLAND WA AUS Card xx1234 Value Date: 16')

    const one = await repos.bank.assign(first!.id, GROCERIES)
    expect(one.rule).toBeNull()
    const before = await rule('woolworths')

    const two = await repos.bank.assign(second!.id, 'cat:eating-out')
    expect(two.rule).toEqual(before)
    await repos.bank.undoAssign(second!.id, two.rule)
    expect(await rule('woolworths')).toEqual(before)

    await repos.bank.undoAssign(first!.id, one.rule)
    expect((await rule('woolworths'))!.deletedAt).not.toBeNull()
    expect((await db.expenses.toArray()).every((expense) => expense.deletedAt !== null)).toBe(true)
    expect((await stored()).filter((tx) => tx.status === 'assigned')).toEqual([])

    // without the hand-back the rule is left alone
    const again = await repos.bank.assign(first!.id, GROCERIES)
    expect(again.rule).toMatchObject({ deletedAt: expect.any(Number) })
    await repos.bank.undoAssign(first!.id)
    expect(await rule('woolworths')).toMatchObject({ confirmations: 1, deletedAt: null })
  })

  it('learns "keine Ausgabe" and what a hand-made link says', async () => {
    const [hostel] = await byText('HARBOUR HOSTEL')
    const ignored = await repos.bank.ignore(hostel!.id)
    expect(await rule('harbour hostel perth')).toMatchObject({
      action: 'ignore',
      categoryId: null,
      confirmations: 1,
    })
    await repos.bank.reopen(hostel!.id, ignored)
    expect((await rule('harbour hostel perth'))!.deletedAt).not.toBeNull()

    const manual = await repos.expenses.add({
      date: '2026-09-19',
      amountCents: 1_700,
      categoryId: 'cat:eating-out',
    })
    const [tavern] = await byText('Seaside Tavern')
    const linked = await repos.bank.linkExisting(tavern!.id, manual.id)
    expect(await rule('seaside tavern fremantle')).toMatchObject({ categoryId: 'cat:eating-out' })
    await repos.bank.unlink(tavern!.id, linked)
    expect((await rule('seaside tavern fremantle'))!.deletedAt).not.toBeNull()
  })

  it('removes and restores a rule', async () => {
    const [first] = await byText('WOOLWORTHS 5678')
    await repos.bank.assign(first!.id, GROCERIES)

    await repos.bank.removeRule('rule:woolworths')
    await repos.bank.removeRule('rule:woolworths') // idempotent
    expect((await rule('woolworths'))!.deletedAt).not.toBeNull()
    await repos.bank.restoreRule('rule:woolworths')
    await repos.bank.restoreRule('rule:woolworths')
    expect((await rule('woolworths'))!.deletedAt).toBeNull()

    await expectCode(repos.bank.removeRule('rule:nope'), 'not-found')
    await expectCode(repos.bank.restoreRule('rule:nope'), 'not-found')
  })

  it('applies known rules in one step and takes all of it back', async () => {
    const [w1] = await byText('WOOLWORTHS 5678')
    const [w2] = await byText('WOOLWORTHS 1234 MIDLAND WA AUS Card xx1234 Value Date: 16')
    const [w3] = await byText('WOOLWORTHS 1234 MIDLAND WA AUS Card xx1234 Value Date: 08')
    const [hostel] = await byText('HARBOUR HOSTEL')
    await repos.bank.assign(w1!.id, GROCERIES)
    await repos.bank.assign(w2!.id, GROCERIES)
    const before = await rules()

    const done = await repos.bank.applyRules([
      { txId: w3!.id, target: { action: 'categorize', categoryId: GROCERIES } },
      { txId: hostel!.id, target: { action: 'ignore', categoryId: null } },
      {
        txId: (await byText('Seaside Tavern'))[0]!.id,
        target: { action: 'income', categoryId: null },
      },
    ])
    expect(done).toEqual([
      { txId: w3!.id, action: 'categorize' },
      { txId: hostel!.id, action: 'ignore' },
    ])
    expect((await db.bankTransactions.get(w3!.id))!.status).toBe('assigned')
    expect((await db.bankTransactions.get(hostel!.id))!.status).toBe('ignored')
    expect(await db.expenses.count()).toBe(3)
    // a rule acting by itself is no confirmation
    expect(await rules()).toEqual(before)

    await repos.bank.undoApplyRules(done)
    expect((await db.bankTransactions.get(w3!.id))!.status).toBe('open')
    expect((await db.bankTransactions.get(hostel!.id))!.status).toBe('open')
    expect(
      (await db.expenses.toArray()).filter((expense) => expense.deletedAt === null),
    ).toHaveLength(2)
    expect(await rules()).toEqual(before)
  })

  it('rolls back the whole batch when one line cannot be applied', async () => {
    const [w1] = await byText('WOOLWORTHS 5678')
    await expectCode(
      repos.bank.applyRules([
        { txId: w1!.id, target: { action: 'categorize', categoryId: GROCERIES } },
        { txId: 'bank:nope:0', target: { action: 'ignore', categoryId: null } },
      ]),
      'not-found',
    )
    expect((await db.bankTransactions.get(w1!.id))!.status).toBe('open')
    expect(await db.expenses.count()).toBe(0)
  })
})

describe('bank.import learns from hand-entered matches', () => {
  it('creates a rule from the category of the matched expense', async () => {
    await repos.expenses.add({ date: '2026-09-16', amountCents: 3_764, categoryId: GROCERIES })
    await repos.bank.import(fileRows())
    expect(await db.merchantRules.toArray()).toMatchObject([
      { pattern: 'woolworths', categoryId: GROCERIES, confirmations: 1 },
    ])
  })
})

describe('income source', () => {
  beforeEach(async () => {
    await repos.bank.import(fileRows())
  })

  it('marks the sender of a credit as the employer and takes it back', async () => {
    const [wage] = await byText('Fast Transfer From ACME')
    const before = await repos.bank.markIncomeSource(wage!.id)
    expect(before).toBeNull()
    expect(await db.merchantRules.get('rule:acme farms pty')).toMatchObject({
      action: 'income',
      categoryId: null,
      deletedAt: null,
    })
    // the credit itself is untouched – it never becomes an expense
    expect(await db.bankTransactions.get(wage!.id)).toMatchObject({
      status: 'open',
      expenseId: null,
    })

    await repos.bank.unmarkIncomeSource(wage!.id, before)
    expect((await db.merchantRules.get('rule:acme farms pty'))!.deletedAt).not.toBeNull()
  })

  it('only accepts credits', async () => {
    const [tavern] = await byText('Seaside Tavern')
    await expectCode(repos.bank.markIncomeSource(tavern!.id), 'not-open')
    await expectCode(repos.bank.markIncomeSource('bank:nope:0'), 'not-found')
  })
})

describe('bank.backToInbox', () => {
  beforeEach(async () => {
    await repos.bank.import(fileRows())
  })

  it('brings an assigned line back and removes its expense, also in a closed week', async () => {
    await repos.weeks.close(WEEK, { incomeCents: 200_000 })
    const [tavern] = await byText('Seaside Tavern')
    await repos.bank.assign(tavern!.id, GROCERIES)
    expect(await primaryBalance()).toBe(198_320)
    const rule = await db.merchantRules.get('rule:seaside tavern fremantle')

    await repos.bank.backToInbox(tavern!.id)
    expect(await db.bankTransactions.get(tavern!.id)).toMatchObject({
      status: 'open',
      expenseId: null,
    })
    expect((await db.expenses.toArray()).every((expense) => expense.deletedAt !== null)).toBe(true)
    expect(await primaryBalance()).toBe(200_000)
    // one booking taken back says nothing about the merchant
    expect(await db.merchantRules.get('rule:seaside tavern fremantle')).toEqual(rule)
  })

  it('brings back a line whose expense was deleted in the meantime', async () => {
    const [tavern] = await byText('Seaside Tavern')
    const { expense } = await repos.bank.assign(tavern!.id, GROCERIES)
    await repos.expenses.remove(expense.id)
    await repos.bank.backToInbox(tavern!.id)
    expect((await db.bankTransactions.get(tavern!.id))!.status).toBe('open')
  })

  it('brings back linked and ignored lines without touching any expense', async () => {
    const manual = await repos.expenses.add({
      date: '2026-09-19',
      amountCents: 1_700,
      categoryId: GROCERIES,
    })
    const [tavern] = await byText('Seaside Tavern')
    const [hostel] = await byText('HARBOUR HOSTEL')
    await repos.bank.linkExisting(tavern!.id, manual.id)
    await repos.bank.ignore(hostel!.id)

    await repos.bank.backToInbox(tavern!.id)
    await repos.bank.backToInbox(hostel!.id)
    expect((await stored()).filter((tx) => tx.status === 'matched')).toEqual([])
    expect((await db.bankTransactions.get(hostel!.id))!.status).toBe('open')
    expect((await db.expenses.get(manual.id))!.deletedAt).toBeNull()
  })

  it('refuses open lines, credits and unknown lines', async () => {
    const [tavern] = await byText('Seaside Tavern')
    const [wage] = await byText('Fast Transfer From ACME')
    await expectCode(repos.bank.backToInbox(tavern!.id), 'not-open')
    await expectCode(repos.bank.backToInbox(wage!.id), 'not-open')
    await expectCode(repos.bank.backToInbox('bank:nope:0'), 'not-found')
  })

  it('undo puts a line back exactly as it was, with its own expense', async () => {
    await repos.weeks.close(WEEK, { incomeCents: 200_000 })
    const [tavern] = await byText('Seaside Tavern')
    const [hostel] = await byText('HARBOUR HOSTEL')
    const { expense } = await repos.bank.assign(tavern!.id, GROCERIES)
    await repos.bank.ignore(hostel!.id)
    const rules = await db.merchantRules.toArray()

    await repos.bank.backToInbox(tavern!.id)
    await repos.bank.backToInbox(hostel!.id)
    await repos.bank.restoreDone(tavern!.id, { status: 'assigned', expenseId: expense.id })
    await repos.bank.restoreDone(hostel!.id, { status: 'ignored', expenseId: null })

    expect(await db.bankTransactions.get(tavern!.id)).toMatchObject({
      status: 'assigned',
      expenseId: expense.id,
    })
    expect((await db.expenses.get(expense.id))!.deletedAt).toBeNull()
    expect(await db.expenses.count()).toBe(1) // the same expense, not a second one
    expect(await primaryBalance()).toBe(198_320)
    expect((await db.bankTransactions.get(hostel!.id))!.status).toBe('ignored')
    expect(await db.merchantRules.toArray()).toEqual(rules)

    await expectCode(
      repos.bank.restoreDone(tavern!.id, { status: 'assigned', expenseId: expense.id }),
      'not-open',
    )
  })

  it('undo refuses an expense that is gone or belongs to another line', async () => {
    const [first, second] = await byText('QUICK VENDING')
    const { expense } = await repos.bank.assign(first!.id, GROCERIES)
    await expectCode(
      repos.bank.restoreDone(second!.id, { status: 'matched', expenseId: expense.id }),
      'already-linked',
    )
    await expectCode(
      repos.bank.restoreDone(second!.id, { status: 'assigned', expenseId: 'nope' }),
      'not-found',
    )
    await expectCode(
      repos.bank.restoreDone(second!.id, { status: 'matched', expenseId: null }),
      'not-found',
    )
  })
})
