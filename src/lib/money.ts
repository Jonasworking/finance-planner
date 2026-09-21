/** Money is always stored and computed as integer cents. */
export type Cents = number

const MINUS = String.fromCharCode(0x2212) // the real minus sign, not a hyphen

const withDecimals = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const withoutDecimals = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 0,
})

const eurFormat = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
})

const rateFormat = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
  useGrouping: false,
})

export interface FormatOptions {
  /** Prefix positive amounts with "+" (deltas, deposits). */
  signed?: boolean
  /** Drop the cents, e.g. for compact tiles: `A$1.600`. */
  decimals?: boolean
}

/**
 * Formats cents as `A$1.600,00` (German separators, A$ prefix, real minus sign).
 * Intl's de-DE/AUD output is "1.600,00 AU$", hence the custom formatter.
 */
export function formatAUD(cents: Cents, options: FormatOptions = {}): string {
  const { signed = false, decimals = true } = options
  const abs = Math.abs(cents) / 100
  const digits = decimals ? withDecimals.format(abs) : withoutDecimals.format(abs)
  const isZero = decimals ? Math.round(Math.abs(cents)) === 0 : Math.round(abs) === 0
  const sign = isZero ? '' : cents < 0 ? MINUS : signed ? '+' : ''
  return `${sign}A$${digits}`
}

const eurFormatWhole = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

/** Converts AUD cents with a manually maintained rate (1 AUD = `rate` EUR) → `1.234,56 €`. */
export function formatEUR(cents: Cents, rate: number, options: FormatOptions = {}): string {
  const { signed = false, decimals = true } = options
  const eurCents = Math.round(cents * rate)
  const abs = Math.abs(eurCents) / 100
  const digits = (decimals ? eurFormat : eurFormatWhole).format(abs)
  const isZero = decimals ? eurCents === 0 : Math.round(abs) === 0
  const sign = isZero ? '' : eurCents < 0 ? MINUS : signed ? '+' : ''
  return `${sign}${digits}`
}

/**
 * How amounts are shown: AUD, or – display only – EUR at the hand-maintained rate. Stored and
 * computed values are always AUD cents.
 */
export type MoneyDisplay = { currency: 'AUD' } | { currency: 'EUR'; rate: number }

export const AUD_DISPLAY: MoneyDisplay = { currency: 'AUD' }

/** EUR only when it is switched on AND a usable rate exists. */
export function moneyDisplay(settings: { showEur: boolean; eurRate: number | null }): MoneyDisplay {
  return settings.showEur && settings.eurRate !== null && settings.eurRate > 0
    ? { currency: 'EUR', rate: settings.eurRate }
    : AUD_DISPLAY
}

export function formatMoney(
  cents: Cents,
  display: MoneyDisplay,
  options: FormatOptions = {},
): string {
  return display.currency === 'EUR'
    ? formatEUR(cents, display.rate, options)
    : formatAUD(cents, options)
}

/**
 * Parses user input into cents. Comma is the decimal separator ("12,5" → 1250);
 * a lone dot with one or two trailing digits is accepted as a decimal point too ("12.50").
 * Returns null for anything that is not a non-negative amount.
 */
export function parseAmountInput(input: string): Cents | null {
  const raw = input.replace(/\s|A\$|\$/g, '')
  if (raw === '' || !/^[\d.,]+$/.test(raw)) return null

  let normalized: string
  if (raw.includes(',')) {
    if (raw.indexOf(',') !== raw.lastIndexOf(',')) return null
    normalized = raw.replace(/\./g, '').replace(',', '.')
  } else if (/^\d+\.\d{1,2}$/.test(raw)) {
    normalized = raw
  } else {
    normalized = raw.replace(/\./g, '')
  }

  if (!/^\d*(\.\d{0,2})?$/.test(normalized) || normalized === '' || normalized === '.') return null
  const value = Number(normalized)
  return Number.isFinite(value) ? Math.round(value * 100) : null
}

export const MAX_RATE = 100

/** A usable exchange rate: finite, above zero and not absurdly large (typo guard). */
export const isValidRate = (rate: number): boolean =>
  Number.isFinite(rate) && rate > 0 && rate <= MAX_RATE

/**
 * Parses a hand-typed exchange rate ("0,61" or "0.61") to at most four decimals.
 * Null for anything that is not a usable rate.
 */
export function parseRateInput(input: string): number | null {
  const raw = input.trim().replace(',', '.')
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(raw)) return null
  const rate = Math.round(Number(raw) * 10_000) / 10_000
  return isValidRate(rate) ? rate : null
}

/** "0,61" – how a stored rate is shown and pre-filled. */
export function formatRate(rate: number): string {
  return rateFormat.format(rate)
}

/** Safe part/total ratio; 0 when there is no positive total. */
export function ratio(part: number, total: number): number {
  return total > 0 ? part / total : 0
}
