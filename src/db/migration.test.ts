import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import v1File from '@/lib/__fixtures__/backup-v1.json?raw'
import { checkLedgerInvariants } from '@/lib/ledger'
import { SCHEMA_VERSION, type AppData } from '@/lib/types'
import { makeBankTx, makeRule } from '@/test/fixtures'
import { loadAppData } from './queries'
import { createRepos } from './repos'
import { FinanceDB, TABLE_NAMES } from './schema'

/*
 * The released version 1, frozen here on purpose: these tests open a database exactly as the
 * app in production created it and let the current code upgrade it.
 */
const V1_STORES = {
  weeks: 'id',
  expenses: 'id, date',
  recurringExpenses: 'id',
  categories: 'id',
  budgets: 'id',
  pots: 'id',
  potTransactions: 'id, [potId+date]',
  tasks: 'id',
  settings: 'id',
}

/** A backup written by the v1 code (demo data, three closed weeks). */
const v1Backup = () =>
  JSON.parse(v1File) as { schemaVersion: number; data: Record<string, { id: string }[]> }

let counter = 0
const names: string[] = []
const freshName = () => {
  const name = `migration-test-${++counter}`
  names.push(name, `${name}-safety`)
  return name
}

afterEach(async () => {
  await Promise.all(names.splice(0).map((name) => Dexie.delete(name)))
})

async function createV1Database(name: string): Promise<void> {
  const old = new Dexie(name)
  old.version(1).stores(V1_STORES)
  await old.open()
  for (const [table, rows] of Object.entries(v1Backup().data)) {
    await old.table(table).bulkAdd(rows)
  }
  old.close()
}

const sorted = (data: Record<string, { id: string }[]>) =>
  Object.fromEntries(
    Object.entries(data).map(([name, rows]) => [
      name,
      [...rows].sort((a, b) => (a.id < b.id ? -1 : 1)),
    ]),
  )

const upgraded = () => sorted({ ...v1Backup().data, bankTransactions: [], merchantRules: [] })

describe('Dexie upgrade 1 → 2', () => {
  it('keeps every row, adds the bank tables empty and leaves the books consistent', async () => {
    const name = freshName()
    await createV1Database(name)

    const db = new FinanceDB(name)
    await db.open()
    expect(db.verno).toBe(SCHEMA_VERSION)
    expect(db.tables.map((table) => table.name).sort()).toEqual([...TABLE_NAMES].sort())

    const data = await loadAppData(db)
    expect(sorted(data as unknown as Record<string, { id: string }[]>)).toEqual(upgraded())
    // `populate` must not run on an upgrade: no second set of seed rows
    expect(data.categories).toHaveLength(v1Backup().data.categories!.length)
    expect(checkLedgerInvariants(data)).toEqual([])
    db.close()
  })

  it('makes the new tables usable, including their indexes', async () => {
    const name = freshName()
    await createV1Database(name)
    const db = new FinanceDB(name)

    await db.bankTransactions.bulkAdd([
      makeBankTx('2026-09-18', -3_764, { id: 'bank:a:0' }),
      makeBankTx('2026-09-17', 143_260, { id: 'bank:b:0', status: 'ignored' }),
    ])
    await db.merchantRules.add(makeRule('woolworths'))

    expect(await db.bankTransactions.where('status').equals('open').primaryKeys()).toEqual([
      'bank:a:0',
    ])
    expect(
      await db.bankTransactions
        .where('date')
        .between('2026-09-14', '2026-09-20', true, true)
        .count(),
    ).toBe(2)
    expect(checkLedgerInvariants(await loadAppData(db))).toEqual([])
    db.close()
  })

  it('creates a fresh database directly in the current version, seeds included', async () => {
    const db = new FinanceDB(freshName())
    await db.open()
    const data = await loadAppData(db)
    expect(db.verno).toBe(SCHEMA_VERSION)
    expect(data.categories).toHaveLength(10)
    expect(data.bankTransactions).toEqual([])
    expect(data.merchantRules).toEqual([])
    db.close()
  })
})

describe('version-1 backups after the upgrade', () => {
  it('imports a version-1 file and exports the current version', async () => {
    const db = new FinanceDB(freshName())
    const repos = createRepos(db, { now: () => 2_000_000 })

    const counts = await repos.backup.import(v1Backup())
    expect(counts).toMatchObject({ expenses: 30, bankTransactions: 0, merchantRules: 0 })
    const data = await loadAppData(db)
    expect(sorted(data as unknown as Record<string, { id: string }[]>)).toEqual(upgraded())

    const exported = JSON.parse(JSON.stringify(await repos.backup.export()))
    expect(exported.schemaVersion).toBe(2)
    await repos.backup.wipeAll()
    await repos.backup.import(exported)
    expect(await loadAppData(db)).toEqual(data satisfies AppData)
    db.close()
  })

  it('restores a safety copy that the old version left behind ("Import rückgängig")', async () => {
    const name = freshName()
    // what v1 stored before its last import: a whole version-1 backup in the safety slot
    const safety = new Dexie(`${name}-safety`)
    safety.version(1).stores({ snapshots: 'id' })
    await safety.table('snapshots').put({ id: 'last', createdAt: 1, backup: v1Backup() })
    safety.close()

    const db = new FinanceDB(name)
    const repos = createRepos(db, { now: () => 2_000_000 })
    await db.open()
    expect((await loadAppData(db)).expenses).toEqual([])

    await repos.backup.restoreSafetyCopy()
    const data = await loadAppData(db)
    expect(sorted(data as unknown as Record<string, { id: string }[]>)).toEqual(upgraded())
    expect(checkLedgerInvariants(data)).toEqual([])
    expect(await repos.backup.safetyCopyInfo()).toBeNull()
    db.close()
  })
})
