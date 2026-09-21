import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { formatMoney, formatPercent, type Cents, type MoneyDisplay } from '@/lib/money'
import { cn } from '@/shared/lib/utils'

export interface DeltaChipProps {
  deltaCents: Cents
  /** Whether a rise is good news (earned, saved) or bad news (spent). */
  upIsGood: boolean
  /** Relative change, when it can be given. */
  ratio?: number | null
  display: MoneyDisplay
}

/** Change against the period before: arrow + signed amount, colored by whether it is good news. */
export function DeltaChip({ deltaCents, upIsGood, ratio, display }: DeltaChipProps) {
  const direction = deltaCents === 0 ? 'same' : deltaCents > 0 ? 'up' : 'down'
  const good = direction === 'same' ? null : (direction === 'up') === upIsGood
  const Icon = direction === 'up' ? ArrowUp : direction === 'down' ? ArrowDown : Minus
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-label whitespace-nowrap tabular-nums',
        good === null
          ? 'bg-surface-3 text-fg-muted'
          : good
            ? 'bg-saved-soft text-saved'
            : 'bg-spent-soft text-spent',
      )}
    >
      <Icon className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
      {direction === 'same' ? (
        'unverändert'
      ) : (
        <>
          <span className="sr-only">{direction === 'up' ? 'gestiegen um' : 'gesunken um'}</span>
          {formatMoney(Math.abs(deltaCents), display, { decimals: false })}
          {ratio != null ? (
            <span className="opacity-80">({formatPercent(ratio, { signed: true })})</span>
          ) : null}
        </>
      )}
    </span>
  )
}
