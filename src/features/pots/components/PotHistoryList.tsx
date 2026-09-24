import { AnimatePresence, m } from 'motion/react'
import { toast } from 'sonner'
import { repos } from '@/db'
import { formatDayLabel } from '@/lib/dates'
import { formatAUD } from '@/lib/money'
import { isDerivedTx, type PotHistoryEntry } from '@/lib/pots'
import type { ISODate } from '@/lib/types'
import { GlassCard } from '@/shared/components/GlassCard'
import { Money } from '@/shared/components/Money'
import { SwipeRow } from '@/shared/components/SwipeRow'
import { errorMessage } from '@/shared/lib/errorMessages'
import { cn } from '@/shared/lib/utils'
import { spring } from '@/shared/motion'
import { useUiStore } from '@/shared/stores/uiStore'
import type { HistoryCopy } from '../potCopy'

export interface PotHistoryListProps {
  entries: readonly PotHistoryEntry[]
  copyFor: (entry: PotHistoryEntry) => HistoryCopy
  today: ISODate
}

/** Deleting never asks first – it offers "Rückgängig" (both legs of a transfer come back). */
async function removeWithUndo(entry: PotHistoryEntry, title: string) {
  try {
    await repos.pots.removeTransaction(entry.tx.id)
    toast(`${title} (${formatAUD(entry.tx.amountCents, { signed: true })}) gelöscht`, {
      action: {
        label: 'Rückgängig',
        onClick: () => {
          repos.pots
            .restoreTransaction(entry.tx.id)
            .catch((error) => toast.error(errorMessage(error)))
        },
      },
    })
  } catch (error) {
    toast.error(errorMessage(error))
  }
}

/**
 * A pot's bookings, newest first, with the balance after each. Manual bookings can be swiped
 * away; weekly savings and pot-paid expenses follow their week/expense – the expense opens for
 * editing instead.
 */
export function PotHistoryList({ entries, copyFor, today }: PotHistoryListProps) {
  const openExpense = useUiStore((state) => state.openExpense)

  return (
    <GlassCard padded={false} className="divide-y divide-border overflow-hidden">
      <AnimatePresence initial={false}>
        {entries.map((entry) => {
          const { tx } = entry
          const copy = copyFor(entry)
          const content = (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{copy.title}</span>
                <span className="block truncate text-label text-fg-muted">
                  {formatDayLabel(tx.date, today)}
                  {copy.subtitle ? ` · ${copy.subtitle}` : ''}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <Money cents={tx.amountCents} tone="auto" signed className="block font-semibold" />
                <Money cents={entry.balanceAfterCents} tone="muted" className="block text-label" />
              </span>
            </>
          )
          const rowClass = 'flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left'

          return (
            <m.div
              key={tx.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={spring.soft}
            >
              {isDerivedTx(tx) ? (
                tx.expenseId ? (
                  <button
                    type="button"
                    onClick={() => tx.expenseId && openExpense(tx.expenseId)}
                    className={cn(
                      rowClass,
                      'outline-none hover:bg-surface-3/40 focus-visible:bg-surface-3/60',
                    )}
                  >
                    {content}
                  </button>
                ) : (
                  <div className={rowClass}>{content}</div>
                )
              ) : (
                <SwipeRow
                  onDelete={() => void removeWithUndo(entry, copy.title)}
                  deleteLabel={`${copy.title} löschen`}
                >
                  <div className={rowClass}>{content}</div>
                </SwipeRow>
              )}
            </m.div>
          )
        })}
      </AnimatePresence>
    </GlassCard>
  )
}
