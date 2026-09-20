import { createElement } from 'react'
import { chipClass, iconFor } from '@/shared/lib/categoryStyle'
import { cn } from '@/shared/lib/utils'

export interface CategoryIconProps {
  icon: string
  color: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZES = {
  sm: { box: 'size-9 rounded-sm', icon: 'size-4.5' },
  md: { box: 'size-11 rounded-md', icon: 'size-5' },
  lg: { box: 'size-14 rounded-md', icon: 'size-6' },
}

/** Tinted rounded tile with the category's (or pot's) icon. */
export function CategoryIcon({ icon, color, size = 'md', className }: CategoryIconProps) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center',
        SIZES[size].box,
        chipClass(color),
        className,
      )}
    >
      {/* The icon is looked up in a static registry by name – not a component created here. */}
      {createElement(iconFor(icon), {
        className: SIZES[size].icon,
        strokeWidth: 1.75,
        'aria-hidden': true,
      })}
    </span>
  )
}
