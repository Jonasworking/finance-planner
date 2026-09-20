import { CalendarCheck, CircleCheck, Plus, Repeat, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import type { NextStep } from '@/lib/dashboard'
import { formatDayLabel, formatWeekRange } from '@/lib/dates'
import type { ISODate } from '@/lib/types'
import { GlassCard } from '@/shared/components/GlassCard'
import { cn } from '@/shared/lib/utils'
import { useUiStore } from '@/shared/stores/uiStore'
import { Button } from '@/shared/ui/button'

interface Copy {
  icon: LucideIcon
  title: string
  text: string
  calm?: boolean
}

function copyFor(step: NextStep, today: ISODate): Copy {
  switch (step.kind) {
    case 'close-pending':
      return {
        icon: CalendarCheck,
        title:
          step.count === 1
            ? 'Eine Woche wartet auf ihren Abschluss'
            : `${step.count} Wochen warten auf ihren Abschluss`,
        text: 'Trag ein, was du verdient hast – was übrig bleibt, wandert in „Nur gespart".',
      }
    case 'first-expense':
      return {
        icon: Plus,
        title: 'Erfasse deine erste Ausgabe',
        text: 'Betrag, Kategorie, speichern – drei Taps. Ab dann siehst du hier, was von deinem Budget übrig ist.',
      }
    case 'close-current':
      return {
        icon: CalendarCheck,
        title: 'Die Woche ist fast vorbei',
        text: 'Schließ sie ab, sobald du weißt, was du verdient hast. Ausgaben kannst du auch danach noch nachtragen.',
      }
    case 'add-recurring':
      return {
        icon: Repeat,
        title: 'Miete automatisch buchen',
        text: 'Als Dauerauftrag landet sie von selbst in den Ausgaben und ist im Restbudget schon eingeplant.',
      }
    case 'all-set':
      return {
        icon: CircleCheck,
        title: 'Alles erledigt',
        text: `Nächster Wochenabschluss: ${formatDayLabel(step.nextCloseOn, today)}`,
        calm: true,
      }
  }
}

/** Exactly one next step – the home screen always says what to do now. */
export function NextStepCard({ step, today }: { step: NextStep; today: ISODate }) {
  const setQuickAddOpen = useUiStore((state) => state.setQuickAddOpen)
  const openCloseWeek = useUiStore((state) => state.openCloseWeek)
  const { icon: Icon, title, text, calm } = copyFor(step, today)

  return (
    <GlassCard className={cn('flex flex-col gap-4', !calm && 'border-saved/40')}>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'grid size-11 shrink-0 place-items-center rounded-md',
            calm ? 'bg-surface-3 text-fg-muted' : 'bg-saved-soft text-saved',
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-caption text-fg-subtle uppercase">Nächster Schritt</p>
          <p className="text-h2">{title}</p>
          <p className="pt-1 text-label text-fg-muted">{text}</p>
        </div>
      </div>

      {step.kind === 'close-pending' ? (
        <Button size="touch" onClick={() => openCloseWeek(step.oldest)}>
          Woche {formatWeekRange(step.oldest)} abschließen
        </Button>
      ) : null}
      {step.kind === 'first-expense' ? (
        <Button size="touch" onClick={() => setQuickAddOpen(true)}>
          <Plus aria-hidden />
          Ausgabe erfassen
        </Button>
      ) : null}
      {step.kind === 'close-current' ? (
        <Button size="touch" onClick={() => openCloseWeek(step.weekStart)}>
          Diese Woche abschließen
        </Button>
      ) : null}
      {step.kind === 'add-recurring' ? (
        <Button size="touch" variant="secondary" asChild>
          <Link to="/recurring">Dauerauftrag anlegen</Link>
        </Button>
      ) : null}
    </GlassCard>
  )
}
