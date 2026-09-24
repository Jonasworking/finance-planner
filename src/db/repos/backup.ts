import Dexie, { type EntityTable } from 'dexie'
import { buildBackup, parseBackup, type BackupFile } from '@/lib/backup'
import { checkLedgerInvariants, type Violation } from '@/lib/ledger'
import { SETTINGS_ID, type AppData } from '@/lib/types'
import { DomainError } from '../errors'
import { loadAppData } from '../queries'
import { TABLE_NAMES } from '../schema'
import type { RepoContext } from './context'

interface SafetySnapshot {
  id: 'last'
  createdAt: number
  backup: BackupFile
}

/** Separate database with a single slot, so "Import rückgängig" survives the replaced main DB. */
class SafetyDB extends Dexie {
  snapshots!: EntityTable<SafetySnapshot, 'id'>

  constructor(name: string) {
    super(name)
    this.version(1).stores({ snapshots: 'id' })
  }
}

export function createBackupRepo(ctx: RepoContext) {
  const { db, clock } = ctx
  const safetyName = `${db.name}-safety`

  async function withSafety<T>(work: (safety: SafetyDB) => Promise<T>): Promise<T> {
    const safety = new SafetyDB(safetyName)
    try {
      return await work(safety)
    } finally {
      safety.close()
    }
  }

  /** All-or-nothing: one transaction over every table; any failure leaves the old data intact. */
  async function replaceAll(data: AppData): Promise<void> {
    await db.transaction('rw', db.allTables, async () => {
      for (const name of TABLE_NAMES) {
        const table = db.table(name)
        await table.clear()
        await table.bulkAdd(data[name])
      }
    })
  }

  return {
    export: async (): Promise<BackupFile> => buildBackup(await loadAppData(db), clock.now()),

    /** Call once the file really left the app (share sheet / download succeeded). */
    markBackupDone: async (): Promise<void> => {
      const now = clock.now()
      await db.settings.update(SETTINGS_ID, { lastBackupAt: now, updatedAt: now })
    },

    /**
     * Import in "replace" mode. Everything that can fail – parsing, schema validation,
     * migration, the ledger check – happens BEFORE the transaction; the current state is parked
     * in the safety slot first. The caller reloads the page afterwards (stores hold stale ids).
     */
    import: async (input: unknown): Promise<Record<keyof AppData, number>> => {
      const parsed = parseBackup(input)
      if (!parsed.ok) throw new DomainError('invalid-backup', parsed.errors[0], parsed.errors)

      const violations = checkLedgerInvariants(parsed.backup.data)
      if (violations.length > 0) {
        throw new DomainError(
          'inconsistent-backup',
          'Das Backup ist in sich nicht stimmig.',
          violations.slice(0, 10).map((violation) => `${violation.code}: ${violation.ref}`),
        )
      }

      const current = buildBackup(await loadAppData(db), clock.now())
      await withSafety((safety) =>
        safety.snapshots.put({ id: 'last', createdAt: clock.now(), backup: current }),
      )
      await replaceAll(parsed.backup.data)

      return Object.fromEntries(
        TABLE_NAMES.map((name) => [name, parsed.backup.data[name].length]),
      ) as Record<keyof AppData, number>
    },

    safetyCopyInfo: (): Promise<{ createdAt: number } | null> =>
      withSafety(async (safety) => {
        const snapshot = await safety.snapshots.get('last')
        return snapshot ? { createdAt: snapshot.createdAt } : null
      }),

    /**
     * "Import rückgängig": puts back the state from before the last import. The slot is emptied
     * afterwards – undoing twice would only restore the same state again.
     */
    restoreSafetyCopy: async (): Promise<void> => {
      const snapshot = await withSafety((safety) => safety.snapshots.get('last'))
      if (!snapshot) throw new DomainError('no-safety-copy')
      await replaceAll(snapshot.backup.data)
      await withSafety((safety) => safety.snapshots.delete('last'))
    },

    /** "Daten prüfen": the ledger check over everything that is stored. */
    check: async (): Promise<{ violations: Violation[]; rows: number }> => {
      const data = await loadAppData(db)
      const rows = TABLE_NAMES.reduce((sum, name) => sum + data[name].length, 0)
      return { violations: checkLedgerInvariants(data), rows }
    },

    /**
     * "Alle Daten löschen": deletes the database itself (not `clear()`), so reopening runs
     * `populate` again and the seeds – above all the primary pot – are back. Reload afterwards.
     */
    wipeAll: async (): Promise<void> => {
      await Dexie.delete(safetyName)
      await db.delete()
      await db.open()
    },
  }
}
