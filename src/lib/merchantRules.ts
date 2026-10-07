import { isInInbox } from './bankInbox'
import {
  isActive,
  type BankTransaction,
  type Category,
  type Expense,
  type MerchantRule,
  type MerchantRuleAction,
} from './types'

/*
 * Learning merchants: every assignment in the inbox teaches a rule "normalized merchant → what
 * to do". Pure – the repo stores what `learnRule` returns.
 */

/** Country and state codes the bank appends to card purchases ("… KARRATHA WA AUS"). */
const PLACE_CODES = new Set([
  'au',
  'aus',
  'wa',
  'nsw',
  'ns',
  'vic',
  'vi',
  'qld',
  'ql',
  'sa',
  'tas',
  'ta',
  'nt',
  'act',
  'ac',
])

/** Without a branch number a name cannot be told from its suburb: keep this many words. */
const MAX_WORDS = 3

const words = (text: string) => text.split(/\s+/).filter(Boolean)

/**
 * The merchant of a bank text, robust against branch numbers, places and card suffixes:
 * "WOOLWORTHS 1234 PERTH WA AUS Card xx1234 Value Date: 16/09/2026" → "woolworths".
 *
 * - card suffix, payment-service prefix ("SMP*", "SQ *") and a leading branch number ("6943-") go
 * - trailing country / state codes go, also glued ones ("… StAU")
 * - everything from the first word with a digit on is branch or place ("4611 KARRATHA", "Perth06")
 * - names without any number keep their first three words ("the good grocer")
 * - direct debits and transfers are named after the other party
 */
export function normalizeMerchant(description: string): string {
  const text = description.replace(/\s+Card xx\d+.*$/i, '').trim()

  const debit = /^Direct Debit\s+\d+\s+(.+)$/i.exec(text)
  if (debit) {
    return words(debit[1]!.toLowerCase())
      .filter((word) => !/^\d+$/.test(word))
      .slice(0, MAX_WORDS)
      .join(' ')
  }
  const transfer = /^(?:Fast )?Transfer (?:From|To)\s+(.+?)(?:\s+CREDIT TO ACCOUNT.*)?$/i.exec(text)
  if (transfer) return words(transfer[1]!.toLowerCase()).slice(0, MAX_WORDS).join(' ')

  const cleaned = text
    .replace(/^[A-Za-z]{2,6}\s?\*\s?/, '')
    .replace(/^\d+-/, '')
    .replace(/([a-z])AUS?$/, '$1')
  const tokens = words(cleaned.toLowerCase())
  while (tokens.length > 1 && PLACE_CODES.has(tokens.at(-1)!)) tokens.pop()

  const firstNumber = tokens.findIndex((word, index) => index > 0 && /\d/.test(word))
  const name = firstNumber === -1 ? tokens.slice(0, MAX_WORDS) : tokens.slice(0, firstNumber)
  return name.join(' ')
}

/** A pattern the way people write a name: "woolworths" → "Woolworths". */
export const displayPattern = (pattern: string): string =>
  pattern.replace(
    /(^|[\s./-])([a-z])/g,
    (_, lead: string, letter: string) => `${lead}${letter.toUpperCase()}`,
  )

/** The merchant for people: "Woolworths", "The Good Grocer". Falls back to the bank's text. */
export function displayMerchant(description: string): string {
  const pattern = normalizeMerchant(description)
  return pattern === '' ? description.trim() : displayPattern(pattern)
}

export const merchantRuleId = (pattern: string): string => `rule:${pattern}`

/**
 * The rule for a bank text: the exact pattern, otherwise the longest rule whose words open the
 * merchant ("woolworths" also covers "woolworths metro").
 */
export function matchRule(
  description: string,
  rules: readonly MerchantRule[],
): MerchantRule | null {
  const key = normalizeMerchant(description)
  if (key === '') return null
  let best: MerchantRule | null = null
  for (const rule of rules) {
    if (!isActive(rule)) continue
    if (rule.pattern === key) return rule
    if (
      key.startsWith(`${rule.pattern} `) &&
      (!best || rule.pattern.length > best.pattern.length)
    ) {
      best = rule
    }
  }
  return best
}

export interface RuleTarget {
  action: MerchantRuleAction
  /** Set for `categorize` only. */
  categoryId: string | null
}

/**
 * The rule after one more assignment of this merchant. The same target again counts as a
 * confirmation; a different target (or a rule that had been deleted) starts over at 1.
 */
export function learnRule(
  previous: MerchantRule | undefined,
  pattern: string,
  target: RuleTarget,
  now: number,
): MerchantRule {
  const categoryId = target.action === 'categorize' ? target.categoryId : null
  const same =
    previous !== undefined &&
    isActive(previous) &&
    previous.action === target.action &&
    previous.categoryId === categoryId
  return {
    id: merchantRuleId(pattern),
    pattern,
    action: target.action,
    categoryId,
    confirmations: same ? previous.confirmations + 1 : 1,
    lastUsedAt: now,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    deletedAt: null,
  }
}

/** Category ids by how often they were used, most used first (stable: ties by id). */
export function categoryUsage(expenses: readonly Expense[]): string[] {
  const counts = new Map<string, number>()
  for (const expense of expenses) {
    if (isActive(expense)) counts.set(expense.categoryId, (counts.get(expense.categoryId) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort(([idA, a], [idB, b]) => b - a || idA.localeCompare(idB))
    .map(([id]) => id)
}

/**
 * Every selectable category, most likely first: the merchant's rule, then what is used most,
 * then the rest in their own order. The first two sit at the edges of the swipe card.
 */
export function suggestCategories(input: {
  description: string
  rules: readonly MerchantRule[]
  /** From `categoryUsage`. */
  usage: readonly string[]
  /** Selectable categories in display order. */
  categories: readonly Category[]
}): Category[] {
  const byId = new Map(input.categories.map((category) => [category.id, category]))
  const rule = matchRule(input.description, input.rules)
  const order = [
    ...(rule?.action === 'categorize' && rule.categoryId ? [rule.categoryId] : []),
    ...input.usage,
    ...input.categories.map((category) => category.id),
  ]
  const result: Category[] = []
  const seen = new Set<string>()
  for (const id of order) {
    const category = byId.get(id)
    if (!category || seen.has(id)) continue
    seen.add(id)
    result.push(category)
  }
  return result
}

/** A target has to be confirmed this often before a rule may act without being asked. */
export const AUTO_CONFIRMATIONS = 2

export interface AutoAssignment {
  tx: BankTransaction
  rule: MerchantRule
}

/**
 * Inbox lines of known merchants – what "automatisch zuordnen" would do, for the preview.
 * Only well-confirmed rules count, and only those that sort a line (category or "no expense").
 */
export function autoAssignable(
  inbox: readonly BankTransaction[],
  rules: readonly MerchantRule[],
  categories: readonly Category[],
): AutoAssignment[] {
  const selectable = new Set(categories.map((category) => category.id))
  const result: AutoAssignment[] = []
  for (const tx of inbox) {
    if (!isInInbox(tx)) continue
    const rule = matchRule(tx.description, rules)
    if (!rule || rule.confirmations < AUTO_CONFIRMATIONS) continue
    if (rule.action === 'income') continue
    if (rule.action === 'categorize' && !(rule.categoryId && selectable.has(rule.categoryId))) {
      continue
    }
    result.push({ tx, rule })
  }
  return result
}
