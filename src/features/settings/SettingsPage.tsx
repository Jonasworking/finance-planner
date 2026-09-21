import { useLiveQuery } from 'dexie-react-hooks'
import { lazy, Suspense } from 'react'
import { db } from '@/db'
import { formatRate } from '@/lib/money'
import { SETTINGS_ID } from '@/lib/types'
import { GlassCard } from '@/shared/components/GlassCard'
import { Page } from '@/shared/components/Page'
import { ThemeToggle } from '@/shared/components/ThemeToggle'
import { useUiStore } from '@/shared/stores/uiStore'
import { Button } from '@/shared/ui/button'

// Statically false in production builds, so the dev tools (and the demo generator) are dropped.
const DevTools = import.meta.env.DEV
  ? lazy(() => import('./components/DevTools').then((module) => ({ default: module.DevTools })))
  : null

export function SettingsPage() {
  const settings = useLiveQuery(() => db.settings.get(SETTINGS_ID), [])
  const openEurRate = useUiStore((state) => state.openEurRate)

  return (
    <Page title="Einstellungen">
      <div className="flex flex-col gap-4">
        <GlassCard className="flex flex-col gap-3">
          <div>
            <p className="text-h2">Farbschema</p>
            <p className="text-label text-fg-muted">Dunkel ist der Standard.</p>
          </div>
          <ThemeToggle className="max-w-sm" />
        </GlassCard>

        <GlassCard className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-h2">EUR-Kurs</p>
            <p className="text-label text-fg-muted">
              {settings?.eurRate != null
                ? `1 A$ = ${formatRate(settings.eurRate)} € · für die Anzeige in der Analyse`
                : 'Noch kein Kurs hinterlegt. Damit zeigt die Analyse Beträge auch in €.'}
            </p>
          </div>
          <Button type="button" variant="secondary" size="touch" onClick={() => openEurRate()}>
            {settings?.eurRate != null ? 'Ändern' : 'Eintragen'}
          </Button>
        </GlassCard>

        <GlassCard>
          <p className="text-caption text-fg-subtle uppercase">Kommt in Phase 6</p>
          <p className="text-label text-fg-muted">
            Standardwerte, Backup (Export/Import), CSV-Export, „Daten prüfen" und „Alle Daten
            löschen".
          </p>
        </GlassCard>

        {DevTools ? (
          <Suspense fallback={null}>
            <DevTools />
          </Suspense>
        ) : null}
      </div>
    </Page>
  )
}
