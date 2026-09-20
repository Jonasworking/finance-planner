import { Flame } from 'lucide-react'
import type { Streak } from '@/lib/streak'
import { GlassCard } from '@/shared/components/GlassCard'
import { cn } from '@/shared/lib/utils'

export interface StreakCardProps {
  streak: Streak
}

const weeks = (count: number) => (count === 1 ? '1 Woche' : `${count} Wochen`)

/**
 * Weeks in a row under budget. Only rendered once a week has been closed – before that the
 * "So läuft deine Woche" card explains what is coming, and an empty streak would say nothing.
 */
export function StreakCard({ streak }: StreakCardProps) {
  const { current, best, stale } = streak
  const running = current > 0

  const title = stale
    ? 'Streak pausiert'
    : running
      ? `${weeks(current)} im Budget`
      : 'Noch kein Streak'
  const text = stale
    ? 'Schließ die offenen Wochen ab, dann siehst du, wie lange deine Serie hält.'
    : running
      ? current >= best
        ? 'Das ist dein Rekord – jede abgeschlossene Woche im Budget verlängert ihn.'
        : `Dein Rekord: ${weeks(best)} am Stück.`
      : best > 0
        ? `Die letzte Woche lag über dem Budget. Dein Rekord: ${weeks(best)} am Stück.`
        : 'Bleib diese Woche im Budget und schließ sie ab – dann startet deine Serie.'

  return (
    <GlassCard className="flex items-center gap-4">
      <span
        className={cn(
          'grid size-12 shrink-0 place-items-center rounded-md',
          running ? 'bg-warning/15 text-warning' : 'bg-surface-3 text-fg-muted',
        )}
      >
        <Flame className="size-6" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-caption text-fg-subtle uppercase">Streak</p>
        <p className="text-h2">{title}</p>
        <p className="text-label text-fg-muted">{text}</p>
      </div>
    </GlassCard>
  )
}
