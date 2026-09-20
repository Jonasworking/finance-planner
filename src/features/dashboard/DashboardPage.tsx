import { GlassCard } from '@/shared/components/GlassCard'
import { Money } from '@/shared/components/Money'
import { Page } from '@/shared/components/Page'
import { ProgressRing } from '@/shared/components/ProgressRing'

/** Static look-and-feel preview. Real data arrives with phase 2 (income & expenses). */
const preview = { earned: 200000, spent: 31250, limit: 40000 }

export function DashboardPage() {
  const saved = preview.earned - preview.spent
  const remaining = preview.limit - preview.spent

  return (
    <Page title="Diese Woche" subtitle="Vorschau mit Beispielwerten">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <GlassCard className="flex flex-col gap-5">
          <div>
            <p className="text-caption text-fg-subtle uppercase">Gespart</p>
            <Money cents={saved} tone="saved" className="text-display" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md bg-income-soft p-3">
              <p className="text-caption text-fg-muted uppercase">Verdient</p>
              <Money cents={preview.earned} className="text-h2" />
            </div>
            <div className="rounded-md bg-spent-soft p-3">
              <p className="text-caption text-fg-muted uppercase">Ausgegeben</p>
              <Money cents={preview.spent} className="text-h2" />
            </div>
          </div>
        </GlassCard>

        <GlassCard className="flex items-center justify-center gap-6">
          <ProgressRing value={preview.spent / preview.limit} label="Wochenbudget verbraucht">
            <div className="text-center">
              <p className="text-caption text-fg-subtle uppercase">Rest</p>
              <Money cents={remaining} decimals={false} className="text-h1" />
            </div>
          </ProgressRing>
        </GlassCard>
      </div>
    </Page>
  )
}
