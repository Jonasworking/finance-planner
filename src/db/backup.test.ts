import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { checkLedgerInvariants } from '@/lib/ledger'
import { PRIMARY_POT_ID, type AppData } from '@/lib/types'
import { seedDemoData } from './demo'
import { DomainError } from './errors'
import { loadAppData } from './queries'
import { createRepos, type Repos } from './repos'
import { FinanceDB, TABLE_NAMES } from './schema'

let db: FinanceDB
let repos: Repos
let counter = 0
let tick = 0

beforeEach(async () => {
  db = new FinanceDB(`backup-test-${++counter}`)
  tick = 2_000_000
  repos = createRepos(db, { now: () => ++tick })
  await db.open()
  await seedDemoData(repos, '2026-09-23', 3)
})

afterEach(async () => {
  expect(checkLedgerInvariants(await loadAppData(db))).toEqual([])
  await repos.backup.wipeAll()
  await db.delete()
})

/** Row order is irrelevant; compare tables sorted by id. */
const sorted = (data: AppData) =>
  Object.fromEntries(
    TABLE_NAMES.map((name) => [name, [...data[name]].sort((a, b) => (a.id < b.id ? -1 : 1))]),
  )

const throughJson = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const expectCode = (promise: Promise<unknown>, code: string) =>
  expect(promise).rejects.toSatisfy((error) => error instanceof DomainError && error.code === code)

describe('backup round trip', () => {
  it('export → wipe → import restores the identical state', async () => {
    const before = await loadAppData(db)
    const file = throughJson(await repos.backup.export())

    await repos.backup.wipeAll()
    const wiped = await loadAppData(db)
    expect(wiped.expenses).toEqual([])
    expect(wiped.weeks).toEqual([])
    expect(wiped.pots.map((pot) => pot.id)).toEqual([PRIMARY_POT_ID]) // seeds are back
    expect(wiped.categories).toHaveLength(10)
    expect(wiped.settings).toHaveLength(1)

    const counts = await repos.backup.import(file)
    expect(counts.expenses).toBe(before.expenses.length)
    expect(sorted(await loadAppData(db))).toEqual(sorted(throughJson(before)))
  })

  it('records when a backup really left the app', async () => {
    expect((await repos.settings.get()).lastBackupAt).toBeNull()
    await repos.backup.markBackupDone()
    expect((await repos.settings.get()).lastBackupAt).toBe(tick)
  })
})

describe('import safety', () => {
  it('rejects foreign or broken files before touching anything', async () => {
    const before = sorted(await loadAppData(db))
    await expectCode(repos.backup.import({ hello: 'world' }), 'invalid-backup')

    const broken = throughJson(await repos.backup.export())
    broken.data.expenses[0]!.amountCents = 12.5
    await expectCode(repos.backup.import(broken), 'invalid-backup')

    expect(sorted(await loadAppData(db))).toEqual(before)
    expect(await repos.backup.safetyCopyInfo()).toBeNull()
  })

  it('rejects a backup whose books do not add up', async () => {
    const before = sorted(await loadAppData(db))
    const cooked = throughJson(await repos.backup.export())
    cooked.data.potTransactions.find((tx) => tx.type === 'auto-weekly')!.amountCents += 100_000

    const attempt = repos.backup.import(cooked)
    await expectCode(attempt, 'inconsistent-backup')
    await expect(attempt).rejects.toHaveProperty('details', [
      expect.stringMatching(/^auto-mismatch: /),
    ])
    expect(sorted(await loadAppData(db))).toEqual(before)
  })

  it('rolls back completely when the write fails half-way', async () => {
    const before = sorted(await loadAppData(db))
    const file = throughJson(await repos.backup.export())
    // Valid for zod and the ledger, but a duplicate primary key makes bulkAdd fail – after
    // earlier tables were already cleared and refilled inside the same transaction.
    file.data.categories.push({ ...file.data.categories[0]! })
    file.data.expenses = []
    file.data.potTransactions = file.data.potTransactions.filter(
      (tx) => tx.type === 'manual-deposit',
    )
    file.data.weeks = []

    await expect(repos.backup.import(file)).rejects.toThrow()
    expect(sorted(await loadAppData(db))).toEqual(before)
  })

  it('keeps the previous state in a safety slot ("Import rückgängig")', async () => {
    const original = sorted(await loadAppData(db))
    await expectCode(repos.backup.restoreSafetyCopy(), 'no-safety-copy')

    const other = throughJson(await repos.backup.export())
    other.data.tasks = []
    other.data.settings[0]!.defaultWeeklyIncomeCents = 123_400
    await repos.backup.import(other)
    expect((await repos.settings.get()).defaultWeeklyIncomeCents).toBe(123_400)
    expect(await repos.backup.safetyCopyInfo()).toEqual({ createdAt: expect.any(Number) })

    await repos.backup.restoreSafetyCopy()
    expect(sorted(await loadAppData(db))).toEqual(original)
    // one undo per import – the slot is empty afterwards
    expect(await repos.backup.safetyCopyInfo()).toBeNull()
    await expectCode(repos.backup.restoreSafetyCopy(), 'no-safety-copy')
  })

  it('"Daten prüfen" checks every stored row and reports what does not add up', async () => {
    const data = await loadAppData(db)
    const total = TABLE_NAMES.reduce((sum, name) => sum + data[name].length, 0)
    expect(await repos.backup.check()).toEqual({ violations: [], rows: total })

    const auto = data.potTransactions.find((tx) => tx.type === 'auto-weekly')!
    await db.potTransactions.update(auto.id, { amountCents: auto.amountCents + 1 })
    const { violations } = await repos.backup.check()
    expect(violations).toEqual([
      expect.objectContaining({ code: 'auto-mismatch', ref: auto.id.replace('auto:', '') }),
    ])
    await db.potTransactions.update(auto.id, { amountCents: auto.amountCents }) // afterEach checks
  })

  it('wiping also removes the safety copy', async () => {
    await repos.backup.import(throughJson(await repos.backup.export()))
    expect(await repos.backup.safetyCopyInfo()).not.toBeNull()
    await repos.backup.wipeAll()
    expect(await repos.backup.safetyCopyInfo()).toBeNull()
  })
})
