/*
 * An import or its undo ends in a page reload (every store and live query must start over).
 * The toast that reports it has to survive that reload – sessionStorage carries the message.
 */
const KEY = 'fp.afterReload'

export type AfterReload = 'imported' | 'import-undone' | 'wiped'

export function reloadWith(message: AfterReload): void {
  try {
    sessionStorage.setItem(KEY, message)
  } catch {
    // no storage: the reload still happens, only the toast is missing
  }
  window.location.reload()
}

/** Reads and clears the message – it is shown once. */
export function takeAfterReload(): AfterReload | null {
  try {
    const value = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    return value === 'imported' || value === 'import-undone' || value === 'wiped' ? value : null
  } catch {
    return null
  }
}
