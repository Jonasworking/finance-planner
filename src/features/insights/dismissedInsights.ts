import { useSyncExternalStore } from 'react'

const KEY = 'fp.insightsDismissed'
/** Ids are stable per occurrence (they carry the week), so old ones never come back – cap the list. */
const MAX_REMEMBERED = 100

/*
 * Which insight cards were swiped away. Like the budget-warning log this is per-device UI state
 * ("I have seen this"), not financial data: it lives in localStorage, stays out of backups and
 * needs no schema change. A second device shows the card again – that is intended.
 */

const listeners = new Set<() => void>()
let snapshot: ReadonlySet<string> | null = null

function read(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(stored) ? stored.filter((id) => typeof id === 'string') : []
  } catch {
    return [] // private mode or a broken entry: show the cards again rather than never
  }
}

function write(ids: readonly string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids.slice(-MAX_REMEMBERED)))
  } catch {
    // Storage unavailable – the card returns on the next visit, which beats losing the app.
  }
  snapshot = null
  for (const listener of listeners) listener()
}

export function readDismissedInsights(): ReadonlySet<string> {
  snapshot ??= new Set(read())
  return snapshot
}

export function dismissInsight(id: string): void {
  write([...read().filter((stored) => stored !== id), id])
}

export function restoreInsight(id: string): void {
  write(read().filter((stored) => stored !== id))
}

/** Forget every dismissal (tests; a future "Hinweise zurücksetzen" in the settings). */
export function clearDismissedInsights(): void {
  write([])
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) {
      snapshot = null
      listener()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/** The dismissed ids as a stable Set – re-renders whoever uses it when a card is swiped away. */
export function useDismissedInsights(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, readDismissedInsights, readDismissedInsights)
}
