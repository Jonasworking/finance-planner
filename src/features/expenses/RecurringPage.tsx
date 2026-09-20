import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Repeat } from 'lucide-react'
import { useState } from 'react'
import { db, loadRecurring } from '@/db'
import { formatDayLabel } from '@/lib/dates'
import { describeRecurrence, nextDueDate } from '@/lib/recurrence'
import type { RecurringExpense } from '@/lib/types'
import { CategoryIcon } from '@/shared/components/CategoryIcon'
import { GlassCard } from '@/shared/components/GlassCard'
import { Money } from '@/shared/components/Money'
import { Page } from '@/shared/components/Page'
import { useToday } from '@/shared/hooks/useToday'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'
import { RecurringSheet } from './components/RecurringSheet'

export function RecurringPage() {
  const today = useToday()
  const data = useLiveQuery(() => loadRecurring(db), [])
  const [sheet, setSheet] = useState<{
    open: boolean
    template: RecurringExpense | null
    session: number
  }>({
    open: false,
    template: null,
    session: 0,
  })
  const openSheet = (template: RecurringExpense | null) =>
    setSheet((current) => ({ open: true, template, session: current.session + 1 }))

  const categoryById = new Map(data?.categories.map((category) => [category.id, category]))

  return (
    <Page
      title="Daueraufträge"
      subtitle="Miete & Co. werden automatisch gebucht"
      actions={
        <Button size="touch" onClick={() => openSheet(null)}>
          <Plus aria-hidden />
          Neu
        </Button>
      }
    >
      {data === undefined ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-18 w-full rounded-lg" />
          <Skeleton className="h-18 w-full rounded-lg" />
        </div>
      ) : data.templates.length === 0 ? (
        <GlassCard className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-surface-3 text-fg-muted">
            <Repeat className="size-6" aria-hidden />
          </span>
          <div>
            <p className="text-h2">Noch keine Daueraufträge</p>
            <p className="text-label text-fg-muted">
              Lege z. B. deine wöchentliche Miete an – sie landet dann von selbst in den Ausgaben
              und ist im Restbudget schon eingeplant.
            </p>
          </div>
          <Button size="touch" onClick={() => openSheet(null)}>
            <Plus aria-hidden />
            Dauerauftrag anlegen
          </Button>
        </GlassCard>
      ) : (
        <GlassCard padded={false} className="divide-y divide-border overflow-hidden">
          {data.templates.map((template) => {
            const category = categoryById.get(template.categoryId)
            const next = nextDueDate(template, today)
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => openSheet(template)}
                className="flex min-h-18 w-full items-center gap-3 px-4 py-3 text-left outline-none hover:bg-surface-3/40 focus-visible:bg-surface-3/60"
              >
                <CategoryIcon
                  icon={category?.icon ?? 'Ellipsis'}
                  color={category?.color ?? 'cat-10'}
                  className={template.active ? undefined : 'opacity-50'}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{template.title}</span>
                  <span className="block truncate text-label text-fg-muted">
                    {describeRecurrence(template)}
                    {template.active
                      ? next
                        ? ` · nächste: ${formatDayLabel(next, today)}`
                        : ' · beendet'
                      : ' · pausiert'}
                  </span>
                </span>
                <Money
                  cents={template.amountCents}
                  tone={template.active ? 'default' : 'muted'}
                  className="font-semibold"
                />
              </button>
            )
          })}
        </GlassCard>
      )}

      <RecurringSheet
        open={sheet.open}
        onOpenChange={(open) => setSheet((current) => ({ ...current, open }))}
        session={sheet.session}
        template={sheet.template}
        categories={data?.categories.filter((category) => !category.archived) ?? []}
        today={today}
        minDate={data?.trackingSince ?? null}
      />
    </Page>
  )
}
