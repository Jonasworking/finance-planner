import { create } from 'zustand'
import type { StorageState } from '@/lib/readiness'
import { isIOS, isStandalone } from '@/shared/lib/platform'

interface DeviceState {
  standalone: boolean
  ios: boolean
  /** `null` until the browser answered. */
  storage: StorageState | null
  /** Reads what the browser reports now (after start, after the app comes back). */
  refresh: () => Promise<void>
  /** Asks the browser to never evict this app's data. Safari grants it to installed apps. */
  requestPersistence: () => Promise<StorageState>
}

async function readStorage(): Promise<StorageState> {
  if (!navigator.storage?.persisted) return 'unsupported'
  try {
    return (await navigator.storage.persisted()) ? 'persisted' : 'not-persisted'
  } catch {
    return 'unsupported'
  }
}

export const useDeviceStore = create<DeviceState>((set) => ({
  standalone: false,
  ios: false,
  storage: null,
  refresh: async () => {
    set({ standalone: isStandalone(), ios: isIOS(), storage: await readStorage() })
  },
  requestPersistence: async () => {
    if (!navigator.storage?.persist) {
      set({ storage: 'unsupported' })
      return 'unsupported'
    }
    let storage: StorageState
    try {
      storage = (await navigator.storage.persist()) ? 'persisted' : 'not-persisted'
    } catch {
      storage = 'unsupported'
    }
    set({ storage })
    return storage
  },
}))
