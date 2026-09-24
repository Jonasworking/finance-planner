import { useLiveQuery } from 'dexie-react-hooks'
import { Check, LockOpen } from 'lucide-react'
import { m } from 'motion/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { db, loadCloseWeek, repos } from '@/db'
import { resolveBudget } from '@/lib/budget'
import { formatWeekRange } from '@/lib/dates'
import { formatAUD } from '@/lib/money'
import { pendingWeeks, summarizeWeek, type WeekSummary } from '@/lib/savings'
import type { Cents, ISODate } from '@/lib/types'
import { Money } from '@/shared/components/Money'
import { MoneyInput } from '@/shared/components/MoneyInput'
import { ResponsiveSheet } from '@/shared/components/ResponsiveSheet'
import { useToday } from '@/shared/hooks/useToday'
import { errorMessage } from '@/shared/lib/errorMessages'
import { cn } from '@/shared/lib/utils'
import { spring } from '@/shared/motion'
import { useUiStore } from '@/shared/stores/uiStore'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Skeleton } from '@/shared/ui/skeleton'

type WeekData = NonNullable<Awaited<ReturnType<typeof loadCloseWeek>>>

function SummaryRow({
  label,
  children,
  strong,
}: {
  label: string
  children: React.ReactNode
  strong?: boolean
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3', strong && 'border-t pt-3')}>
      <span className={strong ? 'text-h2' : 'text-fg-muted'}>{label}</span>
      {children}
    </div>
  )
}

interface CloseWeekFormProps {
  weekStart: ISODate
  data: WeekData
  today: ISODate
}

function CloseWeekForm({ weekStart, data, today }: CloseWeekFormProps) {
  const openCloseWeek = useUiStore((state) => state.openCloseWeek)
  const dismiss = useUiStore((state) => state.dismissCloseWeek)

  const alreadyClosed = data.week?.closedAt != null
  const [incomeCents, setIncomeCents] = useState<Cents | null>(
    data.week?.incomeCents ?? data.settings?.defaultWeeklyIncomeCents ?? null,
  )
  const [note, setNote] = useState(data.week?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<WeekSummary | null>(null)

  const budget = resolveBudget(data.budgets, weekStart)
  // Preview with the income as typed; the repo computes the very same numbers on save.
  const preview = summarizeWeek({
    weekStart,
    week: { ...(data.week ?? blankWeek(weekStart)), incomeCents: incomeCents ?? 0 },
    expenses: data.expenses,
    budget,
  })
  const overBudgetBy = budget ? preview.spentCents - budget.totalLimitCents : null

  const stillPending = data.settings
    ? pendingWeeks(data.weeks, data.settings.trackingSince, today).filter(
        (week) => week !== weekStart,
      )
    : []

  const save = async () => {
    if (incomeCents === null) return
    setBusy(true)
    try {
      await repos.weeks.close(weekStart, { incomeCents, note: note.trim() })
      if (alreadyClosed) {
        dismiss()
        toast.success('Woche aktualisiert')
      } else {
        setDone(preview)
      }
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const reopen = async () => {
    setBusy(true)
    try {
      await repos.weeks.reopen(weekStart)
      dismiss()
      toast('Woche wieder geöffnet', {
        description: 'Die Buchung in „Nur gespart" wurde zurückgenommen.',
        action: {
          label: 'Rückgängig',
          onClick: () => {
            repos.weeks.close(weekStart).catch((error) => toast.error(errorMessage(error)))
          },
        },
      })
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    const next = stillPending[0]
    return (
      <div className="flex flex-col items-center gap-5 py-4 text-center">
        <m.span
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={spring.bouncy}
          className="grid size-20 place-items-center rounded-full bg-saved text-on-saved shadow-glow-saved"
        >
          <Check className="size-10" strokeWidth={3} aria-hidden />
        </m.span>
        <div>
          <p className="text-caption text-fg-subtle uppercase">
            {done.savedCents >= 0 ? 'Gespart' : 'Minus in dieser Woche'}
          </p>
          <Money cents={done.savedCents} tone="auto" className="text-display" />
          <p className="pt-1 text-label text-fg-muted">
            {done.savedCents >= 0
              ? `In „Nur gespart" gebucht · Sparquote ${Math.round(done.savingsRate * 100)} %`
              : 'Wurde von „Nur gespart" abgezogen – so bleibt der Topf ehrlich.'}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2">
          {next ? (
            <Button size="touch" onClick={() => openCloseWeek(next)}>
              Nächste Woche abschließen ({stillPending.length} offen)
            </Button>
          ) : null}
          <Button size="touch" variant={next ? 'ghost' : 'default'} onClick={dismiss}>
            Fertig
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-caption text-fg-subtle uppercase">Einkommen dieser Woche (netto)</p>
        <MoneyInput
          defaultValue={incomeCents}
          onValueChange={setIncomeCents}
          aria-label="Einkommen dieser Woche"
          size="lg"
        />
        <Input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Notiz (z. B. Farm, 38 h)"
          aria-label="Notiz zur Woche"
          maxLength={80}
          className="h-11 rounded-md"
        />
      </div>

      <div className="flex flex-col gap-3 rounded-lg bg-surface-1 p-4">
        <SummaryRow label="Ausgegeben">
          <Money cents={preview.spentCents} />
        </SummaryRow>
        {preview.fundedCents > 0 ? (
          <SummaryRow label="Aus Töpfen bezahlt">
            <Money cents={preview.fundedCents} tone="muted" />
          </SummaryRow>
        ) : null}
        {budget && overBudgetBy !== null ? (
          <SummaryRow label={`Budget ${formatAUD(budget.totalLimitCents, { decimals: false })}`}>
            <span className={cn('text-label', overBudgetBy > 0 ? 'text-spent' : 'text-saved')}>
              {overBudgetBy > 0
                ? `${formatAUD(overBudgetBy)} darüber`
                : `${formatAUD(-overBudgetBy)} darunter`}
            </span>
          </SummaryRow>
        ) : null}
        <SummaryRow label="Gespart" strong>
          <Money cents={preview.savedCents} tone="auto" className="text-h1" />
        </SummaryRow>
      </div>

      <div className="flex flex-col gap-2">
        <Button size="touch" disabled={incomeCents === null || busy} onClick={() => void save()}>
          {alreadyClosed ? 'Änderung speichern' : 'Woche abschließen'}
        </Button>
        {alreadyClosed ? (
          <Button size="touch" variant="ghost" disabled={busy} onClick={() => void reopen()}>
            <LockOpen aria-hidden />
            Woche wieder öffnen
          </Button>
        ) : (
          <p className="text-center text-label text-fg-muted">
            Ausgaben lassen sich auch danach noch ändern – die Buchung zieht automatisch nach.
          </p>
        )}
      </div>
    </div>
  )
}

const blankWeek = (weekStart: ISODate) => ({
  id: weekStart,
  incomeCents: null,
  closedAt: null,
  createdAt: 0,
  updatedAt: 0,
  deletedAt: null,
})

/** "Woche abschließen" (and editing / reopening a closed week), driven by `uiStore`. */
export function CloseWeekSheet() {
  const weekStart = useUiStore((state) => state.closeWeekStart)
  const open = useUiStore((state) => state.closeWeekOpen)
  const session = useUiStore((state) => state.closeWeekSession)
  const dismiss = useUiStore((state) => state.dismissCloseWeek)
  const today = useToday()

  // Tagged with its week: after switching weeks the hook may briefly hold the previous answer.
  const result = useLiveQuery(
    async () => (weekStart ? { weekStart, data: await loadCloseWeek(db, weekStart) } : null),
    [weekStart],
  )
  const data = result && result.weekStart === weekStart ? result.data : undefined
  const closed = data?.week?.closedAt != null

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(next) => !next && dismiss()}
      title={closed ? 'Woche bearbeiten' : 'Woche abschließen'}
      description={weekStart ? formatWeekRange(weekStart) : undefined}
    >
      {weekStart && data ? (
        // Keyed per opening: the income field starts from the stored / default value each time.
        <CloseWeekForm key={session} weekStart={weekStart} data={data} today={today} />
      ) : (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}
    </ResponsiveSheet>
  )
}
