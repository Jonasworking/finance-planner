import { lazy, Suspense, type ComponentType } from 'react'
import { Page } from '@/shared/components/Page'
import { Skeleton } from '@/shared/ui/skeleton'

/**
 * A route page in its own chunk: until it has loaded, the page frame with its title and a
 * skeleton stands in (no spinner page, no layout jump of the header).
 */
export function lazyPage(title: string, load: () => Promise<ComponentType>): ComponentType {
  const LazyComponent = lazy(() => load().then((Component) => ({ default: Component })))

  function LazyPage() {
    return (
      <Suspense
        fallback={
          <Page title={title}>
            <div className="flex flex-col gap-4">
              <Skeleton className="h-40 w-full rounded-lg" />
              <Skeleton className="h-72 w-full rounded-lg" />
            </div>
          </Page>
        }
      >
        <LazyComponent />
      </Suspense>
    )
  }
  LazyPage.displayName = `LazyPage(${title})`
  return LazyPage
}
