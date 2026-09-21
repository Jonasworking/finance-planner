import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { toast } from 'sonner'
import { db, repos } from '@/db'
import { dayOfTimestamp, formatDayLabel } from '@/lib/dates'
import { formatAUD, formatEUR, formatRate, parseRateInput } from '@/lib/money'
import { SETTINGS_ID, type ISODate } from '@/lib/types'
import { ResponsiveSheet } from '@/shared/components/ResponsiveSheet'
import { useToday } from '@/shared/hooks/useToday'
import { errorMessage } from '@/shared/lib/errorMessages'
import { cn } from '@/shared/lib/utils'
import { useUiStore } from '@/shared/stores/uiStore'
import { Button } from '@/shared/ui/button'

const EXAMPLE_CENTS = 100_000

interface EurRateFormProps {
  rate: number | null
  updatedAt: number | null
  today: ISODate
  enableOnSave: boolean
  onDone: () => void
}

function EurRateForm({ rate, updatedAt, today, enableOnSave, onDone }: EurRateFormProps) {
  const [text, setText] = useState(rate === null ? '' : formatRate(rate))
  const [busy, setBusy] = useState(false)
  const parsed = parseRateInput(text)
  const invalid = text.trim() !== '' && parsed === null

  const save = async () => {
    if (parsed === null) return
    setBusy(true)
    try {
      await repos.settings.update(
        enableOnSave ? { eurRate: parsed, showEur: true } : { eurRate: parsed },
      )
      onDone()
      toast.success('EUR-Kurs gespeichert')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <label
        className={cn(
          'flex h-16 items-center gap-3 rounded-md border bg-surface-1 px-4 focus-within:ring-3 focus-within:ring-ring/50',
          invalid ? 'border-danger' : 'border-border-strong',
        )}
      >
        <span className="text-h2 whitespace-nowrap text-fg-subtle">1 A$ =</span>
        <input
          aria-label="EUR-Kurs"
          value={text}
          onChange={(event) => setText(event.target.value)}
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="done"
          placeholder="0,61"
          aria-invalid={invalid}
          className="min-w-0 flex-1 bg-transparent text-h1 font-semibold tabular-nums outline-none placeholder:text-fg-subtle"
        />
        <span className="text-h2 text-fg-subtle">€</span>
      </label>

      <p className="text-label text-fg-muted" aria-live="polite">
        {parsed === null
          ? invalid
            ? 'Bitte einen Kurs wie 0,61 eingeben.'
            : 'Den aktuellen Kurs findest du in deiner Bank-App.'
          : `${formatAUD(EXAMPLE_CENTS)} entsprechen ${formatEUR(EXAMPLE_CENTS, parsed)}.`}
        {updatedAt !== null ? (
          <span className="block text-fg-subtle">
            Zuletzt geändert: {formatDayLabel(dayOfTimestamp(updatedAt), today)}
          </span>
        ) : null}
      </p>

      <Button type="submit" size="touch" disabled={parsed === null || busy}>
        Speichern
      </Button>
    </form>
  )
}

/** Mounted once in the shell; opened by the currency switch and from the settings screen. */
export function EurRateSheet() {
  const open = useUiStore((state) => state.eurRateOpen)
  const session = useUiStore((state) => state.eurRateSession)
  const enableOnSave = useUiStore((state) => state.eurRateEnable)
  const close = useUiStore((state) => state.closeEurRate)
  const today = useToday()
  const settings = useLiveQuery(() => db.settings.get(SETTINGS_ID), [])

  return (
    <ResponsiveSheet
      open={open && settings !== undefined}
      onOpenChange={(next) => {
        if (!next) close()
      }}
      title="EUR-Kurs"
      description="Nur zur Anzeige: gespeichert und gerechnet wird immer in A$. Den Kurs pflegst du von Hand."
    >
      {settings ? (
        <EurRateForm
          key={session}
          rate={settings.eurRate}
          updatedAt={settings.eurRateUpdatedAt}
          today={today}
          enableOnSave={enableOnSave}
          onDone={close}
        />
      ) : null}
    </ResponsiveSheet>
  )
}
