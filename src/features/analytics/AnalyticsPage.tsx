import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db, loadAnalytics } from '@/db'
import { buildAnalytics } from '@/lib/analytics'
import { moneyDisplay } from '@/lib/money'
import { Page } from '@/shared/components/Page'
import { useToday } from '@/shared/hooks/useToday'
import { Skeleton } from '@/shared/ui/skeleton'
import { useAnalyticsStore } from './analyticsStore'
import { BestWorstCard } from './components/BestWorstCard'
import { CategoriesCard } from './components/CategoriesCard'
import { ComparisonCard } from './components/ComparisonCard'
import { CumulativeCard } from './components/CumulativeCard'
import { FilterBar } from './components/FilterBar'
import { FlowCard } from './components/FlowCard'
import { KpiRow } from './components/KpiRow'
import { selectionLabel } from './labels'

export function AnalyticsPage() {
  const today = useToday()
  const data = useLiveQuery(() => loadAnalytics(db), [])
  const { granularity, range, setGranularity, setRange } = useAnalyticsStore()

  const settings = data?.settings
  const view = useMemo(
    () =>
      data && settings
        ? buildAnalytics({
            today,
            range,
            granularity,
            trackingSince: settings.trackingSince,
            weeks: data.weeks,
            expenses: data.expenses,
            budgets: data.budgets,
          })
        : null,
    [data, settings, today, range, granularity],
  )

  if (!data || !settings || !view) {
    return (
      <Page title="Analyse">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-11 w-full rounded-md" />
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-72 w-full rounded-lg" />
        </div>
      </Page>
    )
  }

  const display = moneyDisplay(settings)

  return (
    <Page title="Analyse" subtitle={selectionLabel(view.weekStarts, granularity)}>
      <div className="flex flex-col gap-4">
        <FilterBar
          granularity={granularity}
          range={range}
          onGranularityChange={setGranularity}
          onRangeChange={setRange}
          showsEur={display.currency === 'EUR'}
          eurRate={settings.eurRate}
        />
        <KpiRow totals={view.totals} display={display} />
        <FlowCard points={view.flow} granularity={granularity} display={display} />
        {/* minmax(0,…) + min-w-0: grid tracks must not grow to fit long non-wrapping rows */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[repeat(2,minmax(0,1fr))] lg:items-start">
          <div className="flex min-w-0 flex-col gap-4">
            <CategoriesCard
              // A new selection starts at the overview again.
              key={`${range}-${granularity}`}
              slices={view.slices}
              categories={data.categories}
              expenses={view.expenses}
              weekStarts={view.weekStarts}
              granularity={granularity}
              fundedCents={view.fundedCents}
              openSpentCents={view.totals.openSpentCents}
              today={today}
              display={display}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <ComparisonCard
              comparison={view.comparison}
              granularity={granularity}
              display={display}
            />
            {view.bestWorst ? <BestWorstCard bestWorst={view.bestWorst} display={display} /> : null}
          </div>
        </div>
        <CumulativeCard cumulative={view.cumulative} display={display} />
      </div>
    </Page>
  )
}
