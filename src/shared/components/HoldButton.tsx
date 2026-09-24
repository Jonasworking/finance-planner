import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

export interface HoldButtonProps {
  onConfirm: () => void
  children: ReactNode
  /** How long it has to be held. */
  durationMs?: number
  disabled?: boolean
  className?: string
}

/**
 * For what cannot be undone: the action fires only after the button was held down for
 * `durationMs` – a fill shows the progress, letting go early cancels. Works with a finger, a
 * mouse and the keyboard (hold Space or Enter). A single tap only explains what to do.
 */
export function HoldButton({
  onConfirm,
  children,
  durationMs = 1500,
  disabled,
  className,
}: HoldButtonProps) {
  const [holding, setHolding] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancel = () => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
    setHolding(false)
  }
  const start = () => {
    if (disabled || timer.current !== null) return
    setHolding(true)
    timer.current = setTimeout(() => {
      timer.current = null
      setHolding(false)
      onConfirm()
    }, durationMs)
  }
  useEffect(() => cancel, [])

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture?.(event.pointerId)
        start()
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onLostPointerCapture={cancel}
      onKeyDown={(event) => {
        if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
          event.preventDefault()
          start()
        }
      }}
      onKeyUp={(event) => {
        if (event.key === ' ' || event.key === 'Enter') cancel()
      }}
      onBlur={cancel}
      onContextMenu={(event) => event.preventDefault()}
      className={cn(
        'relative isolate flex h-11 w-full touch-none items-center justify-center overflow-hidden rounded-md bg-danger/15 px-4 font-semibold text-danger outline-none select-none',
        'focus-visible:ring-3 focus-visible:ring-danger/40 disabled:opacity-50',
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 -z-10 bg-danger/35"
        style={{
          width: holding ? '100%' : '0%',
          transition: holding ? `width ${durationMs}ms linear` : 'none',
        }}
      />
      {children}
    </button>
  )
}
