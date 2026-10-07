import { useLiveQuery } from 'dexie-react-hooks'
import { TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { db, previewBankImport, repos } from '@/db'
import type { BankLineError, ParsedBankRow } from '@/lib/bankImport'
import { bankNote } from '@/lib/bankInbox'
import { formatDayLabel } from '@/lib/dates'
import type { ISODate } from '@/lib/types'
import { Money } from '@/shared/components/Money'
import { ResponsiveSheet } from '@/shared/components/ResponsiveSheet'
import { errorMessage } from '@/shared/lib/errorMessages'
import { Button } from '@/shared/ui/button'

/** A file that was read successfully and waits for the user's go. */
export interface PendingImport {
  fileName: string
  rows: ParsedBankRow[]
  errors: BankLineError[]
}

export interface ImportPreviewSheetProps {
  /** Kept while the sheet animates out. */
  pending: PendingImport | null
  open: boolean
  onOpenChange: (open: boolean) => void
  today: ISODate
}

/** Says what the file would do before anything is stored; automatic links can be undone here. */
export function ImportPreviewSheet({
  pending,
  open,
  onOpenChange,
  today,
}: ImportPreviewSheetProps) {
  const [keepOpen, setKeepOpen] = useState<ReadonlySet<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const rows = pending?.rows
  // The rows belong to the answer: after picking another file the hook still holds the old plan.
  const preview = useLiveQuery(
    async () => (rows ? { rows, plan: await previewBankImport(db, rows) } : null),
    [rows],
  )
  const plan = preview && preview.rows === rows ? preview.plan : null

  const linked = plan ? plan.matched.filter(({ row }) => !keepOpen.has(row.id)).length : 0
  const toInbox = plan ? plan.inbox.length + (plan.matched.length - linked) : 0
  const news = plan ? toInbox + linked + plan.credits.length + plan.beforeTracking.length : 0

  const toggle = (id: string) =>
    setKeepOpen((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const confirm = async () => {
    if (!pending) return
    setBusy(true)
    try {
      await repos.bank.import(pending.rows, { keepOpen })
      onOpenChange(false)
      toast.success(
        toInbox === 1 ? '1 Buchung in der Inbox' : `${toInbox} Buchungen in der Inbox`,
        linked > 0 ? { description: `${linked} schon erfasst und verknüpft` } : undefined,
      )
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const counts: [string, number][] = plan
    ? [
        ['Neu in der Inbox', toInbox],
        ['Schon von Hand erfasst', linked],
        ['Bereits importiert', plan.alreadyImported.length],
        ['Gutschriften', plan.credits.length],
      ]
    : []
  if (plan && plan.beforeTracking.length > 0) {
    counts.push(['Vor deinem Tracking-Beginn', plan.beforeTracking.length])
  }
  if (pending && pending.errors.length > 0) counts.push(['Unlesbare Zeilen', pending.errors.length])

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="CSV importieren"
      description={pending?.fileName}
      footer={
        <Button
          type="button"
          size="touch"
          disabled={!plan || busy || news === 0}
          onClick={() => void confirm()}
        >
          {plan && news === 0 ? 'Nichts Neues' : 'Importieren'}
        </Button>
      }
    >
      {plan ? (
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1">
            {counts.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-fg-muted">{label}</dt>
                <dd className="text-right tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          {plan.gap ? (
            <p className="flex gap-3 rounded-md bg-warning-soft px-4 py-3 text-label">
              <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
              <span>
                Diese Datei schließt nicht an den letzten Import an – dazwischen können Buchungen
                fehlen. Exportiere am besten einen Zeitraum, der sich überschneidet.
              </span>
            </p>
          ) : null}

          {plan.matched.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h3 className="text-label text-fg-muted">
                Passt zu Ausgaben, die du schon erfasst hast – es entsteht nichts doppelt.
              </h3>
              <ul className="flex flex-col divide-y divide-border rounded-md bg-surface-3">
                {plan.matched.map(({ row, expense }) => {
                  const kept = keepOpen.has(row.id)
                  return (
                    <li key={row.id} className="flex min-h-14 items-center gap-3 px-3 py-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{bankNote(row.description)}</span>
                        <span className="block truncate text-label text-fg-muted">
                          {kept
                            ? 'kommt in die Inbox'
                            : `erfasst: ${formatDayLabel(expense.date, today)}`}
                          {' · '}
                          <Money cents={-row.amountCents} />
                        </span>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="touch"
                        aria-pressed={kept}
                        aria-label={`${bankNote(row.description)}: ${kept ? 'verknüpfen' : 'lösen'}`}
                        onClick={() => toggle(row.id)}
                      >
                        {kept ? 'Verknüpfen' : 'Lösen'}
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}

          <p className="text-label text-fg-muted">
            Importierte Buchungen landen in der Inbox. Zu Ausgaben werden sie erst, wenn du sie
            einer Kategorie zuordnest.
          </p>
        </div>
      ) : null}
    </ResponsiveSheet>
  )
}
