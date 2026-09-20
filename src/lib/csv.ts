import { isActive, type Category, type Cents, type Expense, type Pot } from './types'

const SEPARATOR = ';'
const BOM = String.fromCharCode(0xfeff) // UTF-8 byte order mark, written as code so no tool can strip it

/** `1250` → `12,50` – decimal comma, no grouping, built from integers (no float rounding). */
export function centsToDecimalComma(cents: Cents): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  return `${sign}${Math.trunc(abs / 100)},${String(abs % 100).padStart(2, '0')}`
}

/**
 * Escapes one text cell: neutralises spreadsheet formulas (a leading = + - @ would be executed
 * by Excel/Numbers) and quotes separators, quotes and line breaks.
 */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/**
 * Expenses as CSV for German Excel/Numbers: `;` separator, decimal comma, UTF-8 BOM, CRLF.
 * Deleted expenses are skipped; rows are sorted by date.
 */
export function expensesToCsv(
  expenses: readonly Expense[],
  categories: readonly Category[],
  pots: readonly Pot[],
): string {
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const potById = new Map(pots.map((pot) => [pot.id, pot]))

  const header = [
    'Datum',
    'Betrag (AUD)',
    'Kategorie',
    'Gruppe',
    'Tags',
    'Notiz',
    'Aus Topf',
    'Wiederkehrend',
  ]
  const rows = expenses
    .filter(isActive)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt))
    .map((expense) => {
      const category = categoryById.get(expense.categoryId)
      return [
        expense.date,
        centsToDecimalComma(expense.amountCents),
        csvCell(category?.name ?? expense.categoryId),
        csvCell(category?.group ?? ''),
        csvCell(expense.tags.join(', ')),
        csvCell(expense.note ?? ''),
        csvCell(
          expense.fundedByPotId
            ? (potById.get(expense.fundedByPotId)?.name ?? expense.fundedByPotId)
            : '',
        ),
        expense.recurringId ? 'ja' : 'nein',
      ].join(SEPARATOR)
    })

  return BOM + [header.join(SEPARATOR), ...rows].join('\r\n') + '\r\n'
}
