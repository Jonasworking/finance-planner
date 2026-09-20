import { useEffect, useState } from 'react'
import { toISODate } from '@/lib/dates'
import type { ISODate } from '@/lib/types'

const currentDay = (): ISODate => toISODate(new Date())

/**
 * Today's local calendar day – the one place where the UI reads the clock. An installed PWA can
 * stay suspended for days, so the value is refreshed when the app becomes visible again and once
 * a minute while it is open (cheap, and enough to roll over shortly after midnight).
 */
export function useToday(): ISODate {
  const [today, setToday] = useState(currentDay)

  useEffect(() => {
    const refresh = () =>
      setToday((previous) => (previous === currentDay() ? previous : currentDay()))
    const interval = window.setInterval(refresh, 60_000)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  return today
}
