import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { repos } from '@/db'
import { formatDate } from '@/lib/dates'
import type { Cents, Settings } from '@/lib/types'
import { GlassCard } from '@/shared/components/GlassCard'
import { MoneyInput } from '@/shared/components/MoneyInput'
import { errorMessage } from '@/shared/lib/errorMessages'
import { Button } from '@/shared/ui/button'

export interface DefaultsCardProps {
  settings: Settings
}

/** The standard weekly income (suggested when closing a week, base of the forecast). */
export function DefaultsCard({ settings }: DefaultsCardProps) {
  const [income, setIncome] = useState<Cents | null>(settings.defaultWeeklyIncomeCents)
  const [busy, setBusy] = useState(false)
  const changed = income !== null && income !== settings.defaultWeeklyIncomeCents

  const save = async () => {
    if (income === null) return
    setBusy(true)
    try {
      await repos.settings.update({ defaultWeeklyIncomeCents: income })
      toast.success('Standard-Einkommen gespeichert')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <GlassCard className="flex flex-col gap-4">
      <div>
        <h2 className="text-h2">Standardwerte</h2>
        <p className="text-label text-fg-muted">
          Erfasst seit {formatDate(settings.trackingSince)}.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-label text-fg-muted">
          Einkommen pro Woche – Vorschlag beim Wochenabschluss und Basis der Prognosen
        </p>
        <div className="flex gap-2">
          <MoneyInput
            defaultValue={settings.defaultWeeklyIncomeCents}
            onValueChange={setIncome}
            aria-label="Standard-Einkommen pro Woche"
            className="min-w-0 flex-1"
          />
          <Button
            type="button"
            size="touch"
            disabled={!changed || busy}
            onClick={() => void save()}
            className="h-12"
          >
            Speichern
          </Button>
        </div>
      </div>
      <p className="text-label text-fg-muted">
        Das Wochenbudget stellst du unter{' '}
        <Link to="/budget" className="font-semibold text-fg underline">
          Budget
        </Link>{' '}
        ein.
      </p>
    </GlassCard>
  )
}
