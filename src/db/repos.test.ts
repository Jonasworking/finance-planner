import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { budgetUsage, resolveBudget } from '@/lib/budget'
import { isMonday } from '@/lib/dates'
import { expensesInWeek } from '@/lib/expenses'
import { checkLedgerInvariants } from '@/lib/ledger'
import { potBalances, summarizeWeek } from '@/lib/savings'
import { computeStreak } from '@/lib/streak'
import { isActive, PRIMARY_POT_ID } from '@/lib/types'
import { DomainError } from './errors'
import { loadAppData } from './queries'
import { createRepos, type Repos } from './repos'
import { FinanceDB } from './schema'

const WEEK = '2026-09-14' // Mon … Sun 2026-09-20
const NEXT_WEEK = '2026-09-21'
const GROCERIES = 'cat:groceries'

let db: FinanceDB
let repos: Repos
let tick = 0
let counter = 0

beforeEach(async () => {
  db = new FinanceDB(`repos-test-${++counter}`)
  tick = 1_000_000
  repos = createRepos(db, { now: () => ++tick })
  await db.open()
})

afterEach(async () => {
  // Whatever a test did through the repos, the books must still add up.
  expect(checkLedgerInvariants(await loadAppData(db))).toEqual([])
  await db.delete()
})

const balances = async () => potBalances(await db.potTransactions.toArray())
const autoTx = (weekStart: string) => db.potTransactions.get(`auto:${weekStart}`)
const expectCode = (promise: Promise<unknown>, code: string) =>
  expect(promise).rejects.toSatisfy((error) => error instanceof DomainError && error.code === code)

describe('seeds', () => {
  it('creates categories, the primary pot, settings and a first budget', async () => {
    const data = await loadAppData(db)
    expect(data.categories).toHaveLength(10)
    expect(data.categories.map((category) => category.id)).toContain(GROCERIES)
    expect(data.pots.map((pot) => pot.id)).toEqual([PRIMARY_POT_ID])
    expect(data.settings).toEqual([
      expect.objectContaining({ id: 'app', defaultWeeklyIncomeCents: 200_000 }),
    ])
    expect(data.budgets).toHaveLength(1)
    expect(isMonday(data.budgets[0]!.id)).toBe(true)
    expect(data.budgets[0]!.totalLimitCents).toBe(40_000)
  })
})

describe('closing a week', () => {
  it('books income − spending into "Nur gespart" on the week’s Sunday', async () => {
    await repos.expenses.add({ date: '2026-09-15', amountCents: 31_250, categoryId: GROCERIES })
    await repos.weeks.close(WEEK, { incomeCents: 200_000 })

    expect(await autoTx(WEEK)).toMatchObject({
      potId: PRIMARY_POT_ID,
      amountCents: 168_750,
      date: '2026-09-20',
      type: 'auto-weekly',
      deletedAt: null,
    })
    expect(await balances()).toEqual({ [PRIMARY_POT_ID]: 168_750 })
  })

  it('is idempotent: closing twice keeps one booking and the original closedAt', async () => {
    const first = await repos.weeks.close(WEEK, { incomeCents: 200_000 })
    const booking = await autoTx(WEEK)
    const second = await repos.weeks.close(WEEK)

    expect(second.closedAt).toBe(first.closedAt)
    expect(await autoTx(WEEK)).toEqual(booking) // not even rewritten
    expect(await db.potTransactions.count()).toBe(1)
  })

  it('books a minus week as a negative amount', async () => {
    await repos.expenses.add({ date: '2026-09-16', amountCents: 45_000, categoryId: GROCERIES })
    await repos.weeks.close(WEEK, { incomeCents: 0, note: 'Keine Schichten' })
    expect((await autoTx(WEEK))?.amountCents).toBe(-45_000)
    expect(await balances()).toEqual({ [PRIMARY_POT_ID]: -45_000 })
  })

  it('needs an income and a Monday', async () => {
    await expectCode(repos.weeks.close(WEEK), 'income-missing')
    await expectCode(repos.weeks.close('2026-09-15', { incomeCents: 1 }), 'not-a-monday')
    await expectCode(repos.weeks.setIncome(WEEK, 12.5), 'invalid-amount')
    expect(await db.weeks.count()).toBe(0)
  })

  it('can use an income entered earlier, and refuses to clear it once closed', async () => {
    await repos.weeks.setIncome(WEEK, 190_000, 'Farm')
    expect(await autoTx(WEEK)).toBeUndefined()
    await repos.weeks.close(WEEK)
    expect((await autoTx(WEEK))?.amountCents).toBe(190_000)
    await expectCode(repos.weeks.setIncome(WEEK, null), 'week-closed')
  })

  it('removes the booking on reopen and revives the same row on re-close', async () => {
    await repos.weeks.close(WEEK, { incomeCents: 200_000 })
    await repos.weeks.reopen(WEEK)
    expect((await autoTx(WEEK))?.deletedAt).not.toBeNull()
    expect(await balances()).toEqual({})

    await repos.weeks.close(WEEK)
    expect(await autoTx(WEEK)).toMatchObject({ amountCents: 200_000, deletedAt: null })
    expect(await db.potTransactions.count()).toBe(1)
  })
})

describe('the expense write path keeps closed weeks in sync', () => {
  beforeEach(async () => {
    await repos.weeks.close(WEEK, { incomeCents: 200_000 })
    await repos.weeks.close(NEXT_WEEK, { incomeCents: 180_000 })
  })

  it('re-syncs on add, edit, delete and restore', async () => {
    const expense = await repos.expenses.add({
      date: '2026-09-15',
      amountCents: 10_000,
      categoryId: GROCERIES,
    })
    expect((await autoTx(WEEK))?.amountCents).toBe(190_000)

    await repos.expenses.update(expense.id, { amountCents: 25_000 })
    expect((await autoTx(WEEK))?.amountCents).toBe(175_000)

    await repos.expenses.remove(expense.id)
    expect((await autoTx(WEEK))?.amountCents).toBe(200_000)

    await repos.expenses.restore(expense.id)
    expect((await autoTx(WEEK))?.amountCents).toBe(175_000)
  })

  it('re-syncs BOTH weeks when the date moves across a week boundary', async () => {
    const expense = await repos.expenses.add({
      date: '2026-09-20',
      amountCents: 10_000,
      categoryId: GROCERIES,
    })
    await repos.expenses.update(expense.id, { date: '2026-09-21' })

    expect((await autoTx(WEEK))?.amountCents).toBe(200_000)
    expect((await autoTx(NEXT_WEEK))?.amountCents).toBe(170_000)
  })

  it('rejects invalid input without writing anything', async () => {
    await expectCode(
      repos.expenses.add({ date: '2026-09-15', amountCents: 0, categoryId: GROCERIES }),
      'invalid-amount',
    )
    await expectCode(
      repos.expenses.add({ date: '2026-02-30', amountCents: 1, categoryId: GROCERIES }),
      'invalid-date',
    )
    await expectCode(
      repos.expenses.add({ date: '2026-09-15', amountCents: 1, categoryId: 'cat:nope' }),
      'unknown-category',
    )
    await expectCode(repos.expenses.update('missing', { amountCents: 1 }), 'not-found')
    expect(await db.expenses.count()).toBe(0)
  })
})

describe('pot-funded expenses ("aus Topf bezahlt")', () => {
  let tripId: string

  beforeEach(async () => {
    tripId = (await repos.pots.create({ name: 'Reisen', targetCents: 300_000 })).id
    await repos.pots.deposit(tripId, 100_000, '2026-09-01')
    await repos.weeks.close(WEEK, { incomeCents: 200_000 })
  })

  it('takes the money from the pot and leaves the week’s savings alone', async () => {
    const flight = await repos.expenses.add({
      date: '2026-09-16',
      amountCents: 80_000,
      categoryId: 'cat:travel',
      fundedByPotId: tripId,
    })
    expect(await db.potTransactions.get(`fund:${flight.id}`)).toMatchObject({
      potId: tripId,
      amountCents: -80_000,
      date: '2026-09-16',
      type: 'expense-funding',
      expenseId: flight.id,
    })
    expect(await balances()).toEqual({ [tripId]: 20_000, [PRIMARY_POT_ID]: 200_000 })
  })

  it('cascades edits, un-funding and deletion', async () => {
    const flight = await repos.expenses.add({
      date: '2026-09-16',
      amountCents: 80_000,
      categoryId: 'cat:travel',
      fundedByPotId: tripId,
    })

    await repos.expenses.update(flight.id, { amountCents: 95_000, date: '2026-09-17' })
    expect(await db.potTransactions.get(`fund:${flight.id}`)).toMatchObject({
      amountCents: -95_000,
      date: '2026-09-17',
    })

    // Paid from the regular week instead: the pot gets its money back, the week pays.
    await repos.expenses.update(flight.id, { fundedByPotId: null })
    expect(await balances()).toEqual({ [tripId]: 100_000, [PRIMARY_POT_ID]: 105_000 })

    await repos.expenses.update(flight.id, { fundedByPotId: tripId })
    await repos.expenses.remove(flight.id)
    expect(await balances()).toEqual({ [tripId]: 100_000, [PRIMARY_POT_ID]: 200_000 })
  })

  it('can move the funding to another pot, including the primary one', async () => {
    const flight = await repos.expenses.add({
      date: '2026-09-16',
      amountCents: 80_000,
      categoryId: 'cat:travel',
      fundedByPotId: tripId,
    })
    await repos.expenses.update(flight.id, { fundedByPotId: PRIMARY_POT_ID })
    expect(await balances()).toEqual({ [tripId]: 100_000, [PRIMARY_POT_ID]: 120_000 })
  })

  it('never overdraws a pot and rolls the expense back', async () => {
    const add = repos.expenses.add({
      date: '2026-09-16',
      amountCents: 100_001,
      categoryId: 'cat:travel',
      fundedByPotId: tripId,
    })
    await expectCode(add, 'insufficient')
    await expectCode(
      repos.expenses.add({
        date: '2026-09-16',
        amountCents: 1,
        categoryId: 'cat:travel',
        fundedByPotId: 'pot:nope',
      }),
      'unknown-pot',
    )
    expect(await db.expenses.count()).toBe(0)

    // Raising an existing funded expense may reuse what it already holds.
    const flight = await repos.expenses.add({
      date: '2026-09-16',
      amountCents: 90_000,
      categoryId: 'cat:travel',
      fundedByPotId: tripId,
    })
    await repos.expenses.update(flight.id, { amountCents: 100_000 })
    await expectCode(repos.expenses.update(flight.id, { amountCents: 100_001 }), 'insufficient')
    expect((await db.expenses.get(flight.id))?.amountCents).toBe(100_000)
  })
})

describe('pots', () => {
  let tripId: string

  beforeEach(async () => {
    tripId = (await repos.pots.create({ name: 'Reisen' })).id
    await repos.pots.deposit(PRIMARY_POT_ID, 50_000, '2026-09-01', 'Startguthaben')
  })

  it('transfers atomically with two legs that cancel out', async () => {
    const transferId = await repos.pots.transfer({
      fromPotId: PRIMARY_POT_ID,
      toPotId: tripId,
      amountCents: 30_000,
      date: '2026-09-10',
    })
    expect(
      await db.potTransactions.bulkGet([`tr:${transferId}:out`, `tr:${transferId}:in`]),
    ).toEqual([
      expect.objectContaining({
        potId: PRIMARY_POT_ID,
        amountCents: -30_000,
        type: 'transfer-out',
        transferId,
      }),
      expect.objectContaining({
        potId: tripId,
        amountCents: 30_000,
        type: 'transfer-in',
        transferId,
      }),
    ])
    expect(await balances()).toEqual({ [PRIMARY_POT_ID]: 20_000, [tripId]: 30_000 })
  })

  it('rejects bad transfers without leaving a half-written one', async () => {
    const transfer = (patch: object) =>
      repos.pots.transfer({
        fromPotId: PRIMARY_POT_ID,
        toPotId: tripId,
        amountCents: 1_000,
        date: '2026-09-10',
        ...patch,
      })
    await expectCode(transfer({ amountCents: 50_001 }), 'insufficient')
    await expectCode(transfer({ toPotId: PRIMARY_POT_ID }), 'same-pot')
    await expectCode(transfer({ toPotId: 'pot:nope' }), 'unknown-pot')
    await expectCode(transfer({ amountCents: 0 }), 'non-positive')
    await expectCode(transfer({ date: 'yesterday' }), 'invalid-date')
    expect(await db.potTransactions.count()).toBe(1)
  })

  it('withdraws only what is there', async () => {
    await repos.pots.withdraw(PRIMARY_POT_ID, 50_000, '2026-09-11')
    await expectCode(repos.pots.withdraw(PRIMARY_POT_ID, 1, '2026-09-11'), 'insufficient')
    expect(await balances()).toEqual({ [PRIMARY_POT_ID]: 0 })
  })

  it('removes manual bookings (both transfer legs) but never derived ones', async () => {
    const transferId = await repos.pots.transfer({
      fromPotId: PRIMARY_POT_ID,
      toPotId: tripId,
      amountCents: 30_000,
      date: '2026-09-10',
    })
    await repos.pots.removeTransaction(`tr:${transferId}:in`)
    expect(await balances()).toEqual({ [PRIMARY_POT_ID]: 50_000 })

    await repos.weeks.close(WEEK, { incomeCents: 100 })
    await expectCode(repos.pots.removeTransaction(`auto:${WEEK}`), 'derived-transaction')
    await expectCode(repos.pots.removeTransaction('missing'), 'not-found')
  })

  it('does not let a removed deposit push a pot below zero', async () => {
    const deposit = await repos.pots.deposit(tripId, 10_000, '2026-09-02')
    await repos.pots.withdraw(tripId, 8_000, '2026-09-03')
    await expectCode(repos.pots.removeTransaction(deposit.id), 'insufficient')
  })

  it('restores a removed booking – both transfer legs – as the undo of a delete', async () => {
    const deposit = await repos.pots.deposit(tripId, 10_000, '2026-09-02')
    await repos.pots.removeTransaction(deposit.id)
    expect(await balances()).toEqual({ [PRIMARY_POT_ID]: 50_000 })
    await repos.pots.restoreTransaction(deposit.id)
    expect(await balances()).toEqual({ [PRIMARY_POT_ID]: 50_000, [tripId]: 10_000 })

    const transferId = await repos.pots.transfer({
      fromPotId: PRIMARY_POT_ID,
      toPotId: tripId,
      amountCents: 30_000,
      date: '2026-09-10',
    })
    await repos.pots.removeTransaction(`tr:${transferId}:out`)
    await repos.pots.restoreTransaction(`tr:${transferId}:in`) // either leg brings back both
    expect(await balances()).toEqual({ [PRIMARY_POT_ID]: 20_000, [tripId]: 40_000 })

    await repos.pots.restoreTransaction(deposit.id) // already active → nothing to do
    expect(await balances()).toEqual({ [PRIMARY_POT_ID]: 20_000, [tripId]: 40_000 })
  })

  it('refuses a restore that would overdraw a pot, hit an archived one or touch derived rows', async () => {
    const withdrawal = await repos.pots.withdraw(PRIMARY_POT_ID, 40_000, '2026-09-03')
    await repos.pots.removeTransaction(withdrawal.id)
    await repos.pots.withdraw(PRIMARY_POT_ID, 45_000, '2026-09-04') // the money is gone meanwhile
    await expectCode(repos.pots.restoreTransaction(withdrawal.id), 'insufficient')

    const deposit = await repos.pots.deposit(tripId, 500, '2026-09-02')
    await repos.pots.removeTransaction(deposit.id)
    await repos.pots.archive(tripId)
    await expectCode(repos.pots.restoreTransaction(deposit.id), 'archived')

    await repos.weeks.close(WEEK, { incomeCents: 100 })
    await repos.weeks.reopen(WEEK)
    await expectCode(repos.pots.restoreTransaction(`auto:${WEEK}`), 'derived-transaction')
    await expectCode(repos.pots.restoreTransaction('missing'), 'not-found')
    expect(await balances()).toEqual({ [PRIMARY_POT_ID]: 5_000 })
  })

  it('archives only empty pots and never the primary one', async () => {
    await repos.pots.deposit(tripId, 500, '2026-09-02')
    await expectCode(repos.pots.archive(tripId), 'pot-not-empty')
    await expectCode(repos.pots.archive(PRIMARY_POT_ID), 'primary-pot-protected')

    await repos.pots.withdraw(tripId, 500, '2026-09-03')
    await repos.pots.archive(tripId)
    await expectCode(repos.pots.deposit(tripId, 1, '2026-09-04'), 'archived')
    await repos.pots.unarchive(tripId)
    await repos.pots.update(PRIMARY_POT_ID, { name: 'Erspartes' })
    expect((await db.pots.get(PRIMARY_POT_ID))?.name).toBe('Erspartes')
  })
})

describe('recurring expenses', () => {
  const rent = () =>
    repos.recurring.create({
      title: 'Miete',
      amountCents: 18_000,
      categoryId: 'cat:rent',
      interval: 'weekly',
      anchorDate: '2026-09-04',
    })

  it('materialises due instances with deterministic ids', async () => {
    const template = await rent()
    expect(await repos.recurring.materialize('2026-09-20')).toBe(3)
    const ids = (await db.expenses.toArray()).map((expense) => expense.id).sort()
    expect(ids).toEqual(['09-04', '09-11', '09-18'].map((day) => `rec:${template.id}:2026-${day}`))
    expect((await db.recurringExpenses.get(template.id))?.lastGeneratedDate).toBe('2026-09-20')
  })

  it('is idempotent – also when two calls race (app start + visibilitychange)', async () => {
    await rent()
    const created = await Promise.all([
      repos.recurring.materialize('2026-09-20'),
      repos.recurring.materialize('2026-09-20'),
    ])
    expect(created.sort()).toEqual([0, 3])
    expect(await repos.recurring.materialize('2026-09-20')).toBe(0)
    expect(await db.expenses.count()).toBe(3)
  })

  it('never resurrects a deleted instance or overwrites an edited one', async () => {
    const template = await rent()
    await repos.recurring.materialize('2026-09-20')
    await repos.expenses.remove(`rec:${template.id}:2026-09-11`)
    await repos.expenses.update(`rec:${template.id}:2026-09-18`, { amountCents: 20_000 })

    // Even with the watermark gone, existing ids are skipped.
    await db.recurringExpenses.update(template.id, { lastGeneratedDate: null })
    expect(await repos.recurring.materialize('2026-09-20')).toBe(0)
    expect((await db.expenses.get(`rec:${template.id}:2026-09-11`))?.deletedAt).not.toBeNull()
    expect((await db.expenses.get(`rec:${template.id}:2026-09-18`))?.amountCents).toBe(20_000)
  })

  it('re-syncs a closed week when an instance lands in it', async () => {
    await repos.weeks.close(WEEK, { incomeCents: 200_000 })
    await rent()
    await repos.recurring.materialize('2026-09-20')
    expect((await autoTx(WEEK))?.amountCents).toBe(182_000) // rent of 2026-09-18
  })

  it('does not back-fill after a rhythm change or a reactivation', async () => {
    const template = await rent()
    await repos.recurring.materialize('2026-09-06')
    await repos.recurring.update(template.id, { active: false }, '2026-09-06')
    expect(await repos.recurring.materialize('2026-09-20')).toBe(0)

    await repos.recurring.update(template.id, { active: true }, '2026-09-20')
    expect(await repos.recurring.materialize('2026-09-25')).toBe(1) // only 09-25, not 09-11/09-18

    await repos.recurring.update(template.id, { interval: 'fortnightly' }, '2026-09-26')
    expect((await db.recurringExpenses.get(template.id))?.lastGeneratedDate).toBe('2026-09-25')

    await repos.recurring.remove(template.id)
    expect(await repos.recurring.materialize('2026-12-31')).toBe(0)
    await expectCode(repos.recurring.update(template.id, { title: 'x' }, '2026-12-31'), 'not-found')
  })

  it('validates its input', async () => {
    const base = {
      title: 'x',
      amountCents: 1,
      categoryId: 'cat:rent',
      interval: 'weekly' as const,
      anchorDate: '2026-09-04',
    }
    await expectCode(repos.recurring.create({ ...base, amountCents: 0 }), 'invalid-amount')
    await expectCode(repos.recurring.create({ ...base, anchorDate: 'friday' }), 'invalid-date')
    await expectCode(
      repos.recurring.create({ ...base, categoryId: 'cat:nope' }),
      'unknown-category',
    )
  })
})

describe('budgets, categories, tasks, settings', () => {
  it('writes budgets only for the week of the given day and never touches older rows', async () => {
    await repos.budgets.set('2026-08-05', {
      totalLimitCents: 40_000,
      categoryLimits: { [GROCERIES]: 12_000 },
    })
    const before = await db.budgets.get('2026-08-03')
    await repos.budgets.set('2026-09-17', { totalLimitCents: 45_000 })
    await repos.budgets.set('2026-09-18', { totalLimitCents: 47_000 })

    expect(await db.budgets.get('2026-08-03')).toEqual(before)
    expect(await db.budgets.get(WEEK)).toMatchObject({
      totalLimitCents: 47_000,
      categoryLimits: {},
    })
    await expectCode(repos.budgets.set('2026-09-18', { totalLimitCents: -1 }), 'invalid-amount')
  })

  it('manages categories without deleting them', async () => {
    const pets = await repos.categories.create({
      name: 'Haustier',
      icon: 'Dog',
      color: 'cat-2',
      group: 'Sonstiges',
    })
    expect(pets.sortOrder).toBe(10)
    await repos.categories.update(pets.id, { archived: true })
    await repos.categories.reorder([pets.id, GROCERIES])
    expect((await db.categories.get(pets.id))?.sortOrder).toBe(0)
    expect((await db.categories.get(GROCERIES))?.sortOrder).toBe(1)
    await expectCode(repos.categories.update('cat:nope', { name: 'x' }), 'unknown-category')
  })

  it('manages tasks', async () => {
    const task = await repos.tasks.add({
      title: 'TFN beantragen',
      category: 'Behörden',
      dueDate: '2026-10-01',
    })
    await repos.tasks.setDone(task.id, true)
    expect(await db.tasks.get(task.id)).toMatchObject({ done: true, doneAt: expect.any(Number) })
    await repos.tasks.setDone(task.id, false)
    await repos.tasks.update(task.id, { title: 'TFN prüfen' })
    await repos.tasks.remove(task.id)
    expect((await db.tasks.get(task.id))?.deletedAt).not.toBeNull()
    await repos.tasks.restore(task.id)
    expect(await db.tasks.get(task.id)).toMatchObject({
      title: 'TFN prüfen',
      done: false,
      doneAt: null,
      deletedAt: null,
    })
    await expectCode(repos.tasks.add({ title: 'x', dueDate: 'soon' }), 'invalid-date')
  })

  it('validates a task’s title and pot reference', async () => {
    await expectCode(repos.tasks.add({ title: '   ' }), 'invalid-title')
    await expectCode(repos.tasks.add({ title: 'Bali', linkedPotId: 'pot:nope' }), 'unknown-pot')
    expect(await db.tasks.count()).toBe(0)

    const bali = await repos.pots.create({ name: 'Bali', targetCents: 300_000 })
    const task = await repos.tasks.add({ title: '  Flug buchen ', linkedPotId: bali.id, note: ' ' })
    expect(task).toMatchObject({ title: 'Flug buchen', linkedPotId: bali.id, note: undefined })

    await expectCode(repos.tasks.update(task.id, { title: '' }), 'invalid-title')
    await expectCode(repos.tasks.update(task.id, { linkedPotId: 'pot:nope' }), 'unknown-pot')
    await repos.tasks.update(task.id, { linkedPotId: null, note: 'Skyscanner' })
    expect(await db.tasks.get(task.id)).toMatchObject({ linkedPotId: null, note: 'Skyscanner' })
    await expectCode(repos.tasks.update('task:nope', { title: 'x' }), 'not-found')
    await expectCode(repos.tasks.setDone('task:nope', true), 'not-found')
  })

  it('keeps the original doneAt when a finished task is ticked again', async () => {
    const task = await repos.tasks.add({ title: 'Super prüfen' })
    await repos.tasks.setDone(task.id, true)
    const first = await db.tasks.get(task.id)
    await repos.tasks.setDone(task.id, true)
    expect(await db.tasks.get(task.id)).toEqual(first)
    await repos.tasks.setDone(task.id, false)
    expect(await db.tasks.get(task.id)).toMatchObject({ done: false, doneAt: null })
  })

  it('stamps the EUR rate when it changes', async () => {
    const before = await repos.settings.get()
    expect(before.eurRateUpdatedAt).toBeNull()
    const after = await repos.settings.update({ eurRate: 0.61, showEur: true })
    expect(after).toMatchObject({ eurRate: 0.61, showEur: true, eurRateUpdatedAt: after.updatedAt })
    const unchanged = await repos.settings.update({ showEur: false })
    expect(unchanged.eurRateUpdatedAt).toBe(after.eurRateUpdatedAt)
    await expectCode(repos.settings.update({ trackingSince: 'x' }), 'invalid-date')
    await expectCode(repos.settings.update({ eurRate: 0 }), 'invalid-rate')
    await expectCode(repos.settings.update({ eurRate: Number.NaN }), 'invalid-rate')
    expect((await repos.settings.update({ eurRate: null })).eurRate).toBeNull()
  })
})

describe('soft delete', () => {
  it('keeps tombstones in the table but out of the books', async () => {
    const expense = await repos.expenses.add({
      date: '2026-09-15',
      amountCents: 5_000,
      categoryId: GROCERIES,
    })
    await repos.expenses.remove(expense.id)
    await repos.expenses.remove(expense.id) // no-op
    expect(await db.expenses.count()).toBe(1)
    expect((await db.expenses.toArray()).filter(isActive)).toEqual([])
    await repos.expenses.restore(expense.id)
    await repos.expenses.restore(expense.id) // no-op
    expect((await db.expenses.toArray()).filter(isActive)).toHaveLength(1)
  })
})

describe('onboarding', () => {
  const input = {
    defaultWeeklyIncomeCents: 210_000,
    totalLimitCents: 45_000,
    openingBalanceCents: 850_000,
    trackingSince: '2026-08-31',
  }

  it('stores settings, the budget and the opening balance in one go', async () => {
    await repos.onboarding.complete(input, '2026-09-23')

    expect(await repos.settings.get()).toMatchObject({
      defaultWeeklyIncomeCents: 210_000,
      trackingSince: '2026-08-31',
      onboardingDone: true,
    })
    // Every tracked week resolves to the chosen limit – including weeks after the seeded row.
    const budgets = await db.budgets.toArray()
    expect(budgets.map((budget) => budget.totalLimitCents)).toEqual(budgets.map(() => 45_000))
    expect(budgets.some((budget) => budget.id === '2026-08-31')).toBe(true)
    expect(await db.potTransactions.get('opening-balance')).toMatchObject({
      potId: PRIMARY_POT_ID,
      amountCents: 850_000,
      date: '2026-08-31',
      type: 'manual-deposit',
      note: 'Startguthaben',
    })
    expect(await balances()).toEqual({ [PRIMARY_POT_ID]: 850_000 })
  })

  it('is idempotent and can take the opening balance back', async () => {
    await repos.onboarding.complete(input, '2026-09-23')
    await repos.onboarding.complete({ ...input, openingBalanceCents: 900_000 }, '2026-09-23')
    expect(await balances()).toEqual({ [PRIMARY_POT_ID]: 900_000 })
    expect(await db.potTransactions.count()).toBe(1)

    await repos.onboarding.complete({ ...input, openingBalanceCents: 0 }, '2026-09-23')
    expect(await balances()).toEqual({})
  })

  it('rejects bad input without changing anything', async () => {
    await expectCode(
      repos.onboarding.complete({ ...input, trackingSince: '2026-09-24' }, '2026-09-23'),
      'invalid-date',
    )
    await expectCode(
      repos.onboarding.complete({ ...input, totalLimitCents: -1 }, '2026-09-23'),
      'invalid-amount',
    )
    await expectCode(
      repos.onboarding.complete({ ...input, openingBalanceCents: 1.5 }, '2026-09-23'),
      'invalid-amount',
    )
    expect((await repos.settings.get()).onboardingDone).toBe(false)
    expect(await db.potTransactions.count()).toBe(0)
  })
})

describe('recurring restore', () => {
  it('undoes a delete without back-filling', async () => {
    const template = await repos.recurring.create({
      title: 'Miete',
      amountCents: 18_000,
      categoryId: 'cat:rent',
      interval: 'weekly',
      anchorDate: '2026-09-04',
    })
    await repos.recurring.materialize('2026-09-06')
    await repos.recurring.remove(template.id)
    await repos.recurring.restore(template.id)
    await repos.recurring.restore(template.id) // no-op

    expect((await db.recurringExpenses.get(template.id))?.deletedAt).toBeNull()
    expect(await repos.recurring.materialize('2026-09-12')).toBe(1)
    await expectCode(repos.recurring.restore('missing'), 'not-found')
  })
})

describe('phase 3 scenario: budget change, pots and a pot-funded expense', () => {
  const TODAY = '2026-09-23' // Wednesday of the week after WEEK
  const BEFORE = '2026-09-07'

  /** Week numbers and streak exactly the way the screens derive them: from raw rows. */
  async function books() {
    const data = await loadAppData(db)
    const summaries = [BEFORE, WEEK].map((weekStart) =>
      summarizeWeek({
        weekStart,
        week: data.weeks.find((week) => week.id === weekStart),
        expenses: data.expenses,
        budget: resolveBudget(data.budgets, weekStart),
      }),
    )
    return { data, summaries, streak: computeStreak(summaries, TODAY) }
  }

  it('leaves past weeks, the streak and the week’s savings untouched', async () => {
    // Like the real app: the onboarding dates the first budget row to the first tracked week.
    // (The seeded default row is dated by the REAL clock – never rely on where it falls.)
    await repos.onboarding.complete(
      {
        defaultWeeklyIncomeCents: 200_000,
        totalLimitCents: 40_000,
        openingBalanceCents: 0,
        trackingSince: BEFORE,
      },
      BEFORE,
    )
    await repos.expenses.add({ date: '2026-09-08', amountCents: 38_000, categoryId: GROCERIES })
    await repos.expenses.add({ date: '2026-09-16', amountCents: 39_500, categoryId: GROCERIES })
    await repos.weeks.close(BEFORE, { incomeCents: 200_000 })
    await repos.weeks.close(WEEK, { incomeCents: 200_000 })
    expect((await books()).streak).toMatchObject({ current: 2, best: 2, stale: false })

    // A tighter budget from today on: both closed weeks would be "over" under it …
    await repos.budgets.set(TODAY, {
      totalLimitCents: 30_000,
      categoryLimits: { [GROCERIES]: 10_000 },
    })
    const afterBudget = await books()
    // … but they keep the limit that applied back then, and so does the streak.
    expect(afterBudget.summaries.map((week) => week.totalLimitCents)).toEqual([40_000, 40_000])
    expect(afterBudget.streak).toMatchObject({ current: 2, best: 2 })
    expect(resolveBudget(afterBudget.data.budgets, NEXT_WEEK)?.totalLimitCents).toBe(30_000)

    // Save up in a pot and pay a big one-off from it – inside the already closed week.
    const trip = await repos.pots.create({ name: 'Reise', targetCents: 300_000 })
    await repos.pots.transfer({
      fromPotId: PRIMARY_POT_ID,
      toPotId: trip.id,
      amountCents: 100_000,
      date: TODAY,
    })
    await repos.expenses.add({
      date: '2026-09-18',
      amountCents: 80_000,
      categoryId: 'cat:travel',
      fundedByPotId: trip.id,
    })

    const afterTrip = await books()
    expect(afterTrip.summaries[1]).toMatchObject({
      spentCents: 39_500,
      fundedCents: 80_000,
      savedCents: 160_500,
      underBudget: true,
    })
    expect(afterTrip.streak).toMatchObject({ current: 2, best: 2 })
    expect((await autoTx(WEEK))?.amountCents).toBe(160_500)
    const weekUsage = budgetUsage(
      expensesInWeek(afterTrip.data.expenses, WEEK),
      resolveBudget(afterTrip.data.budgets, WEEK)!,
    )
    expect(weekUsage.total.spentCents).toBe(39_500)
    expect(weekUsage.byCategory['cat:travel']).toBeUndefined()

    // Pot balance = plain sum of its bookings: 162,000 + 160,500 − 100,000 and 100,000 − 80,000.
    expect(await balances()).toEqual({ [PRIMARY_POT_ID]: 222_500, [trip.id]: 20_000 })
  })
})
