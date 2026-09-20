import type { Transition } from 'motion/react'

/** Durations in seconds (motion uses seconds). */
export const duration = {
  fast: 0.12,
  base: 0.2,
  slow: 0.32,
} as const

export const spring = {
  /** Taps, toggles, tab indicator. */
  snappy: { type: 'spring', stiffness: 500, damping: 35 },
  /** Sheets, page content, progress rings. */
  soft: { type: 'spring', stiffness: 260, damping: 28 },
  /** Success moments (week closed, task checked). */
  bouncy: { type: 'spring', stiffness: 400, damping: 17 },
} as const satisfies Record<string, Transition>

/** Haptic-like press feedback for tappable surfaces. */
export const tap = { scale: 0.97 } as const
