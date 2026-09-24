import { useEffect } from 'react'
import { toast } from 'sonner'
import { useRegisterSW } from 'virtual:pwa-register/react'

/** How often a resumed app may ask the server for a new version. */
const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000

/**
 * Service worker registration and the update toast. A new version never takes over by itself:
 * the toast offers "Aktualisieren" (reload into the new version, the data stays in IndexedDB).
 * An installed app is resumed far more often than it navigates, so besides the browser's own
 * checks it asks for an update whenever it comes back to the foreground – at most every 15 min.
 */
export function PwaUpdater() {
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      let lastCheck = Date.now()
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible' || !navigator.onLine) return
        if (Date.now() - lastCheck < UPDATE_CHECK_INTERVAL_MS) return
        lastCheck = Date.now()
        void registration.update().catch(() => {})
      })
    },
  })

  useEffect(() => {
    if (!needRefresh) return
    toast('Neue Version verfügbar', {
      id: 'pwa-update',
      description: 'Lädt die App neu – deine Daten bleiben erhalten.',
      duration: Infinity,
      action: { label: 'Aktualisieren', onClick: () => void updateServiceWorker(true) },
    })
  }, [needRefresh, updateServiceWorker])

  useEffect(() => {
    if (!offlineReady) return
    toast.success('Offline bereit', { description: 'Die App startet jetzt auch ohne Netz.' })
    setOfflineReady(false)
  }, [offlineReady, setOfflineReady])

  return null
}
