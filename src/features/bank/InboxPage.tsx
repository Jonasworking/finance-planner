import { useLiveQuery } from 'dexie-react-hooks'
import { CircleCheck, FileUp, Inbox } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { db, loadInbox } from '@/db'
import { parseBankFile } from '@/lib/bankImport'
import { bankNote, purchaseDay } from '@/lib/bankInbox'
import { formatDayLabel } from '@/lib/dates'
import type { BankTransaction } from '@/lib/types'
import { GlassCard } from '@/shared/components/GlassCard'
import { Money } from '@/shared/components/Money'
import { Page } from '@/shared/components/Page'
import { useToday } from '@/shared/hooks/useToday'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'
import { AssignSheet } from './components/AssignSheet'
import { ImportPreviewSheet, type PendingImport } from './components/ImportPreviewSheet'

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/** Bank lines waiting for a category, and the way in for a new export. */
export function InboxPage() {
  const today = useToday()
  const data = useLiveQuery(() => loadInbox(db), [])
  const input = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<{
    open: boolean
    pending: PendingImport | null
    session: number
  }>({ open: false, pending: null, session: 0 })
  const [assign, setAssign] = useState<{ open: boolean; tx: BankTransaction | null }>({
    open: false,
    tx: null,
  })

  const pick = async (file: File | undefined) => {
    if (!file) return
    const result = parseBankFile(await file.text())
    if (!result.ok) {
      toast.error(
        result.reason === 'empty'
          ? 'Die Datei ist leer.'
          : 'Das ist kein CommBank-Export (erwartet: Datum, Betrag, Beschreibung, Kontostand).',
      )
      return
    }
    setPreview((current) => ({
      open: true,
      pending: { fileName: file.name, rows: result.rows, errors: result.errors },
      session: current.session + 1,
    }))
  }

  const importButton = (label: string) => (
    <Button type="button" size="touch" onClick={() => input.current?.click()}>
      <FileUp aria-hidden />
      {label}
    </Button>
  )

  const done = data?.done
  const doneParts = done
    ? [
        done.assigned > 0 ? `${done.assigned} zugeordnet` : null,
        done.matched > 0 ? `${done.matched} schon erfasst` : null,
        done.ignored > 0 ? `${done.ignored} keine Ausgabe` : null,
        done.credits > 0 ? plural(done.credits, 'Gutschrift', 'Gutschriften') : null,
      ].filter((part) => part !== null)
    : []

  return (
    <Page
      title="Inbox"
      subtitle={
        data && data.inbox.length > 0
          ? `${plural(data.inbox.length, 'Buchung', 'Buchungen')} offen`
          : 'Buchungen aus deinem Bank-Export'
      }
      actions={data?.hasImported ? importButton('CSV') : undefined}
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        {data === undefined ? (
          <>
            <Skeleton className="h-18 w-full rounded-lg" />
            <Skeleton className="h-18 w-full rounded-lg" />
          </>
        ) : !data.hasImported ? (
          <GlassCard className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-surface-3 text-fg-muted">
              <Inbox className="size-6" aria-hidden />
            </span>
            <div>
              <p className="text-h2">Noch nichts importiert</p>
              <p className="text-label text-fg-muted">
                In NetBank die Umsätze als CSV exportieren und „In Dateien sichern" – dann hier
                auswählen. Die Buchungen landen in dieser Inbox; was du schon von Hand erfasst hast,
                wird erkannt und nicht verdoppelt.
              </p>
            </div>
            {importButton('CSV importieren')}
          </GlassCard>
        ) : data.inbox.length === 0 ? (
          <GlassCard className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-saved-soft text-saved">
              <CircleCheck className="size-6" aria-hidden />
            </span>
            <div>
              <p className="text-h2">Alles zugeordnet</p>
              <p className="text-label text-fg-muted">
                Der nächste Export darf sich mit dem letzten überschneiden – doppelt kommt nichts
                herein.
              </p>
            </div>
          </GlassCard>
        ) : (
          <GlassCard padded={false} className="divide-y divide-border overflow-hidden">
            {data.inbox.map((tx) => (
              <button
                key={tx.id}
                type="button"
                onClick={() => setAssign({ open: true, tx })}
                className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left outline-none hover:bg-surface-3/40 focus-visible:bg-surface-3/60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{bankNote(tx.description)}</span>
                  <span className="block truncate text-label text-fg-muted">
                    {formatDayLabel(purchaseDay(tx), today)}
                    {data.candidates[tx.id] ? ' · vielleicht schon erfasst' : ''}
                    {data.closedWeeks[tx.id] ? ' · Woche abgeschlossen' : ''}
                  </span>
                </span>
                <Money cents={-tx.amountCents} className="font-semibold" />
              </button>
            ))}
          </GlassCard>
        )}

        {doneParts.length > 0 ? (
          <p className="px-1 text-label text-fg-muted">Erledigt: {doneParts.join(' · ')}</p>
        ) : null}
      </div>

      <input
        ref={input}
        type="file"
        accept=".csv,text/csv,text/comma-separated-values,text/plain"
        className="hidden"
        aria-label="Bank-Export wählen"
        onChange={(event) => {
          const file = event.target.files?.[0]
          // Reset, so picking the same file again fires `change` again.
          event.target.value = ''
          void pick(file)
        }}
      />

      <ImportPreviewSheet
        key={preview.session}
        pending={preview.pending}
        open={preview.open}
        onOpenChange={(open) => setPreview((current) => ({ ...current, open }))}
        today={today}
      />
      <AssignSheet
        tx={assign.tx}
        open={assign.open}
        onOpenChange={(open) => setAssign((current) => ({ ...current, open }))}
        categories={data?.categories ?? []}
        allCategories={data?.allCategories ?? []}
        candidates={(assign.tx && data?.candidates[assign.tx.id]) || []}
        closedWeek={(assign.tx && data?.closedWeeks[assign.tx.id]) || null}
        today={today}
      />
    </Page>
  )
}
