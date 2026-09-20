import { parseAmountInput, type Cents } from './money'

export type NumpadKey =
  '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | ',' | 'backspace'

/** Up to A$999.999 – far beyond any expense, but keeps the display from overflowing. */
export const MAX_INTEGER_DIGITS = 6

const grouping = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 })

/**
 * State machine of the amount entry. The state is the raw text as typed ('', '12', '12,', '12,5'),
 * so the display can show exactly what was entered. Invalid keys leave the state unchanged.
 */
export function applyNumpadKey(current: string, key: NumpadKey): string {
  if (key === 'backspace') return current.slice(0, -1)

  const [integer = '', decimals] = current.split(',')
  if (key === ',') {
    if (decimals !== undefined) return current
    return integer === '' ? '0,' : `${current},`
  }

  if (decimals !== undefined) return decimals.length < 2 ? current + key : current
  if (integer === '0') return key // no leading zeros: "0" + "5" → "5"
  return integer.length < MAX_INTEGER_DIGITS ? current + key : current
}

/** Cents of the entered text; an empty or incomplete entry counts as far as it is typed. */
export function amountInputToCents(current: string): Cents {
  return parseAmountInput(current) ?? 0
}

/** `A$1.600`, `A$12,5`, `A$0,` – grouped integer part plus the decimals exactly as typed. */
export function formatAmountInput(current: string): string {
  const [integer = '', decimals] = current.split(',')
  const grouped = grouping.format(Number(integer || '0'))
  return decimals === undefined ? `A$${grouped}` : `A$${grouped},${decimals}`
}

/** Entry text for editing an existing amount: 1250 → '12,50', 1200 → '12'. */
export function centsToAmountInput(cents: Cents): string {
  const whole = Math.trunc(cents / 100)
  const rest = cents % 100
  return rest === 0 ? String(whole) : `${whole},${String(rest).padStart(2, '0')}`
}
