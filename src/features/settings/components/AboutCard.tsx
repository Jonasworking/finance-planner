import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { clearDismissedInsights } from '@/features/insights'
import { formatDate } from '@/lib/dates'
import { GlassCard } from '@/shared/components/GlassCard'
import { useDeviceStore } from '@/shared/stores/deviceStore'
import { Button } from '@/shared/ui/button'

function formatMegabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`
}

/** Build, address, storage – what to look at when something seems off – and the hint reset. */
export function AboutCard() {
  const { standalone, storage } = useDeviceStore()
  const [usage, setUsage] = useState<number | null>(null)

  useEffect(() => {
    void navigator.storage
      ?.estimate?.()
      .then((estimate) => setUsage(estimate.usage ?? null))
      .catch(() => {})
  }, [])

  const rows: [string, string][] = [
    ['Version', `${__APP_BUILD__.sha} · ${formatDate(__APP_BUILD__.date)}`],
    ['Adresse', window.location.host],
    ['Läuft als', standalone ? 'installierte App' : 'Browser-Tab'],
    [
      'Speicher',
      storage === 'persisted'
        ? 'dauerhaft'
        : storage === 'not-persisted'
          ? 'nicht dauerhaft'
          : storage === 'unsupported'
            ? 'vom Browser verwaltet'
            : '…',
    ],
  ]
  if (usage !== null) rows.push(['Belegt', formatMegabytes(usage)])

  return (
    <GlassCard className="flex flex-col gap-4">
      <h2 className="text-h2">Über die App</h2>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-label">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-fg-muted">{label}</dt>
            <dd className="truncate text-right">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center">
        <p className="min-w-0 flex-1 text-label text-fg-muted">
          Weggewischte Hinweise auf dem Home-Screen wieder zeigen.
        </p>
        <Button
          type="button"
          variant="secondary"
          size="touch"
          onClick={() => {
            clearDismissedInsights()
            toast.success('Hinweise werden wieder gezeigt')
          }}
        >
          Hinweise zurückholen
        </Button>
      </div>
    </GlassCard>
  )
}
