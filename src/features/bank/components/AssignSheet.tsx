import { CalendarCheck } from 'lucide-react'
import { bankNote, purchaseDay } from '@/lib/bankInbox'
import { formatDayLabel, formatWeekRange } from '@/lib/dates'
import type { BankTransaction, Category, Expense, ISODate } from '@/lib/types'
import { CategoryGrid } from '@/shared/components/CategoryGrid'
import { CategoryIcon } from '@/shared/components/CategoryIcon'
import { Money } from '@/shared/components/Money'
import { ResponsiveSheet } from '@/shared/components/ResponsiveSheet'
import { Button } from '@/shared/ui/button'
import { assignWithUndo, ignoreWithUndo, linkWithUndo } from '../bankActions'

export interface AssignSheetProps {
  /** The inbox line (kept while the sheet animates out). */
  tx: BankTransaction | null
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: readonly Category[]
  /** Every category, also archived ones – hand-entered expenses may still point at them. */
  allCategories: readonly Category[]
  /** Hand-entered expenses that could be this booking. */
  candidates: readonly Expense[]
  /** Set when the expense would land in a week that is already closed. */
  closedWeek: ISODate | null
  today: ISODate
}

/** One bank line: pick its category, say it is an expense you already entered, or no expense. */
export function AssignSheet({
  tx,
  open,
  onOpenChange,
  categories,
  allCategories,
  candidates,
  closedWeek,
  today,
}: AssignSheetProps) {
  const close = () => onOpenChange(false)
  const amountCents = tx ? -tx.amountCents : 0

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Buchung zuordnen"
      description={tx ? formatDayLabel(purchaseDay(tx), today) : undefined}
      footer={
        <Button
          type="button"
          variant="secondary"
          size="touch"
          disabled={!tx}
          onClick={() => {
            if (!tx) return
            close()
            void ignoreWithUndo(tx)
          }}
        >
          Keine Ausgabe
        </Button>
      }
    >
      {tx ? (
        <div className="flex flex-col gap-4">
          <div className="text-center">
            <Money cents={amountCents} className="text-display" />
            <p className="break-words">{bankNote(tx.description)}</p>
          </div>

          {closedWeek ? (
            <p className="flex gap-3 rounded-md bg-warning-soft px-4 py-3 text-label">
              <CalendarCheck className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
              <span>
                Die Woche {formatWeekRange(closedWeek)} ist abgeschlossen – als neue Ausgabe sinkt
                ihr Gespartes um <Money cents={amountCents} />.
              </span>
            </p>
          ) : null}

          {candidates.length > 0 ? (
            <section aria-label="Schon erfasst?" className="flex flex-col gap-2">
              <h3 className="text-label text-fg-muted">Schon von Hand erfasst?</h3>
              {candidates.map((expense) => {
                const category = allCategories.find((row) => row.id === expense.categoryId)
                return (
                  <button
                    key={expense.id}
                    type="button"
                    aria-label={`Ist dieselbe: ${category?.name ?? 'Ausgabe'} vom ${formatDayLabel(expense.date, today)}`}
                    onClick={() => {
                      close()
                      void linkWithUndo(tx, expense)
                    }}
                    className="flex min-h-14 items-center gap-3 rounded-md bg-surface-3 px-3 py-2 text-left outline-none hover:bg-surface-3/70 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <CategoryIcon
                      icon={category?.icon ?? 'Ellipsis'}
                      color={category?.color ?? 'cat-10'}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">
                        {expense.note || category?.name || 'Ausgabe'}
                      </span>
                      <span className="block truncate text-label text-fg-muted">
                        {formatDayLabel(expense.date, today)} · ist dieselbe
                      </span>
                    </span>
                    <Money cents={expense.amountCents} className="font-semibold" />
                  </button>
                )
              })}
            </section>
          ) : null}

          <section className="flex flex-col gap-2">
            <h3 className="text-label text-fg-muted">
              {candidates.length > 0 ? 'Oder als neue Ausgabe in' : 'Kategorie'}
            </h3>
            <CategoryGrid
              categories={categories}
              value={null}
              onChange={(categoryId) => {
                const category = categories.find((row) => row.id === categoryId)
                if (!category) return
                close()
                void assignWithUndo(tx, category)
              }}
            />
          </section>
        </div>
      ) : null}
    </ResponsiveSheet>
  )
}
