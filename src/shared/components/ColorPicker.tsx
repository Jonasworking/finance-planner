import { CATEGORY_COLORS, solidClass } from '@/shared/lib/categoryStyle'
import { cn } from '@/shared/lib/utils'

export interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
}

/** The ten category colors as swatches – used for categories and pots alike. */
export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <fieldset>
      <legend className="pb-2 text-caption text-fg-subtle uppercase">Farbe</legend>
      <div className="flex flex-wrap gap-2.5">
        {CATEGORY_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Farbe ${color.replace('cat-', '')}`}
            aria-pressed={value === color}
            onClick={() => onChange(color)}
            className={cn(
              'size-9 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              solidClass(color),
              value === color && 'ring-2 ring-fg ring-offset-2 ring-offset-surface-2',
            )}
          />
        ))}
      </div>
    </fieldset>
  )
}
