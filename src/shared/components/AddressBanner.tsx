import { TriangleAlert } from 'lucide-react'
import { classifyHost, PRODUCTION_HOST } from '@/lib/readiness'
import { cn } from '@/shared/lib/utils'

export interface AddressBannerProps {
  className?: string
}

/**
 * The database belongs to the address. On an old address or a preview deployment, anything
 * entered stays THERE – the real app at the final address never sees it. Said on every screen.
 */
export function AddressBanner({ className }: AddressBannerProps) {
  const host = classifyHost(window.location.hostname)
  if (host === 'production' || host === 'local') return null

  return (
    <div
      role="note"
      aria-label="Hinweis zur Adresse"
      className={cn(
        'flex items-start gap-3 rounded-md border border-warning/40 bg-warning-soft px-4 py-3 text-label',
        className,
      )}
    >
      <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
      <p className="min-w-0">
        {host === 'old-address' ? (
          <>
            <strong className="font-semibold">Alte Adresse.</strong> Was du hier eingibst, bleibt
            hier. Die App wohnt jetzt unter{' '}
            <a href={`https://${PRODUCTION_HOST}/`} className="font-semibold underline">
              {PRODUCTION_HOST}
            </a>
            .
          </>
        ) : (
          <>
            <strong className="font-semibold">Vorschau zum Testen.</strong> Keine echten Daten
            eingeben – sie landen nicht in deiner App unter{' '}
            <a href={`https://${PRODUCTION_HOST}/`} className="font-semibold underline">
              {PRODUCTION_HOST}
            </a>
            .
          </>
        )}
      </p>
    </div>
  )
}
