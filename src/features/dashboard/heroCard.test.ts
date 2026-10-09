import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { lastHeroCard, rememberHeroCard } from './heroCard'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('heroCard', () => {
  it('starts with the savings and remembers the card shown last', () => {
    expect(lastHeroCard()).toBe('savings')
    rememberHeroCard('week')
    expect(lastHeroCard()).toBe('week')
    expect(localStorage.getItem('fp.homeHero')).toBe('week')
  })

  it('ignores a value it does not know', () => {
    localStorage.setItem('fp.homeHero', 'pots')
    expect(lastHeroCard()).toBe('savings')
  })

  it('carries on without storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(lastHeroCard()).toBe('savings')
    expect(() => rememberHeroCard('week')).not.toThrow()
  })
})
