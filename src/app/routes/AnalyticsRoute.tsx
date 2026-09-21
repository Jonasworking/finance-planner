import { lazy, Suspense } from 'react'
import { Page } from '@/shared/components/Page'
import { Skeleton } from '@/shared/ui/skeleton'

// The analysis screen (and with it Recharts) stays out of the start chunk.
const AnalyticsPage = lazy(() =>
  import('@/features/analytics').then((module) => ({ default: module.AnalyticsPage })),
)

export function AnalyticsRoute() {
  return (
    <Suspense
      fallback={
        <Page title="Analyse">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-11 w-full rounded-md" />
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-72 w-full rounded-lg" />
          </div>
        </Page>
      }
    >
      <AnalyticsPage />
    </Suspense>
  )
}
