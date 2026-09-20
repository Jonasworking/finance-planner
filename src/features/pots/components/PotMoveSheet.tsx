import { ArrowDownUp } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { repos } from '@/db'
import { transferTxIds } from '@/lib/ids'
import { formatAUD } from '@/lib/money'
import { validateDeposit, validateTransfer, validateWithdrawal } from '@/lib/savings'
import { PRIMARY_POT_ID, type Cents, type ISODate, type Pot } from '@/lib/types'
import { MoneyInput } from '@/shared/components/MoneyInput'
import { ResponsiveSheet } from '@/shared/components/ResponsiveSheet'
import { errorMessage } from '@/shared/lib/errorMessages'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'

export type PotMoveMode = 'deposit' | 'withdraw' | 'transfer'

const COPY: Record<PotMoveMode, { title: string; description: string; submit: string }> = {
  deposit: {
    title: 'Einzahlen',
    description: 'Geld von außerhalb – z. B. ein Geschenk oder eine Rückzahlung.',
    submit: 'Einzahlen',
  },
  withdraw: {
    title: 'Auszahlen',
    description: 'Geld verlässt den Topf, ohne eine Ausgabe zu sein.',
    submit: 'Auszahlen',
  },
  transfer: {
    title: 'Umbuchen',
    description: 'Von einem Topf in einen anderen – dein Gespartes bleibt gleich.',
    submit: 'Umbuchen',
  },
}

interface PotMoveFormProps {
  mode: PotMoveMode
  /** The pot whose screen the sheet was opened from. */
  pot: Pot
  /** Every pot money can move between (active, not archived), incl. `pot`. */
  pots: readonly Pot[]
  balances: Readonly<Record<string, Cents>>
  today: ISODate
  onDone: () => void
}

const selectClass =
  'h-11 w-full min-w-0 rounded-md border border-border-strong bg-surface-1 px-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

function PotMoveForm({ mode, pot, pots, balances, today, onDone }: PotMoveFormProps) {
  const others = pots.filter((other) => other.id !== pot.id)
  // Filling a goal from "Nur gespart" is the usual move, so that is the default direction.
  const [fromId, setFromId] = useState(
    pot.id === PRIMARY_POT_ID ? pot.id : (others[0]?.id ?? pot.id),
  )
  const [toId, setToId] = useState(pot.id === PRIMARY_POT_ID ? (others[0]?.id ?? pot.id) : pot.id)
  const [amountCents, setAmountCents] = useState<Cents | null>(null)
  const [date, setDate] = useState<ISODate>(today)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const sourceId = mode === 'transfer' ? fromId : pot.id
  const available = balances[sourceId] ?? 0
  const potById = (id: string) => pots.find((row) => row.id === id)
  const nameOf = (id: string) => potById(id)?.name ?? 'Topf'
  // The same rules the repo enforces – so the hint and the write can never disagree.
  const problem =
    amountCents === null
      ? null
      : mode === 'deposit'
        ? validateDeposit({ pot, amountCents })
        : mode === 'withdraw'
          ? validateWithdrawal({ pot, amountCents, balanceCents: available })
          : validateTransfer({
              from: potById(fromId),
              to: potById(toId),
              amountCents,
              fromBalanceCents: available,
            })
  const valid = amountCents !== null && problem === null
  const trimmedNote = note.trim() === '' ? undefined : note.trim()

  const submit = async () => {
    if (!valid || amountCents === null) return
    setBusy(true)
    try {
      let undoId: string
      let message: string
      if (mode === 'deposit') {
        undoId = (await repos.pots.deposit(pot.id, amountCents, date, trimmedNote)).id
        message = `${formatAUD(amountCents)} in „${pot.name}" eingezahlt`
      } else if (mode === 'withdraw') {
        undoId = (await repos.pots.withdraw(pot.id, amountCents, date, trimmedNote)).id
        message = `${formatAUD(amountCents)} aus „${pot.name}" ausgezahlt`
      } else {
        const transferId = await repos.pots.transfer({
          fromPotId: fromId,
          toPotId: toId,
          amountCents,
          date,
          note: trimmedNote,
        })
        undoId = transferTxIds(transferId).out
        message = `${formatAUD(amountCents)} nach „${nameOf(toId)}" umgebucht`
      }
      onDone()
      toast.success(message, {
        action: {
          label: 'Rückgängig',
          onClick: () => {
            repos.pots.removeTransaction(undoId).catch((error) => toast.error(errorMessage(error)))
          },
        },
      })
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <MoneyInput
        defaultValue={null}
        onValueChange={setAmountCents}
        aria-label="Betrag"
        size="lg"
      />
      {mode === 'deposit' ? null : (
        <p className="text-label text-fg-muted">
          Verfügbar in „{nameOf(sourceId)}": {formatAUD(available)}
        </p>
      )}
      {problem === 'insufficient' || problem === 'same-pot' ? (
        <p role="alert" className="text-label text-spent">
          {errorMessage({ code: problem })}
        </p>
      ) : null}

      {mode === 'transfer' ? (
        <div className="flex items-end gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-caption text-fg-subtle uppercase">Von</span>
              <select
                value={fromId}
                onChange={(event) => setFromId(event.target.value)}
                className={selectClass}
              >
                {pots.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} · {formatAUD(balances[option.id] ?? 0)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-caption text-fg-subtle uppercase">Nach</span>
              <select
                value={toId}
                onChange={(event) => setToId(event.target.value)}
                className={selectClass}
              >
                {pots.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} · {formatAUD(balances[option.id] ?? 0)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="icon-touch"
            className="mb-7"
            onClick={() => {
              setFromId(toId)
              setToId(fromId)
            }}
            aria-label="Richtung tauschen"
          >
            <ArrowDownUp aria-hidden />
          </Button>
        </div>
      ) : null}

      <Input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Notiz (optional)"
        aria-label="Notiz"
        maxLength={60}
        enterKeyHint="done"
        className="h-11 rounded-md"
      />
      <Input
        type="date"
        value={date}
        max={today}
        onChange={(event) => event.target.value !== '' && setDate(event.target.value)}
        aria-label="Datum"
        className="h-11 rounded-md"
      />

      <Button type="button" size="touch" disabled={!valid || busy} onClick={() => void submit()}>
        {COPY[mode].submit}
      </Button>
    </div>
  )
}

export interface PotMoveSheetProps extends Omit<PotMoveFormProps, 'onDone'> {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Changes per opening, so the form starts fresh each time. */
  session: number
}

export function PotMoveSheet({ open, onOpenChange, session, ...form }: PotMoveSheetProps) {
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={COPY[form.mode].title}
      description={COPY[form.mode].description}
    >
      <PotMoveForm key={session} {...form} onDone={() => onOpenChange(false)} />
    </ResponsiveSheet>
  )
}
