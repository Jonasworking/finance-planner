import { TrendingDown, Trophy, type LucideIcon } from 'lucide-react'
import { formatWeekRange } from '@/lib/dates'
import type { MoneyDisplay } from '@/lib/money'
import type { WeekSummary } from '@/lib/savings'
import { GlassCard } from '@/shared/components/GlassCard'
import { Money } from '@/shared/components/Money'
import { cn } from '@/shared/lib/utils'

interface WeekTileProps {
  label: string
  icon: LucideIcon
  iconClass: string
  week: WeekSummary
  display: MoneyDisplay
}

function WeekTile({ label, icon: Icon, iconClass, week, display }: WeekTileProps) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-full', iconClass)}>
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-label text-fg-muted">{label}</p>
        <p className="truncate">{formatWeekRange(week.weekStart)}</p>
      </div>
      <p className="text-right">
        <Money
          cents={week.savedCents}
          decimals={false}
          display={display}
          className="font-semibold"
        />
        <span className="block text-label text-fg-muted">gespart</span>
      </p>
    </div>
  )
}

export interface BestWorstCardProps {
  bestWorst: { best: WeekSummary; worst: WeekSummary }
  display: MoneyDisplay
}

/** Best and weakest closed week of the selection, by what was put aside. */
export function BestWorstCard({ bestWorst, display }: BestWorstCardProps) {
  return (
    <GlassCard className="flex flex-col gap-4">
      <h2 className="text-h2">Beste und schwächste Woche</h2>
      <WeekTile
        label="Beste Woche"
        icon={Trophy}
        iconClass="bg-saved-soft text-saved"
        week={bestWorst.best}
        display={display}
      />
      <WeekTile
        label="Schwächste Woche"
        icon={TrendingDown}
        iconClass="bg-surface-3 text-fg-muted"
        week={bestWorst.worst}
        display={display}
      />
    </GlassCard>
  )
}
