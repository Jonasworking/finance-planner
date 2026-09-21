import {
  AUD_DISPLAY,
  formatMoney,
  type Cents,
  type FormatOptions,
  type MoneyDisplay,
} from '@/lib/money'
import { cn } from '@/shared/lib/utils'

type MoneyTone = 'default' | 'muted' | 'saved' | 'spent' | 'income' | 'auto'

const toneClass: Record<Exclude<MoneyTone, 'auto'>, string> = {
  default: '',
  muted: 'text-fg-muted',
  saved: 'text-saved',
  spent: 'text-spent',
  income: 'text-income',
}

export interface MoneyProps extends FormatOptions {
  cents: Cents
  /** `auto` colors positive amounts mint and negative amounts coral. */
  tone?: MoneyTone
  /** Show the amount in EUR instead (display only – screens with a currency switch pass it). */
  display?: MoneyDisplay
  className?: string
}

/** The only way amounts are rendered: `A$1.600,00`, tabular figures, never wrapping. */
export function Money({
  cents,
  tone = 'default',
  signed,
  decimals,
  display = AUD_DISPLAY,
  className,
}: MoneyProps) {
  const resolved = tone === 'auto' ? (cents < 0 ? 'spent' : cents > 0 ? 'saved' : 'default') : tone
  return (
    <span className={cn('whitespace-nowrap tabular-nums', toneClass[resolved], className)}>
      {formatMoney(cents, display, { signed, decimals })}
    </span>
  )
}
