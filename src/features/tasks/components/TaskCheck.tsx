import { m } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/shared/lib/utils'
import { spring, tap } from '@/shared/motion'

/** How long the tick is shown before the change is written and the row moves away. */
export const CHECK_COMMIT_DELAY_MS = 320

export interface TaskCheckProps {
  checked: boolean
  /** Accessible name, e.g. "„TFN beantragen" erledigen". */
  label: string
  onChange: (checked: boolean) => void
  className?: string
}

/**
 * The tick of a task. Ticking a task off shows the check first (bouncy spring, drawn stroke)
 * and commits a moment later – with live queries the row would otherwise jump to "Erledigt"
 * before the eye catches the animation. Unticking commits at once.
 */
export function TaskCheck({ checked, label, onChange, className }: TaskCheckProps) {
  const [pending, setPending] = useState(false)
  // Once the stored value catches up (or flips back), the optimistic tick has done its job.
  const [seenChecked, setSeenChecked] = useState(checked)
  if (checked !== seenChecked) {
    setSeenChecked(checked)
    setPending(false)
  }
  const timer = useRef<number | null>(null)
  const shown = checked || pending

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  const toggle = () => {
    if (shown) {
      if (timer.current !== null) window.clearTimeout(timer.current)
      timer.current = null
      setPending(false)
      if (checked) onChange(false)
      return
    }
    setPending(true)
    timer.current = window.setTimeout(() => {
      timer.current = null
      onChange(true)
    }, CHECK_COMMIT_DELAY_MS)
  }

  return (
    <m.button
      type="button"
      role="checkbox"
      aria-checked={shown}
      aria-label={label}
      whileTap={tap}
      onClick={toggle}
      className={cn(
        'grid size-11 shrink-0 place-items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        className,
      )}
    >
      <span
        className={cn(
          'grid size-6 place-items-center rounded-full border-2 transition-colors duration-200',
          shown ? 'border-saved bg-saved text-on-saved' : 'border-fg-subtle bg-transparent',
        )}
      >
        {/* The bouncy spring overshoots on its way to 1 – that overshoot is the "pop". */}
        <m.svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          aria-hidden
          initial={false}
          animate={{ scale: shown ? 1 : 0.4, opacity: shown ? 1 : 0 }}
          transition={spring.bouncy}
        >
          <m.path
            d="M5 12.5l4.5 4.5L19 7.5"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: shown ? 1 : 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          />
        </m.svg>
      </span>
    </m.button>
  )
}
