import { CircleCheck } from 'lucide-react'
import { Link } from 'react-router'
import type { ReservedItem, Usage } from '@/lib/budget'
import type { WeekProjection } from '@/lib/dashboard'
import { formatDayLabel } from '@/lib/dates'
import { formatAUD } from '@/lib/money'
import type { WeekSummary } from '@/lib/savings'
import type { ISODate } from '@/lib/types'
import { GlassCard } from '@/shared/components/GlassCard'
import { Money } from '@/shared/components/Money'
import { ProgressRing } from '@/shared/components/ProgressRing'

export interface WeekHeroProps {
  summary: WeekSummary
  /** The running week against its budget (`runningWeekBudget`); null without a budget. */
  usage: Usage | null
  projection: WeekProjection
  reserved: { totalCents: number; items: ReservedItem[] }
  daysLeft: number
  today: ISODate
}

const RING_TONE = { ok: 'saved', warn: 'warning', over: 'spent' } as const

/** The running week at a glance. Works from day one: the projection assumes the default income. */
export function WeekHero({ summary, usage, projection, reserved, daysLeft, today }: WeekHeroProps) {
  const limit = usage?.limitCents ?? null
  const remaining = usage?.remainingCents ?? null
  const nextReserved = reserved.items[0]

  return (
    <GlassCard className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
      {/* The whole ring is the way to the budget – a touch target nobody can miss. */}
      <Link
        to="/budget"
        aria-label="Budget anpassen"
        className="mx-auto shrink-0 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ProgressRing
          value={usage?.spentRatio ?? 0}
          reserved={usage?.reservedRatio ?? 0}
          label="Wochenbudget verbraucht"
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
      </Link>

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
