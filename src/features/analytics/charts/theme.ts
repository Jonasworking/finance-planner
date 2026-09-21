/** Chart chrome – recessive, from the same tokens as the rest of the app. */
export const AXIS_TICK = { fill: 'var(--fg-muted)', fontSize: 11 } as const
export const GRID_STROKE = 'var(--border)'
export const BASELINE_STROKE = 'var(--border-strong)'
export const CURSOR_FILL = { fill: 'var(--surface-3)', fillOpacity: 0.6 } as const

export const SERIES = {
  income: 'var(--chart-income)',
  spent: 'var(--chart-spent)',
  saved: 'var(--chart-saved)',
} as const

/** Marks stay thin: a column never fills its slot. */
export const MAX_BAR_SIZE = 24
export const ANIMATION_MS = 400
