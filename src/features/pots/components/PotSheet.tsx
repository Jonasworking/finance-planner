import { Archive, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { repos } from '@/db'
import { PRIMARY_POT_ID, type Cents, type ISODate, type Pot } from '@/lib/types'
import { CategoryIcon } from '@/shared/components/CategoryIcon'
import { ColorPicker } from '@/shared/components/ColorPicker'
import { IconPicker } from '@/shared/components/IconPicker'
import { MoneyInput } from '@/shared/components/MoneyInput'
import { ResponsiveSheet } from '@/shared/components/ResponsiveSheet'
import { errorMessage } from '@/shared/lib/errorMessages'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'

interface PotFormProps {
  /** null = create a new pot. */
  pot: Pot | null
  /** Balance of the pot being edited – only an empty pot can be archived. */
  balanceCents: Cents
  today: ISODate
  onDone: (created?: Pot) => void
}

function PotForm({ pot, balanceCents, today, onDone }: PotFormProps) {
  const [name, setName] = useState(pot?.name ?? '')
  const [targetCents, setTargetCents] = useState<Cents | null>(pot?.targetCents ?? null)
  const [deadline, setDeadline] = useState<ISODate | null>(pot?.deadline ?? null)
  const [color, setColor] = useState(pot?.color ?? 'cat-5')
  const [icon, setIcon] = useState(pot?.icon ?? 'Plane')
  const [busy, setBusy] = useState(false)

  const isPrimary = pot?.id === PRIMARY_POT_ID
  const valid = name.trim() !== ''

  const run = async (work: () => Promise<Pot | void>, message: string) => {
    setBusy(true)
    try {
      const result = await work()
      onDone(result ?? undefined)
      toast.success(message)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const save = () => {
    if (!valid) return
    const values = { name: name.trim(), targetCents, deadline, color, icon }
    return run(
      () => (pot ? repos.pots.update(pot.id, values) : repos.pots.create(values)),
      pot ? 'Topf gespeichert' : `„${values.name}" angelegt`,
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <CategoryIcon icon={icon} color={color} size="lg" />
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Wofür sparst du? (z. B. Bali)"
          aria-label="Name"
          maxLength={28}
          enterKeyHint="done"
          className="h-11 rounded-md"
        />
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-caption text-fg-subtle uppercase">Ziel (optional)</span>
        <MoneyInput
          defaultValue={targetCents}
          onValueChange={(cents) => setTargetCents(cents !== null && cents > 0 ? cents : null)}
          aria-label="Zielbetrag"
          placeholder="ohne Ziel"
        />
      </label>

      <div className="flex flex-col gap-2">
        <label htmlFor="pot-deadline" className="text-caption text-fg-subtle uppercase">
          Bis wann? (optional)
        </label>
        <div className="flex gap-2">
          <Input
            id="pot-deadline"
            type="date"
            value={deadline ?? ''}
            min={today}
            onChange={(event) => setDeadline(event.target.value === '' ? null : event.target.value)}
            className="h-11 min-w-0 flex-1 rounded-md"
          />
          {deadline ? (
            <Button
              type="button"
              variant="secondary"
              size="icon-touch"
              onClick={() => setDeadline(null)}
              aria-label="Deadline entfernen"
            >
              <X aria-hidden />
            </Button>
          ) : null}
        </div>
        <span className="text-label text-fg-muted">
          Mit Ziel und Datum zeigt der Topf, was pro Woche nötig ist.
        </span>
      </div>

      {/* "Nur gespart" keeps its mint identity – it is the pot every week close books into. */}
      {isPrimary ? null : (
        <>
          <ColorPicker value={color} onChange={setColor} />
          <IconPicker value={icon} onChange={setIcon} />
        </>
      )}

      {pot && !isPrimary && !pot.archived ? (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="secondary"
            size="touch"
            disabled={busy || balanceCents !== 0}
            onClick={() => void run(() => repos.pots.archive(pot.id), 'Topf archiviert')}
          >
            <Archive aria-hidden />
            Archivieren
          </Button>
          {balanceCents !== 0 ? (
            <p className="text-label text-fg-muted">
              Nur ein leerer Topf lässt sich archivieren – zahl den Rest aus oder buch ihn um.
            </p>
          ) : null}
        </div>
      ) : null}

      <Button type="button" size="touch" disabled={!valid || busy} onClick={() => void save()}>
        {pot ? 'Speichern' : 'Topf anlegen'}
      </Button>
    </div>
  )
}

export interface PotSheetProps extends Omit<PotFormProps, 'onDone'> {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Changes per opening, so the form starts fresh each time. */
  session: number
  /** Called with the new pot after "anlegen". */
  onCreated?: (pot: Pot) => void
}

export function PotSheet({ open, onOpenChange, session, onCreated, ...form }: PotSheetProps) {
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={form.pot ? 'Topf bearbeiten' : 'Neuer Spartopf'}
      description={
        form.pot ? undefined : 'Ein Topf für ein Ziel – gefüllt durch Umbuchen oder Einzahlen.'
      }
    >
      <PotForm
        key={session}
        {...form}
        onDone={(created) => {
          onOpenChange(false)
          if (created && !form.pot) onCreated?.(created)
        }}
      />
    </ResponsiveSheet>
  )
}
