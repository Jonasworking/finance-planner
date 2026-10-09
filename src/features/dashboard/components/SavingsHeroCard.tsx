import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import type { SavingsOverview } from '@/lib/dashboard'
import { addDaysISO, formatDayLabel, weekStartOf } from '@/lib/dates'
import { formatAUD } from '@/lib/money'
import type { ISODate } from '@/lib/types'
import { GlassCard } from '@/shared/components/GlassCard'
import { Money } from '@/shared/components/Money'
import { TrendLine } from './TrendLine'

const whole = (cents: number, signed = false) => formatAUD(cents, { decimals: false, signed })

/** "seit letztem Sonntag" while that is the Sunday meant, otherwise the day itself. */
function sinceLabel(since: ISODate, today: ISODate): string {
  const lastSunday = addDaysISO(weekStartOf(today), -1)
  if (since === lastSunday) return 'seit letztem Sonntag'
  if (since === today) return 'seit heute'
  return `seit ${formatDayLabel(since, today)}`
}

export interface SavingsHeroCardProps {
  overview: SavingsOverview
  today: ISODate
}

/**
 * Everything saved, at a glance – and where it came from over the last weeks. Never an empty
 * card: until the first week is closed it says what will happen here.
 */
export function SavingsHeroCard({ overview, today }: SavingsHeroCardProps) {
  const { totalCents, change, trend } = overview
  return (
    <Link
      to="/pots"
      className="flex min-w-0 flex-1 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <GlassCard className="flex min-w-0 flex-1 flex-col gap-3">
        <div>
          <p className="flex items-center justify-between text-caption text-fg-subtle uppercase">
            Gesamt gespart
            <ChevronRight className="size-4 shrink-0" aria-hidden />
          </p>
          <Money
            cents={totalCents}
            decimals={false}
            tone={totalCents > 0 ? 'saved' : totalCents < 0 ? 'spent' : 'muted'}
            className="text-display"
          />
          {change ? (
            <p className="text-label text-fg-muted">
              {whole(change.deltaCents, true)} {sinceLabel(change.since, today)}
            </p>
          ) : null}
        </div>

        {trend.length > 0 ? (
          <TrendLine points={trend} className="mt-auto" />
        ) : (
          <p className="mt-auto rounded-md bg-saved-soft p-3 text-label text-fg-muted">
            {totalCents > 0
              ? 'Dein Startguthaben. Mit jedem Wochenabschluss kommt dazu, was von der Woche übrig bleibt – hier entsteht dann dein Sparverlauf.'
              : 'Nach deinem ersten Wochenabschluss landet hier, was von der Woche übrig bleibt – und dein Sparverlauf beginnt.'}
          </p>
        )}

        {overview.otherPots > 0 && overview.otherCents !== 0 ? (
          <p className="text-label text-fg-muted">
            Nur gespart {whole(overview.primaryCents)} ·{' '}
            {overview.otherPots === 1 ? '1 Topf' : `${overview.otherPots} Töpfe`}{' '}
            {whole(overview.otherCents)}
          </p>
        ) : null}
      </GlassCard>
    </Link>
  )
}
