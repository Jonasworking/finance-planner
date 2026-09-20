import { createElement } from 'react'
import { CATEGORY_ICON_NAMES, iconFor } from '@/shared/lib/categoryStyle'
import { cn } from '@/shared/lib/utils'

export interface IconPickerProps {
  value: string
  onChange: (icon: string) => void
}

/** The curated icon registry as a scrollable grid – used for categories and pots alike. */
export function IconPicker({ value, onChange }: IconPickerProps) {
  return (
    <fieldset>
      <legend className="pb-2 text-caption text-fg-subtle uppercase">Icon</legend>
      <div className="grid max-h-44 grid-cols-7 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-8">
        {CATEGORY_ICON_NAMES.map((iconName) => (
          <button
            key={iconName}
            type="button"
            aria-label={iconName}
            aria-pressed={value === iconName}
            onClick={() => onChange(iconName)}
            className={cn(
              'grid aspect-square place-items-center rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              value === iconName ? 'bg-saved-soft text-saved' : 'bg-surface-3 text-fg-muted',
            )}
          >
            {/* Looked up in a static registry by name – not a component created here. */}
            {createElement(iconFor(iconName), {
              className: 'size-5',
              strokeWidth: 1.75,
              'aria-hidden': true,
            })}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
