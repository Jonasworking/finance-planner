import { Check, ChevronRight } from 'lucide-react'
import { formatWeekRange } from '@/lib/dates'
import type { WeekSummary } from '@/lib/savings'
import { GlassCard } from '@/shared/components/GlassCard'
import { Money } from '@/shared/components/Money'
import { cn } from '@/shared/lib/utils'
import { useUiStore } from '@/shared/stores/uiStore'

export interface WeeksCardProps {
  /** Closed weeks, newest first. */
  closedWeeks: readonly WeekSummary[]
  hasAnyExpense: boolean
}

const HOW_IT_WORKS = [
  { title: 'Ausgaben erfassen', text: 'Unter der Woche, in drei Taps.' },
  { title: 'Woche abschließen', text: 'Am Sonntag trägst du ein, was du verdient hast.' },
  { title: 'Gespartes wächst', text: 'Einkommen − Ausgaben wandert in „Nur gespart".' },
]

/**
 * Recent closed weeks (tap to edit or reopen). Until the first week is closed it shows how a
 * week works instead – with the first step ticked off once an expense exists.
 */
export function WeeksCard({ closedWeeks, hasAnyExpense }: WeeksCardProps) {
  const openCloseWeek = useUiStore((state) => state.openCloseWeek)

  if (closedWeeks.length === 0) {
    const doneUntil = hasAnyExpense ? 1 : 0
    return (
      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-caption text-fg-subtle uppercase">So läuft deine Woche</h2>
        <GlassCard>
          <ol className="flex flex-col gap-4">
            {HOW_IT_WORKS.map((item, index) => {
              const done = index < doneUntil
              const current = index === doneUntil
              return (
                <li key={item.title} className="flex items-center gap-3">
                  <span
                    className={cn(
                      'grid size-8 shrink-0 place-items-center rounded-full text-label font-semibold',
                      done
                        ? 'bg-saved text-on-saved'
                        : current
                          ? 'border-2 border-saved text-saved'
                          : 'bg-surface-3 text-fg-subtle',
                    )}
                  >
                    {done ? (
                      <Check className="size-4" strokeWidth={3} aria-label="erledigt" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className={cn(!done && !current && 'text-fg-muted')}>
                    <span className="block">{item.title}</span>
                    <span className="block text-label text-fg-muted">{item.text}</span>
                  </span>
                </li>
              )
            })}
          </ol>
        </GlassCard>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-caption text-fg-subtle uppercase">Letzte Wochen</h2>
      <GlassCard padded={false} className="divide-y divide-border overflow-hidden">
        {closedWeeks.map((week) => (
          <button
            key={week.weekStart}
            type="button"
            onClick={() => openCloseWeek(week.weekStart)}
            className="flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left outline-none hover:bg-surface-3/40 focus-visible:bg-surface-3/60"
          >
            <span
              aria-hidden
              className={cn(
                'size-2.5 shrink-0 rounded-full',
                week.underBudget === false ? 'bg-spent' : 'bg-saved',
              )}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{formatWeekRange(week.weekStart)}</span>
              <span className="block truncate text-label text-fg-muted">
                <Money cents={week.spentCents} decimals={false} /> ausgegeben
                {week.underBudget === false ? ' · über Budget' : ''}
                {week.incomeCents > 0 ? ` · Sparquote ${Math.round(week.savingsRate * 100)} %` : ''}
              </span>
            </span>
            <Money cents={week.savedCents} tone="auto" signed className="font-semibold" />
            <ChevronRight className="size-4 shrink-0 text-fg-subtle" aria-hidden />
          </button>
        ))}
      </GlassCard>
    </section>
  )
}
