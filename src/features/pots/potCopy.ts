import { formatDayLabel, formatWeekRange } from '@/lib/dates'
import { formatAUD } from '@/lib/money'
import type { PotSummary } from '@/lib/pots'
import type { Category, Expense, ISODate, Pot, PotTransaction } from '@/lib/types'

const weeks = (count: number) => (count === 1 ? '1 Woche' : `${count} Wochen`)

/** One line on where a pot is heading – for the list card and the detail hero. */
export function forecastLine(summary: PotSummary, today: ISODate): string {
  const { pot, forecast, paceCentsPerWeek, missingCents } = summary
  if (pot.targetCents === null) {
    return paceCentsPerWeek > 0
      ? `Zuletzt ${formatAUD(paceCentsPerWeek, { signed: true })} pro Woche`
      : 'Ohne Ziel – einfach sammeln'
  }
  if (forecast.reached) return 'Ziel erreicht'
  if (summary.overdue) return `Deadline verpasst – es fehlen ${formatAUD(missingCents ?? 0)}`
  if (forecast.eta === null) return 'Noch kein Spartempo – zahl ein oder buch um'
  return `Bei aktuellem Tempo erreicht am ${formatDayLabel(forecast.eta, today)}`
}

/** "2 Wochen vor der Deadline" / "3 Wochen nach der Deadline"; null when there is nothing to compare. */
export function deadlineLine(summary: PotSummary): string | null {
  const delta = summary.deadlineDeltaWeeks
  if (delta === null) return null
  if (delta === 0) return 'Punktlandung zur Deadline'
  return delta > 0 ? `${weeks(delta)} vor der Deadline` : `${weeks(-delta)} nach der Deadline`
}

export interface HistoryCopy {
  title: string
  subtitle: string | null
}

/** What a booking is called in a pot's history. */
export function historyCopy(
  tx: PotTransaction,
  context: {
    pots: readonly Pot[]
    transactions: readonly PotTransaction[]
    fundedExpenses: readonly Expense[]
    categories: readonly Category[]
  },
): HistoryCopy {
  switch (tx.type) {
    case 'auto-weekly':
      return {
        title: tx.amountCents < 0 ? 'Minus-Woche' : 'Wochenabschluss',
        subtitle: tx.sourceWeekStart ? `Woche ${formatWeekRange(tx.sourceWeekStart)}` : null,
      }
    case 'manual-deposit':
      return { title: tx.note ?? 'Einzahlung', subtitle: tx.note ? 'Einzahlung' : null }
    case 'withdrawal':
      return { title: tx.note ?? 'Auszahlung', subtitle: tx.note ? 'Auszahlung' : null }
    case 'transfer-in':
    case 'transfer-out': {
      const otherLeg = context.transactions.find(
        (other) => other.transferId === tx.transferId && other.id !== tx.id,
      )
      const otherPot =
        context.pots.find((pot) => pot.id === otherLeg?.potId)?.name ?? 'anderem Topf'
      return {
        title:
          tx.type === 'transfer-in'
            ? `Umbuchung von „${otherPot}"`
            : `Umbuchung nach „${otherPot}"`,
        subtitle: tx.note ?? null,
      }
    }
    case 'expense-funding': {
      const expense = context.fundedExpenses.find((row) => row.id === tx.expenseId)
      const category = context.categories.find((row) => row.id === expense?.categoryId)?.name
      return {
        title: expense?.note ?? category ?? 'Ausgabe',
        subtitle:
          expense?.note && category ? `Aus dem Topf bezahlt · ${category}` : 'Aus dem Topf bezahlt',
      }
    }
  }
}
