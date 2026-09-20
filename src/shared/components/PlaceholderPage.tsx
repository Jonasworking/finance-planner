import type { LucideIcon } from 'lucide-react'
import { GlassCard } from './GlassCard'
import { Page } from './Page'

export interface PlaceholderPageProps {
  title: string
  subtitle?: string
  icon: LucideIcon
  /** Phase in docs/PLAN.md that delivers this screen. */
  phase: number
  planned: string[]
}

/** Stand-in for screens that a later phase implements. */
export function PlaceholderPage({
  title,
  subtitle,
  icon: Icon,
  phase,
  planned,
}: PlaceholderPageProps) {
  return (
    <Page title={title} subtitle={subtitle}>
      <GlassCard className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-md bg-saved-soft text-saved">
            <Icon className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-caption text-fg-subtle uppercase">Kommt in Phase {phase}</p>
            <p className="text-h2">{title}</p>
          </div>
        </div>
        <ul className="flex flex-col gap-2 text-label text-fg-muted">
          {planned.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-fg-subtle" />
              {item}
            </li>
          ))}
        </ul>
      </GlassCard>
    </Page>
  )
}
