import { CalendarDays, ChevronDown, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useEffectEvent, useState } from 'react'
import {
  amountInputToCents,
  applyNumpadKey,
  formatAmountInput,
  type NumpadKey,
} from '@/lib/amountInput'
import { formatDayLabel } from '@/lib/dates'
import type { Category, Cents, ISODate } from '@/lib/types'
import { CategoryIcon } from '@/shared/components/CategoryIcon'
import { Numpad } from '@/shared/components/Numpad'
import { TagInput } from '@/shared/components/TagInput'
import { cn } from '@/shared/lib/utils'
import { spring } from '@/shared/motion'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'

export interface ExpenseFormValues {
  /** Raw numpad text, e.g. '12,5'. */
  amountInput: string
  categoryId: string | null
  date: ISODate
  note: string
  tags: string[]
}

export interface ExpenseFormResult {
  amountCents: Cents
  categoryId: string
  date: ISODate
  note: string | undefined
  tags: string[]
}

export interface ExpenseFormProps {
  initial: ExpenseFormValues
  categories: readonly Category[]
  tagVocabulary: readonly string[]
  today: ISODate
  submitLabel: string
  onSubmit: (result: ExpenseFormResult) => void | Promise<void>
  /** Shows a delete button (edit mode). */
  onDelete?: () => void
}

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)

/**
 * Amount → category → save. The amount is plain text driven by the custom numpad (no <input>,
 * so the iOS keyboard stays away); date, note and tags hide behind "Details" and sit ABOVE the
 * numpad, so the system keyboard never covers the field being edited.
 */
export function ExpenseForm({
  initial,
  categories,
  tagVocabulary,
  today,
  submitLabel,
  onSubmit,
  onDelete,
}: ExpenseFormProps) {
  const [values, setValues] = useState(initial)
  const [detailsOpen, setDetailsOpen] = useState(
    initial.note !== '' || initial.tags.length > 0 || initial.date !== today,
  )
  const [submitting, setSubmitting] = useState(false)

  const amountCents = amountInputToCents(values.amountInput)
  const canSubmit = amountCents > 0 && values.categoryId !== null && !submitting
  const patch = (next: Partial<ExpenseFormValues>) =>
    setValues((current) => ({ ...current, ...next }))
  const pressKey = (key: NumpadKey) =>
    setValues((current) => ({ ...current, amountInput: applyNumpadKey(current.amountInput, key) }))

  const submit = async () => {
    if (!canSubmit || values.categoryId === null) return
    setSubmitting(true)
    try {
      await onSubmit({
        amountCents,
        categoryId: values.categoryId,
        date: values.date,
        note: values.note.trim() === '' ? undefined : values.note.trim(),
        tags: values.tags,
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Hardware keyboard (MacBook): type the amount directly, Enter saves.
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return
    if (/^\d$/.test(event.key)) pressKey(event.key as NumpadKey)
    else if (event.key === ',' || event.key === '.') pressKey(',')
    else if (event.key === 'Backspace') pressKey('backspace')
    else if (event.key === 'Enter') void submit()
    else return
    event.preventDefault()
  })
  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <p
        aria-live="polite"
        aria-label="Betrag"
        className={cn(
          'py-1 text-center text-display tabular-nums transition-colors',
          amountCents > 0 ? 'text-fg' : 'text-fg-subtle',
        )}
      >
        {formatAmountInput(values.amountInput)}
      </p>

      <button
        type="button"
        onClick={() => setDetailsOpen((open) => !open)}
        aria-expanded={detailsOpen}
        className="mx-auto flex h-9 items-center gap-2 rounded-full bg-surface-3 px-4 text-label text-fg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <CalendarDays className="size-4" aria-hidden />
        {formatDayLabel(values.date, today)}
        <span aria-hidden>·</span>
        Details
        <ChevronDown
          className={cn('size-4 transition-transform', detailsOpen && 'rotate-180')}
          aria-hidden
        />
      </button>

      <AnimatePresence initial={false}>
        {detailsOpen ? (
          <motion.div
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring.soft}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 p-0.5">
              <Input
                value={values.note}
                onChange={(event) => patch({ note: event.target.value })}
                placeholder="Notiz (z. B. Woolworths)"
                aria-label="Notiz"
                maxLength={80}
                enterKeyHint="done"
                className="h-11 rounded-md"
              />
              <TagInput
                value={values.tags}
                onChange={(tags) => patch({ tags })}
                vocabulary={tagVocabulary}
              />
              <Input
                type="date"
                value={values.date}
                max={today}
                onChange={(event) =>
                  event.target.value !== '' && patch({ date: event.target.value })
                }
                aria-label="Datum"
                className="h-11 rounded-md"
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div role="radiogroup" aria-label="Kategorie" className="grid grid-cols-5 gap-x-1 gap-y-2">
        {categories.map((category) => {
          const selected = values.categoryId === category.id
          return (
            <motion.button
              key={category.id}
              type="button"
              role="radio"
              aria-checked={selected}
              whileTap={{ scale: 0.94 }}
              transition={spring.snappy}
              onClick={() => patch({ categoryId: category.id })}
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

      <Numpad onKey={pressKey} />

      <div className="flex gap-2">
        {onDelete ? (
          <Button
            type="button"
            variant="destructive"
            size="icon-touch"
            onClick={onDelete}
            aria-label="Ausgabe löschen"
          >
            <Trash2 aria-hidden />
          </Button>
        ) : null}
        <Button
          type="button"
          size="touch"
          className="flex-1"
          disabled={!canSubmit}
          onClick={() => void submit()}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}
