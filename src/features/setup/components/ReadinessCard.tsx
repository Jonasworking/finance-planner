import { CircleCheck, Circle, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { dayOfTimestamp, formatDate } from '@/lib/dates'
import { classifyHost, PRODUCTION_HOST, readiness, type ReadinessCheckId } from '@/lib/readiness'
import { GlassCard } from '@/shared/components/GlassCard'
import { cn } from '@/shared/lib/utils'
import { useDeviceStore } from '@/shared/stores/deviceStore'
import { Button } from '@/shared/ui/button'
import { acknowledgeReady, isReadyAcknowledged } from '../readyAcknowledged'

export interface ReadinessCardProps {
  lastBackupAt: number | null
  /**
   * `home`: until everything is done, then once "Bereit" with "Verstanden" – after that it is
   * gone. `settings`: always, as the place to look it up again.
   */
  variant: 'home' | 'settings'
  className?: string
}

interface CheckCopy {
  title: string
  detail: ReactNode
  action?: ReactNode
}

/** "Ab wann kann ich echte Daten erfassen?" – four checks, and a clear yes once all are done. */
export function ReadinessCard({ lastBackupAt, variant, className }: ReadinessCardProps) {
  const { standalone, ios, storage, requestPersistence } = useDeviceStore()
  const [acknowledged, setAcknowledged] = useState(isReadyAcknowledged)
  const [asked, setAsked] = useState(false)
  const hostname = window.location.hostname
  const host = classifyHost(hostname)

  // Development and the smoke suite run on localhost: no card on the home screen there.
  if (variant === 'home' && host === 'local' && !import.meta.env.DEV) return null
  if (storage === null) return null // still asking the browser

  const state = readiness({ host, standalone, storage, lastBackupAt })
  if (variant === 'home' && state.ready && acknowledged) return null

  const copy: Record<ReadinessCheckId, CheckCopy> = {
    address:
      host === 'production'
        ? { title: 'Endgültige Adresse', detail: PRODUCTION_HOST }
        : {
            title: 'Endgültige Adresse',
            detail: (
              <>
                Du bist auf {hostname}. Echte Daten nur unter{' '}
                <a href={`https://${PRODUCTION_HOST}/`} className="font-semibold text-fg underline">
                  {PRODUCTION_HOST}
                </a>
                .
              </>
            ),
          },
    installed: standalone
      ? { title: 'Als App installiert', detail: 'Du nutzt die installierte App.' }
      : {
          title: 'Als App installieren',
          detail: ios
            ? 'In Safari „Teilen" → „Zum Home-Bildschirm", dann die App über das Icon öffnen. Safari und App haben getrennte Daten.'
            : 'Chrome: Installieren-Symbol in der Adresszeile · Safari: Ablage → „Zum Dock hinzufügen". Danach die App von dort öffnen.',
        },
    storage:
      storage === 'not-persisted'
        ? {
            title: 'Speicher dauerhaft machen',
            detail: asked
              ? 'Der Browser hat noch nicht zugestimmt – in der installierten App klappt es meist von selbst.'
              : 'Sonst darf der Browser die Daten bei Platzmangel löschen.',
            action: (
              <Button
                type="button"
                variant="secondary"
                size="touch"
                onClick={() => void requestPersistence().then(() => setAsked(true))}
              >
                Dauerhaft machen
              </Button>
            ),
          }
        : {
            title: 'Speicher dauerhaft',
            detail:
              storage === 'persisted'
                ? 'Der Browser löscht die Daten nicht von selbst.'
                : 'Dieser Browser verwaltet den Speicher selbst.',
          },
    backup:
      lastBackupAt !== null
        ? {
            title: 'Backup ausprobiert',
            detail: `Zuletzt am ${formatDate(dayOfTimestamp(lastBackupAt))}.`,
          }
        : {
            title: 'Einmal ein Backup speichern',
            detail: 'Dann weißt du, dass der Weg zurück funktioniert.',
            action:
              variant === 'home' ? (
                <Button asChild variant="secondary" size="touch">
                  <Link to="/settings#backup">Zum Backup</Link>
                </Button>
              ) : undefined,
          },
  }

  if (state.ready && variant === 'home') {
    return (
      <GlassCard role="status" className={cn('flex flex-col gap-3 border-saved/50', className)}>
        <div className="flex items-center gap-3">
          <ShieldCheck className="size-8 shrink-0 text-saved" aria-hidden />
          <div>
            <h2 className="text-h2">Bereit für echte Daten</h2>
            <p className="text-label text-fg-muted">
              Ab jetzt kannst du gefahrlos echte Daten erfassen. Die App erinnert dich an Backups.
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="touch"
          onClick={() => {
            acknowledgeReady()
            setAcknowledged(true)
          }}
        >
          Verstanden
        </Button>
      </GlassCard>
    )
  }

  return (
    <GlassCard
      id={variant === 'settings' ? 'readiness' : undefined}
      aria-labelledby={`readiness-${variant}`}
      className={cn('flex flex-col gap-4', !state.ready && 'border-warning/50', className)}
    >
      <div className="flex items-start gap-3">
        {state.ready ? (
          <ShieldCheck className="size-7 shrink-0 text-saved" aria-hidden />
        ) : (
          <ShieldAlert className="size-7 shrink-0 text-warning" aria-hidden />
        )}
        <div className="min-w-0">
          <h2 id={`readiness-${variant}`} className="text-h2">
            {state.ready ? 'Bereit für echte Daten' : 'Noch nicht bereit für echte Daten'}
          </h2>
          <p className="text-label text-fg-muted">
            {state.ready
              ? 'Alle vier Punkte sind erledigt – deine Daten sind hier gut aufgehoben.'
              : `${state.doneCount} von 4 erledigt. Erst wenn alle vier stimmen, sind echte Daten hier sicher.`}
          </p>
        </div>
      </div>
      <ul className="flex flex-col gap-3">
        {state.checks.map(({ id, done }) => {
          const { title, detail, action } = copy[id]
          return (
            <li key={id} className="flex items-start gap-3">
              {done ? (
                <CircleCheck className="mt-0.5 size-5 shrink-0 text-saved" aria-label="erledigt" />
              ) : (
                <Circle className="mt-0.5 size-5 shrink-0 text-fg-subtle" aria-label="offen" />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div>
                  <p className={cn(done && 'text-fg-muted')}>{title}</p>
                  <p className="text-label text-fg-muted">{detail}</p>
                </div>
                {!done && action ? <div>{action}</div> : null}
              </div>
            </li>
          )
        })}
      </ul>
    </GlassCard>
  )
}
