import type { ParsedBankRow } from './bankImport'
import { addDaysISO, weekStartOf } from './dates'
import { isActive, type BankTransaction, type Expense, type ISODate, type Week } from './types'

/*
 * What an import does with the lines of a file, and how the inbox reads stored lines. Pure:
 * the repo writes exactly the plan computed here, the preview shows the same plan.
 */

/** A hand-entered expense may be dated up to this many days before the purchase the bank reports. */
export const MATCH_DAYS_BEFORE = 3

type BankLine = Pick<BankTransaction, 'date' | 'valueDate' | 'amountCents'>

/** The day the money was spent: the value date of a card purchase, otherwise the booking date. */
export const purchaseDay = (line: Pick<BankLine, 'date' | 'valueDate'>): ISODate =>
  line.valueDate ?? line.date

/** Inbox = debits nobody has dealt with yet. Credits never show up there. */
export const isInInbox = (tx: BankTransaction): boolean =>
  isActive(tx) && tx.status === 'open' && tx.amountCents < 0

/**
 * Expenses that could be this bank line, entered by hand before the import: same amount, dated
 * between three days before the purchase and the booking date, and not yet tied to another line.
 */
export function matchCandidates(
  line: BankLine,
  expenses: readonly Expense[],
  linkedExpenseIds: ReadonlySet<string>,
): Expense[] {
  if (line.amountCents >= 0) return []
  const from = addDaysISO(purchaseDay(line), -MATCH_DAYS_BEFORE)
  return expenses
    .filter(
      (expense) =>
        isActive(expense) &&
        !linkedExpenseIds.has(expense.id) &&
        expense.amountCents === -line.amountCents &&
        expense.date >= from &&
        expense.date <= line.date,
    )
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
}

export interface ImportPlan {
  /** New debits that go to the inbox (includes `ambiguous`). */
  inbox: ParsedBankRow[]
  /** New debits that are obviously an expense entered by hand: linked, no new expense. */
  matched: { row: ParsedBankRow; expense: Expense }[]
  /** Inbox lines with possible, but not unambiguous, hand-entered counterparts. */
  ambiguous: ParsedBankRow[]
  /** New credits: stored (dedupe, income suggestion), never an expense. */
  credits: ParsedBankRow[]
  /** New lines from before tracking began: stored as ignored. */
  beforeTracking: ParsedBankRow[]
  /** Lines an earlier import already brought in. */
  alreadyImported: ParsedBankRow[]
  /**
   * The file starts after the newest stored line and shares nothing with earlier imports:
   * bookings in between may be missing (an export holds a limited number of lines).
   */
  gap: boolean
}

export interface ImportPlanInput {
  rows: readonly ParsedBankRow[]
  /** Ids of every stored bank line, tombstones included. */
  existingIds: ReadonlySet<string>
  /** Booking date of the newest stored line, `null` before the first import. */
  latestStoredDate: ISODate | null
  expenses: readonly Expense[]
  /** Expenses that already belong to a stored bank line. */
  linkedExpenseIds: ReadonlySet<string>
  trackingSince: ISODate
  /** Row ids the user chose not to link automatically ("Lösen" in the preview). */
  keepOpen?: ReadonlySet<string>
}

/**
 * Sorts the lines of a file. A debit is linked automatically only when the match is unambiguous
 * in both directions: exactly one candidate expense, and that expense is a candidate of no other
 * new line. Everything else with candidates is left for the user to decide.
 */
export function planImport(input: ImportPlanInput): ImportPlan {
  const { rows, existingIds, expenses, linkedExpenseIds, keepOpen } = input
  const trackingStart = weekStartOf(input.trackingSince)
  const plan: ImportPlan = {
    inbox: [],
    matched: [],
    ambiguous: [],
    credits: [],
    beforeTracking: [],
    alreadyImported: [],
    gap: false,
  }

  const debits: ParsedBankRow[] = []
  for (const row of rows) {
    if (existingIds.has(row.id)) plan.alreadyImported.push(row)
    else if (purchaseDay(row) < trackingStart) plan.beforeTracking.push(row)
    else if (row.amountCents > 0) plan.credits.push(row)
    else debits.push(row)
  }

  const candidates = new Map(
    debits.map((row) => [row.id, matchCandidates(row, expenses, linkedExpenseIds)]),
  )
  const claims = new Map<string, number>()
  for (const list of candidates.values()) {
    for (const expense of list) claims.set(expense.id, (claims.get(expense.id) ?? 0) + 1)
  }

  for (const row of debits) {
    const list = candidates.get(row.id)!
    const only = list.length === 1 ? list[0]! : null
    if (only && claims.get(only.id) === 1 && !keepOpen?.has(row.id)) {
      plan.matched.push({ row, expense: only })
      continue
    }
    plan.inbox.push(row)
    if (list.length > 0) plan.ambiguous.push(row)
  }

  const oldest = rows.reduce<ISODate | null>(
    (min, row) => (min === null || row.date < min ? row.date : min),
    null,
  )
  plan.gap =
    input.latestStoredDate !== null &&
    oldest !== null &&
    plan.alreadyImported.length === 0 &&
    oldest > input.latestStoredDate
  return plan
}

/** The bank's text without the card suffix – good enough as the note of the expense. */
export function bankNote(description: string): string {
  return description.replace(/\s+Card xx\d+.*$/i, '').trim()
}

/**
 * The closed week a new expense for this line would land in (its booking in "Nur gespart" will
 * shrink by the amount), or `null` while that week is still open.
 */
export function closedWeekFor(
  line: Pick<BankLine, 'date' | 'valueDate'>,
  weeks: readonly Week[],
): ISODate | null {
  const weekStart = weekStartOf(purchaseDay(line))
  const week = weeks.find((candidate) => candidate.id === weekStart)
  return week && isActive(week) && week.closedAt !== null ? weekStart : null
}

/** Newest first; lines of one day in a stable order. */
export const byNewest = (a: BankTransaction, b: BankTransaction): number =>
  b.date.localeCompare(a.date) || a.id.localeCompare(b.id)
