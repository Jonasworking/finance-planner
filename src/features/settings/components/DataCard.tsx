import { CircleCheck, ShieldAlert, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { repos } from '@/db'
import type { Violation } from '@/lib/ledger'
import { GlassCard } from '@/shared/components/GlassCard'
import { errorMessage } from '@/shared/lib/errorMessages'
import { Button } from '@/shared/ui/button'
import type { ExportFiles } from '../hooks/useExportFiles'
import { WipeSheet } from './WipeSheet'

export interface DataCardProps {
  files: ExportFiles | undefined
}

type CheckResult = { violations: Violation[]; rows: number }

/** "Daten prüfen" (the ledger check) and "Alle Daten löschen". */
export function DataCard({ files }: DataCardProps) {
  const [result, setResult] = useState<CheckResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [wipeOpen, setWipeOpen] = useState(false)

  const check = async () => {
    setChecking(true)
    try {
      setResult(await repos.backup.check())
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setChecking(false)
    }
  }

  return (
    <GlassCard className="flex flex-col gap-4">
      <div>
        <h2 className="text-h2">Daten</h2>
        <p className="text-label text-fg-muted">
          Prüft, ob Wochen, Töpfe und Buchungen zusammenpassen.
        </p>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="touch"
        disabled={checking}
        onClick={() => void check()}
      >
        Daten prüfen
      </Button>
      {result ? (
        result.violations.length === 0 ? (
          <p role="status" className="flex items-center gap-2 text-label">
            <CircleCheck className="size-5 shrink-0 text-saved" aria-hidden />
            Alles stimmt – {result.rows} Einträge geprüft.
          </p>
        ) : (
          <div role="status" className="flex flex-col gap-2 text-label">
            <p className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="size-5 shrink-0 text-warning" aria-hidden />
              {result.violations.length === 1
                ? '1 Unstimmigkeit gefunden.'
                : `${result.violations.length} Unstimmigkeiten gefunden.`}{' '}
              Speichere ein Backup, bevor du etwas änderst.
            </p>
            <ul className="max-h-40 overflow-y-auto rounded-sm bg-surface-2 p-3 font-mono text-caption">
              {result.violations.slice(0, 20).map((violation) => (
                <li key={`${violation.code}:${violation.ref}`}>
                  {violation.code} · {violation.ref}
                </li>
              ))}
            </ul>
          </div>
        )
      ) : null}
      <div className="border-t pt-4">
        <Button
          type="button"
          variant="destructive"
          size="touch"
          onClick={() => setWipeOpen(true)}
          className="w-full"
        >
          <Trash2 aria-hidden />
          Alle Daten löschen
        </Button>
      </div>
      <WipeSheet open={wipeOpen} onOpenChange={setWipeOpen} files={files} />
    </GlassCard>
  )
}
