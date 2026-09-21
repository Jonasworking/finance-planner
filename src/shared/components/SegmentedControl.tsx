import { motion } from 'motion/react'
import { useId } from 'react'
import { cn } from '@/shared/lib/utils'
import { spring } from '@/shared/motion'

export interface SegmentedOption<T extends string | number> {
  value: T
  label: string
  /** Spoken instead of a terse label, e.g. "8 Wochen" for "8 W". */
  ariaLabel?: string
}

export interface SegmentedControlProps<T extends string | number> {
  /** Accessible name of the group. */
  label: string
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

/** One-of-n switch for view options (range, grouping, currency). 44 px tall on touch screens. */
export function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  const indicatorId = useId()
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('grid auto-cols-fr grid-flow-col rounded-md bg-surface-3 p-1', className)}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.ariaLabel}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative flex h-9 min-w-0 items-center justify-center rounded-sm px-3 text-label whitespace-nowrap outline-none',
              'transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:h-11',
              active ? 'text-fg' : 'text-fg-muted hover:text-fg',
            )}
          >
            {active ? (
              <motion.span
                layoutId={indicatorId}
                transition={spring.snappy}
                className="absolute inset-0 rounded-sm bg-surface-1 shadow-card"
              />
            ) : null}
            <span className="relative">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
