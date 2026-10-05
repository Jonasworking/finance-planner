import { isISODate } from './dates'
import type { BankSource, Cents, ISODate } from './types'

/*
 * Reading bank exports. Everything here is pure: text in, rows out. What happens to the rows
 * (inbox, dedupe against stored ids) is the repo's business.
 */

/** One CSV record with the (1-based) line it started on. */
export interface CsvRecord {
  line: number
  cells: string[]
}

const BOM = String.fromCharCode(0xfeff)

/**
 * Minimal RFC-4180 reader: quoted cells may contain commas, line breaks and doubled quotes.
 * Blank lines are skipped, a leading BOM is ignored, CRLF and LF both end a record.
 */
export function parseCsv(text: string, delimiter = ','): CsvRecord[] {
  const input = text.startsWith(BOM) ? text.slice(1) : text
  const records: CsvRecord[] = []
  let cells: string[] = []
  let cell = ''
  let quoted = false
  let line = 1
  let startLine = 1

  const endRecord = () => {
    cells.push(cell)
    if (cells.length > 1 || cells[0]!.trim() !== '') records.push({ line: startLine, cells })
    cells = []
    cell = ''
  }

  for (let index = 0; index < input.length; index++) {
    const char = input[index]!
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        cell += '"'
        index++
      } else if (char === '"') {
        quoted = false
      } else {
        if (char === '\n') line++
        cell += char
      }
    } else if (char === '"' && cell === '') {
      quoted = true
    } else if (char === delimiter) {
      cells.push(cell)
      cell = ''
    } else if (char === '\n') {
      endRecord()
      line++
      startLine = line
    } else if (char !== '\r') {
      cell += char
    }
  }
  if (cell !== '' || cells.length > 0) endRecord()
  return records
}

/** "05/10/2026" (day first) → "2026-10-05"; `null` for anything that is not a real day. */
export function parseBankDate(raw: string): ISODate | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim())
  if (!match) return null
  const iso = `${match[3]}-${match[2]!.padStart(2, '0')}-${match[1]!.padStart(2, '0')}`
  return isISODate(iso) ? iso : null
}

/**
 * "-7.50", "+1763.94", "1,763.94", "12" → signed cents; `null` for anything else. The decimal
 * separator is a dot (bank exports are English), commas only group thousands. No floats involved.
 */
export function parseBankAmount(raw: string): Cents | null {
  const match = /^([+-])?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/.exec(raw.trim())
  if (!match) return null
  const whole = Number(match[2]!.replaceAll(',', ''))
  const fraction = Number((match[3] ?? '').padEnd(2, '0'))
  const cents = whole * 100 + fraction
  if (!Number.isSafeInteger(cents)) return null
  return match[1] === '-' && cents !== 0 ? -cents : cents
}

/** How one bank lays out its export. Another bank = another entry in `BANK_FORMATS`. */
export interface BankFormat {
  id: BankSource
  label: string
  hasHeader: boolean
  /** Zero-based column positions. */
  columns: { date: number; amount: number; description: number; balance: number | null }
  /** The day of the purchase, if the description carries one. */
  valueDate: (description: string) => ISODate | null
}

/**
 * CommBank NetBank "CSV" export, checked against a real file (2026-10-05): no header, newest
 * first, CRLF, `DD/MM/YYYY,"-7.50","TEXT","+1763.94"`. Card purchases that were settled later end
 * with "Card xx1234 Value Date: DD/MM/YYYY".
 */
const commbank: BankFormat = {
  id: 'commbank',
  label: 'CommBank',
  hasHeader: false,
  columns: { date: 0, amount: 1, description: 2, balance: 3 },
  valueDate: (description) => {
    const match = /Value Date: (\d{1,2}\/\d{1,2}\/\d{4})/i.exec(description)
    return match ? parseBankDate(match[1]!) : null
  },
}

export const BANK_FORMATS: readonly BankFormat[] = [commbank]

export interface ParsedBankRow {
  /** `bank:<hash>:<n>` – stable across exports, see `bankTxId`. */
  id: string
  /** Line in the file, for error messages and the preview. */
  line: number
  date: ISODate
  valueDate: ISODate | null
  amountCents: Cents
  description: string
  balanceCents: Cents | null
}

export type BankLineProblem = 'columns' | 'date' | 'amount'

export interface BankLineError {
  line: number
  reason: BankLineProblem
}

export type BankFileResult =
  | { ok: true; format: BankSource; rows: ParsedBankRow[]; errors: BankLineError[] }
  | { ok: false; reason: 'empty' | 'unknown-format' }

type RowWithoutId = Omit<ParsedBankRow, 'id'>

const collapse = (text: string) => text.trim().replace(/\s+/g, ' ')

function readRow(record: CsvRecord, format: BankFormat): RowWithoutId | BankLineProblem {
  const { columns } = format
  const needed = Math.max(columns.date, columns.amount, columns.description) + 1
  if (record.cells.length < needed) return 'columns'

  const date = parseBankDate(record.cells[columns.date]!)
  if (!date) return 'date'
  const amountCents = parseBankAmount(record.cells[columns.amount]!)
  if (amountCents === null || amountCents === 0) return 'amount'

  const description = collapse(record.cells[columns.description]!)
  const balance = columns.balance === null ? undefined : record.cells[columns.balance]
  return {
    line: record.line,
    date,
    valueDate: format.valueDate(description),
    amountCents,
    description,
    balanceCents: balance === undefined ? null : parseBankAmount(balance),
  }
}

const dataRecords = (records: readonly CsvRecord[], format: BankFormat) =>
  format.hasHeader ? records.slice(1) : records

/** The first format whose layout fits one of the first data lines (one bad line is no verdict). */
export function detectBankFormat(
  records: readonly CsvRecord[],
  formats: readonly BankFormat[] = BANK_FORMATS,
): BankFormat | null {
  return (
    formats.find((format) => {
      const sample = dataRecords(records, format).slice(0, 5)
      return sample.some((record) => typeof readRow(record, format) !== 'string')
    }) ?? null
  )
}

/** 53-bit string hash (cyrb53) – synchronous, so `lib` stays free of `crypto.subtle`. */
export function hashText(text: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index)
    h1 = Math.imul(h1 ^ code, 2654435761)
    h2 = Math.imul(h2 ^ code, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

/** What makes two lines "the same booking": date, amount and the text (case and spacing aside). */
const contentKey = (row: Pick<ParsedBankRow, 'date' | 'amountCents' | 'description'>) =>
  `${row.date}|${row.amountCents}|${collapse(row.description).toUpperCase()}`

/**
 * Deterministic id of a bank line. `occurrence` counts identical lines (two coffees for the same
 * price on the same day are two bookings, not a duplicate).
 */
export const bankTxId = (
  row: Pick<ParsedBankRow, 'date' | 'amountCents' | 'description'>,
  occurrence: number,
): string => `bank:${hashText(contentKey(row))}:${occurrence}`

/**
 * Numbers identical lines 0, 1, 2 … in file order. An export always holds whole days, so the
 * same booking gets the same number in every export that covers its day – overlapping files
 * therefore agree on every id.
 */
function withIds(rows: readonly RowWithoutId[]): ParsedBankRow[] {
  const seen = new Map<string, number>()
  return rows.map((row) => {
    const key = contentKey(row)
    const occurrence = seen.get(key) ?? 0
    seen.set(key, occurrence + 1)
    return { ...row, id: bankTxId(row, occurrence) }
  })
}

/**
 * Reads a bank export. Lines that cannot be read are reported, never silently dropped; a file
 * that fits no known layout is rejected as a whole instead of being imported half.
 */
export function parseBankFile(
  text: string,
  formats: readonly BankFormat[] = BANK_FORMATS,
): BankFileResult {
  const records = parseCsv(text)
  if (records.length === 0) return { ok: false, reason: 'empty' }
  const format = detectBankFormat(records, formats)
  if (!format) return { ok: false, reason: 'unknown-format' }

  const rows: RowWithoutId[] = []
  const errors: BankLineError[] = []
  for (const record of dataRecords(records, format)) {
    const row = readRow(record, format)
    if (typeof row === 'string') errors.push({ line: record.line, reason: row })
    else rows.push(row)
  }
  return { ok: true, format: format.id, rows: withIds(rows), errors }
}
