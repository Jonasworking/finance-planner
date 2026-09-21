import { ArrowLeft, ChevronRight } from 'lucide-react'
import { lazy, Suspense, useMemo, useState } from 'react'
import { categoryDetail, foldSlices, type CategorySlice, type Granularity } from '@/lib/analytics'
import { formatDayLabel } from '@/lib/dates'
import { formatPercent, type Cents, type MoneyDisplay } from '@/lib/money'
import type { Category, Expense, ISODate } from '@/lib/types'
import { CategoryIcon } from '@/shared/components/CategoryIcon'
import { GlassCard } from '@/shared/components/GlassCard'
import { Money } from '@/shared/components/Money'
import { cn } from '@/shared/lib/utils'
import { useUiStore } from '@/shared/stores/uiStore'
import { Skeleton } from '@/shared/ui/skeleton'
import { REST_SLICE_ID, toDonutRows, toTrendRows, type DonutRow } from '../chartData'
import { periodLabel } from '../labels'
import { ChartCard, type ChartTable } from './ChartCard'

const CategoryDonut = lazy(() =>
  import('../charts').then((module) => ({ default: module.CategoryDonut })),
)
const CategoryTrendChart = lazy(() =>
  import('../charts').then((module) => ({ default: module.CategoryTrendChart })),
)

const TITLE = 'Wofür das Geld wegging'

interface SliceRowProps {
  row: DonutRow
  display: MoneyDisplay
  expanded?: boolean
  onSelect: () => void
}

/** Legend and table in one: swatch, icon, name, amount and share – and the way into a category. */
function SliceRow({ row, display, expanded, onSelect }: SliceRowProps) {
  const isRest = row.id === REST_SLICE_ID
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-expanded={isRest ? expanded : undefined}
      className="flex min-h-12 w-full items-center gap-2.5 rounded-sm py-1 text-left outline-none hover:bg-surface-3/40 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className={cn('h-8 w-1 shrink-0 rounded-full', row.swatch)} aria-hidden />
      <CategoryIcon icon={row.icon} color={row.color} size="sm" />
      <span className="min-w-0 flex-1 truncate">{row.name}</span>
      <span className="text-right">
        <Money
          cents={row.amountCents}
          decimals={false}
          display={display}
          className="font-semibold"
        />
        <span className="block text-label text-fg-muted tabular-nums">
          {formatPercent(row.share)}
        </span>
      </span>
      <ChevronRight
        className={cn(
          'size-4 shrink-0 text-fg-subtle transition-transform',
          expanded && 'rotate-90',
        )}
        aria-hidden
      />
    </button>
  )
}

export interface CategoriesCardProps {
  slices: readonly CategorySlice[]
  categories: readonly Category[]
  /** Active expenses of the selection. */
  expenses: readonly Expense[]
  weekStarts: readonly ISODate[]
  granularity: Granularity
  /** Paid from pots in the selection – named, because it is not part of the donut. */
  fundedCents: Cents
  /** Spending of weeks that are not closed yet – part of the donut, but not of the sums above. */
  openSpentCents: Cents
  today: ISODate
  display: MoneyDisplay
}

/** Spending by category as a donut; a tap on a category drills into its trend and expenses. */
export function CategoriesCard({
  slices,
  categories,
  expenses,
  weekStarts,
  granularity,
  fundedCents,
  openSpentCents,
  today,
  display,
}: CategoriesCardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [restOpen, setRestOpen] = useState(false)
  const openExpense = useUiStore((state) => state.openExpense)

  const folded = useMemo(() => foldSlices(slices), [slices])
  const rows = useMemo(() => toDonutRows(folded, categories), [folded, categories])
  const restRows = useMemo(
    () => (folded.rest ? toDonutRows({ top: folded.rest.slices, rest: null }, categories) : []),
    [folded, categories],
  )
  const totalCents = slices.reduce((sum, slice) => sum + slice.amountCents, 0)

  // The selection may change under an open drill-down: fall back to the overview then.
  const selected = [...rows, ...restRows].find((row) => row.id === selectedId) ?? null
  const detail = useMemo(
    () =>
      selected
        ? categoryDetail({ expenses, categoryId: selected.id, weekStarts, granularity })
        : null,
    [selected, expenses, weekStarts, granularity],
  )

  const select = (id: string) => {
    if (id === REST_SLICE_ID) setRestOpen((open) => !open)
    else setSelectedId(id)
  }

  if (selected && detail) {
    const byMonth = granularity === 'month'
    const trendRows = toTrendRows(detail.trend, granularity, display)
    const table: ChartTable = {
      columns: [byMonth ? 'Monat' : 'Woche', 'Ausgegeben'],
      rows: [...detail.trend].reverse().map((point) => ({
        key: point.key,
        cells: [
          periodLabel(point.key, granularity),
          <Money key="amount" cents={point.amountCents} display={display} />,
        ],
      })),
    }
    return (
      <ChartCard
        title={selected.name}
        subtitle={
          // Each fact stays on one line – a break may only fall between them.
          <>
            <span className="whitespace-nowrap">
              <Money cents={detail.totalCents} decimals={false} display={display} /> im Zeitraum
            </span>
            {' · '}
            <span className="whitespace-nowrap">{formatPercent(selected.share)} der Ausgaben</span>
            {' · '}
            <span className="whitespace-nowrap">
              Ø <Money cents={detail.avgPerWeekCents} decimals={false} display={display} /> pro
              Woche
            </span>
          </>
        }
        table={table}
        plotClassName="h-44"
        before={
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="-my-1 flex min-h-11 items-center gap-1.5 self-start rounded-sm text-label text-fg-muted outline-none hover:text-fg focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Alle Kategorien
          </button>
        }
        after={
          detail.largest.length > 0 ? (
            <section className="flex flex-col">
              <h3 className="text-caption text-fg-subtle uppercase">Größte Ausgaben</h3>
              <ul className="divide-y">
                {detail.largest.map((expense) => (
                  <li key={expense.id}>
                    <button
                      type="button"
                      onClick={() => openExpense(expense.id)}
                      className="flex min-h-12 w-full items-center gap-3 py-1 text-left outline-none hover:bg-surface-3/40 focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">
                          {expense.note ??
                            (expense.tags.length ? expense.tags.join(', ') : selected.name)}
                        </span>
                        <span className="block text-label text-fg-muted">
                          {formatDayLabel(expense.date, today)}
                        </span>
                      </span>
                      <Money
                        cents={expense.amountCents}
                        display={display}
                        className="font-semibold"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null
        }
      >
        <CategoryTrendChart rows={trendRows} fill={selected.fill} display={display} />
      </ChartCard>
    )
  }

  return (
    <GlassCard className="flex min-w-0 flex-col gap-3">
      <div>
        <h2 className="text-h2">{TITLE}</h2>
        <p className="text-label text-fg-muted">
          {rows.length === 0
            ? 'Noch keine Ausgaben im Zeitraum – mit der ersten Ausgabe teilt sich hier der Ring auf.'
            : 'Tippe auf eine Kategorie für ihren Verlauf und ihre größten Ausgaben.'}
        </p>
      </div>

      {rows.length > 0 ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div
            role="group"
            aria-label="Kategorien: Chart"
            className="relative mx-auto size-44 shrink-0"
          >
            <Suspense fallback={<Skeleton className="size-full rounded-full" />}>
              <CategoryDonut rows={rows} display={display} onSelect={select} />
            </Suspense>
            <p className="pointer-events-none absolute inset-0 grid place-content-center text-center">
              <Money cents={totalCents} decimals={false} display={display} className="text-h2" />
              <span className="text-label text-fg-muted">ausgegeben</span>
            </p>
          </div>
          <ul className="min-w-0 flex-1">
            {rows.map((row) => (
              <li key={row.id}>
                <SliceRow
                  row={row}
                  display={display}
                  expanded={row.id === REST_SLICE_ID ? restOpen : undefined}
                  onSelect={() => select(row.id)}
                />
                {row.id === REST_SLICE_ID && restOpen ? (
                  <ul className="ml-3.5 border-l pl-2">
                    {restRows.map((rest) => (
                      <li key={rest.id}>
                        <SliceRow row={rest} display={display} onSelect={() => select(rest.id)} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {rows.length > 0 && (openSpentCents > 0 || fundedCents > 0) ? (
        <p className="text-label text-fg-subtle">
          {openSpentCents > 0 ? (
            <>
              Mit <Money cents={openSpentCents} decimals={false} display={display} /> aus noch
              offenen Wochen.{' '}
            </>
          ) : null}
          {fundedCents > 0 ? (
            <>
              Ohne <Money cents={fundedCents} decimals={false} display={display} />, die aus Töpfen
              bezahlt wurden.
            </>
          ) : null}
        </p>
      ) : null}
    </GlassCard>
  )
}
