import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { toast } from 'sonner'
import { db, repos } from '@/db'
import { GlassCard } from '@/shared/components/GlassCard'
import { useToday } from '@/shared/hooks/useToday'
import { errorMessage } from '@/shared/lib/errorMessages'
import { Button } from '@/shared/ui/button'

/** Dev builds only (see SettingsPage): fill the database with demo data or wipe it. */
export function DevTools() {
  const today = useToday()
  const expenseCount = useLiveQuery(() => db.expenses.count(), [])
  const [busy, setBusy] = useState(false)

  const run = async (work: () => Promise<void>, message: string) => {
    setBusy(true)
    try {
      await work()
      toast.success(message)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <GlassCard className="flex flex-col gap-3 border-dashed">
      <div>
        <p className="text-caption text-warning uppercase">Nur im Dev-Build</p>
        <p className="text-label text-fg-muted">
          {expenseCount ?? '…'} Ausgaben in der Datenbank. Demo-Daten lassen sich nur in eine leere
          Datenbank laden.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="touch"
          variant="secondary"
          disabled={busy || expenseCount !== 0}
          onClick={() =>
            void run(async () => {
              const { seedDemoData } = await import('@/db/demo')
              await seedDemoData(repos, today)
            }, '12 Demo-Wochen geladen')
          }
        >
          Demo-Daten laden
        </Button>
        <Button
          size="touch"
          variant="destructive"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await repos.backup.wipeAll()
              window.location.reload()
            }, 'Datenbank geleert')
          }
        >
          Alles löschen
        </Button>
      </div>
    </GlassCard>
  )
}
