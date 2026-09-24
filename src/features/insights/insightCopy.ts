import {
  CalendarCheck,
  Euro,
  Flame,
  Gauge,
  HardDriveDownload,
  PiggyBank,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { formatDayLabel } from '@/lib/dates'
import type { Insight } from '@/lib/insights'
import { formatAUD, formatPercent } from '@/lib/money'
import type { Category, ISODate, Pot } from '@/lib/types'
import { potPath } from '@/shared/lib/routes'

export type InsightAction = { label: string; to: string } | { label: string; run: 'eur-rate' }

export interface InsightCopy {
  title: string
  text: string
  icon: LucideIcon
  /** A category's or pot's own tile (icon name + color token) instead of the generic icon. */
  chip?: { icon: string; color: string }
  action?: InsightAction
}

export interface InsightRefs {
  categories: readonly Category[]
  pots: readonly Pot[]
  today: ISODate
}

const weeks = (count: number) => (count === 1 ? '1 Woche' : `${count} Wochen`)
/** "vor 3 Tagen" (dative) vs. "3 Tage alt" (nominative). */
const daysAgo = (count: number) => (count === 1 ? '1 Tag' : `${count} Tagen`)
const daysOld = (count: number) => (count === 1 ? '1 Tag' : `${count} Tage`)
const whole = (cents: number) => formatAUD(cents, { decimals: false })

/** German copy for a structured insight. Every `kind` is covered – TypeScript insists. */
export function describeInsight(insight: Insight, refs: InsightRefs): InsightCopy {
  switch (insight.kind) {
    case 'budget-over':
      return {
        icon: Gauge,
        title: `${formatAUD(insight.overCents)} über dem Budget`,
        text: 'Diese Woche liegst du über deinem Wochenlimit. Schau, was noch ansteht – oder pass das Budget an.',
        action: { label: 'Budget', to: '/budget' },
      }
    case 'budget-warn':
      return {
        icon: Gauge,
        title: `Budget zu ${formatPercent(insight.ratio)} verbraucht`,
        text: `Noch ${formatAUD(insight.remainingCents)} bis zum Wochenlimit.`,
        action: { label: 'Budget', to: '/budget' },
      }
    case 'pending-weeks':
      return {
        icon: CalendarCheck,
        title:
          insight.count === 1
            ? 'Eine Woche wartet auf ihren Abschluss'
            : `${insight.count} Wochen warten auf ihren Abschluss`,
        // No full stop: the day label already ends in an abbreviation ("Sep.").
        text: `Die älteste beginnt am ${formatDayLabel(insight.oldest, refs.today)}`,
        action: { label: 'Home', to: '/' },
      }
    case 'category-over-average': {
      const category = refs.categories.find((row) => row.id === insight.categoryId)
      return {
        icon: TrendingUp,
        chip: category ? { icon: category.icon, color: category.color } : undefined,
        title: `${category?.name ?? 'Eine Kategorie'} über deinem Schnitt`,
        text: `${whole(insight.currentCents)} diese Woche statt sonst Ø ${whole(insight.averageCents)} – ${formatPercent(insight.overRatio, { signed: true })} mehr als üblich.`,
        action: { label: 'Analyse', to: '/analytics' },
      }
    }
    case 'pot-ahead': {
      const pot = refs.pots.find((row) => row.id === insight.potId)
      return {
        icon: PiggyBank,
        chip: pot ? { icon: pot.icon, color: pot.color } : undefined,
        title: `„${pot?.name ?? 'Topf'}" liegt ${weeks(insight.weeks)} vor dem Plan`,
        text: 'Bei deinem Tempo erreichst du das Ziel vor der Deadline.',
        action: { label: 'Zum Topf', to: potPath(insight.potId) },
      }
    }
    case 'pot-behind': {
      const pot = refs.pots.find((row) => row.id === insight.potId)
      const name = pot?.name ?? 'Topf'
      return {
        icon: PiggyBank,
        chip: pot ? { icon: pot.icon, color: pot.color } : undefined,
        title:
          insight.weeks === null
            ? `„${name}" kommt so nicht ans Ziel`
            : `„${name}" hinkt ${weeks(insight.weeks)} hinterher`,
        text:
          insight.requiredWeeklyCents !== null
            ? `Bis zur Deadline bräuchtest du ${whole(insight.requiredWeeklyCents)} pro Woche.`
            : 'Bei deinem Tempo reicht es nicht bis zur Deadline.',
        action: { label: 'Zum Topf', to: potPath(insight.potId) },
      }
    }
    case 'streak-milestone':
      return {
        icon: Flame,
        title: `${insight.weeks} Wochen im Budget – stark!`,
        text: 'Deine Serie hält. Jede weitere Woche im Budget verlängert sie.',
      }
    case 'savings-rate':
      return {
        icon: insight.direction === 'up' ? TrendingUp : TrendingDown,
        title:
          insight.direction === 'up'
            ? `Sparquote gestiegen: ${formatPercent(insight.rate)}`
            : `Sparquote gesunken: ${formatPercent(insight.rate)}`,
        text: `Letzte Woche ${formatPercent(insight.rate)} statt sonst Ø ${formatPercent(insight.averageRate)}.`,
        action: { label: 'Analyse', to: '/analytics' },
      }
    case 'backup-stale':
      return {
        icon: HardDriveDownload,
        title:
          insight.days === null
            ? 'Noch kein Backup'
            : `Letztes Backup vor ${daysAgo(insight.days)}`,
        text: 'Deine Daten liegen nur auf diesem Gerät – sichere sie als Datei.',
        action: { label: 'Backup speichern', to: '/settings#backup' },
      }
    case 'eur-rate-stale':
      return {
        icon: Euro,
        title: `EUR-Kurs ist ${daysOld(insight.days)} alt`,
        text: 'Prüf den Kurs, damit deine €-Beträge stimmen.',
        action: { label: 'Kurs prüfen', run: 'eur-rate' },
      }
  }
}
