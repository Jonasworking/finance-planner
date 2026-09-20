import { PiggyBank } from 'lucide-react'
import { formatWeekRange } from '@/lib/dates'
import { formatAUD } from '@/lib/money'
import type { WeekSummary } from '@/lib/savings'
import type { Cents } from '@/lib/types'
import { GlassCard } from '@/shared/components/GlassCard'
import { Money } from '@/shared/components/Money'

export interface SavingsCardProps {
  balanceCents: Cents
  /** Most recent closed week, if any. */
  lastClosed: WeekSummary | null
}

/** "Nur gespart" – never an empty card: it explains itself until the first week is closed. */
export function SavingsCard({ balanceCents, lastClosed }: SavingsCardProps) {
  const hint = lastClosed
    ? `Zuletzt ${formatAUD(lastClosed.savedCents, { signed: true })} · Woche ${formatWeekRange(lastClosed.weekStart)}`
    : balanceCents > 0
      ? 'Dein Startguthaben – wächst mit jedem Wochenabschluss.'
      : 'Nach deinem ersten Wochenabschluss landet hier, was von der Woche übrig bleibt.'

  return (
    <GlassCard className="flex items-center gap-4">
      <span className="grid size-12 shrink-0 place-items-center rounded-md bg-saved-soft text-saved">
        <PiggyBank className="size-6" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-caption text-fg-subtle uppercase">Nur gespart</p>
        <Money
          cents={balanceCents}
          tone={balanceCents > 0 ? 'saved' : balanceCents < 0 ? 'spent' : 'muted'}
          className="text-h1"
        />
        <p className="text-label text-fg-muted">{hint}</p>
      </div>
    </GlassCard>
  )
}
