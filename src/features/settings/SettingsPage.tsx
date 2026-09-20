import { lazy, Suspense } from 'react'
import { GlassCard } from '@/shared/components/GlassCard'
import { Page } from '@/shared/components/Page'
import { ThemeToggle } from '@/shared/components/ThemeToggle'

// Statically false in production builds, so the dev tools (and the demo generator) are dropped.
const DevTools = import.meta.env.DEV
  ? lazy(() => import('./components/DevTools').then((module) => ({ default: module.DevTools })))
  : null

export function SettingsPage() {
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

        <GlassCard>
          <p className="text-caption text-fg-subtle uppercase">Kommt in Phase 6</p>
          <p className="text-label text-fg-muted">
            EUR-Wechselkurs, Standardwerte, Backup (Export/Import), CSV-Export, „Daten prüfen" und
            „Alle Daten löschen".
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
