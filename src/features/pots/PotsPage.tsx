import { useLiveQuery } from 'dexie-react-hooks'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { db, loadPots } from '@/db'
import { formatAUD } from '@/lib/money'
import { summarizePots } from '@/lib/pots'
import { GlassCard } from '@/shared/components/GlassCard'
import { Page } from '@/shared/components/Page'
import { useToday } from '@/shared/hooks/useToday'
import { potPath } from '@/shared/lib/routes'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'
import { PotCard } from './components/PotCard'
import { PotSheet } from './components/PotSheet'

export function PotsPage() {
  const today = useToday()
  const navigate = useNavigate()
  const data = useLiveQuery(() => loadPots(db), [])
  const [sheet, setSheet] = useState({ open: false, session: 0 })
  const openSheet = () => setSheet((current) => ({ open: true, session: current.session + 1 }))

  const pots = data ? summarizePots(data.pots, data.transactions, today) : undefined

  return (
    <Page
      title="Spartöpfe"
      subtitle={pots ? `Gesamt ${formatAUD(pots.totalCents)}` : undefined}
      actions={
        <Button size="touch" onClick={openSheet}>
          <Plus aria-hidden />
          Neu
        </Button>
      }
    >
      {pots === undefined ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* minmax(0,…): cards hold truncating lines and must not widen their track */}
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {pots.active.map((summary) => (
              <PotCard key={summary.pot.id} summary={summary} today={today} />
            ))}
          </div>

          {/* Only "Nur gespart" so far: say what further pots are for instead of leaving a gap. */}
          {pots.active.length === 1 ? (
            <GlassCard className="flex flex-col items-start gap-3">
              <div>
                <p className="text-h2">Wofür sparst du?</p>
                <p className="text-label text-fg-muted">
                  Leg für ein Ziel – Reise, Auto, Notgroschen – einen eigenen Topf an und buch aus
                  „Nur gespart" um. Er zeigt dir, wann du es erreichst und was pro Woche nötig ist.
                  Große Ausgaben zahlst du später direkt aus dem Topf, ohne dein Wochenbudget zu
                  belasten.
                </p>
              </div>
              <Button size="touch" variant="secondary" onClick={openSheet}>
                <Plus aria-hidden />
                Topf anlegen
              </Button>
            </GlassCard>
          ) : null}

          {pots.archived.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="px-1 text-caption text-fg-subtle uppercase">Archiviert</h2>
              <div className="grid grid-cols-[minmax(0,1fr)] gap-4 opacity-70 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                {pots.archived.map((summary) => (
                  <PotCard key={summary.pot.id} summary={summary} today={today} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      <PotSheet
        open={sheet.open}
        onOpenChange={(open) => setSheet((current) => ({ ...current, open }))}
        session={sheet.session}
        pot={null}
        balanceCents={0}
        today={today}
        onCreated={(pot) => void navigate(potPath(pot.id))}
      />
    </Page>
  )
}
