import { useLiveQuery } from 'dexie-react-hooks'
import { countInbox, db } from '@/db'

/** Bank lines waiting in the inbox – the badge next to the navigation entry. */
export function useInboxCount(): number {
  return useLiveQuery(() => countInbox(db), []) ?? 0
}
