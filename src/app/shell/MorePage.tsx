import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { GlassCard } from '@/shared/components/GlassCard'
import { Page } from '@/shared/components/Page'
import { secondaryNav } from './navItems'

/** Mobile hub for everything that does not fit into the bottom tabs. */
export function MorePage() {
  return (
    <Page title="Mehr" hideMoreLink>
      <GlassCard padded={false} className="divide-y divide-border overflow-hidden">
        {secondaryNav.map(({ to, label, description, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex min-h-16 items-center gap-3 px-4 py-3 outline-none hover:bg-surface-3/60 focus-visible:bg-surface-3"
          >
            <span className="grid size-10 place-items-center rounded-md bg-surface-3 text-fg-muted">
              <Icon className="size-5" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block">{label}</span>
              {description ? (
                <span className="block truncate text-label text-fg-muted">{description}</span>
              ) : null}
            </span>
            <ChevronRight className="size-5 text-fg-subtle" aria-hidden />
          </Link>
        ))}
      </GlassCard>
    </Page>
  )
}
