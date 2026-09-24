import { act, render } from '@testing-library/react'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PwaUpdater } from './PwaUpdater'

const sw = vi.hoisted(() => ({
  needRefresh: false,
  offlineReady: false,
  setOfflineReady: vi.fn(),
  updateServiceWorker: vi.fn(() => Promise.resolve()),
  onRegisteredSW: undefined as undefined | ((url: string, reg: unknown) => void),
}))
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: (options: { onRegisteredSW?: (url: string, reg: unknown) => void }) => {
    sw.onRegisteredSW = options.onRegisteredSW
    return {
      needRefresh: [sw.needRefresh, vi.fn()],
      offlineReady: [sw.offlineReady, sw.setOfflineReady],
      updateServiceWorker: sw.updateServiceWorker,
    }
  },
}))
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  sw.needRefresh = false
  sw.offlineReady = false
})
afterEach(() => vi.useRealTimers())

describe('PwaUpdater', () => {
  it('offers the new version instead of swapping it in silently', () => {
    sw.needRefresh = true
    render(<PwaUpdater />)
    expect(toast).toHaveBeenCalledOnce()
    const [title, options] = vi.mocked(toast).mock.calls[0]!
    expect(title).toBe('Neue Version verfügbar')
    expect(options?.duration).toBe(Infinity)
    const action = options?.action as { label: string; onClick: () => void }
    expect(action.label).toBe('Aktualisieren')
    expect(sw.updateServiceWorker).not.toHaveBeenCalled()
    action.onClick()
    expect(sw.updateServiceWorker).toHaveBeenCalledWith(true)
  })

  it('says once that the app works offline', () => {
    sw.offlineReady = true
    render(<PwaUpdater />)
    expect(toast.success).toHaveBeenCalledWith('Offline bereit', expect.anything())
    expect(sw.setOfflineReady).toHaveBeenCalledWith(false)
    expect(toast).not.toHaveBeenCalled()
  })

  it('checks for an update when the app comes back – at most every 15 minutes', () => {
    vi.useFakeTimers({ now: 0 })
    render(<PwaUpdater />)
    const update = vi.fn(() => Promise.resolve())
    sw.onRegisteredSW?.('/sw.js', { update })
    const resume = () =>
      act(() => {
        Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
        document.dispatchEvent(new Event('visibilitychange'))
      })

    resume()
    expect(update).not.toHaveBeenCalled() // just registered
    vi.setSystemTime(15 * 60 * 1000)
    resume()
    expect(update).toHaveBeenCalledOnce()
    vi.setSystemTime(20 * 60 * 1000)
    resume()
    expect(update).toHaveBeenCalledOnce()
  })
})
