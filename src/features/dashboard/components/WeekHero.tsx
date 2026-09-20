import { CircleCheck } from 'lucide-react'
import { levelFor, type ReservedItem } from '@/lib/budget'
import type { WeekProjection } from '@/lib/dashboard'
import { formatDayLabel } from '@/lib/dates'
import { formatAUD, ratio } from '@/lib/money'
import type { WeekSummary } from '@/lib/savings'
import type { ISODate } from '@/lib/types'
import { GlassCard } from '@/shared/components/GlassCard'
import { Money } from '@/shared/components/Money'
import { ProgressRing } from '@/shared/components/ProgressRing'

export interface WeekHeroProps {
  summary: WeekSummary
  projection: WeekProjection
  reserved: { totalCents: number; items: ReservedItem[] }
  daysLeft: number
  today: ISODate
}

const RING_TONE = { ok: 'saved', warn: 'warning', over: 'spent' } as const

/** The running week at a glance. Works from day one: the projection assumes the default income. */
export function WeekHero({ summary, projection, reserved, daysLeft, today }: WeekHeroProps) {
  const limit = summary.totalLimitCents
  const committed = summary.spentCents + reserved.totalCents
  const used = limit === null ? 0 : ratio(committed, limit)
  const remaining = limit === null ? null : limit - committed
  const nextReserved = reserved.items[0]

  return (
    <GlassCard className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
      <ProgressRing
        value={used}
        label="Wochenbudget verbraucht"
        tone={RING_TONE[levelFor(used)]}
        size={168}
        className="mx-auto shrink-0"
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

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div>
          <p className="text-caption text-fg-subtle uppercase">Ausgegeben</p>
          <p className="flex flex-wrap items-baseline gap-x-2">
            <Money cents={summary.spentCents} className="text-h1" />
            {limit !== null ? (
              <span className="text-label text-fg-muted">
                von {formatAUD(limit, { decimals: false })}
              </span>
            ) : null}
          </p>
          {nextReserved ? (
            <p className="text-label text-fg-muted">
              + {formatAUD(reserved.totalCents)} reserviert ({nextReserved.title},{' '}
              {formatDayLabel(nextReserved.date, today)}
              {reserved.items.length > 1 ? ` +${reserved.items.length - 1}` : ''})
            </p>
          ) : null}
        </div>

        <div className="rounded-md bg-saved-soft p-3">
          {summary.closed ? (
            <>
              <p className="flex items-center gap-1.5 text-caption text-saved uppercase">
                <CircleCheck className="size-3.5" aria-hidden />
                Woche abgeschlossen · gespart
              </p>
              <Money cents={summary.savedCents} tone="auto" className="text-h1" />
            </>
          ) : (
            <>
              <p className="text-caption text-saved uppercase">Voraussichtlich gespart</p>
              <Money cents={projection.projectedSavedCents} tone="auto" className="text-h1" />
              <p className="text-label text-fg-muted">
                {projection.isEstimate
                  ? `bei ${formatAUD(projection.incomeCents, { decimals: false })} Einkommen`
                  : `Einkommen ${formatAUD(projection.incomeCents, { decimals: false })} eingetragen`}{' '}
                ·{' '}
                {daysLeft === 0
                  ? 'letzter Tag der Woche'
                  : `noch ${daysLeft} ${daysLeft === 1 ? 'Tag' : 'Tage'}`}
              </p>
            </>
          )}
        </div>
      </div>
    </GlassCard>
  )
}
