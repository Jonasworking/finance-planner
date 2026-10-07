import { Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { repos } from '@/db'
import { purchaseDay } from '@/lib/bankInbox'
import { formatDayLabel } from '@/lib/dates'
import { displayMerchant } from '@/lib/merchantRules'
import type { BankTransaction, Category, ISODate } from '@/lib/types'
import { GlassCard } from '@/shared/components/GlassCard'
import { Money } from '@/shared/components/Money'
import { errorMessage } from '@/shared/lib/errorMessages'
import { Button } from '@/shared/ui/button'

/** More rows than this are not worth scrolling through on a phone; the newest come first. */
const MAX_ROWS = 50

export interface DoneViewProps {
  /** Debits that were dealt with, newest first. */
  lines: readonly BankTransaction[]
  /** Credits, newest first, with whether their sender is marked as the employer. */
  credits: readonly { tx: BankTransaction; isIncome: boolean }[]
  /** Every category, also archived ones. */
  categories: readonly Category[]
  /** Category of each expense, to say where an assigned line went. */
  expenseCategoryIds: Record<string, string>
  today: ISODate
}

const fail = (error: unknown) => toast.error(errorMessage(error))

async function backToInbox(tx: BankTransaction) {
  if (tx.status === 'open') return
  const was = { status: tx.status, expenseId: tx.expenseId }
  try {
    await repos.bank.backToInbox(tx.id)
    toast(
      tx.status === 'assigned'
        ? 'Zurück in der Inbox – die Ausgabe ist entfernt'
        : 'Zurück in der Inbox',
      {
        action: {
          label: 'Rückgängig',
          onClick: () => {
            repos.bank.restoreDone(tx.id, was).catch(fail)
          },
        },
      },
    )
  } catch (error) {
    fail(error)
  }
}

async function toggleIncome(tx: BankTransaction, isIncome: boolean) {
  try {
    if (isIncome) {
      await repos.bank.unmarkIncomeSource(tx.id)
      toast(`${displayMerchant(tx.description)} zählt nicht mehr als Lohn`)
    } else {
      await repos.bank.markIncomeSource(tx.id)
      toast.success('Als Lohn gemerkt', {
        description: 'Der Wochenabschluss schlägt den Betrag als Einkommen vor.',
      })
    }
  } catch (error) {
    fail(error)
  }
}

/** What was dealt with (and can come back to the inbox), and the credits with the wage switch. */
export function DoneView({ lines, credits, categories, expenseCategoryIds, today }: DoneViewProps) {
  const what = (tx: BankTransaction) => {
    if (tx.status === 'ignored') return 'keine Ausgabe'
    if (tx.status === 'matched') return 'schon erfasst'
    const categoryId = tx.expenseId ? expenseCategoryIds[tx.expenseId] : undefined
    return `→ ${categories.find((category) => category.id === categoryId)?.name ?? 'Ausgabe'}`
  }

  return (
    <div className="flex flex-col gap-6">
      {credits.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-caption text-fg-subtle uppercase">Gutschriften</h2>
          <GlassCard padded={false} className="divide-y divide-border overflow-hidden">
            {credits.slice(0, MAX_ROWS).map(({ tx, isIncome }) => (
              <div key={tx.id} className="flex min-h-16 items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{displayMerchant(tx.description)}</span>
                  <span className="block truncate text-label text-fg-muted">
                    {formatDayLabel(tx.date, today)} · <Money cents={tx.amountCents} />
                  </span>
                </span>
                <Button
                  type="button"
                  variant={isIncome ? 'default' : 'secondary'}
                  size="touch"
                  aria-pressed={isIncome}
                  aria-label={`${displayMerchant(tx.description)}: das ist mein Lohn`}
                  onClick={() => void toggleIncome(tx, isIncome)}
                >
                  {isIncome ? 'Lohn ✓' : 'Mein Lohn'}
                </Button>
              </div>
            ))}
          </GlassCard>
          <p className="px-1 text-label text-fg-muted">
            Gutschriften werden nie zu Ausgaben. Markierst du deinen Lohn, schlägt der
            Wochenabschluss ihn als Einkommen vor – übernommen wird erst, wenn du abschließt.
          </p>
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-caption text-fg-subtle uppercase">Erledigte Buchungen</h2>
        {lines.length === 0 ? (
          <GlassCard>
            <p className="text-label text-fg-muted">
              Noch nichts erledigt. Zugeordnete, verknüpfte und aussortierte Buchungen stehen hier –
              und lassen sich von hier zurück in die Inbox holen.
            </p>
          </GlassCard>
        ) : (
          <GlassCard padded={false} className="divide-y divide-border overflow-hidden">
            {lines.slice(0, MAX_ROWS).map((tx) => (
              <div key={tx.id} className="flex min-h-16 items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{displayMerchant(tx.description)}</span>
                  <span className="block truncate text-label text-fg-muted">
                    <Money cents={-tx.amountCents} /> · {what(tx)} ·{' '}
                    {formatDayLabel(purchaseDay(tx), today)}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-touch"
                  aria-label={`${displayMerchant(tx.description)} zurück in die Inbox`}
                  onClick={() => void backToInbox(tx)}
                >
                  <Undo2 aria-hidden />
                </Button>
              </div>
            ))}
          </GlassCard>
        )}
        {lines.length > MAX_ROWS ? (
          <p className="px-1 text-label text-fg-muted">
            Die {MAX_ROWS} neuesten von {lines.length} erledigten Buchungen.
          </p>
        ) : null}
      </section>
    </div>
  )
}
