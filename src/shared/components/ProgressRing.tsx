import { m, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'
import { spring } from '@/shared/motion'

type RingTone = 'saved' | 'warning' | 'spent' | 'income'

const strokeClass: Record<RingTone, string> = {
  saved: 'stroke-saved',
  warning: 'stroke-warning',
  spent: 'stroke-spent',
  income: 'stroke-income',
}

export interface ProgressRingProps {
  /** Progress from 0 to 1; values outside are clamped. */
  value: number
  /**
   * Share that is planned but not used yet (e.g. reserved standing orders), drawn as a fainter
   * arc continuing after `value`. Counts towards the announced percentage.
   */
  reserved?: number
  /** Accessible name, e.g. "Wochenbudget verbraucht". */
  label: string
  /** Spoken instead of the bare percentage, e.g. "A$339 von A$400, A$61 übrig". */
  valueText?: string
  size?: number
  strokeWidth?: number
  tone?: RingTone
  className?: string
  children?: ReactNode
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))

export function ProgressRing({
  value,
  reserved = 0,
  label,
  valueText,
  size = 160,
  strokeWidth = 12,
  tone = 'saved',
  className,
  children,
}: ProgressRingProps) {
  const reduceMotion = useReducedMotion()
  const used = clamp(value)
  const committed = clamp(value + Math.max(0, reserved))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  // Arcs sweep in on mount and follow every change; with reduced motion they just appear.
  const arc = (share: number, extraClass?: string) => (
    <m.circle
      cx={size / 2}
      cy={size / 2}
      r={radius}
      fill="none"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeDasharray={circumference}
      initial={reduceMotion ? false : { strokeDashoffset: circumference }}
      animate={{ strokeDashoffset: circumference * (1 - share) }}
      transition={reduceMotion ? { duration: 0 } : spring.soft}
      className={cn(strokeClass[tone], extraClass)}
    />
  )

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(committed * 100)}
      aria-valuetext={valueText}
      className={cn('relative inline-grid place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-surface-3"
        />
        {/* A round cap would paint a dot even for an empty arc, so empty arcs are left out. */}
        {committed > used ? arc(committed, 'opacity-35') : null}
        {used > 0 ? arc(used) : null}
      </svg>
      {children ? <div className="absolute inset-0 grid place-items-center">{children}</div> : null}
    </div>
  )
}
