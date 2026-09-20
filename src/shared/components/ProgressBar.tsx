import { cn } from '@/shared/lib/utils'

type BarTone = 'saved' | 'warning' | 'spent' | 'income' | 'muted'

const fillClass: Record<BarTone, string> = {
  saved: 'bg-saved',
  warning: 'bg-warning',
  spent: 'bg-spent',
  income: 'bg-income',
  muted: 'bg-fg-subtle',
}

export interface ProgressBarProps {
  /** Progress from 0 to 1; values outside are clamped. */
  value: number
  /** Accessible name, e.g. "Lebensmittel: Limit verbraucht". */
  label: string
  tone?: BarTone
  className?: string
}

/** Thin bar for list rows (category limits, pot targets) – the ring's small sibling. */
export function ProgressBar({ value, label, tone = 'saved', className }: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, value))
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      className={cn('h-1.5 overflow-hidden rounded-full bg-surface-3', className)}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-500 ease-out-soft motion-reduce:transition-none',
          fillClass[tone],
        )}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  )
}
