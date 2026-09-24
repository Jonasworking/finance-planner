import { Download, FileSpreadsheet, RotateCcw, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { repos } from '@/db'
import { parseBackup, type BackupFile } from '@/lib/backup'
import { dayOfTimestamp, formatDate } from '@/lib/dates'
import { backupState } from '@/lib/insights'
import type { ISODate } from '@/lib/types'
import { GlassCard } from '@/shared/components/GlassCard'
import { errorMessage } from '@/shared/lib/errorMessages'
import { saveFile } from '@/shared/lib/saveFile'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import type { ExportFiles } from '../hooks/useExportFiles'
import { reloadWith } from '../importFlags'
import { ImportSheet } from './ImportSheet'

export interface BackupCardProps {
  lastBackupAt: number | null
  files: ExportFiles | undefined
  today: ISODate
}

function lastBackupLabel(days: number | null): string {
  if (days === null) return 'Noch kein Backup gespeichert.'
  if (days === 0) return 'Letztes Backup: heute.'
  if (days === 1) return 'Letztes Backup: gestern.'
  return `Letztes Backup: vor ${days} Tagen.`
}

/**
 * Backup (JSON, everything) and CSV export, import with a safety copy, and its undo. The data
 * lives only on this device – this card is the way out, so it says clearly when a backup is due.
 */
export function BackupCard({ lastBackupAt, files, today }: BackupCardProps) {
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<BackupFile | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [safetyCopyAt, setSafetyCopyAt] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    void repos.backup.safetyCopyInfo().then((info) => {
      if (active) setSafetyCopyAt(info?.createdAt ?? null)
    })
    return () => {
      active = false
    }
  }, [])

  const state = backupState(lastBackupAt, today, files?.hasData ?? false)

  const saveBackup = async () => {
    if (!files) return
    const result = await saveFile(files.backup)
    if (result === 'cancelled') return
    await repos.backup.markBackupDone()
    toast.success('Backup gespeichert', { description: files.backup.name })
  }

  const saveCsv = async () => {
    if (!files) return
    const result = await saveFile(files.csv)
    if (result !== 'cancelled') toast.success('CSV gespeichert', { description: files.csv.name })
  }

  const pick = async (file: File | undefined) => {
    if (!file) return
    let json: unknown
    try {
      json = JSON.parse(await file.text())
    } catch {
      toast.error('Die Datei ist kein Finanzplaner-Backup.')
      return
    }
    const parsed = parseBackup(json)
    if (!parsed.ok) {
      toast.error(parsed.errors[0] ?? 'Die Datei ist kein gültiges Backup.')
      return
    }
    setPending(parsed.backup)
    setSheetOpen(true)
  }

  const undoImport = async () => {
    setBusy(true)
    try {
      await repos.backup.restoreSafetyCopy()
      reloadWith('import-undone')
    } catch (error) {
      toast.error(errorMessage(error))
      setBusy(false)
    }
  }

  return (
    <GlassCard id="backup" className="flex scroll-mt-24 flex-col gap-4">
      <div>
        <h2 className="text-h2">Backup</h2>
        <p className={cn('text-label', state.due ? 'font-semibold text-warning' : 'text-fg-muted')}>
          {lastBackupLabel(state.days)}
          {state.due ? ' Deine Daten liegen nur auf diesem Gerät – sichere sie jetzt.' : ''}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          size="touch"
          disabled={!files}
          onClick={() => void saveBackup()}
          className="sm:flex-1"
        >
          <Download aria-hidden />
          Backup speichern
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="touch"
          onClick={() => input.current?.click()}
          className="sm:flex-1"
        >
          <Upload aria-hidden />
          Backup einspielen
        </Button>
      </div>
      <p className="text-label text-fg-muted">
        Die Datei enthält alles: Ausgaben, Wochen, Töpfe, Tasks und Einstellungen. Auf dem iPhone
        „In Dateien sichern" wählen – oder per AirDrop auf den Mac.
      </p>
      <input
        ref={input}
        type="file"
        accept=".json,application/json,text/plain"
        className="hidden"
        aria-label="Backup-Datei wählen"
        onChange={(event) => {
          const file = event.target.files?.[0]
          // Reset, so picking the same file again fires `change` again.
          event.target.value = ''
          void pick(file)
        }}
      />

      {safetyCopyAt !== null ? (
        <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center">
          <p className="min-w-0 flex-1 text-label text-fg-muted">
            Vor dem letzten Import gesichert am {formatDate(dayOfTimestamp(safetyCopyAt))}.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="touch"
            disabled={busy}
            onClick={() => void undoImport()}
          >
            <RotateCcw aria-hidden />
            Import rückgängig
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center">
        <p className="min-w-0 flex-1 text-label text-fg-muted">
          Alle Ausgaben als Tabelle für Excel oder Numbers.
        </p>
        <Button
          type="button"
          variant="secondary"
          size="touch"
          disabled={!files}
          onClick={() => void saveCsv()}
        >
          <FileSpreadsheet aria-hidden />
          CSV exportieren
        </Button>
      </div>

      <ImportSheet backup={pending} open={sheetOpen} onOpenChange={setSheetOpen} />
    </GlassCard>
  )
}
