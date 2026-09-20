import { useEffect } from 'react'
import { repos } from '@/db'
import type { ISODate } from '@/lib/types'

/**
 * Books due standing orders at app start and whenever the day changes (`useToday` also refreshes
 * when the app becomes visible again). The repo makes this idempotent and safe under concurrent
 * calls, so a second tab or React's double-invoked effects do no harm.
 */
export function useMaterializeRecurring(today: ISODate, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    repos.recurring.materialize(today).catch((error: unknown) => {
      console.error('Materialising standing orders failed', error)
    })
  }, [today, enabled])
}
