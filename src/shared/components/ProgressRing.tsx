import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

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
  /** Accessible name, e.g. "Wochenbudget verbraucht". */
  label: string
  size?: number
  strokeWidth?: number
  tone?: RingTone
  className?: string
  children?: ReactNode
}

export function ProgressRing({
  value,
  label,
  size = 160,
  strokeWidth = 12,
  tone = 'saved',
  className,
  children,
}: ProgressRingProps) {
  const clamped = Math.min(1, Math.max(0, value))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
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
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          className={cn(
            'transition-[stroke-dashoffset] duration-700 ease-out-soft motion-reduce:transition-none',
            strokeClass[tone],
          )}
        />
      </svg>
      {children ? <div className="absolute inset-0 grid place-items-center">{children}</div> : null}
    </div>
  )
}
