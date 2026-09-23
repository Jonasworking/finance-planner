import { RotateCcw } from 'lucide-react'
import type { Category, Cents, ISODate } from '@/lib/types'
import type { Scenario, WhatIfCategory } from '@/lib/whatif'
import { GlassCard } from '@/shared/components/GlassCard'
import { Button } from '@/shared/ui/button'
import { CutRow } from './CutRow'

export interface CutsCardProps {
  ranges: readonly WhatIfCategory[]
  categories: readonly Category[]
  cuts: Readonly<Record<string, Cents>>
  scenario: Scenario
  until: ISODate
  onCut: (categoryId: string, cents: Cents) => void
  onReset: () => void
}

/** The sliders: per category, how much less per week. */
export function CutsCard({
  ranges,
  categories,
  cuts,
  scenario,
  until,
  onCut,
  onReset,
}: CutsCardProps) {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const hasCuts = scenario.extraPerWeekCents > 0

  return (
    <GlassCard padded={false} className="flex min-w-0 flex-col">
      <div className="flex items-center gap-3 px-4 pt-4 pb-1">
        <div className="min-w-0 flex-1">
          <h2 className="text-h2">Weniger ausgeben</h2>
          <p className="text-label text-fg-muted">Pro Woche, je Kategorie.</p>
        </div>
        {hasCuts ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-touch"
            onClick={onReset}
            aria-label="Alle Regler zurücksetzen"
            title="Alle Regler zurücksetzen"
            className="-mr-2 shrink-0 text-fg-muted"
          >
            <RotateCcw className="size-5" aria-hidden />
          </Button>
        ) : null}
      </div>
      {ranges.length === 0 ? (
        <p className="px-4 pb-4 text-label text-fg-muted">
          Sobald du eine Woche mit Ausgaben abgeschlossen oder Kategorie-Limits gesetzt hast, kannst
          du hier einzelne Kategorien kürzen.
        </p>
      ) : (
        <div className="divide-y">
          {ranges.map((range) => {
            const category = byId.get(range.categoryId)
            if (!category) return null
            return (
              <CutRow
                key={range.categoryId}
                category={category}
                range={range}
                cutCents={Math.min(cuts[range.categoryId] ?? 0, range.maxCents)}
                gainCents={scenario.gainByCategory[range.categoryId] ?? 0}
                until={until}
                onChange={(cents) => onCut(range.categoryId, cents)}
              />
            )
          })}
        </div>
      )}
    </GlassCard>
  )
}
