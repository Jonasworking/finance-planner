import { useLiveQuery } from 'dexie-react-hooks'
import { lazy, Suspense, useEffect } from 'react'
import { useLocation } from 'react-router'
import { toast } from 'sonner'
import { db } from '@/db'
import { ReadinessCard } from '@/features/setup'
import { formatRate } from '@/lib/money'
import { SETTINGS_ID } from '@/lib/types'
import { GlassCard } from '@/shared/components/GlassCard'
import { Page } from '@/shared/components/Page'
import { ThemeToggle } from '@/shared/components/ThemeToggle'
import { useToday } from '@/shared/hooks/useToday'
import { useUiStore } from '@/shared/stores/uiStore'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'
import { AboutCard } from './components/AboutCard'
import { BackupCard } from './components/BackupCard'
import { DataCard } from './components/DataCard'
import { DefaultsCard } from './components/DefaultsCard'
import { useExportFiles } from './hooks/useExportFiles'
import { takeAfterReload } from './importFlags'

// Statically false in production builds, so the dev tools (and the demo generator) are dropped.
const DevTools = import.meta.env.DEV
  ? lazy(() => import('./components/DevTools').then((module) => ({ default: module.DevTools })))
  : null

const AFTER_RELOAD = {
  imported: 'Backup eingespielt',
  'import-undone': 'Import rückgängig gemacht',
  wiped: 'Alle Daten gelöscht',
} as const

export function SettingsPage() {
  const today = useToday()
  const settings = useLiveQuery(() => db.settings.get(SETTINGS_ID), [])
  const files = useExportFiles(today)
  const openEurRate = useUiStore((state) => state.openEurRate)
  const { hash } = useLocation()

  // After an import, its undo or a wipe the page reloaded – say what happened.
  useEffect(() => {
    const message = takeAfterReload()
    if (message === 'imported') {
      toast.success(AFTER_RELOAD.imported, {
        description: 'Der vorige Stand ist gesichert – „Import rückgängig" im Abschnitt Backup.',
      })
    } else if (message) {
      toast.success(AFTER_RELOAD[message])
    }
  }, [])

  // "/settings#backup" (from the home-screen reminder): the page scrolls inside `main`.
  const loaded = settings !== undefined
  useEffect(() => {
    if (!loaded || hash === '') return
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [loaded, hash])

  if (!settings) {
    return (
      <Page title="Einstellungen">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </Page>
    )
  }

  return (
    <Page title="Einstellungen">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <ReadinessCard variant="settings" lastBackupAt={settings.lastBackupAt} />
        <BackupCard lastBackupAt={settings.lastBackupAt} files={files} today={today} />
        <DefaultsCard settings={settings} />

        <GlassCard className="flex flex-col gap-3">
          <div>
            <h2 className="text-h2">Farbschema</h2>
            <p className="text-label text-fg-muted">Dunkel ist der Standard.</p>
          </div>
          <ThemeToggle className="max-w-sm" />
        </GlassCard>

        <GlassCard className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-h2">EUR-Kurs</h2>
            <p className="text-label text-fg-muted">
              {settings.eurRate != null
                ? `1 A$ = ${formatRate(settings.eurRate)} € · für die Anzeige in der Analyse`
                : 'Noch kein Kurs hinterlegt. Damit zeigt die Analyse Beträge auch in €.'}
            </p>
          </div>
          <Button type="button" variant="secondary" size="touch" onClick={() => openEurRate()}>
            {settings.eurRate != null ? 'Ändern' : 'Eintragen'}
          </Button>
        </GlassCard>

        <DataCard files={files} />
        <AboutCard />

        {DevTools ? (
          <Suspense fallback={null}>
            <DevTools />
          </Suspense>
        ) : null}
      </div>
    </Page>
  )
}
