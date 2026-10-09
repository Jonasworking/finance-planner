import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import type { Usage } from '@/lib/budget'
import { formatAUD } from '@/lib/money'
import type { WeekSummary } from '@/lib/savings'
import { GlassCard } from '@/shared/components/GlassCard'
import { Money } from '@/shared/components/Money'
import { ProgressRing } from '@/shared/components/ProgressRing'

const whole = (cents: number) => formatAUD(cents, { decimals: false })

/** What the ring says to a screen reader: the amounts, not just a percentage. */
function ringValueText(usage: Usage): string {
  if (usage.limitCents === null || usage.remainingCents === null) return ''
  const reserved = usage.reservedCents > 0 ? `, ${whole(usage.reservedCents)} reserviert` : ''
  const rest =
    usage.remainingCents >= 0
      ? `${whole(usage.remainingCents)} übrig`
      : `${whole(-usage.remainingCents)} drüber`
  return `${whole(usage.spentCents)} von ${whole(usage.limitCents)} ausgegeben${reserved}, ${rest}`
}

export interface WeekRingCardProps {
  summary: WeekSummary
  /** The running week against its budget (`runningWeekBudget`); null without a budget. */
  usage: Usage | null
  daysLeft: number
}

const RING_TONE = { ok: 'saved', warn: 'warning', over: 'spent' } as const

/** The running week against its budget. The whole card is the way to the budget. */
export function WeekRingCard({ summary, usage, daysLeft }: WeekRingCardProps) {
  const remaining = usage?.remainingCents ?? null
  return (
    <Link
      to="/budget"
      className="flex min-w-0 flex-1 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <GlassCard className="flex min-w-0 flex-1 flex-col items-center gap-3">
        <p className="flex w-full items-center justify-between text-caption text-fg-subtle uppercase">
          Diese Woche
          <ChevronRight className="size-4 shrink-0" aria-hidden />
        </p>
        <ProgressRing
          value={usage?.spentRatio ?? 0}
          reserved={usage?.reservedRatio ?? 0}
          label="Wochenbudget verbraucht"
          valueText={usage ? ringValueText(usage) : undefined}
          tone={RING_TONE[usage?.level ?? 'ok']}
          size={168}
        >
          <div className="text-center">
            {remaining === null ? (
              <Money cents={summary.spentCents} decimals={false} className="text-h1" />
            ) : (
              <>
                <p className="text-caption text-fg-subtle uppercase">
                  {remaining >= 0 ? 'Rest' : 'Drüber'}
                </p>
                <Money
                  cents={Math.abs(remaining)}
                  decimals={false}
                  tone={remaining >= 0 ? 'default' : 'spent'}
                  className="text-h1"
                />
              </>
            )}
          </div>
        </ProgressRing>
        <p className="mt-auto text-label text-fg-muted">
          {summary.closed
            ? 'Woche abgeschlossen'
            : daysLeft === 0
              ? 'Letzter Tag der Woche'
              : `Noch ${daysLeft} ${daysLeft === 1 ? 'Tag' : 'Tage'}`}
        </p>
      </GlassCard>
    </Link>
  )
}
