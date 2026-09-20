import { Trash2 } from 'lucide-react'
import { animate, motion, useMotionValue, useTransform, type PanInfo } from 'motion/react'
import { useRef, type MouseEvent, type ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'
import { spring } from '@/shared/motion'

const REVEAL = 88
const DELETE_DISTANCE = 140
const DELETE_VELOCITY = 600
/** Below this offset the row counts as "at rest" and taps go through to the content. */
const REST_TOLERANCE = 4

export interface SwipeRowProps {
  children: ReactNode
  /** Called after the row was swiped away. Pair it with an undo toast. */
  onDelete: () => void
  deleteLabel?: string
  className?: string
}

/**
 * Swipe left to delete. Horizontal drags are direction-locked, so vertical scrolling still
 * works (`touch-action: pan-y`). A short swipe reveals the delete button (also the accessible
 * path – it is a real button), a long or fast swipe deletes right away.
 */
export function SwipeRow({
  children,
  onDelete,
  deleteLabel = 'Löschen',
  className,
}: SwipeRowProps) {
  const x = useMotionValue(0)
  const actionOpacity = useTransform(x, [-REVEAL, -24, 0], [1, 0.4, 0])
  const iconScale = useTransform(x, [-DELETE_DISTANCE, -REVEAL, 0], [1.25, 1, 0.8])
  const dragging = useRef(false)

  const dismiss = () => {
    void animate(x, -window.innerWidth, { duration: 0.18, ease: 'easeIn' }).then(onDelete)
  }

  const onDragEnd = (_: unknown, info: PanInfo) => {
    // The browser still fires a click on the content after pointerup – keep the flag until then.
    window.setTimeout(() => {
      dragging.current = false
    }, 0)
    if (info.offset.x < -DELETE_DISTANCE || info.velocity.x < -DELETE_VELOCITY) return dismiss()
    void animate(x, info.offset.x < -REVEAL / 2 ? -REVEAL : 0, spring.snappy)
  }

  /**
   * A swipe must never count as a tap: without this, releasing the drag "clicks" the row and
   * opens it (which for a swipe-delete meant an empty edit sheet covering the undo toast).
   * Tapping a row whose delete button is revealed just closes it again.
   */
  const swallowClick = (event: MouseEvent) => {
    const displaced = x.get() < -REST_TOLERANCE
    if (!dragging.current && !displaced) return
    event.preventDefault()
    event.stopPropagation()
    if (!dragging.current) void animate(x, 0, spring.snappy)
  }

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <motion.div
        style={{ opacity: actionOpacity }}
        className="absolute inset-y-0 right-0 flex bg-spent"
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label={deleteLabel}
          className="grid h-full place-items-center text-on-saved outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
          style={{ width: REVEAL }}
        >
          <motion.span style={{ scale: iconScale }}>
            <Trash2 className="size-5" aria-hidden />
          </motion.span>
        </button>
      </motion.div>

      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -DELETE_DISTANCE * 1.5, right: 0 }}
        dragElastic={{ left: 0.2, right: 0 }}
        onDragStart={() => {
          dragging.current = true
        }}
        onDragEnd={onDragEnd}
        onClickCapture={swallowClick}
        style={{ x, touchAction: 'pan-y' }}
        className="relative bg-surface-1"
      >
        {children}
      </motion.div>
    </div>
  )
}
