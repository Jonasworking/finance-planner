import { Delete } from 'lucide-react'
import { m } from 'motion/react'
import type { NumpadKey } from '@/lib/amountInput'
import { cn } from '@/shared/lib/utils'
import { spring } from '@/shared/motion'

const KEYS: NumpadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'backspace']

export interface NumpadProps {
  onKey: (key: NumpadKey) => void
  className?: string
}

/**
 * Custom amount keypad. The amount itself is rendered as plain text by the caller – there is no
 * <input>, so the iOS keyboard never opens. Keys react on pointerdown (no 300 ms tap delay,
 * no double-tap zoom) and scale down as haptic-like feedback.
 */
export function Numpad({ onKey, className }: NumpadProps) {
  return (
    <div role="group" aria-label="Ziffernblock" className={cn('grid grid-cols-3 gap-2', className)}>
      {KEYS.map((key) => (
        <m.button
          key={key}
          type="button"
          whileTap={{ scale: 0.94 }}
          transition={spring.snappy}
          aria-label={key === 'backspace' ? 'Löschen' : key === ',' ? 'Komma' : key}
          onPointerDown={(event) => {
            // Keep focus where it is and handle the key right away.
            event.preventDefault()
            onKey(key)
          }}
          // Keyboard and assistive tech activate buttons via click, not pointerdown.
          onClick={(event) => {
            if (event.detail === 0) onKey(key)
          }}
          className="grid h-14 touch-manipulation place-items-center rounded-md bg-surface-3 text-h1 font-medium tabular-nums outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {key === 'backspace' ? <Delete className="size-6" aria-hidden /> : key}
        </m.button>
      ))}
    </div>
  )
}
