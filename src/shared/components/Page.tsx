import { Ellipsis } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/shared/lib/utils'

export interface PageProps {
  title: string
  subtitle?: string
  /** Extra header actions, rendered before the mobile "Mehr" link. */
  actions?: ReactNode
  /** Hide the mobile link to the "Mehr" page (e.g. on the page itself). */
  hideMoreLink?: boolean
  children: ReactNode
  className?: string
}

/** Standard page frame: sticky glass header (safe-area aware) + centered content column. */
export function Page({ title, subtitle, actions, hideMoreLink, children, className }: PageProps) {
  return (
    <>
      <header className="sticky top-0 z-10 border-b glass pt-safe">
        <div className="mx-auto flex min-h-14 w-full max-w-[1120px] items-center gap-3 px-4 py-2 lg:min-h-16 lg:px-8">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-h2 lg:text-h1">{title}</h1>
            {subtitle ? <p className="truncate text-label text-fg-muted">{subtitle}</p> : null}
          </div>
          {actions}
          {hideMoreLink ? null : (
            <Link
              to="/more"
              aria-label="Mehr"
              className="grid size-11 place-items-center rounded-full text-fg-muted outline-none hover:bg-surface-3 hover:text-fg focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden"
            >
              <Ellipsis className="size-6" aria-hidden />
            </Link>
          )}
        </div>
      </header>
      <div className={cn('mx-auto w-full max-w-[1120px] px-4 py-6 lg:px-8', className)}>
        {children}
      </div>
    </>
  )
}
