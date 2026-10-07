import { describe, expect, it } from 'vitest'
import {
  AUTO_RELOAD_KEY,
  AUTO_RELOAD_LOCK_MS,
  claimAutoReload,
  isChunkLoadError,
} from './reloadOnce'

const memory = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  }
}

describe('claimAutoReload', () => {
  it('allows one automatic reload and notes when it happened', () => {
    const storage = memory()
    expect(claimAutoReload(storage, 1_000_000)).toBe(true)
    expect(storage.data.get(AUTO_RELOAD_KEY)).toBe('1000000')
  })

  it('refuses a second one while the lock holds – no reload loop', () => {
    const storage = memory()
    claimAutoReload(storage, 1_000_000)
    expect(claimAutoReload(storage, 1_000_001)).toBe(false)
    expect(claimAutoReload(storage, 1_000_000 + AUTO_RELOAD_LOCK_MS)).toBe(false)
    expect(storage.data.get(AUTO_RELOAD_KEY)).toBe('1000000')
  })

  it('allows it again once the lock has run out', () => {
    const storage = memory()
    claimAutoReload(storage, 1_000_000)
    expect(claimAutoReload(storage, 1_000_001 + AUTO_RELOAD_LOCK_MS)).toBe(true)
    expect(storage.data.get(AUTO_RELOAD_KEY)).toBe(String(1_000_001 + AUTO_RELOAD_LOCK_MS))
  })

  it('ignores a broken stored value', () => {
    expect(claimAutoReload(memory({ [AUTO_RELOAD_KEY]: 'gestern' }), 1_000_000)).toBe(true)
  })

  it('never reloads automatically when storage does not work (no lock possible)', () => {
    const broken = {
      getItem: () => null,
      setItem: () => {
        throw new Error('denied')
      },
    }
    expect(claimAutoReload(broken, 1_000_000)).toBe(false)
    const unreadable = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {},
    }
    expect(claimAutoReload(unreadable, 1_000_000)).toBe(false)
  })
})

describe('isChunkLoadError', () => {
  it('recognises a part that could not be fetched, in every browser’s wording', () => {
    for (const message of [
      'Failed to fetch dynamically imported module: https://example.test/assets/onboarding-abc.js',
      'error loading dynamically imported module',
      'Importing a module script failed.',
      'Unable to preload CSS for /assets/page.css',
      'Failed to load module script: Expected a JavaScript module script',
    ]) {
      expect(isChunkLoadError(new TypeError(message))).toBe(true)
      expect(isChunkLoadError(message)).toBe(true)
    }
  })

  it('leaves every other error alone', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false)
    expect(isChunkLoadError(null)).toBe(false)
    expect(isChunkLoadError({ status: 404 })).toBe(false)
  })
})
