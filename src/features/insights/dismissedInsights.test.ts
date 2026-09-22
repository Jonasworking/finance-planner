import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearDismissedInsights,
  dismissInsight,
  readDismissedInsights,
  restoreInsight,
  useDismissedInsights,
} from './dismissedInsights'

const KEY = 'fp.insightsDismissed'

beforeEach(clearDismissedInsights)

describe('dismissedInsights', () => {
  it('remembers dismissed ids across reads and forgets restored ones', () => {
    expect(readDismissedInsights().size).toBe(0)
    dismissInsight('budget-over:2026-09-14')
    dismissInsight('pot:pot:1:2026-09-14')
    expect([...readDismissedInsights()]).toEqual(['budget-over:2026-09-14', 'pot:pot:1:2026-09-14'])
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual([
      'budget-over:2026-09-14',
      'pot:pot:1:2026-09-14',
    ])

    restoreInsight('budget-over:2026-09-14')
    expect([...readDismissedInsights()]).toEqual(['pot:pot:1:2026-09-14'])
  })

  it('does not store an id twice and keeps at most the 100 newest', () => {
    dismissInsight('a')
    dismissInsight('a')
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(['a'])
    for (let index = 0; index < 120; index++) dismissInsight(`id-${index}`)
    const stored = JSON.parse(localStorage.getItem(KEY)!) as string[]
    expect(stored).toHaveLength(100)
    expect(stored[0]).toBe('id-20')
    expect(stored.at(-1)).toBe('id-119')
    expect(readDismissedInsights().has('a')).toBe(false)
  })

  it('treats a broken or foreign entry as "nothing dismissed"', () => {
    localStorage.setItem(KEY, '{not json')
    restoreInsight('x') // a write re-reads the storage
    expect(readDismissedInsights().size).toBe(0)
    localStorage.setItem(KEY, JSON.stringify([1, 'ok', null]))
    restoreInsight('x')
    expect([...readDismissedInsights()]).toEqual(['ok'])
  })

  it('re-renders subscribers when the set changes', () => {
    const { result } = renderHook(() => useDismissedInsights())
    expect(result.current.has('a')).toBe(false)
    act(() => dismissInsight('a'))
    expect(result.current.has('a')).toBe(true)
    act(() => restoreInsight('a'))
    expect(result.current.has('a')).toBe(false)
  })
})
