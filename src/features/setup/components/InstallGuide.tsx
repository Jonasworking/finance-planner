import { Share, SquarePlus, Smartphone } from 'lucide-react'
import { useState } from 'react'
import { repos } from '@/db'
import { AddressBanner } from '@/shared/components/AddressBanner'
import { Button } from '@/shared/ui/button'

const STEPS = [
  { icon: Share, text: 'Tippe in Safari auf „Teilen".' },
  { icon: SquarePlus, text: 'Wähle „Zum Home-Bildschirm" und dann „Hinzufügen".' },
  { icon: Smartphone, text: 'Öffne den Finanzplaner ab jetzt über das neue Icon.' },
] as const

/**
 * iPhone in the browser: install first. Safari and the installed app keep separate data, so
 * anything entered in the tab would be missing in the app. Shown before the onboarding.
 */
export function InstallGuide() {
  const [busy, setBusy] = useState(false)

  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-4 pt-safe pb-safe">
      <div className="flex w-full max-w-md flex-col gap-6 py-8">
        <AddressBanner />
        <div className="flex flex-col gap-2">
          <h1 className="text-h1 font-bold">Erst installieren, dann loslegen</h1>
          <p className="text-fg-muted">
            Auf dem iPhone haben Safari und die installierte App getrennte Speicher. Installier den
            Finanzplaner zuerst – sonst landen deine Daten im Safari-Tab und fehlen in der App.
          </p>
        </div>
        <ol className="flex flex-col gap-3">
          {STEPS.map(({ icon: Icon, text }, index) => (
            <li key={text} className="flex items-center gap-3 rounded-md bg-surface-1 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-surface-3 text-saved">
                <Icon className="size-5" aria-hidden />
              </span>
              <span>
                <span className="sr-only">Schritt {index + 1}: </span>
                {text}
              </span>
            </li>
          ))}
        </ol>
        <Button
          type="button"
          variant="ghost"
          size="touch"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void repos.settings.dismissInstallHint().finally(() => setBusy(false))
          }}
          className="text-fg-muted"
        >
          Trotzdem im Browser weiter
        </Button>
      </div>
    </div>
  )
}
