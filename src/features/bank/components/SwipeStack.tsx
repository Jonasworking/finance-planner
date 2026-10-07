import { ArrowLeft, ArrowRight, Ban, SkipForward, Undo2 } from 'lucide-react'
import {
  animate,
  m,
  useMotionValue,
  useTransform,
  type MotionValue,
  type PanInfo,
} from 'motion/react'
import { useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { toast } from 'sonner'
import { repos } from '@/db'
import { purchaseDay } from '@/lib/bankInbox'
import { formatDayLabel, formatWeekRange } from '@/lib/dates'
import { displayMerchant } from '@/lib/merchantRules'
import { formatAUD } from '@/lib/money'
import type { BankTransaction, Category, ISODate } from '@/lib/types'
import { CategoryGrid } from '@/shared/components/CategoryGrid'
import { CategoryIcon } from '@/shared/components/CategoryIcon'
import { Money } from '@/shared/components/Money'
import { ProgressBar } from '@/shared/components/ProgressBar'
import { errorMessage } from '@/shared/lib/errorMessages'
import { cn } from '@/shared/lib/utils'
import { spring } from '@/shared/motion'

const SWIPE_DISTANCE = 110
const SWIPE_VELOCITY = 600
/** Below this offset the card counts as "at rest" and taps go through to its content. */
const REST_TOLERANCE = 4

export interface SwipeStackProps {
  /** Inbox lines, newest first. */
  inbox: readonly BankTransaction[]
  /** Selectable categories per line, most likely first. */
  suggestions: Record<string, Category[]>
  /** Selectable categories in their fixed order: the grid must not reshuffle from card to card. */
  categories: readonly Category[]
  /** Lines that may already have been entered by hand. */
  candidates: Record<string, unknown[]>
  /** Lines whose expense would land in a closed week. */
  closedWeeks: Record<string, ISODate>
  today: ISODate
  /** Opens the sheet with everything one can do with a line ("ist dieselbe", …). */
  onDetails: (tx: BankTransaction) => void
}

interface Done {
  label: string
  txId: string
  undo: () => Promise<void>
}

/**
 * One booking per card, like a receipt. Swiping right or left files it under one of the two most
 * likely categories (they wait at the edges and are buttons as well), every other category is a
 * tap below. Skipping only moves a card to the end for this visit; "Rückgängig" takes back the
 * last filing, including what the merchant's rule learned from it.
 */
export function SwipeStack({
  inbox,
  suggestions,
  categories,
  candidates,
  closedWeeks,
  today,
  onDetails,
}: SwipeStackProps) {
  const [skipped, setSkipped] = useState<readonly string[]>([])
  const [history, setHistory] = useState<readonly Done[]>([])
  const [busy, setBusy] = useState(false)

  const waiting = [
    ...inbox.filter((tx) => !skipped.includes(tx.id)),
    ...skipped.flatMap((id) => inbox.filter((tx) => tx.id === id)),
  ]
  const current = waiting[0]
  const next = waiting[1]
  const total = inbox.length + history.length
  const last = history.at(-1)

  /** Runs one filing; `false` means it did not happen (the card comes back). */
  const file = async (
    tx: BankTransaction,
    label: string,
    work: () => Promise<() => Promise<void>>,
  ): Promise<boolean> => {
    if (busy) return false
    setBusy(true)
    try {
      const undo = await work()
      setHistory((entries) => [...entries, { label, txId: tx.id, undo }])
      return true
    } catch (error) {
      toast.error(errorMessage(error))
      return false
    } finally {
      setBusy(false)
    }
  }

  const assign = (tx: BankTransaction, category: Category) =>
    file(tx, `${displayMerchant(tx.description)} → ${category.name}`, async () => {
      const { rule } = await repos.bank.assign(tx.id, category.id)
      return () => repos.bank.undoAssign(tx.id, rule)
    })

  const ignore = (tx: BankTransaction) =>
    file(tx, `${displayMerchant(tx.description)} → keine Ausgabe`, async () => {
      const rule = await repos.bank.ignore(tx.id)
      return () => repos.bank.reopen(tx.id, rule)
    })

  const undoLast = async () => {
    if (!last || busy) return
    setBusy(true)
    try {
      await last.undo()
      setHistory((entries) => entries.slice(0, -1))
      // Back on top, also if it had been skipped before.
      setSkipped((ids) => ids.filter((id) => id !== last.txId))
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  if (!current) return null
  const options = suggestions[current.id] ?? []

  return (
    <section aria-label="Buchungen zuordnen" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3 text-label text-fg-muted">
          <span className="tabular-nums">
            {history.length + 1} von {total}
          </span>
          <span aria-live="polite" className="min-w-0 truncate">
            {last ? `Zuletzt: ${last.label}` : 'Wischen oder antippen'}
          </span>
        </div>
        <ProgressBar value={history.length / total} label="Zugeordnet in dieser Runde" />
      </div>

      <TopCard
        key={current.id}
        tx={current}
        next={next}
        right={options[0]}
        left={options[1]}
        closedWeek={closedWeeks[current.id] ?? null}
        maybeEntered={current.id in candidates}
        today={today}
        onFile={(category) => assign(current, category)}
        onDetails={() => onDetails(current)}
      />

      <div className="flex flex-col gap-2">
        <h3 className="text-label text-fg-muted">Andere Kategorie</h3>
        <CategoryGrid
          categories={categories}
          value={null}
          onChange={(categoryId) => {
            const category = categories.find((row) => row.id === categoryId)
            if (category) void assign(current, category)
          }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StackAction
          icon={SkipForward}
          label="Überspringen"
          disabled={waiting.length < 2}
          onClick={() =>
            setSkipped((ids) => [...ids.filter((id) => id !== current.id), current.id])
          }
        />
        <StackAction icon={Ban} label="Keine Ausgabe" onClick={() => void ignore(current)} />
        <StackAction
          icon={Undo2}
          label="Rückgängig"
          disabled={!last}
          onClick={() => void undoLast()}
        />
      </div>
    </section>
  )
}

function StackAction({
  icon: Icon,
  label,
  disabled,
  onClick,
}: {
  icon: typeof Ban
  label: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-md bg-surface-2 px-1 text-caption text-fg outline-none hover:bg-surface-3 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40"
    >
      <Icon className="size-5" aria-hidden />
      <span className="w-full truncate text-center">{label}</span>
    </button>
  )
}

/** One of the two categories waiting at the edge; it lights up as the card moves towards it. */
function EdgeTarget({
  category,
  side,
  x,
  onClick,
}: {
  category: Category | undefined
  side: 'left' | 'right'
  x: MotionValue<number>
  onClick: () => void
}) {
  const towards = side === 'right' ? SWIPE_DISTANCE : -SWIPE_DISTANCE
  const opacity = useTransform(x, [0, towards], [0.7, 1], { clamp: true })
  const scale = useTransform(x, [0, towards], [1, 1.08], { clamp: true })
  if (!category) return <span />
  const Arrow = side === 'right' ? ArrowRight : ArrowLeft
  return (
    <m.button
      type="button"
      onClick={onClick}
      style={{ opacity, scale }}
      aria-label={`${side === 'right' ? 'Nach rechts' : 'Nach links'}: ${category.name}`}
      className={cn(
        'flex min-h-11 min-w-0 items-center gap-2 rounded-md px-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        side === 'right' ? 'flex-row-reverse justify-self-end text-right' : 'justify-self-start',
      )}
    >
      <Arrow className="size-4 shrink-0 text-fg-muted" aria-hidden />
      <CategoryIcon icon={category.icon} color={category.color} size="sm" />
      <span className="min-w-0 truncate text-label font-medium">{category.name}</span>
    </m.button>
  )
}

interface TopCardProps {
  tx: BankTransaction
  next: BankTransaction | undefined
  right: Category | undefined
  left: Category | undefined
  closedWeek: ISODate | null
  maybeEntered: boolean
  today: ISODate
  onFile: (category: Category) => Promise<boolean>
  onDetails: () => void
}

/**
 * The card on top with its two targets. Keyed by the line, so every card starts at rest. Like
 * SwipeRow it swallows the click the browser fires after a drag.
 */
function TopCard({
  tx,
  next,
  right,
  left,
  closedWeek,
  maybeEntered,
  today,
  onFile,
  onDetails,
}: TopCardProps) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-240, 240], [-7, 7])
  const dragging = useRef(false)
  const amountCents = -tx.amountCents
  const merchant = displayMerchant(tx.description)

  const fileTo = (category: Category | undefined, direction: 1 | -1) => {
    if (!category) {
      void animate(x, 0, spring.snappy)
      return
    }
    void (async () => {
      await animate(x, direction * window.innerWidth, { duration: 0.18, ease: 'easeIn' })
      // Not filed (an error, or another filing was still running): the card comes back.
      if (!(await onFile(category))) void animate(x, 0, spring.snappy)
    })()
  }

  const onDragEnd = (_: unknown, info: PanInfo) => {
    window.setTimeout(() => {
      dragging.current = false
    }, 0)
    const far = Math.abs(info.offset.x) > SWIPE_DISTANCE
    const fast = Math.abs(info.velocity.x) > SWIPE_VELOCITY
    if (far || fast) return info.offset.x > 0 ? fileTo(right, 1) : fileTo(left, -1)
    void animate(x, 0, spring.snappy)
  }

  const swallowClick = (event: MouseEvent) => {
    const displaced = Math.abs(x.get()) > REST_TOLERANCE
    if (!dragging.current && !displaced) return
    event.preventDefault()
    event.stopPropagation()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'ArrowRight') fileTo(right, 1)
    else if (event.key === 'ArrowLeft') fileTo(left, -1)
    else return
    event.preventDefault()
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
        <EdgeTarget category={left} side="left" x={x} onClick={() => fileTo(left, -1)} />
        <EdgeTarget category={right} side="right" x={x} onClick={() => fileTo(right, 1)} />
      </div>

      <div className="grid [grid-template-areas:'stack']">
        {next ? (
          <div
            aria-hidden
            className="flex scale-95 flex-col items-center justify-center rounded-lg border bg-surface-1 opacity-50 [grid-area:stack]"
          >
            <span className="text-h1 text-fg-muted tabular-nums">
              {formatAUD(-next.amountCents)}
            </span>
          </div>
        ) : null}
        <m.div
          drag="x"
          dragDirectionLock
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.8}
          onDragStart={() => {
            dragging.current = true
          }}
          onDragEnd={onDragEnd}
          onClickCapture={swallowClick}
          onKeyDown={onKeyDown}
          style={{ x, rotate, touchAction: 'pan-y' }}
          tabIndex={0}
          role="group"
          aria-roledescription="Buchung"
          aria-label={`${merchant}, ${formatAUD(amountCents)}`}
          aria-keyshortcuts="ArrowLeft ArrowRight"
          className="relative z-10 flex cursor-grab flex-col items-center gap-1 rounded-lg border bg-surface-1 px-4 pt-6 pb-4 text-center shadow-lg outline-none [grid-area:stack] focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
        >
          <Money cents={amountCents} className="text-display" />
          <p className="max-w-full text-h2 break-words">{merchant}</p>
          <p className="text-label text-fg-muted">{formatDayLabel(purchaseDay(tx), today)}</p>
          <p className="mt-3 w-full border-t border-dashed pt-3 text-caption break-words text-fg-subtle">
            {tx.description}
          </p>
          {closedWeek ? (
            <p className="w-full rounded-md bg-warning-soft px-3 py-2 text-label">
              Woche {formatWeekRange(closedWeek)} ist abgeschlossen – ihr Gespartes sinkt um{' '}
              <Money cents={amountCents} />.
            </p>
          ) : null}
          {maybeEntered ? (
            <button
              type="button"
              onClick={onDetails}
              className="min-h-11 w-full rounded-md bg-income-soft px-3 py-2 text-label font-medium text-income outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Vielleicht schon erfasst – ansehen
            </button>
          ) : null}
        </m.div>
      </div>
    </div>
  )
}
