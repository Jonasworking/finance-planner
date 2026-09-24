import { ArrowLeft, PiggyBank, ReceiptText, Wallet } from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { repos } from '@/db'
import { addWeeksISO, formatWeekRange, weekStartOf } from '@/lib/dates'
import type { Cents, ISODate } from '@/lib/types'
import { Money } from '@/shared/components/Money'
import { MoneyInput } from '@/shared/components/MoneyInput'
import { useToday } from '@/shared/hooks/useToday'
import { errorMessage } from '@/shared/lib/errorMessages'
import { cn } from '@/shared/lib/utils'
import { spring } from '@/shared/motion'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'

const STEPS = ['welcome', 'income', 'budget', 'start'] as const
const BUDGET_PRESETS = [30_000, 40_000, 50_000, 60_000]

type TrackingChoice = 'this-week' | 'last-week' | 'custom'

export interface OnboardingDefaults {
  defaultWeeklyIncomeCents: Cents
  totalLimitCents: Cents
}

function Choice({
  selected,
  onClick,
  title,
  hint,
}: {
  selected: boolean
  onClick: () => void
  title: string
  hint: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'flex flex-col rounded-md border px-4 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        selected ? 'border-saved bg-saved-soft' : 'bg-surface-1',
      )}
    >
      <span>{title}</span>
      <span className="text-label text-fg-muted">{hint}</span>
    </button>
  )
}

/** First run: four short steps, saved in ONE transaction at the end (`repos.onboarding`). */
export function OnboardingFlow({ defaults }: { defaults: OnboardingDefaults }) {
  const today = useToday()
  const [stepIndex, setStepIndex] = useState(0)
  const [incomeCents, setIncomeCents] = useState<Cents | null>(defaults.defaultWeeklyIncomeCents)
  const [limitCents, setLimitCents] = useState<Cents | null>(defaults.totalLimitCents)
  const [limitSession, setLimitSession] = useState(0)
  const [openingCents, setOpeningCents] = useState<Cents | null>(0)
  const [tracking, setTracking] = useState<TrackingChoice>('this-week')
  const [customDate, setCustomDate] = useState<ISODate>(today)
  const [busy, setBusy] = useState(false)

  const step = STEPS[stepIndex]!
  const thisWeek = weekStartOf(today)
  const lastWeek = addWeeksISO(thisWeek, -1)
  const trackingSince =
    tracking === 'this-week' ? thisWeek : tracking === 'last-week' ? lastWeek : customDate

  const canContinue =
    step === 'income'
      ? incomeCents !== null
      : step === 'budget'
        ? limitCents !== null
        : openingCents !== null

  const finish = async () => {
    if (incomeCents === null || limitCents === null || openingCents === null) return
    setBusy(true)
    try {
      await repos.onboarding.complete(
        {
          defaultWeeklyIncomeCents: incomeCents,
          totalLimitCents: limitCents,
          openingBalanceCents: openingCents,
          trackingSince,
        },
        today,
      )
    } catch (error) {
      toast.error(errorMessage(error))
      setBusy(false)
    }
  }

  const next = () => (step === 'start' ? void finish() : setStepIndex((index) => index + 1))

  return (
    <div className="grid h-dvh grid-rows-[auto_1fr_auto] bg-bg pt-safe">
      <header className="flex h-14 items-center gap-3 px-4">
        {stepIndex > 0 ? (
          <Button
            variant="ghost"
            size="icon-touch"
            onClick={() => setStepIndex((index) => index - 1)}
            aria-label="Zurück"
          >
            <ArrowLeft aria-hidden />
          </Button>
        ) : (
          <span className="size-11" />
        )}
        <div
          role="progressbar"
          aria-label="Einrichtung"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={stepIndex + 1}
          className="flex flex-1 justify-center gap-1.5"
        >
          {STEPS.map((name, index) => (
            <span
              key={name}
              className={cn(
                'h-1.5 rounded-full transition-all',
                index === stepIndex ? 'w-8 bg-saved' : 'w-1.5 bg-surface-3',
              )}
            />
          ))}
        </div>
        <span className="size-11" />
      </header>

      <main className="overflow-y-auto px-5">
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={spring.soft}
            className="mx-auto flex max-w-md flex-col gap-6 py-6"
          >
            {step === 'welcome' ? (
              <>
                <span className="grid size-16 place-items-center rounded-full border-[5px] border-saved" />
                <div>
                  <h1 className="text-h1">Willkommen beim Finanzplaner</h1>
                  <p className="pt-2 text-fg-muted">
                    Woche für Woche: ausgeben, abschließen, sparen. Alles bleibt auf diesem Gerät.
                  </p>
                </div>
                <ul className="flex flex-col gap-4">
                  {[
                    {
                      icon: ReceiptText,
                      title: 'Ausgaben in drei Taps',
                      text: 'Betrag, Kategorie, speichern.',
                    },
                    {
                      icon: Wallet,
                      title: 'Woche abschließen',
                      text: 'Du trägst ein, was du verdient hast.',
                    },
                    {
                      icon: PiggyBank,
                      title: 'Der Rest ist gespart',
                      text: 'Einkommen − Ausgaben landet in „Nur gespart".',
                    },
                  ].map(({ icon: Icon, title, text }) => (
                    <li key={title} className="flex items-center gap-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-md bg-saved-soft text-saved">
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <span>
                        <span className="block">{title}</span>
                        <span className="block text-label text-fg-muted">{text}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {step === 'income' ? (
              <>
                <div>
                  <h1 className="text-h1">Was verdienst du pro Woche?</h1>
                  <p className="pt-2 text-fg-muted">
                    Netto, ungefähr. Der Betrag wird beim Wochenabschluss nur vorgeschlagen – du
                    kannst ihn jede Woche anpassen.
                  </p>
                </div>
                <MoneyInput
                  defaultValue={incomeCents}
                  onValueChange={setIncomeCents}
                  aria-label="Einkommen pro Woche"
                  size="lg"
                  autoFocus
                />
              </>
            ) : null}

            {step === 'budget' ? (
              <>
                <div>
                  <h1 className="text-h1">Wie viel willst du pro Woche höchstens ausgeben?</h1>
                  <p className="pt-2 text-fg-muted">
                    Dein Wochenbudget für alles – Miete, Essen, Freizeit.
                  </p>
                </div>
                <MoneyInput
                  key={limitSession}
                  defaultValue={limitCents}
                  onValueChange={setLimitCents}
                  aria-label="Wochenbudget"
                  size="lg"
                />
                <div className="flex flex-wrap gap-2">
                  {BUDGET_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      aria-pressed={limitCents === preset}
                      onClick={() => {
                        setLimitCents(preset)
                        setLimitSession((session) => session + 1) // remount the field with the preset
                      }}
                      className={cn(
                        'h-10 rounded-full border px-4 tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                        limitCents === preset
                          ? 'border-transparent bg-saved text-on-saved'
                          : 'text-fg-muted',
                      )}
                    >
                      <Money cents={preset} decimals={false} />
                    </button>
                  ))}
                </div>
                {incomeCents !== null && limitCents !== null ? (
                  <p className="rounded-md bg-saved-soft p-4 text-saved">
                    So bleiben dir etwa{' '}
                    <Money
                      cents={Math.max(0, incomeCents - limitCents)}
                      decimals={false}
                      className="font-semibold"
                    />{' '}
                    pro Woche zum Sparen.
                  </p>
                ) : null}
              </>
            ) : null}

            {step === 'start' ? (
              <>
                <div>
                  <h1 className="text-h1">Wo startest du?</h1>
                  <p className="pt-2 text-fg-muted">
                    Was du schon gespart hast, kommt als Startguthaben in „Nur gespart". Leer lassen
                    heißt: bei 0 beginnen.
                  </p>
                </div>
                <MoneyInput
                  defaultValue={openingCents === 0 ? null : openingCents}
                  onValueChange={(cents) => setOpeningCents(cents ?? 0)}
                  aria-label="Startguthaben"
                  size="lg"
                />
                <fieldset className="flex flex-col gap-2">
                  <legend className="pb-2 text-caption text-fg-subtle uppercase">
                    Ab wann zählen wir?
                  </legend>
                  <div
                    role="radiogroup"
                    aria-label="Tracking-Beginn"
                    className="flex flex-col gap-2"
                  >
                    <Choice
                      selected={tracking === 'this-week'}
                      onClick={() => setTracking('this-week')}
                      title="Ab dieser Woche"
                      hint={formatWeekRange(thisWeek)}
                    />
                    <Choice
                      selected={tracking === 'last-week'}
                      onClick={() => setTracking('last-week')}
                      title="Ab letzter Woche"
                      hint={`${formatWeekRange(lastWeek)} · wartet dann auf ihren Abschluss`}
                    />
                    <Choice
                      selected={tracking === 'custom'}
                      onClick={() => setTracking('custom')}
                      title="Eigenes Datum"
                      hint="Alle beendeten Wochen seitdem kannst du nachträglich abschließen."
                    />
                  </div>
                  {tracking === 'custom' ? (
                    <Input
                      type="date"
                      value={customDate}
                      max={today}
                      onChange={(event) =>
                        event.target.value !== '' && setCustomDate(event.target.value)
                      }
                      aria-label="Tracking-Beginn"
                      className="h-11 rounded-md"
                    />
                  ) : null}
                </fieldset>
              </>
            ) : null}
          </m.div>
        </AnimatePresence>
      </main>

      <footer className="mx-auto w-full max-w-md px-5 pt-3 pb-safe-4">
        <Button
          size="touch"
          className="w-full"
          disabled={(step !== 'welcome' && !canContinue) || busy}
          onClick={next}
        >
          {step === 'welcome' ? 'Los geht’s' : step === 'start' ? 'Fertig' : 'Weiter'}
        </Button>
      </footer>
    </div>
  )
}
