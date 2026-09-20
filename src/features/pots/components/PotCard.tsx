import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { formatAUD } from '@/lib/money'
import type { PotSummary } from '@/lib/pots'
import type { ISODate } from '@/lib/types'
import { CategoryIcon } from '@/shared/components/CategoryIcon'
import { GlassCard } from '@/shared/components/GlassCard'
import { Money } from '@/shared/components/Money'
import { ProgressBar } from '@/shared/components/ProgressBar'
import { potPath } from '@/shared/lib/routes'
import { forecastLine } from '../potCopy'

export interface PotCardProps {
  summary: PotSummary
  today: ISODate
}

/** A pot in the list: balance, progress towards its target and where it is heading. */
export function PotCard({ summary, today }: PotCardProps) {
  const { pot, balanceCents, progress } = summary

  return (
    <Link
      to={potPath(pot.id)}
      className="min-w-0 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <GlassCard className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <CategoryIcon icon={pot.icon} color={pot.color} />
          <span className="min-w-0 flex-1">
            <span className="block truncate">{pot.name}</span>
            <span className="block truncate text-label text-fg-muted">
              {pot.targetCents === null
                ? 'ohne Ziel'
                : `Ziel ${formatAUD(pot.targetCents, { decimals: false })}`}
            </span>
          </span>
          <Money
            cents={balanceCents}
            tone={balanceCents < 0 ? 'spent' : 'default'}
            className="text-h2 font-semibold"
          />
          <ChevronRight className="size-4 shrink-0 text-fg-subtle" aria-hidden />
        </div>
        {progress !== null ? (
          <ProgressBar value={progress} label={`${pot.name}: Ziel erreicht zu`} />
        ) : null}
        <p className="truncate text-label text-fg-muted">{forecastLine(summary, today)}</p>
      </GlassCard>
    </Link>
  )
}
