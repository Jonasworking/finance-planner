import { motion } from 'motion/react'
import type { Category } from '@/lib/types'
import { CategoryIcon } from '@/shared/components/CategoryIcon'
import { cn } from '@/shared/lib/utils'
import { spring } from '@/shared/motion'

export interface CategoryGridProps {
  categories: readonly Category[]
  value: string | null
  onChange: (categoryId: string) => void
}

/** Single-choice grid of category tiles (quick add, edit, standing orders). */
export function CategoryGrid({ categories, value, onChange }: CategoryGridProps) {
  return (
    <div role="radiogroup" aria-label="Kategorie" className="grid grid-cols-5 gap-x-1 gap-y-2">
      {categories.map((category) => {
        const selected = value === category.id
        return (
          <motion.button
            key={category.id}
            type="button"
            role="radio"
            aria-checked={selected}
            whileTap={{ scale: 0.94 }}
            transition={spring.snappy}
            onClick={() => onChange(category.id)}
            className="flex min-w-0 flex-col items-center gap-1 rounded-md py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <CategoryIcon
              icon={category.icon}
              color={category.color}
              className={cn(
                'transition-shadow',
                selected && 'ring-2 ring-saved ring-offset-2 ring-offset-surface-2',
              )}
            />
            <span
              className={cn(
                // Two lines with German hyphenation ("Lebens-mittel") instead of "Lebensmit…";
                // the fixed height keeps the grid rows aligned.
                'line-clamp-2 h-[26px] w-full text-center text-[11px] leading-[13px] break-words hyphens-auto',
                selected ? 'font-semibold text-fg' : 'text-fg-muted',
              )}
            >
              {category.name}
            </span>
          </motion.button>
        )
      })}
    </div>
  )
}
