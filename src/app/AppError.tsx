import { RotateCw, TriangleAlert } from 'lucide-react'
import { useEffect } from 'react'
import { useRouteError } from 'react-router'
import { claimAutoReload, isChunkLoadError } from '@/shared/lib/reloadOnce'
import { Button } from '@/shared/ui/button'

/**
 * Whether this page load reloads itself for a part that did not arrive. Decided once per page
 * load: strict mode renders twice, and the lock must not be claimed (and then refused) twice.
 */
let autoReload: boolean | undefined
function claimOnce(): boolean {
  autoReload ??= claimAutoReload(window.sessionStorage, Date.now())
  return autoReload
}

/**
 * Stands in for the whole app when something unexpected happened. A part that could not be
 * loaded reloads the app once by itself; a second failure – and any other error – gets this
 * screen: what happened in plain words, that the data is safe, and a way out.
 */
export function AppError() {
  const error = useRouteError()
  const loadProblem = isChunkLoadError(error)
  const reloading = loadProblem && claimOnce()

  useEffect(() => {
    if (reloading) window.location.reload()
  }, [reloading])

  // On its way into the reload: keep the background, no flash of an error.
  if (reloading) return <div className="h-dvh bg-bg" />

  return (
    <main className="grid h-dvh place-items-center bg-bg px-6 pt-safe pb-safe">
      <div role="alert" className="flex max-w-sm flex-col items-center gap-4 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-warning-soft text-warning">
          <TriangleAlert className="size-6" aria-hidden />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-h1">
            {loadProblem ? 'Die App konnte nicht geladen werden' : 'Etwas ist schiefgelaufen'}
          </h1>
          <p className="text-fg-muted">
            {loadProblem
              ? 'Ein Teil der App kam nicht an – meist liegt das an der Verbindung.'
              : 'Die App ist auf einen unerwarteten Fehler gestoßen.'}{' '}
            Deine Daten liegen sicher auf diesem Gerät.
          </p>
        </div>
        <Button type="button" size="touch" onClick={() => window.location.reload()}>
          <RotateCw aria-hidden />
          Neu laden
        </Button>
      </div>
    </main>
  )
}
