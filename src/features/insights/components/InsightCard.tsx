import { ChevronRight, X } from 'lucide-react'
import { animate, m, useMotionValue, useTransform, type PanInfo } from 'motion/react'
import { useRef, type MouseEvent } from 'react'
import { Link } from 'react-router'
import type { Insight, InsightSeverity } from '@/lib/insights'
import { CategoryIcon } from '@/shared/components/CategoryIcon'
import { GlassCard } from '@/shared/components/GlassCard'
import { cn } from '@/shared/lib/utils'
import { spring } from '@/shared/motion'
import { useUiStore } from '@/shared/stores/uiStore'
import type { InsightCopy } from '../insightCopy'

const DISMISS_DISTANCE = 120
const DISMISS_VELOCITY = 600
/** Below this offset the card counts as "at rest" and taps go through to its content. */
const REST_TOLERANCE = 4

const toneClass: Record<InsightSeverity, string> = {
  positive: 'bg-saved-soft text-saved',
  warning: 'bg-warning/15 text-warning',
  info: 'bg-income-soft text-income',
}

export interface InsightCardProps {
  insight: Insight
  copy: InsightCopy
  onDismiss: (insight: Insight) => void
}

/**
 * One insight. Swipe it away in either direction (vertical scrolling stays free); the "X" is the
 * accessible path. Like SwipeRow it swallows the click the browser fires after a drag – otherwise
 * letting go of a half-swiped card would follow its link.
 */
export function InsightCard({ insight, copy, onDismiss }: InsightCardProps) {
  const openEurRate = useUiStore((state) => state.openEurRate)
  const x = useMotionValue(0)
  const opacity = useTransform(x, [-DISMISS_DISTANCE * 2, 0, DISMISS_DISTANCE * 2], [0.2, 1, 0.2])
  const dragging = useRef(false)

  const flyOut = (direction: 1 | -1) => {
    void animate(x, direction * window.innerWidth, { duration: 0.18, ease: 'easeIn' }).then(() =>
      onDismiss(insight),
    )
  }

  const onDragEnd = (_: unknown, info: PanInfo) => {
    window.setTimeout(() => {
      dragging.current = false
    }, 0)
    const far = Math.abs(info.offset.x) > DISMISS_DISTANCE
    const fast = Math.abs(info.velocity.x) > DISMISS_VELOCITY
    if (far || fast) return flyOut(info.offset.x < 0 ? -1 : 1)
    void animate(x, 0, spring.snappy)
  }

  const swallowClick = (event: MouseEvent) => {
    // Still flying out (or springing back) counts as well – the click may arrive a frame later.
    const displaced = Math.abs(x.get()) > REST_TOLERANCE
    if (!dragging.current && !displaced) return
    event.preventDefault()
    event.stopPropagation()
  }

  const { icon: Icon, chip, title, text, action } = copy

  return (
    <m.div
      drag="x"
      dragDirectionLock
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragStart={() => {
        dragging.current = true
      }}
      onDragEnd={onDragEnd}
      onClickCapture={swallowClick}
      style={{ x, opacity, touchAction: 'pan-y' }}
      role="article"
      aria-label={title}
    >
      <GlassCard className="flex items-start gap-3">
        {chip ? (
          <CategoryIcon icon={chip.icon} color={chip.color} />
        ) : (
          <span
            className={cn(
              'grid size-11 shrink-0 place-items-center rounded-md',
              toneClass[insight.severity],
            )}
          >
            <Icon className="size-5" aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium">{title}</p>
          <p className="pt-0.5 text-label text-fg-muted">{text}</p>
          {action ? (
            'to' in action ? (
              <Link
                to={action.to}
                className="mt-2 inline-flex min-h-8 items-center gap-0.5 rounded-sm text-label font-medium text-fg outline-none hover:text-saved focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {action.label}
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => openEurRate()}
                className="mt-2 inline-flex min-h-8 items-center gap-0.5 rounded-sm text-label font-medium text-fg outline-none hover:text-saved focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {action.label}
                <ChevronRight className="size-4" aria-hidden />
              </button>
            )
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => flyOut(1)}
          aria-label={`Hinweis ausblenden: ${title}`}
          className="-mt-2 -mr-2 grid size-11 shrink-0 place-items-center rounded-full text-fg-subtle outline-none hover:bg-surface-3 hover:text-fg focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X className="size-5" aria-hidden />
        </button>
      </GlassCard>
    </m.div>
  )
}
