import type { WeekProjection } from '@/lib/dashboard'
import { formatWeekday } from '@/lib/dates'
import { formatAUD } from '@/lib/money'
import type { WeekSummary } from '@/lib/savings'
import type { Cents } from '@/lib/types'
import { GlassCard } from '@/shared/components/GlassCard'
import { Money } from '@/shared/components/Money'

const whole = (cents: number) => formatAUD(cents, { decimals: false })

/** Where the projected income comes from – the wage names its day ("Do."), as the bank booked it. */
function incomeHint(projection: WeekProjection): string {
  const amount = whole(projection.incomeCents)
  if (projection.source === 'entered') return `Einkommen ${amount} eingetragen`
  if (projection.source === 'default') return `bei ${amount} Einkommen`
  const [day] = projection.wageDays
  const when = projection.wageDays.length === 1 && day ? formatWeekday(day) : 'mehrere Gutschriften'
  return `bei ${amount} Lohn (${when})`
}

export interface WeekTilesProps {
  summary: WeekSummary
  /** Weekly limit, null without a budget. */
  limitCents: Cents | null
  /** Standing orders of this week that are not booked yet. */
  reservedCents: Cents
  projection: WeekProjection
}

/** The two numbers of the running week next to the hero: what went out, what will be left. */
export function WeekTiles({ summary, limitCents, reservedCents, projection }: WeekTilesProps) {
  return (
    <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 lg:gap-4">
      <GlassCard className="flex min-w-0 flex-col p-3 sm:p-4">
        <p className="text-caption text-fg-subtle uppercase">Ausgegeben</p>
        <Money cents={summary.spentCents} className="text-h2" />
        <p className="text-label text-fg-muted">
          {limitCents !== null ? `von ${whole(limitCents)}` : 'kein Budget'}
          {reservedCents > 0 ? ` · + ${whole(reservedCents)} reserviert` : ''}
        </p>
      </GlassCard>
      <GlassCard className="flex min-w-0 flex-col p-3 sm:p-4">
        <p className="text-caption text-fg-subtle uppercase">Diese Woche</p>
        {summary.closed ? (
          <>
            <Money cents={summary.savedCents} signed tone="auto" className="text-h2" />
            <p className="text-label text-fg-muted">gespart · Woche abgeschlossen</p>
          </>
        ) : (
          <>
            <Money cents={projection.projectedSavedCents} signed tone="auto" className="text-h2" />
            <p className="text-label text-fg-muted">voraussichtlich · {incomeHint(projection)}</p>
          </>
        )}
      </GlassCard>
    </div>
  )
}
