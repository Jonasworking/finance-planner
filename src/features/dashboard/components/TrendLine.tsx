import { useId } from 'react'
import { formatAUD } from '@/lib/money'
import type { Cents, ISODate } from '@/lib/types'
import { cn } from '@/shared/lib/utils'
import { trendGeometry } from '../trendGeometry'

export interface TrendLineProps {
  /** Totals after each closed week, oldest first (`savingsOverview().trend`). */
  points: readonly { weekStart: ISODate; totalCents: Cents }[]
  className?: string
}

const ALIGN = {
  start: '',
  center: '-translate-x-1/2',
  end: '-translate-x-full',
} as const

/**
 * The savings of the last weeks as a line over a wash – a plain SVG, so the home screen does
 * not need the chart library. The dot marks where the line stands now.
 */
export function TrendLine({ points, className }: TrendLineProps) {
  const gradient = useId()
  const geometry = trendGeometry(points)
  const first = points[0]
  const last = points[points.length - 1]
  if (!geometry || !first || !last) return null
  const weeks = points.length - 1

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {/* the dot sits on the right edge – keep its radius inside the card */}
      <div
        role="img"
        aria-label={`Sparverlauf: von ${formatAUD(first.totalCents, { decimals: false })} auf ${formatAUD(last.totalCents, { decimals: false })} in ${weeks} ${weeks === 1 ? 'Woche' : 'Wochen'}`}
        className="relative mr-1.5 h-16"
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
          className="absolute inset-0 size-full overflow-visible"
        >
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--chart-saved)" stopOpacity="0.28" />
              <stop offset="1" stopColor="var(--chart-saved)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={geometry.area} fill={`url(#${gradient})`} />
          <path
            d={geometry.line}
            fill="none"
            stroke="var(--chart-saved)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span
          aria-hidden
          className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-saved ring-2 ring-surface-1"
          style={{ left: `${geometry.end.x}%`, top: `${geometry.end.y}%` }}
        />
      </div>
      <div aria-hidden className="relative mr-1.5 h-3.5 text-caption text-fg-subtle">
        {geometry.months.map((month) => (
          <span
            key={`${month.label}-${month.x}`}
            className={cn('absolute top-0 whitespace-nowrap', ALIGN[month.align])}
            style={{ left: `${month.x}%` }}
          >
            {month.label}
          </span>
        ))}
      </div>
    </div>
  )
}
