import { useLiveQuery } from 'dexie-react-hooks'
import { ArchiveRestore, ArrowLeftRight, ChevronLeft, Minus, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { db, loadPots, repos } from '@/db'
import { formatDayLabel } from '@/lib/dates'
import { formatAUD } from '@/lib/money'
import { potHistory, summarizePots } from '@/lib/pots'
import { potBalances } from '@/lib/savings'
import { CategoryIcon } from '@/shared/components/CategoryIcon'
import { GlassCard } from '@/shared/components/GlassCard'
import { Money } from '@/shared/components/Money'
import { Page } from '@/shared/components/Page'
import { ProgressRing } from '@/shared/components/ProgressRing'
import { useToday } from '@/shared/hooks/useToday'
import { errorMessage } from '@/shared/lib/errorMessages'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'
import { PotHistoryList } from './components/PotHistoryList'
import { PotMoveSheet, type PotMoveMode } from './components/PotMoveSheet'
import { PotSheet } from './components/PotSheet'
import { deadlineLine, forecastLine, historyCopy } from './potCopy'

const backLink = (
  <Link
    to="/pots"
    className="-ml-1 inline-flex h-11 items-center gap-1 self-start rounded-md pr-2 text-label text-fg-muted outline-none hover:text-fg focus-visible:ring-3 focus-visible:ring-ring/50"
  >
    <ChevronLeft className="size-4" aria-hidden />
    Alle Töpfe
  </Link>
)

export function PotDetailPage() {
  const { potId } = useParams()
  const today = useToday()
  const data = useLiveQuery(() => loadPots(db), [])
  const [move, setMove] = useState<{ open: boolean; mode: PotMoveMode; session: number }>({
    open: false,
    mode: 'deposit',
    session: 0,
  })
  const [edit, setEdit] = useState({ open: false, session: 0 })
  const openMove = (mode: PotMoveMode) =>
    setMove((current) => ({ open: true, mode, session: current.session + 1 }))

  if (data === undefined) {
    return (
      <Page title="Spartopf">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-52 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </Page>
    )
  }

  const all = summarizePots(data.pots, data.transactions, today)
  const summary = [...all.active, ...all.archived].find((row) => row.pot.id === potId)
  if (!summary) {
    return (
      <Page title="Spartopf">
        <div className="flex flex-col gap-3">
          {backLink}
          <GlassCard>
            <p className="text-h2">Diesen Topf gibt es nicht (mehr).</p>
            <p className="text-label text-fg-muted">
              Vielleicht wurde er auf einem anderen Gerät entfernt.
            </p>
          </GlassCard>
        </div>
      </Page>
    )
  }

  const { pot, balanceCents, progress, missingCents, paceCentsPerWeek, requiredWeeklyCents } =
    summary
  const usablePots = all.active.map((row) => row.pot)
  const history = potHistory(data.transactions, pot.id)
  const deadlineText = deadlineLine(summary)
  const onTrack = summary.deadlineDeltaWeeks !== null && summary.deadlineDeltaWeeks >= 0

  const unarchive = async () => {
    try {
      await repos.pots.unarchive(pot.id)
      toast.success('Topf wiederhergestellt')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <Page
      title={pot.name}
      subtitle={pot.archived ? 'Archivierter Spartopf' : 'Spartopf'}
      actions={
        <Button
          variant="secondary"
          size="icon-touch"
          onClick={() => setEdit((current) => ({ open: true, session: current.session + 1 }))}
          aria-label="Topf bearbeiten"
        >
          <Pencil aria-hidden />
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {backLink}

        {/* minmax(0,…) + min-w-0: grid tracks must not grow to fit long non-wrapping rows */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start">
          <div className="flex min-w-0 flex-col gap-4">
            <GlassCard className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
              {progress !== null ? (
                <ProgressRing
                  value={progress}
                  label="Ziel erreicht zu"
                  size={148}
                  className="mx-auto shrink-0"
                >
                  <span className="text-h1 tabular-nums">{Math.round(progress * 100)} %</span>
                </ProgressRing>
              ) : (
                <CategoryIcon icon={pot.icon} color={pot.color} size="lg" className="mx-auto" />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="text-caption text-fg-subtle uppercase">Im Topf</p>
                <Money
                  cents={balanceCents}
                  tone={balanceCents < 0 ? 'spent' : 'saved'}
                  className="text-display font-bold"
                />
                {pot.targetCents !== null ? (
                  <p className="text-label text-fg-muted">
                    von {formatAUD(pot.targetCents)}
                    {missingCents !== null && missingCents > 0
                      ? ` · es fehlen ${formatAUD(missingCents)}`
                      : ''}
                  </p>
                ) : null}
                <p className="pt-1">{forecastLine(summary, today)}</p>
                {deadlineText ? (
                  <p className={cn('text-label', onTrack ? 'text-saved' : 'text-warning')}>
                    {deadlineText}
                  </p>
                ) : null}
              </div>
            </GlassCard>

            {pot.archived ? (
              <GlassCard className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-label text-fg-muted">
                  Archiviert – der Verlauf bleibt, neue Buchungen sind nicht möglich.
                </p>
                <Button variant="secondary" size="touch" onClick={() => void unarchive()}>
                  <ArchiveRestore aria-hidden />
                  Wiederherstellen
                </Button>
              </GlassCard>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <Button size="touch" className="min-w-0 px-2" onClick={() => openMove('deposit')}>
                  <Plus aria-hidden />
                  Einzahlen
                </Button>
                <Button
                  size="touch"
                  variant="secondary"
                  className="min-w-0 px-2"
                  disabled={balanceCents <= 0}
                  onClick={() => openMove('withdraw')}
                >
                  <Minus aria-hidden />
                  Auszahlen
                </Button>
                <Button
                  size="touch"
                  variant="secondary"
                  className="min-w-0 px-2"
                  disabled={usablePots.length < 2}
                  onClick={() => openMove('transfer')}
                >
                  <ArrowLeftRight aria-hidden />
                  Umbuchen
                </Button>
              </div>
            )}

            <GlassCard>
              <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3">
                <dt>
                  Spartempo
                  <span className="block text-label text-fg-muted">
                    Ø der letzten 8 abgeschlossenen Wochen
                  </span>
                </dt>
                <dd className="text-right font-semibold tabular-nums">
                  {formatAUD(paceCentsPerWeek, { signed: true })} / Woche
                </dd>
                {pot.deadline !== null ? (
                  <>
                    <dt>
                      Nötig pro Woche
                      <span className="block text-label text-fg-muted">
                        bis {formatDayLabel(pot.deadline, today)}
                      </span>
                    </dt>
                    <dd
                      className={cn(
                        'text-right font-semibold tabular-nums',
                        requiredWeeklyCents !== null && !onTrack && 'text-warning',
                      )}
                    >
                      {requiredWeeklyCents === null
                        ? summary.overdue
                          ? 'Deadline vorbei'
                          : '–'
                        : requiredWeeklyCents === 0
                          ? 'geschafft'
                          : `${formatAUD(requiredWeeklyCents)} / Woche`}
                    </dd>
                  </>
                ) : null}
              </dl>
            </GlassCard>
          </div>

          <section className="flex min-w-0 flex-col gap-2">
            <h2 className="px-1 text-caption text-fg-subtle uppercase">Verlauf</h2>
            {history.length > 0 ? (
              <PotHistoryList
                entries={history}
                copyFor={(entry) => historyCopy(entry.tx, data)}
                today={today}
              />
            ) : (
              <p className="px-1 text-label text-fg-muted">
                Noch keine Buchungen. Zahl etwas ein oder buch aus einem anderen Topf um – ab dann
                siehst du hier jede Bewegung mit dem Stand danach.
              </p>
            )}
          </section>
        </div>
      </div>

      <PotMoveSheet
        open={move.open}
        onOpenChange={(open) => setMove((current) => ({ ...current, open }))}
        session={move.session}
        mode={move.mode}
        pot={pot}
        pots={usablePots}
        balances={potBalances(data.transactions)}
        today={today}
      />
      <PotSheet
        open={edit.open}
        onOpenChange={(open) => setEdit((current) => ({ ...current, open }))}
        session={edit.session}
        pot={pot}
        balanceCents={balanceCents}
        today={today}
      />
    </Page>
  )
}
