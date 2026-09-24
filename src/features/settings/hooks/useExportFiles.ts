import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db, loadAppData } from '@/db'
import { buildBackup } from '@/lib/backup'
import { expensesToCsv } from '@/lib/csv'
import { isActive, type ISODate } from '@/lib/types'

export interface ExportFiles {
  backup: File
  csv: File
  /** Something worth backing up exists (at least one expense or closed week). */
  hasData: boolean
}

/**
 * The backup and the CSV as ready-made files, rebuilt whenever the data changes. They exist
 * BEFORE the tap on purpose: iOS allows `navigator.share()` only right after a tap, and reading
 * the whole database first would let that permission expire.
 */
export function useExportFiles(today: ISODate): ExportFiles | undefined {
  // The export time is taken with the data (not during render – rendering stays pure).
  const snapshot = useLiveQuery(async () => ({ data: await loadAppData(db), at: Date.now() }), [])
  return useMemo(() => {
    if (!snapshot) return undefined
    const { data, at } = snapshot
    const backup = new File(
      [JSON.stringify(buildBackup(data, at))],
      `finanzplaner-backup-${today}.json`,
      { type: 'application/json' },
    )
    const csv = new File(
      [expensesToCsv(data.expenses, data.categories, data.pots)],
      `finanzplaner-ausgaben-${today}.csv`,
      { type: 'text/csv' },
    )
    const hasData =
      data.expenses.some(isActive) ||
      data.weeks.some((week) => isActive(week) && week.closedAt !== null)
    return { backup, csv, hasData }
  }, [snapshot, today])
}
