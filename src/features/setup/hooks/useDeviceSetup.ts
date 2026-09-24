import { useEffect } from 'react'
import { useDeviceStore } from '@/shared/stores/deviceStore'

/**
 * Keeps the device facts current (installed? storage kept?) and, in the installed app, asks the
 * browser once to keep the data for good – Safari grants that to home-screen apps, and without
 * it a full phone may evict IndexedDB. Mounted once by the app shell.
 */
export function useDeviceSetup(): void {
  const refresh = useDeviceStore((state) => state.refresh)
  const requestPersistence = useDeviceStore((state) => state.requestPersistence)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await refresh()
      const { standalone, storage } = useDeviceStore.getState()
      if (!cancelled && standalone && storage === 'not-persisted') await requestPersistence()
    })()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh, requestPersistence])
}
