import { describe, expect, it } from 'vitest'
import {
  makeBudget,
  makeCategory,
  makeExpense,
  makePot,
  makeRecurring,
  makeSettings,
  makeTask,
  makeTx,
  makeWeek,
  NOW,
} from '@/test/fixtures'
import { BACKUP_APP, buildBackup, migrateBackup, parseBackup } from './backup'
import { PRIMARY_POT_ID, SCHEMA_VERSION, type AppData } from './types'

const data = (): AppData => ({
  settings: [makeSettings({ eurRate: 0.6, eurRateUpdatedAt: NOW })],
  categories: [makeCategory('cat:groceries')],
  pots: [makePot(PRIMARY_POT_ID, { targetCents: 1_000_000, deadline: '2027-03-01' })],
  recurringExpenses: [makeRecurring('2026-09-04')],
  budgets: [makeBudget('2026-09-07', 40_000, { 'cat:groceries': 10_000 })],
  tasks: [makeTask({ dueDate: '2026-10-01' })],
  weeks: [
    makeWeek('2026-09-14', { closedAt: NOW, note: 'Farm' }),
    makeWeek('2026-09-21', { incomeCents: null }),
  ],
  expenses: [
    makeExpense('2026-09-15', 6_000, { note: 'Woolworths', tags: ['food'] }),
    makeExpense('2026-09-16', 5, { deletedAt: NOW }),
  ],
  potTransactions: [
    makeTx(PRIMARY_POT_ID, 194_000, '2026-09-20', {
      id: 'auto:2026-09-14',
      type: 'auto-weekly',
      sourceWeekStart: '2026-09-14',
    }),
  ],
})

describe('buildBackup / parseBackup', () => {
  it('round-trips through JSON without losing anything (tombstones included)', () => {
    const backup = buildBackup(data(), NOW)
    expect(backup).toMatchObject({
      app: BACKUP_APP,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: NOW,
    })

    const parsed = parseBackup(JSON.parse(JSON.stringify(backup)))
    expect(parsed).toEqual({ ok: true, backup })
  })

  it('rejects files that are not ours', () => {
    for (const input of [
      null,
      'text',
      42,
      [],
      {},
      { app: 'other', schemaVersion: 1 },
      { app: BACKUP_APP, schemaVersion: '1' },
    ]) {
      expect(parseBackup(input)).toEqual({
        ok: false,
        errors: ['Die Datei ist kein Finanzplaner-Backup.'],
      })
    }
  })

  it('rejects backups from a newer app version', () => {
    const result = parseBackup({ ...buildBackup(data(), NOW), schemaVersion: SCHEMA_VERSION + 1 })
    expect(result.ok).toBe(false)
    expect(!result.ok && result.errors[0]).toMatch(/neueren App-Version/)
  })

  it('reports where the content is invalid', () => {
    const broken = JSON.parse(JSON.stringify(buildBackup(data(), NOW)))
    broken.data.weeks[0].id = '2026-09-15' // not a Monday
    broken.data.expenses[0].amountCents = 12.5
    broken.data.expenses[0].date = '2026-02-30'
    delete broken.data.pots
    const result = parseBackup(broken)
    expect(result.ok).toBe(false)
    const errors = result.ok ? [] : result.errors
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^data\.weeks\.0\.id: must be a Monday/),
        expect.stringMatching(/^data\.expenses\.0\.amountCents:/),
        expect.stringMatching(/^data\.expenses\.0\.date: must be a calendar date/),
        expect.stringMatching(/^data\.pots:/),
      ]),
    )
  })

  it('requires exactly one settings row and strips unknown keys', () => {
    const twoSettings = buildBackup({ ...data(), settings: [makeSettings(), makeSettings()] }, NOW)
    expect(parseBackup(twoSettings).ok).toBe(false)
    expect(parseBackup(buildBackup({ ...data(), settings: [] }, NOW)).ok).toBe(false)

    const extra = JSON.parse(JSON.stringify(buildBackup(data(), NOW)))
    extra.data.expenses[0].injected = '<script>'
    const parsed = parseBackup(extra)
    expect(parsed.ok && 'injected' in parsed.backup.data.expenses[0]!).toBe(false)
  })
})

describe('migrateBackup', () => {
  it('applies every step in order up to the target version', () => {
    const steps = {
      1: (backup: { schemaVersion: number }) => ({ ...backup, a: true }),
      2: (backup: { schemaVersion: number }) => ({ ...backup, b: true }),
    }
    expect(migrateBackup({ schemaVersion: 1 }, steps, 3)).toEqual({
      schemaVersion: 3,
      a: true,
      b: true,
    })
    expect(migrateBackup({ schemaVersion: 3 }, steps, 3)).toEqual({ schemaVersion: 3 })
  })

  it('fails loudly when a step is missing', () => {
    expect(() => migrateBackup({ schemaVersion: 1 }, {}, 2)).toThrow(
      /No migration from backup version 1/,
    )
  })
})
