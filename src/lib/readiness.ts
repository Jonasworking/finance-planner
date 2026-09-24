/*
 * "Ab wann kann ich echte Daten erfassen?" – the data lives only in this browser, under this
 * address. It is safe to rely on once the app runs at its final address, as an installed app
 * (on iOS a Safari tab and the installed app do not share data), with storage the browser may
 * not evict, and once a backup has been made at least once (so the way out is known to work).
 */

/** The final production address (decided 2026-09-24). IndexedDB is bound to it. */
export const PRODUCTION_HOST = 'jonas-finanzen.vercel.app'

/** Earlier production addresses: they still serve the app, but with a database of their own. */
const OLD_ADDRESSES = new Set([
  'finance-planner-jonasworkings-projects.vercel.app',
  'finance-planner-gilt-eight.vercel.app',
])

export type HostKind = 'production' | 'old-address' | 'preview' | 'local'

export function classifyHost(hostname: string): HostKind {
  if (hostname === PRODUCTION_HOST) return 'production'
  if (OLD_ADDRESSES.has(hostname)) return 'old-address'
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.local') ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)
  ) {
    return 'local'
  }
  return 'preview'
}

/** `unsupported`: the browser has no way to ask – it manages storage on its own. */
export type StorageState = 'persisted' | 'not-persisted' | 'unsupported'

export type ReadinessCheckId = 'address' | 'installed' | 'storage' | 'backup'

export interface ReadinessCheck {
  id: ReadinessCheckId
  done: boolean
}

export interface Readiness {
  checks: ReadinessCheck[]
  ready: boolean
  /** How many of the checks are done – "2 von 4". */
  doneCount: number
}

export function readiness(input: {
  host: HostKind
  standalone: boolean
  storage: StorageState
  lastBackupAt: number | null
}): Readiness {
  const checks: ReadinessCheck[] = [
    { id: 'address', done: input.host === 'production' },
    { id: 'installed', done: input.standalone },
    { id: 'storage', done: input.storage !== 'not-persisted' },
    { id: 'backup', done: input.lastBackupAt !== null },
  ]
  const doneCount = checks.filter((check) => check.done).length
  return { checks, ready: doneCount === checks.length, doneCount }
}
