import { isActive, type Expense } from './types'

export const MAX_TAG_LENGTH = 24

/** Tags are lower-case words without '#': "  #Coffee  Run " → "coffee run". Empty → null. */
export function normalizeTag(raw: string): string | null {
  const tag = raw
    .replace(/^[#\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, MAX_TAG_LENGTH)
    .trim()
  return tag === '' ? null : tag
}

/** Adds a tag unless it is empty or already present. Returns the same array when unchanged. */
export function addTag(tags: readonly string[], raw: string): readonly string[] {
  const tag = normalizeTag(raw)
  return tag === null || tags.includes(tag) ? tags : [...tags, tag]
}

/** All tags in use, most frequent first (then alphabetical) – the autocomplete vocabulary. */
export function collectTags(expenses: readonly Expense[]): string[] {
  const counts = new Map<string, number>()
  for (const expense of expenses) {
    if (!isActive(expense)) continue
    for (const tag of expense.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([tag]) => tag)
}

/**
 * Suggestions for the text being typed: tags starting with the query first, then tags containing
 * it; already selected tags are left out. An empty query suggests the most used tags.
 */
export function suggestTags(
  vocabulary: readonly string[],
  query: string,
  selected: readonly string[],
  limit = 6,
): string[] {
  const needle = normalizeTag(query) ?? ''
  const available = vocabulary.filter((tag) => !selected.includes(tag))
  if (needle === '') return available.slice(0, limit)
  const starts = available.filter((tag) => tag.startsWith(needle))
  const contains = available.filter((tag) => !tag.startsWith(needle) && tag.includes(needle))
  return [...starts, ...contains].slice(0, limit)
}
