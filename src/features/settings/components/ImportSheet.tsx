import { TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { repos } from '@/db'
import type { BackupFile } from '@/lib/backup'
import { dayOfTimestamp, formatDate } from '@/lib/dates'
import { isActive } from '@/lib/types'
import { ResponsiveSheet } from '@/shared/components/ResponsiveSheet'
import { errorMessage } from '@/shared/lib/errorMessages'
import { Button } from '@/shared/ui/button'
import { reloadWith } from '../importFlags'

export interface ImportSheetProps {
  /** The checked backup (null while closed); kept while the sheet animates out. */
  backup: BackupFile | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const count = (rows: readonly { deletedAt: number | null }[]) => rows.filter(isActive).length

/** What the file holds, and a clear word that it replaces everything on this device. */
export function ImportSheet({ backup, open, onOpenChange }: ImportSheetProps) {
  const [busy, setBusy] = useState(false)

  const confirm = async () => {
    if (!backup) return
    setBusy(true)
    try {
      await repos.backup.import(backup)
      reloadWith('imported')
    } catch (error) {
      toast.error(errorMessage(error))
      setBusy(false)
    }
  }

  const rows = backup
    ? [
        ['Ausgaben', count(backup.data.expenses)],
        ['Wochen', count(backup.data.weeks)],
        ['Töpfe', count(backup.data.pots)],
        ['Daueraufträge', count(backup.data.recurringExpenses)],
        ['Tasks', count(backup.data.tasks)],
      ]
    : []

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Backup einspielen"
      description={
        backup ? `Gespeichert am ${formatDate(dayOfTimestamp(backup.exportedAt))}.` : undefined
      }
      footer={
        <Button
          type="button"
          size="touch"
          disabled={!backup || busy}
          onClick={() => void confirm()}
        >
          Einspielen
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-fg-muted">{label}</dt>
              <dd className="text-right tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="flex gap-3 rounded-md bg-warning-soft px-4 py-3 text-label">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <span>
            Ersetzt <strong>alle</strong> Daten auf diesem Gerät. Der jetzige Stand wird vorher
            gesichert – „Import rückgängig" holt ihn zurück.
          </span>
        </p>
      </div>
    </ResponsiveSheet>
  )
}
