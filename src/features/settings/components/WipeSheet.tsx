import { Download } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { repos } from '@/db'
import { HoldButton } from '@/shared/components/HoldButton'
import { ResponsiveSheet } from '@/shared/components/ResponsiveSheet'
import { errorMessage } from '@/shared/lib/errorMessages'
import { saveFile } from '@/shared/lib/saveFile'
import { Button } from '@/shared/ui/button'
import type { ExportFiles } from '../hooks/useExportFiles'
import { reloadWith } from '../importFlags'

export interface WipeSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  files: ExportFiles | undefined
}

/** Device-local memory that belongs to the data (not the theme): gone with the data. */
function forgetDeviceLog(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('fp.') && key !== 'fp.theme') localStorage.removeItem(key)
    }
  } catch {
    // storage unavailable – nothing to forget
  }
}

/** "Alle Daten löschen": a backup first, then only by holding the button. */
export function WipeSheet({ open, onOpenChange, files }: WipeSheetProps) {
  const [busy, setBusy] = useState(false)

  const wipe = async () => {
    setBusy(true)
    try {
      await repos.backup.wipeAll()
      forgetDeviceLog()
      reloadWith('wiped')
    } catch (error) {
      toast.error(errorMessage(error))
      setBusy(false)
    }
  }

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Alle Daten löschen"
      description="Löscht Ausgaben, Wochen, Töpfe, Tasks und Einstellungen auf diesem Gerät. Das lässt sich nicht rückgängig machen."
    >
      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant="secondary"
          size="touch"
          disabled={!files || busy}
          onClick={() =>
            void (async () => {
              if (!files || (await saveFile(files.backup)) === 'cancelled') return
              await repos.backup.markBackupDone()
              toast.success('Backup gespeichert', { description: files.backup.name })
            })()
          }
        >
          <Download aria-hidden />
          Vorher Backup speichern
        </Button>
        <HoldButton disabled={busy} onConfirm={() => void wipe()}>
          Gedrückt halten zum Löschen
        </HoldButton>
        <p className="text-center text-label text-fg-muted">
          Halte den Knopf gut eine Sekunde lang gedrückt.
        </p>
      </div>
    </ResponsiveSheet>
  )
}
