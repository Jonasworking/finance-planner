import type { BudgetLevel } from '@/lib/budget'

/** Budget level → tone of bars, sliders and rings. */
export const LEVEL_TONE = { ok: 'saved', warn: 'warning', over: 'spent' } as const satisfies Record<
  BudgetLevel,
  string
>

/** Budget level → text color (complete class names, so Tailwind can see them). */
export const LEVEL_TEXT: Record<BudgetLevel, string> = {
  ok: 'text-fg-muted',
  warn: 'text-warning',
  over: 'text-spent',
}
