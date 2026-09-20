import { useState } from 'react'
import { centsToAmountInput } from '@/lib/amountInput'
import { parseAmountInput, type Cents } from '@/lib/money'
import { cn } from '@/shared/lib/utils'

export interface MoneyInputProps {
  /** Initial amount; the field keeps its own text afterwards (remount via `key` to reset). */
  defaultValue: Cents | null
  /** Parsed cents, or null while the text is empty or not a valid amount. */
  onValueChange: (cents: Cents | null) => void
  'aria-label': string
  placeholder?: string
  autoFocus?: boolean
  size?: 'md' | 'lg'
  className?: string
}

/**
 * Amount field for forms that are filled in rarely (income, budget, standing orders): a real
 * input with the decimal keypad. The quick-add flow uses the custom `Numpad` instead.
 */
export function MoneyInput({
  defaultValue,
  onValueChange,
  placeholder = '0',
  autoFocus,
  size = 'md',
  className,
  ...aria
}: MoneyInputProps) {
  const [text, setText] = useState(defaultValue === null ? '' : centsToAmountInput(defaultValue))
  const invalid = text.trim() !== '' && parseAmountInput(text) === null

  return (
    <label
      className={cn(
        'flex items-center gap-2 rounded-md border bg-surface-1 px-4 focus-within:ring-3 focus-within:ring-ring/50',
        invalid ? 'border-danger' : 'border-border-strong',
        size === 'lg' ? 'h-16' : 'h-12',
        className,
      )}
    >
      <span className={cn('text-fg-subtle', size === 'lg' ? 'text-h1' : 'text-h2')}>A$</span>
      <input
        {...aria}
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          onValueChange(
            event.target.value.trim() === '' ? null : parseAmountInput(event.target.value),
          )
        }}
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="done"
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-invalid={invalid}
        className={cn(
          'min-w-0 flex-1 bg-transparent font-semibold tabular-nums outline-none placeholder:text-fg-subtle',
          size === 'lg' ? 'text-h1' : 'text-h2',
        )}
      />
    </label>
  )
}
