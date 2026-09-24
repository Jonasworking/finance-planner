import { Slider as SliderPrimitive } from 'radix-ui'
import { formatAUD, type Cents } from '@/lib/money'
import { cn } from '@/shared/lib/utils'

type SliderTone = 'saved' | 'warning' | 'spent'

const rangeClass: Record<SliderTone, string> = {
  saved: 'bg-saved',
  warning: 'bg-warning',
  spent: 'bg-spent',
}

export interface AmountSliderProps {
  valueCents: Cents
  maxCents: Cents
  stepCents: Cents
  onValueChange: (cents: Cents) => void
  'aria-label': string
  /** What a screen reader says for the value (default: the amount, "A$20"). */
  valueText?: (cents: Cents) => string
  tone?: SliderTone
  className?: string
}

/**
 * Slider for money amounts, built for thumbs: a 28 px grip inside a 44 px hit area (the
 * generated shadcn slider has a 12 px one). Arrow keys move one step, Page Up/Down ten.
 */
export function AmountSlider({
  valueCents,
  maxCents,
  stepCents,
  onValueChange,
  tone = 'saved',
  valueText = (cents) => formatAUD(cents, { decimals: cents % 100 !== 0 }),
  className,
  ...aria
}: AmountSliderProps) {
  return (
    <SliderPrimitive.Root
      value={[Math.min(valueCents, maxCents)]}
      min={0}
      max={maxCents}
      step={stepCents}
      onValueChange={([next]) => next !== undefined && onValueChange(next)}
      className={cn('relative flex h-11 w-full touch-none items-center select-none', className)}
    >
      <SliderPrimitive.Track className="relative h-2 grow overflow-hidden rounded-full bg-surface-3">
        <SliderPrimitive.Range className={cn('absolute h-full', rangeClass[tone])} />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        {...aria}
        aria-valuetext={valueText(Math.min(valueCents, maxCents))}
        className="relative block size-7 rounded-full border border-border-strong bg-fg shadow-card outline-none after:absolute after:-inset-2 focus-visible:ring-3 focus-visible:ring-ring/50"
      />
    </SliderPrimitive.Root>
  )
}
