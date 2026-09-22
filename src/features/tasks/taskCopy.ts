import { Building2, Ellipsis, Landmark, type LucideIcon } from 'lucide-react'
import type { DueState } from '@/lib/tasks'
import type { TaskCategory } from '@/lib/types'

export const categoryIcon: Record<TaskCategory, LucideIcon> = {
  Finanzen: Landmark,
  Behörden: Building2,
  Sonstiges: Ellipsis,
}

/** Text colour of the due label – overdue tasks are the ones that must stand out. */
export const dueTone: Record<DueState, string> = {
  overdue: 'text-spent font-medium',
  today: 'text-warning font-medium',
  soon: 'text-fg-muted',
  later: 'text-fg-muted',
  none: 'text-fg-muted',
}

export const openCountLabel = (open: number, overdue: number): string => {
  if (open === 0) return 'Nichts offen'
  const base = open === 1 ? '1 offen' : `${open} offen`
  return overdue > 0 ? `${base} · ${overdue} überfällig` : base
}
