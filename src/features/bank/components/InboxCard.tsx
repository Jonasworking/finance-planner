import { ChevronRight, Inbox } from 'lucide-react'
import { Link } from 'react-router'
import { GlassCard } from '@/shared/components/GlassCard'

/** Home widget – rendered only while bank lines wait for a category. */
export function InboxCard({ count }: { count: number }) {
  return (
    <GlassCard padded={false} className="overflow-hidden">
      <Link
        to="/inbox"
        className="flex min-h-16 items-center gap-3 px-4 py-3 outline-none hover:bg-surface-3/40 focus-visible:bg-surface-3/60"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-income-soft text-income">
          <Inbox className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block">
            {count === 1 ? '1 Buchung' : `${count} Buchungen`} in der Inbox
          </span>
          <span className="block truncate text-label text-fg-muted">Kategorie zuordnen</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-fg-subtle" aria-hidden />
      </Link>
    </GlassCard>
  )
}
