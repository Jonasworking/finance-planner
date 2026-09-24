import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
import { m } from 'motion/react'
import { useId } from 'react'
import { cn } from '@/shared/lib/utils'
import { spring } from '@/shared/motion'
import { useThemeStore, type ThemePreference } from '@/shared/stores/themeStore'

const options: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: 'dark', label: 'Dunkel', icon: Moon },
  { value: 'light', label: 'Hell', icon: Sun },
  { value: 'system', label: 'System', icon: Monitor },
]

export function ThemeToggle({ className }: { className?: string }) {
  const preference = useThemeStore((state) => state.preference)
  const setPreference = useThemeStore((state) => state.setPreference)
  const indicatorId = useId()

  return (
    <div
      role="radiogroup"
      aria-label="Farbschema"
      className={cn('grid grid-cols-3 rounded-md bg-surface-3 p-1', className)}
    >
      {options.map(({ value, label, icon: Icon }) => {
        const active = preference === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setPreference(value)}
            className={cn(
              'relative flex h-9 min-w-0 items-center justify-center gap-1 rounded-sm px-1 text-label outline-none',
              'transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
              active ? 'text-fg' : 'text-fg-muted hover:text-fg',
            )}
          >
            {active ? (
              <m.span
                layoutId={indicatorId}
                transition={spring.snappy}
                className="absolute inset-0 rounded-sm bg-surface-1 shadow-card"
              />
            ) : null}
            <Icon className="relative size-4" aria-hidden />
            <span className="relative">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
