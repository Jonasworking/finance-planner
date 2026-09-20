import type { ComponentProps } from 'react'
import { cn } from '@/shared/lib/utils'

export interface GlassCardProps extends ComponentProps<'div'> {
  /** `glass` blurs what is behind it – reserve for overlays (tab bar, sticky header). */
  variant?: 'solid' | 'glass'
  padded?: boolean
}

export function GlassCard({
  variant = 'solid',
  padded = true,
  className,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border shadow-card',
        variant === 'glass' ? 'glass' : 'bg-surface-1',
        padded && 'p-4 sm:p-5',
        className,
      )}
      {...props}
    />
  )
}
