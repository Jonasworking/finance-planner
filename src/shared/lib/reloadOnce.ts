/*
 * Loading a part of the app can fail (a lost request, a deployment that replaced the files while
 * the app was open). One automatic reload usually fixes it – but only one: the time of the last
 * automatic reload is kept for this tab, and a second failure shortly after shows a message
 * instead of reloading in a loop. The boot script in index.html uses the same key and lock.
 */

export const AUTO_RELOAD_KEY = 'fp.autoReloadAt'
/** A failure within this time after an automatic reload is not reloaded again. */
export const AUTO_RELOAD_LOCK_MS = 60_000

type ReloadStorage = Pick<Storage, 'getItem' | 'setItem'>

/**
 * Whether an automatic reload is allowed right now – and if so, notes that it is happening.
 * Without working storage there is no lock, so there is no automatic reload either.
 */
export function claimAutoReload(storage: ReloadStorage, now: number): boolean {
  try {
    const last = Number(storage.getItem(AUTO_RELOAD_KEY)) || 0
    if (now - last <= AUTO_RELOAD_LOCK_MS) return false
    storage.setItem(AUTO_RELOAD_KEY, String(now))
    return true
  } catch {
    return false
  }
}

/** A lazily loaded part (route, sheet, chart) that could not be fetched – in any browser's words. */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  return /dynamically imported module|importing a module script failed|unable to preload|failed to load module script/i.test(
    message,
  )
}
