import {
  ChartColumn,
  FlaskConical,
  Gauge,
  House,
  ListChecks,
  PiggyBank,
  ReceiptText,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Match the path exactly (needed for "/"). */
  end?: boolean
  description?: string
}

/** Bottom tabs on mobile (split around the "+" button) and first sidebar group on desktop. */
export const primaryNav: NavItem[] = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/expenses', label: 'Ausgaben', icon: ReceiptText },
  { to: '/pots', label: 'Töpfe', icon: PiggyBank },
  { to: '/analytics', label: 'Analyse', icon: ChartColumn },
]

/** "Mehr" page on mobile, second sidebar group on desktop. */
export const secondaryNav: NavItem[] = [
  { to: '/budget', label: 'Budget', icon: Gauge, description: 'Wochenlimit und Kategorien' },
  { to: '/tasks', label: 'Tasks', icon: ListChecks, description: 'Finanz-To-dos mit Fälligkeit' },
  {
    to: '/what-if',
    label: 'Was-wäre-wenn',
    icon: FlaskConical,
    description: 'Sparszenarien durchrechnen',
  },
  {
    to: '/settings',
    label: 'Einstellungen',
    icon: Settings,
    description: 'Theme, EUR-Kurs, Daten',
  },
]
