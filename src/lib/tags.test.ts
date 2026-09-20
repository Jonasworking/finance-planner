import { describe, expect, it } from 'vitest'
import { makeExpense, NOW } from '@/test/fixtures'
import { addTag, collectTags, normalizeTag, suggestTags } from './tags'

describe('normalizeTag', () => {
  it('lower-cases, trims and strips the hash', () => {
    expect(normalizeTag('  #Coffee  Run ')).toBe('coffee run')
    expect(normalizeTag('##Woolworths')).toBe('woolworths')
    expect(normalizeTag('   ')).toBeNull()
    expect(normalizeTag('#')).toBeNull()
    expect(normalizeTag('x'.repeat(40))).toHaveLength(24)
  })
})

describe('addTag', () => {
  it('appends new tags and ignores duplicates and blanks', () => {
    const tags = ['cafe']
    expect(addTag(tags, 'Treat')).toEqual(['cafe', 'treat'])
    expect(addTag(tags, '#CAFE')).toBe(tags)
    expect(addTag(tags, '  ')).toBe(tags)
  })
})

describe('collectTags', () => {
  it('orders by usage, then alphabetically, ignoring deleted expenses', () => {
    const expenses = [
      makeExpense('2026-09-21', 1, { tags: ['cafe', 'treat'] }),
      makeExpense('2026-09-22', 1, { tags: ['cafe'] }),
      makeExpense('2026-09-22', 1, { tags: ['bus'] }),
      makeExpense('2026-09-23', 1, { tags: ['gone'], deletedAt: NOW }),
    ]
    expect(collectTags(expenses)).toEqual(['cafe', 'bus', 'treat'])
  })
})

describe('suggestTags', () => {
  const vocabulary = ['cafe', 'woolworths', 'coles', 'bus', 'icecream', 'work']

  it('prefers prefix matches over substring matches', () => {
    expect(suggestTags(vocabulary, 'co', [])).toEqual(['coles'])
    expect(suggestTags(vocabulary, 'c', [])).toEqual(['cafe', 'coles', 'icecream'])
    expect(suggestTags(vocabulary, '#WO', [])).toEqual(['woolworths', 'work'])
  })

  it('leaves out selected tags, honours the limit and suggests favourites for an empty query', () => {
    expect(suggestTags(vocabulary, 'c', ['cafe'])).toEqual(['coles', 'icecream'])
    expect(suggestTags(vocabulary, '', ['cafe'], 2)).toEqual(['woolworths', 'coles'])
    expect(suggestTags(vocabulary, 'zzz', [])).toEqual([])
  })
})
