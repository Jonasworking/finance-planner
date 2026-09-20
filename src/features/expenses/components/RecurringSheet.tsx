import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { repos } from '@/db'
import { describeRecurrence } from '@/lib/recurrence'
import type { Category, Cents, ISODate, RecurrenceInterval, RecurringExpense } from '@/lib/types'
import { MoneyInput } from '@/shared/components/MoneyInput'
import { ResponsiveSheet } from '@/shared/components/ResponsiveSheet'
import { errorMessage } from '@/shared/lib/errorMessages'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Switch } from '@/shared/ui/switch'
import { CategoryGrid } from './CategoryGrid'

const INTERVALS: { value: RecurrenceInterval; label: string }[] = [
  { value: 'weekly', label: 'Wöchentlich' },
  { value: 'fortnightly', label: 'Alle 2 Wochen' },
  { value: 'monthly', label: 'Monatlich' },
]

interface RecurringFormProps {
  template: RecurringExpense | null
  categories: readonly Category[]
  today: ISODate
  /** Earliest sensible first due date – nothing is booked before tracking began. */
  minDate: ISODate | null
  onDone: () => void
}

function RecurringForm({ template, categories, today, minDate, onDone }: RecurringFormProps) {
  const [title, setTitle] = useState(template?.title ?? '')
  const [amountCents, setAmountCents] = useState<Cents | null>(template?.amountCents ?? null)
  const [categoryId, setCategoryId] = useState<string | null>(template?.categoryId ?? null)
  const [interval, setRhythm] = useState<RecurrenceInterval>(template?.interval ?? 'weekly')
  const [anchorDate, setAnchorDate] = useState<ISODate>(template?.anchorDate ?? today)
  const [active, setActive] = useState(template?.active ?? true)
  const [busy, setBusy] = useState(false)

  const valid =
    title.trim() !== '' && amountCents !== null && amountCents > 0 && categoryId !== null

  const run = async (work: () => Promise<unknown>, message: string) => {
    setBusy(true)
    try {
      await work()
      // Book whatever is due right away instead of waiting for the next app start.
      await repos.recurring.materialize(today)
      onDone()
      toast.success(message)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const save = () => {
    if (!valid || amountCents === null || categoryId === null) return
    const values = { title: title.trim(), amountCents, categoryId, interval, anchorDate }
    return run(
      () =>
        template
          ? repos.recurring.update(template.id, { ...values, active }, today)
          : repos.recurring.create(values),
      template ? 'Dauerauftrag gespeichert' : 'Dauerauftrag angelegt',
    )
  }

  const remove = async () => {
    if (!template) return
    setBusy(true)
    try {
      await repos.recurring.remove(template.id)
      onDone()
      toast(`„${template.title}" gelöscht`, {
        description: 'Bereits gebuchte Ausgaben bleiben erhalten.',
        action: {
          label: 'Rückgängig',
          onClick: () => {
            repos.recurring.restore(template.id).catch((error) => toast.error(errorMessage(error)))
          },
        },
      })
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Bezeichnung (z. B. Miete)"
        aria-label="Bezeichnung"
        maxLength={40}
        className="h-11 rounded-md"
      />
      <MoneyInput defaultValue={amountCents} onValueChange={setAmountCents} aria-label="Betrag" />

      <CategoryGrid categories={categories} value={categoryId} onChange={setCategoryId} />

      <fieldset>
        <legend className="pb-2 text-caption text-fg-subtle uppercase">Rhythmus</legend>
        <div className="grid grid-cols-3 gap-1 rounded-md bg-surface-3 p-1">
          {INTERVALS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={interval === option.value}
              onClick={() => setRhythm(option.value)}
              className={cn(
                'h-9 rounded-sm text-label outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                interval === option.value ? 'bg-surface-1 text-fg shadow-card' : 'text-fg-muted',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className="text-caption text-fg-subtle uppercase">
          {template ? 'Rhythmus ab' : 'Erste Fälligkeit'}
        </span>
        <Input
          type="date"
          value={anchorDate}
          min={minDate ?? undefined}
          onChange={(event) => event.target.value !== '' && setAnchorDate(event.target.value)}
          className="h-11 rounded-md"
        />
        <span className="text-label text-fg-muted">
          {describeRecurrence({ interval, anchorDate })}
          {!template && anchorDate < today ? ' · wird ab diesem Tag nachgebucht' : ''}
        </span>
      </label>

      {template ? (
        <label className="flex items-center justify-between gap-3 rounded-md bg-surface-1 px-4 py-3">
          <span>
            <span className="block">Aktiv</span>
            <span className="block text-label text-fg-muted">
              Pausiert bucht nichts; beim Fortsetzen wird nichts nachgeholt.
            </span>
          </span>
          <Switch checked={active} onCheckedChange={setActive} aria-label="Aktiv" />
        </label>
      ) : null}

      <div className="flex gap-2">
        {template ? (
          <Button
            type="button"
            variant="destructive"
            size="icon-touch"
            disabled={busy}
            onClick={() => void remove()}
            aria-label="Dauerauftrag löschen"
          >
            <Trash2 aria-hidden />
          </Button>
        ) : null}
        <Button
          type="button"
          size="touch"
          className="flex-1"
          disabled={!valid || busy}
          onClick={() => void save()}
        >
          Speichern
        </Button>
      </div>
    </div>
  )
}

export interface RecurringSheetProps extends Omit<RecurringFormProps, 'onDone'> {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Changes per opening, so the form starts fresh each time. */
  session: number
}

export function RecurringSheet({ open, onOpenChange, session, ...form }: RecurringSheetProps) {
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={form.template ? 'Dauerauftrag bearbeiten' : 'Neuer Dauerauftrag'}
      description="Wird automatisch als Ausgabe gebucht, sobald er fällig ist."
    >
      <RecurringForm key={session} {...form} onDone={() => onOpenChange(false)} />
    </ResponsiveSheet>
  )
}
