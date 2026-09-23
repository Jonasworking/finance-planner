import { lazy, Suspense } from 'react'
import { Page } from '@/shared/components/Page'
import { Skeleton } from '@/shared/ui/skeleton'

// The calculator (and with it Recharts) stays out of the start chunk.
const WhatIfPage = lazy(() =>
  import('@/features/whatif').then((module) => ({ default: module.WhatIfPage })),
)

export function WhatIfRoute() {
  return (
    <Suspense
      fallback={
        <Page title="Was-wäre-wenn">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-64 w-full rounded-lg" />
            <Skeleton className="h-72 w-full rounded-lg" />
          </div>
        </Page>
      }
    >
      <WhatIfPage />
    </Suspense>
  )
}
