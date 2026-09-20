import { CalendarDays, ChevronDown, PiggyBank, Trash2, Wallet } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useEffectEvent, useState } from 'react'
import {
  amountInputToCents,
  applyNumpadKey,
  formatAmountInput,
  type NumpadKey,
} from '@/lib/amountInput'
import { formatDayLabel } from '@/lib/dates'
import { formatAUD } from '@/lib/money'
import { availableForExpense } from '@/lib/pots'
import { validateWithdrawal } from '@/lib/savings'
import type { Category, Cents, Expense, ISODate, Pot } from '@/lib/types'
import { Numpad } from '@/shared/components/Numpad'
import { TagInput } from '@/shared/components/TagInput'
import { cn } from '@/shared/lib/utils'
import { spring } from '@/shared/motion'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { CategoryGrid } from './CategoryGrid'

export interface ExpenseFormValues {
  /** Raw numpad text, e.g. '12,5'. */
  amountInput: string
  categoryId: string | null
  date: ISODate
  note: string
  tags: string[]
  /** "Aus Topf bezahlt"; null/undefined = from the weekly budget. */
  fundedByPotId?: string | null
}

export interface ExpenseFormResult {
  amountCents: Cents
  categoryId: string
  date: ISODate
  note: string | undefined
  tags: string[]
  fundedByPotId: string | null
}

export interface ExpenseFormProps {
  initial: ExpenseFormValues
  categories: readonly Category[]
  tagVocabulary: readonly string[]
  /** Pots the expense can be paid from, with their balances. */
  pots?: readonly Pot[]
  potBalances?: Readonly<Record<string, Cents>>
  /** The stored expense in edit mode: what it already holds in its pot is available to it. */
  existing?: Expense | null
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
  pots = [],
  potBalances = {},
  existing = null,
  today,
  submitLabel,
  onSubmit,
  onDelete,
}: ExpenseFormProps) {
  const [values, setValues] = useState(initial)
  const [detailsOpen, setDetailsOpen] = useState(
    initial.note !== '' ||
      initial.tags.length > 0 ||
      initial.date !== today ||
      initial.fundedByPotId != null,
  )
  const [submitting, setSubmitting] = useState(false)

  const amountCents = amountInputToCents(values.amountInput)
  const fundingPot = pots.find((pot) => pot.id === values.fundedByPotId) ?? null
  const availableCents = fundingPot
    ? availableForExpense(potBalances, fundingPot.id, existing)
    : null
  // The repo's own rule, so the hint and the write can never disagree.
  const overdrawn =
    availableCents !== null &&
    amountCents > 0 &&
    validateWithdrawal({ pot: fundingPot, amountCents, balanceCents: availableCents }) ===
      'insufficient'
  const canSubmit = amountCents > 0 && values.categoryId !== null && !overdrawn && !submitting
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
        fundedByPotId: fundingPot?.id ?? null,
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
        {fundingPot ? `aus „${fundingPot.name}"` : 'Details'}
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
              {pots.length > 0 ? (
                <fieldset>
                  <legend className="pb-2 text-caption text-fg-subtle uppercase">
                    Bezahlt aus
                  </legend>
                  <div
                    role="radiogroup"
                    aria-label="Bezahlt aus"
                    className="flex flex-wrap gap-1.5"
                  >
                    {[null, ...pots].map((pot) => {
                      const selected = (pot?.id ?? null) === (fundingPot?.id ?? null)
                      const Icon = pot ? PiggyBank : Wallet
                      return (
                        <button
                          key={pot?.id ?? 'budget'}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => patch({ fundedByPotId: pot?.id ?? null })}
                          className={cn(
                            'flex h-9 max-w-full items-center gap-1.5 rounded-full border px-3.5 text-label outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                            selected
                              ? 'border-transparent bg-saved text-on-saved'
                              : 'text-fg-muted',
                          )}
                        >
                          <Icon className="size-4 shrink-0" aria-hidden />
                          <span className="truncate">{pot ? pot.name : 'Wochenbudget'}</span>
                        </button>
                      )
                    })}
                  </div>
                  {fundingPot && availableCents !== null ? (
                    <p
                      role={overdrawn ? 'alert' : undefined}
                      className={cn('pt-2 text-label', overdrawn ? 'text-spent' : 'text-fg-muted')}
                    >
                      {overdrawn
                        ? `In „${fundingPot.name}" sind nur ${formatAUD(availableCents)}.`
                        : `Zählt nicht zum Wochenbudget · ${formatAUD(availableCents)} im Topf`}
                    </p>
                  ) : null}
                </fieldset>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <CategoryGrid
        categories={categories}
        value={values.categoryId}
        onChange={(categoryId) => patch({ categoryId })}
      />

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
